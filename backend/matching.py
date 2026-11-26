import re
from typing import List, Dict, Any, Optional, Tuple
from rapidfuzz import fuzz
from sqlalchemy.orm import Session
from backend.models import Outlet, OutletAlias, OutletMappingHistory

# Common business suffixes and franchise noise words to de-emphasize in core location matching
NOISE_WORDS = {
    "enterprise", "enterprises", "foods", "food", "tastify", "outlet", "store",
    "branch", "franchise", "pvt", "ltd", "limited", "llp", "the", "and", "co",
    "trading", "traders", "services", "corporation", "cafe", "restaurant"
}

LOCATION_SYNONYMS = {
    "nanapura": "nanpura",
    "lp savani": "l p savani",
    "l.p. savani": "l p savani",
    "lpsavani": "l p savani",
    "mota varachha": "motavaraccha",
    "mota varachha": "motavaraccha",
    "motavarachha": "motavaraccha",
    "mota varaccha": "motavaraccha",
    "baben bardoli": "bardoli",
    "citylight": "city light",
    "fatehganj": "fatehgunj",
}


def normalize_text(text: Optional[str]) -> str:
    """
    Standardize outlet text:
    - remove special characters, codes like OUT-012, MF-001
    - lower case
    - collapse whitespace
    """
    if not text:
        return ""

    s = str(text)

    # Replace newlines with spaces
    s = s.replace("\n", " ").replace("\r", " ")

    # Remove code patterns like (OUT-012), OUT-012, MF-001, NO_MF
    s = re.sub(r"\b(OUT-\d+|MF-\d+|NO_MF)\b", " ", s, flags=re.IGNORECASE)

    # Remove parentheses and brackets
    s = re.sub(r"[()\[\]{}]", " ", s)

    # Replace hyphens, dashes, slashes, dots with spaces
    s = re.sub(r"[-_/.,|:;+]", " ", s)

    # Lowercase
    s = s.lower().strip()

    # Collapse whitespace
    words = [w for w in s.split() if w]
    cleaned = " ".join(words)

    # Check for known synonyms
    for k, v in LOCATION_SYNONYMS.items():
        if k in cleaned:
            cleaned = cleaned.replace(k, v)

    return cleaned


def extract_core_location(text: str) -> str:
    """
    Extract the most salient location token(s) by stripping noise words.
    e.g. 'VAIBHAV LAXMI ENTERPRISE ADAJAN' -> 'adajan'
    '(ADAJAN) -VAIBHAV LAXMI ENTERPRISE' -> 'adajan'
    """
    norm = normalize_text(text)
    tokens = norm.split()
    meaningful = [t for t in tokens if t not in NOISE_WORDS and len(t) > 1]
    return " ".join(meaningful) if meaningful else norm


def extract_outlet_code(raw_name: str) -> Optional[str]:
    """
    Check if the raw string contains a known code like OUT-012, MF-001, etc.
    """
    match = re.search(r"\b(OUT-\d+|MF-\d+)\b", raw_name, flags=re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return None


class OutletMatcher:
    def __init__(self, db: Session):
        self.db = db
        self.reload_cache()

    def reload_cache(self):
        """Load outlets and confirmed aliases into in-memory lookup structures."""
        self.outlets = self.db.query(Outlet).filter(Outlet.is_active == True).all()
        self.aliases = self.db.query(OutletAlias).filter(OutletAlias.is_confirmed == True).all()

        # Build fast exact-lookup dictionaries
        self.exact_name_map: Dict[str, Outlet] = {}
        self.code_map: Dict[str, Outlet] = {}
        self.alias_map: Dict[str, Outlet] = {}
        self.outlet_by_id: Dict[int, Outlet] = {o.id: o for o in self.outlets}

        for o in self.outlets:
            norm = normalize_text(o.official_name)
            self.exact_name_map[norm] = o
            core = extract_core_location(o.official_name)
            if core:
                self.exact_name_map[core] = o

            if o.code:
                self.code_map[o.code.upper().strip()] = o

        for a in self.aliases:
            norm_alias = a.normalized_alias or normalize_text(a.raw_alias)
            parent = self.outlet_by_id.get(a.outlet_id)
            if parent:
                self.alias_map[norm_alias] = parent
                core_alias = extract_core_location(a.raw_alias)
                if core_alias:
                    self.alias_map[core_alias] = parent

    def match_outlet(self, raw_name: str) -> Dict[str, Any]:
        """
        Intelligently matches a raw outlet string to an existing outlet.
        Returns:
            {
                "raw_name": str,
                "matched_outlet_id": Optional[int],
                "matched_outlet_name": Optional[str],
                "confidence": float (0-100),
                "is_auto_matched": bool,
                "needs_confirmation": bool,
                "reason": str,
                "candidates": List[Dict]
            }
        """
        if not raw_name or not raw_name.strip():
            return {
                "raw_name": raw_name or "",
                "matched_outlet_id": None,
                "matched_outlet_name": None,
                "confidence": 0.0,
                "is_auto_matched": False,
                "needs_confirmation": True,
                "reason": "Empty outlet name",
                "candidates": []
            }

        raw_trimmed = raw_name.strip()
        norm = normalize_text(raw_trimmed)
        core = extract_core_location(raw_trimmed)
        code = extract_outlet_code(raw_trimmed)

        # 1. Check code match (e.g. OUT-012, MF-001)
        if code and code in self.code_map:
            matched = self.code_map[code]
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": matched.id,
                "matched_outlet_name": matched.official_name,
                "confidence": 100.0,
                "is_auto_matched": True,
                "needs_confirmation": False,
                "reason": f"Exact outlet code match ({code})",
                "candidates": [{"id": matched.id, "name": matched.official_name, "score": 100.0}]
            }

        # 2. Check confirmed aliases
        if norm in self.alias_map:
            matched = self.alias_map[norm]
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": matched.id,
                "matched_outlet_name": matched.official_name,
                "confidence": 100.0,
                "is_auto_matched": True,
                "needs_confirmation": False,
                "reason": "Exact confirmed alias match",
                "candidates": [{"id": matched.id, "name": matched.official_name, "score": 100.0}]
            }

        # 3. Check exact official name or core name
        if norm in self.exact_name_map:
            matched = self.exact_name_map[norm]
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": matched.id,
                "matched_outlet_name": matched.official_name,
                "confidence": 100.0,
                "is_auto_matched": True,
                "needs_confirmation": False,
                "reason": "Exact official name match",
                "candidates": [{"id": matched.id, "name": matched.official_name, "score": 100.0}]
            }

        if core and core in self.exact_name_map:
            matched = self.exact_name_map[core]
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": matched.id,
                "matched_outlet_name": matched.official_name,
                "confidence": 98.0,
                "is_auto_matched": True,
                "needs_confirmation": False,
                "reason": f"Core location match ({core})",
                "candidates": [{"id": matched.id, "name": matched.official_name, "score": 98.0}]
            }

        if core and core in self.alias_map:
            matched = self.alias_map[core]
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": matched.id,
                "matched_outlet_name": matched.official_name,
                "confidence": 96.0,
                "is_auto_matched": True,
                "needs_confirmation": False,
                "reason": f"Core location matched alias ({core})",
                "candidates": [{"id": matched.id, "name": matched.official_name, "score": 96.0}]
            }

        # 4. Fuzzy Matching against all existing outlets
        candidates = []
        for o in self.outlets:
            target_norm = normalize_text(o.official_name)
            target_core = extract_core_location(o.official_name)

            # Calculate multiple fuzzy metrics
            token_sort = fuzz.token_sort_ratio(norm, target_norm)
            token_set = fuzz.token_set_ratio(norm, target_norm)
            partial = fuzz.partial_ratio(norm, target_norm)

            core_token_sort = fuzz.token_sort_ratio(core, target_core) if (core and target_core) else 0

            # Weighted combined score
            best_score = max(token_set, token_sort, core_token_sort, (token_sort * 0.6 + partial * 0.4))

            # Also check against aliases of this outlet
            for a in o.aliases:
                if a.is_confirmed:
                    a_norm = a.normalized_alias or normalize_text(a.raw_alias)
                    a_score = max(
                        fuzz.token_set_ratio(norm, a_norm),
                        fuzz.token_sort_ratio(norm, a_norm)
                    )
                    if a_score > best_score:
                        best_score = a_score

            candidates.append({
                "id": o.id,
                "name": o.official_name,
                "code": o.code,
                "score": round(float(best_score), 1)
            })

        # Sort candidates descending by score
        candidates.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = candidates[:5]

        if not top_candidates or top_candidates[0]["score"] < 50.0:
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": None,
                "matched_outlet_name": None,
                "confidence": 0.0,
                "is_auto_matched": False,
                "needs_confirmation": True,
                "reason": "No strong candidate found (Unrecognized Outlet)",
                "candidates": top_candidates
            }

        top = top_candidates[0]
        score = top["score"]

        # High confidence threshold: >= 95%
        if score >= 95.0:
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": top["id"],
                "matched_outlet_name": top["name"],
                "confidence": score,
                "is_auto_matched": True,
                "needs_confirmation": False,
                "reason": f"High fuzzy match ({score}%)",
                "candidates": top_candidates
            }
        elif score >= 65.0:
            # Uncertain match: Needs confirmation as per user rule!
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": top["id"],
                "matched_outlet_name": top["name"],
                "confidence": score,
                "is_auto_matched": False,
                "needs_confirmation": True,
                "reason": f"Potential match ({score}%): requires confirmation",
                "candidates": top_candidates
            }
        else:
            return {
                "raw_name": raw_trimmed,
                "matched_outlet_id": None,
                "matched_outlet_name": None,
                "confidence": score,
                "is_auto_matched": False,
                "needs_confirmation": True,
                "reason": f"Low match ({score}%): review suggested",
                "candidates": top_candidates
            }

    def confirm_and_save_alias(
        self,
        raw_alias: str,
        outlet_id: int,
        source_file: Optional[str] = None,
        action: str = "user_confirmed"
    ) -> OutletAlias:
        """
        Permanently associates raw_alias with outlet_id, saving to outlet_aliases and recording history.
        """
        norm = normalize_text(raw_alias)
        existing = (
            self.db.query(OutletAlias)
            .filter(
                OutletAlias.outlet_id == outlet_id,
                OutletAlias.normalized_alias == norm
            )
            .first()
        )

        prev_id = existing.outlet_id if existing else None

        if not existing:
            alias = OutletAlias(
                outlet_id=outlet_id,
                raw_alias=raw_alias.strip(),
                normalized_alias=norm,
                source_file=source_file,
                is_confirmed=True,
                confidence=1.0
            )
            self.db.add(alias)
        else:
            existing.is_confirmed = True
            existing.confidence = 1.0
            alias = existing

        # Record history
        history = OutletMappingHistory(
            raw_alias=raw_alias.strip(),
            previous_outlet_id=prev_id,
            new_outlet_id=outlet_id,
            action=action,
            notes=f"Confirmed mapping of '{raw_alias}' to outlet #{outlet_id}"
        )
        self.db.add(history)
        self.db.commit()
        self.db.refresh(alias)

        # Refresh in-memory cache
        self.reload_cache()
        return alias

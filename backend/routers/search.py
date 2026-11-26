from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from rapidfuzz import fuzz
from backend.database import get_db
from backend.models import Outlet, OutletAlias
from backend.schemas import OutletSearchResult
from backend.matching import normalize_text

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("/outlets", response_model=List[OutletSearchResult])
def search_outlets(
    q: str = Query(..., min_length=1, description="Query string for outlet search"),
    limit: int = 15,
    db: Session = Depends(get_db)
):
    """
    Intelligent autocomplete search matching official outlet name, code, city,
    and all registered aliases using both substring and RapidFuzz fuzzy scoring.
    """
    clean_q = q.strip().lower()
    norm_q = normalize_text(q)

    outlets = db.query(Outlet).filter(Outlet.is_active == True).all()
    results = []

    for o in outlets:
        aliases_list = [a.raw_alias for a in o.aliases]
        official_lower = o.official_name.lower()
        code_lower = (o.code or "").lower()
        city_lower = (o.city or "").lower()

        # Score calculation
        best_score = 0.0

        # Exact substring matches get high priority
        if clean_q == official_lower:
            best_score = 100.0
        elif clean_q == code_lower:
            best_score = 100.0
        elif clean_q in official_lower:
            best_score = 95.0
        elif clean_q in code_lower or (city_lower and clean_q in city_lower):
            best_score = 90.0
        else:
            # Check aliases
            for alias in aliases_list:
                alias_lower = alias.lower()
                if clean_q == alias_lower:
                    best_score = max(best_score, 98.0)
                elif clean_q in alias_lower:
                    best_score = max(best_score, 92.0)

        # Fuzzy check if score is not already maximum
        if best_score < 90.0:
            fuzz_official = max(
                fuzz.token_sort_ratio(norm_q, o.normalized_name),
                fuzz.partial_ratio(norm_q, o.normalized_name)
            )
            best_score = max(best_score, fuzz_official)

            for alias in aliases_list:
                norm_a = normalize_text(alias)
                fuzz_a = max(
                    fuzz.token_sort_ratio(norm_q, norm_a),
                    fuzz.partial_ratio(norm_q, norm_a)
                )
                best_score = max(best_score, fuzz_a)

        if best_score >= 50.0:
            results.append({
                "id": o.id,
                "official_name": o.official_name,
                "code": o.code,
                "city": o.city,
                "aliases": aliases_list[:5],
                "match_score": round(best_score, 1)
            })

    # Sort descending by match score
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return [OutletSearchResult(**r) for r in results[:limit]]

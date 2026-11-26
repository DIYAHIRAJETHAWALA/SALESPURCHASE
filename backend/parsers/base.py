from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import re
from datetime import datetime


@dataclass
class ParsedRecord:
    outlet_raw: str
    item_raw: str
    item_code: Optional[str] = None
    quantity: float = 0.0
    unit_price: Optional[float] = None
    amount: float = 0.0
    transaction_date: Optional[str] = None
    source_row_idx: Optional[int] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedReport:
    report_type: str  # 'sales' or 'purchase'
    parser_name: str
    filename: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    sheet_name: Optional[str] = None
    outlets_found: List[str] = field(default_factory=list)
    items_found: List[str] = field(default_factory=list)
    records: List[ParsedRecord] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    total_quantity: float = 0.0
    total_amount: float = 0.0


def clean_num(val: Any) -> float:
    """Safely convert text or numeric value to float."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "")
    if not s or s.lower() in ("-", "none", "null", "nan", "na", "n/a"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date_string(text: str) -> Optional[str]:
    """Extract standard date format YYYY-MM-DD or DD-MM-YYYY."""
    if not text:
        return None
    # Look for DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
    m = re.search(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b", text)
    if m:
        d, mth, y = m.groups()
        return f"{y}-{mth.zfill(2)}-{d.zfill(2)}"
    m2 = re.search(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b", text)
    if m2:
        y, mth, d = m2.groups()
        return f"{y}-{mth.zfill(2)}-{d.zfill(2)}"
    return None


def extract_date_range_from_text(text: str) -> (Optional[str], Optional[str]):
    """
    Search for patterns like:
    - '01-11-2026 || Report End Date : 07-11-2026'
    - '(01/11/2026 - 07/11/2026)'
    - 'From-01-11-2026-to-07-11-2026'
    """
    if not text:
        return None, None

    dates = []
    for m in re.finditer(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b", text):
        d, mth, y = m.groups()
        dates.append(f"{y}-{mth.zfill(2)}-{d.zfill(2)}")

    if len(dates) >= 2:
        return dates[0], dates[1]
    elif len(dates) == 1:
        return dates[0], dates[0]
    return None, None

import os
import hashlib
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db, DB_PATH, Base, engine
from backend.models import (
    Outlet, OutletAlias, Item, ImportBatch,
    SalesRecord, PurchaseRecord, ImportErrorLog, OutletMappingHistory
)
from backend.parsers.manager import ParserManager
from backend.matching import OutletMatcher, normalize_text

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/stats")
def get_system_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    db_size_bytes = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0

    return {
        "database_size_bytes": db_size_bytes,
        "database_size_mb": round(db_size_bytes / (1024 * 1024), 2),
        "total_outlets": db.query(Outlet).count(),
        "active_outlets": db.query(Outlet).filter(Outlet.is_active == True).count(),
        "total_aliases": db.query(OutletAlias).count(),
        "total_items": db.query(Item).count(),
        "total_import_batches": db.query(ImportBatch).count(),
        "total_sales_records": db.query(SalesRecord).count(),
        "total_purchase_records": db.query(PurchaseRecord).count(),
    }


@router.post("/reset-data")
def reset_database(db: Session = Depends(get_db)):
    """Wipes all transactional data and outlets for clean slate."""
    db.query(SalesRecord).delete()
    db.query(PurchaseRecord).delete()
    db.query(ImportErrorLog).delete()
    db.query(ImportBatch).delete()
    db.query(OutletAlias).delete()
    db.query(OutletMappingHistory).delete()
    db.query(Outlet).delete()
    db.query(Item).delete()
    db.commit()

    return {"success": True, "message": "All database records have been cleanly reset."}


@router.post("/seed-samples")
def seed_samples(db: Session = Depends(get_db)):
    """
    Auto-loads the provided sample reports from sample_data/ into the system:
    1. Location Wise Item Sales Report 20-11-2026 16_42.csv (Sales)
    2. order-report-From-01-11-2026-to-07-11-2026.xlsx (Sales)
    3. Realistic Purchase Report for the same outlets and items so comparison analytics work immediately.
    """
    from backend.routers.imports import commit_import
    from backend.schemas import ImportCommitRequest, CommitMapping

    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "sample_data")
    csv_file = os.path.join(sample_dir, "Location Wise Item Sales Report 20-11-2026 16_42.csv")
    xlsx_file = os.path.join(sample_dir, "order-report-From-01-11-2026-to-07-11-2026.xlsx")

    results = []

    # 1. Load CSV Sales Report if file exists
    if os.path.exists(csv_file):
        with open(csv_file, "rb") as f:
            content = f.read()
        f_hash = hashlib.sha256(content).hexdigest()

        # Parse preview
        from backend.routers.imports import PREVIEW_CACHE
        rep = ParserManager.parse(content, os.path.basename(csv_file), report_type="sales")
        PREVIEW_CACHE[f_hash] = {
            "bytes": content,
            "filename": os.path.basename(csv_file),
            "report_type": "sales",
            "report": rep
        }

        # Auto-create initial outlets from the CSV headers
        matcher = OutletMatcher(db)
        confirmed = []
        for raw in rep.outlets_found:
            clean_name = raw.strip()
            # If formatted like (ADAJAN) -VAIBHAV LAXMI ENTERPRISE -> Official: "ADAJAN - VAIBHAV LAXMI ENTERPRISE"
            confirmed.append(CommitMapping(
                raw_name=raw,
                create_new=True,
                new_outlet_name=clean_name.replace("(", "").replace(")", "").strip(),
                new_outlet_city=clean_name.split(")")[0].replace("(", "").strip() if "(" in clean_name else "Surat"
            ))

        req = ImportCommitRequest(
            file_hash=f_hash,
            report_type="sales",
            filename=os.path.basename(csv_file),
            mode="replace",
            confirmed_mappings=confirmed
        )
        res = commit_import(req, db)
        results.append(f"Imported CSV Sales: {res.total_imported} records into {res.batch_id}")

    # 2. Load XLSX Order/Sales Report if exists
    if os.path.exists(xlsx_file):
        with open(xlsx_file, "rb") as f:
            content = f.read()
        f_hash = hashlib.sha256(content).hexdigest()

        rep = ParserManager.parse(content, os.path.basename(xlsx_file), report_type="sales")
        from backend.routers.imports import PREVIEW_CACHE
        PREVIEW_CACHE[f_hash] = {
            "bytes": content,
            "filename": os.path.basename(xlsx_file),
            "report_type": "sales",
            "report": rep
        }

        req = ImportCommitRequest(
            file_hash=f_hash,
            report_type="sales",
            filename=os.path.basename(xlsx_file),
            mode="replace",
            confirmed_mappings=[]
        )
        res = commit_import(req, db)
        results.append(f"Imported XLSX Sales: {res.total_imported} records into {res.batch_id}")

    # 3. Generate a realistic Purchase batch matching the outlets & items
    # so that comparison, variance, items purchased but not sold, and items sold but not purchased can be immediately tested!
    outlets = db.query(Outlet).filter(Outlet.is_active == True).all()
    items = db.query(Item).all()

    if outlets and items:
        import uuid
        p_batch_id = f"BATCH-PURCHASE-SEED-{uuid.uuid4().hex[:4].upper()}"
        p_batch = ImportBatch(
            batch_id=p_batch_id,
            report_type="purchase",
            filename="Franchise_Master_Purchase_Nov2026.xlsx",
            file_hash="sample_seed_purchase_hash",
            parser_used="Standard Purchase Importer",
            start_date="2026-11-01",
            end_date="2026-11-07",
            status="completed"
        )
        db.add(p_batch)
        db.commit()
        db.refresh(p_batch)

        purchases = []
        tot_q = 0.0
        tot_a = 0.0

        # For a subset of items and outlets, create purchase records
        import random
        random.seed(42)  # reproducible

        for o in outlets[:15]:
            # Each outlet purchases 10 to 20 items
            sample_items = random.sample(items, min(len(items), 15))
            for itm in sample_items:
                # Purchase quantity roughly 80% to 120% of expected sales or standard batch
                qty = float(random.randint(15, 250))
                price = itm.standard_price or float(random.choice([25, 30, 35, 45, 60, 100, 150]))
                amt = round(qty * price, 2)
                tot_q += qty
                tot_a += amt

                p_rec = PurchaseRecord(
                    batch_id=p_batch.id,
                    outlet_id=o.id,
                    raw_outlet_name=o.official_name,
                    item_id=itm.id,
                    raw_item_name=itm.name,
                    item_code=itm.code,
                    quantity=qty,
                    unit_price=price,
                    amount=amt,
                    transaction_date="2026-11-01",
                    source_row_idx=1
                )
                purchases.append(p_rec)

        db.bulk_save_objects(purchases)
        p_batch.total_records = len(purchases)
        p_batch.total_quantity = round(tot_q, 2)
        p_batch.total_amount = round(tot_a, 2)
        db.commit()

        results.append(f"Generated Purchase dataset: {len(purchases)} records into {p_batch.batch_id}")

    return {"success": True, "results": results}

import hashlib
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import (
    ImportBatch, SalesRecord, PurchaseRecord,
    Item, Outlet, OutletAlias, ImportErrorLog, OutletMappingHistory
)
from backend.schemas import (
    PreviewResponse, PreviewRecord, OutletMatchPrediction,
    OutletCandidate, ImportCommitRequest, ImportCommitResponse,
    ImportBatchResponse
)
from backend.parsers.manager import ParserManager
from backend.matching import OutletMatcher, normalize_text

router = APIRouter(prefix="/api/imports", tags=["Imports"])

# In-memory preview cache: hash -> {bytes, report, filename, report_type}
# Used to commit without re-uploading
PREVIEW_CACHE: Dict[str, Dict] = {}


@router.post("/preview", response_model=PreviewResponse)
async def preview_file(
    file: UploadFile = File(...),
    report_type: str = Form("sales"),  # 'sales' or 'purchase'
    sheet_name: Optional[str] = Form(None),
    parser_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if report_type not in ("sales", "purchase"):
        raise HTTPException(status_code=400, detail="report_type must be 'sales' or 'purchase'")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    file_hash = hashlib.sha256(content).hexdigest()

    # Check for existing duplicate batch
    existing_batch = db.query(ImportBatch).filter(
        ImportBatch.file_hash == file_hash,
        ImportBatch.report_type == report_type,
        ImportBatch.status == "completed"
    ).first()

    # Run parser
    try:
        report = ParserManager.parse(
            file_bytes=content,
            filename=file.filename or "unknown",
            report_type=report_type,
            sheet_name=sheet_name,
            parser_type=parser_type
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parsing error: {str(e)}")

    # Run outlet matcher predictions for all outlets found in the report
    matcher = OutletMatcher(db)
    predictions = []
    for raw_outlet in report.outlets_found:
        m = matcher.match_outlet(raw_outlet)
        candidates = [OutletCandidate(**c) for c in m.get("candidates", [])]
        predictions.append(
            OutletMatchPrediction(
                raw_name=m["raw_name"],
                matched_outlet_id=m["matched_outlet_id"],
                matched_outlet_name=m["matched_outlet_name"],
                confidence=m["confidence"],
                is_auto_matched=m["is_auto_matched"],
                needs_confirmation=m["needs_confirmation"],
                reason=m["reason"],
                candidates=candidates
            )
        )

    # Cache file bytes for commit step
    PREVIEW_CACHE[file_hash] = {
        "bytes": content,
        "filename": file.filename,
        "report_type": report_type,
        "report": report
    }

    # Format sample preview records (up to 15)
    sample_records = [
        PreviewRecord(
            outlet_raw=r.outlet_raw,
            item_raw=r.item_raw,
            item_code=r.item_code,
            quantity=r.quantity,
            unit_price=r.unit_price,
            amount=r.amount,
            transaction_date=r.transaction_date,
            source_row_idx=r.source_row_idx
        )
        for r in report.records[:15]
    ]

    return PreviewResponse(
        filename=file.filename or "",
        file_hash=file_hash,
        report_type=report_type,
        parser_used=report.parser_name,
        sheet_name=report.sheet_name,
        start_date=report.start_date,
        end_date=report.end_date,
        total_records=len(report.records),
        total_quantity=round(report.total_quantity, 2),
        total_amount=round(report.total_amount, 2),
        items_count=len(report.items_found),
        outlets_count=len(report.outlets_found),
        outlet_predictions=predictions,
        sample_records=sample_records,
        warnings=report.warnings,
        is_duplicate=(existing_batch is not None),
        existing_batch_id=existing_batch.batch_id if existing_batch else None
    )


@router.post("/commit", response_model=ImportCommitResponse)
def commit_import(request: ImportCommitRequest, db: Session = Depends(get_db)):
    cached = PREVIEW_CACHE.get(request.file_hash)
    if not cached:
        raise HTTPException(
            status_code=400,
            detail="File preview expired or not found. Please upload and preview again."
        )

    report = cached["report"]
    report_type = request.report_type
    matcher = OutletMatcher(db)

    # 1. Handle Duplicate / Replace Mode
    existing_batch = db.query(ImportBatch).filter(
        ImportBatch.file_hash == request.file_hash,
        ImportBatch.report_type == report_type,
        ImportBatch.status == "completed"
    ).first()

    if existing_batch:
        if request.mode == "replace":
            # Delete old batch and cascading records
            db.delete(existing_batch)
            db.commit()
            matcher.reload_cache()
        elif request.mode == "cancel":
            return ImportCommitResponse(
                success=False,
                batch_id=existing_batch.batch_id,
                report_type=report_type,
                total_imported=0,
                total_quantity=0,
                total_amount=0,
                new_outlets_created=0,
                aliases_saved=0,
                message="Import cancelled by user due to duplicate file."
            )

    # 2. Process user confirmed mappings & new outlet creations
    new_outlets_count = 0
    aliases_saved_count = 0
    outlet_id_by_raw_name: Dict[str, Optional[int]] = {}

    for cm in request.confirmed_mappings:
        raw_name = cm.raw_name.strip()
        if cm.create_new:
            new_name = (cm.new_outlet_name or raw_name).strip()
            norm = normalize_text(new_name)
            outlet = db.query(Outlet).filter(Outlet.normalized_name == norm).first()
            if not outlet:
                outlet = Outlet(
                    official_name=new_name,
                    normalized_name=norm,
                    code=cm.new_outlet_code,
                    city=cm.new_outlet_city,
                    is_active=True
                )
                db.add(outlet)
                db.commit()
                db.refresh(outlet)
                new_outlets_count += 1
            outlet_id_by_raw_name[raw_name] = outlet.id
            matcher.confirm_and_save_alias(raw_name, outlet.id, source_file=request.filename)
            aliases_saved_count += 1

        elif cm.outlet_id:
            outlet_id_by_raw_name[raw_name] = cm.outlet_id
            matcher.confirm_and_save_alias(raw_name, cm.outlet_id, source_file=request.filename)
            aliases_saved_count += 1

    # Reload matcher cache with newly confirmed outlets/aliases
    matcher.reload_cache()

    # Map remaining outlets using smart matcher
    for raw_outlet in report.outlets_found:
        if raw_outlet not in outlet_id_by_raw_name:
            m = matcher.match_outlet(raw_outlet)
            if m["is_auto_matched"] and m["matched_outlet_id"]:
                outlet_id_by_raw_name[raw_outlet] = m["matched_outlet_id"]
                # Auto save high confidence alias
                matcher.confirm_and_save_alias(
                    raw_alias=raw_outlet,
                    outlet_id=m["matched_outlet_id"],
                    source_file=request.filename,
                    action="auto_matched"
                )
                aliases_saved_count += 1
            else:
                # If still unmapped, auto-create outlet if high confidence not available
                # or leave null for review
                outlet_id_by_raw_name[raw_outlet] = m["matched_outlet_id"]

    # 3. Create Import Batch
    batch_num = f"BATCH-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    batch = ImportBatch(
        batch_id=batch_num,
        report_type=report_type,
        filename=request.filename,
        file_hash=request.file_hash,
        parser_used=report.parser_name,
        sheet_name=report.sheet_name,
        start_date=report.start_date,
        end_date=report.end_date,
        total_records=len(report.records),
        total_quantity=round(report.total_quantity, 2),
        total_amount=round(report.total_amount, 2),
        status="completed"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # 4. Item cache to avoid duplicate queries
    item_cache: Dict[str, Item] = {}
    existing_items = db.query(Item).all()
    for item in existing_items:
        item_cache[item.normalized_name] = item

    # 5. Insert records
    record_objects = []
    for r in report.records:
        norm_item = normalize_text(r.item_raw)
        db_item = item_cache.get(norm_item)
        if not db_item:
            db_item = Item(
                name=r.item_raw.strip(),
                normalized_name=norm_item,
                code=r.item_code,
                standard_price=r.unit_price
            )
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            item_cache[norm_item] = db_item

        target_outlet_id = outlet_id_by_raw_name.get(r.outlet_raw)

        if report_type == "sales":
            rec = SalesRecord(
                batch_id=batch.id,
                outlet_id=target_outlet_id,
                raw_outlet_name=r.outlet_raw,
                item_id=db_item.id,
                raw_item_name=r.item_raw,
                item_code=r.item_code,
                quantity=r.quantity,
                unit_price=r.unit_price,
                amount=r.amount,
                transaction_date=r.transaction_date,
                source_row_idx=r.source_row_idx,
                raw_data_json=json.dumps(r.raw_data)
            )
        else:
            rec = PurchaseRecord(
                batch_id=batch.id,
                outlet_id=target_outlet_id,
                raw_outlet_name=r.outlet_raw,
                item_id=db_item.id,
                raw_item_name=r.item_raw,
                item_code=r.item_code,
                quantity=r.quantity,
                unit_price=r.unit_price,
                amount=r.amount,
                transaction_date=r.transaction_date,
                source_row_idx=r.source_row_idx,
                raw_data_json=json.dumps(r.raw_data)
            )
        record_objects.append(rec)

    # Bulk save
    db.bulk_save_objects(record_objects)
    db.commit()

    # Clean preview cache
    if request.file_hash in PREVIEW_CACHE:
        del PREVIEW_CACHE[request.file_hash]

    return ImportCommitResponse(
        success=True,
        batch_id=batch.batch_id,
        report_type=report_type,
        total_imported=len(report.records),
        total_quantity=round(report.total_quantity, 2),
        total_amount=round(report.total_amount, 2),
        new_outlets_created=new_outlets_count,
        aliases_saved=aliases_saved_count,
        message=f"Successfully imported {len(report.records)} records into batch {batch.batch_id}."
    )


@router.get("/batches", response_model=Dict[str, Any])
def list_batches(
    report_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    q = db.query(ImportBatch)
    if report_type:
        q = q.filter(ImportBatch.report_type == report_type)

    total = q.count()
    batches = q.order_by(ImportBatch.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "batches": [ImportBatchResponse.from_orm(b) for b in batches]
    }


@router.delete("/batches/{batch_id}")
def rollback_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(ImportBatch).filter(ImportBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    records_count = batch.total_records
    batch_type = batch.report_type
    db.delete(batch)
    db.commit()

    return {
        "success": True,
        "message": f"Rolled back batch {batch_id} ({batch_type}) and removed {records_count} records."
    }

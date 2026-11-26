from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    Outlet, OutletAlias, SalesRecord, PurchaseRecord,
    OutletMappingHistory
)
from backend.schemas import (
    OutletResponse, OutletCreate, OutletUpdate,
    OutletAliasResponse, OutletMatchPrediction, CommitMapping
)
from backend.matching import OutletMatcher, normalize_text

router = APIRouter(prefix="/api/outlets", tags=["Outlets"])


@router.get("/", response_model=List[OutletResponse])
def list_outlets(
    q: Optional[str] = None,
    city: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Outlet)
    if active_only:
        query = query.filter(Outlet.is_active == True)
    if city:
        query = query.filter(func.lower(Outlet.city) == city.lower())
    if q:
        query = query.filter(
            or_(
                Outlet.official_name.ilike(f"%{q}%"),
                Outlet.code.ilike(f"%{q}%"),
                Outlet.city.ilike(f"%{q}%")
            )
        )
    return query.order_by(Outlet.official_name).all()


@router.get("/unmatched-review")
def get_unmatched_review(db: Session = Depends(get_db)):
    """
    Find raw outlet names in sales or purchase records that do not have an outlet_id
    or unconfirmed aliases, and run fuzzy matcher to suggest matches.
    """
    matcher = OutletMatcher(db)

    # Find distinct raw outlet names with NULL outlet_id
    unmatched_sales = db.query(SalesRecord.raw_outlet_name).filter(SalesRecord.outlet_id.is_(None)).distinct().all()
    unmatched_purchase = db.query(PurchaseRecord.raw_outlet_name).filter(PurchaseRecord.outlet_id.is_(None)).distinct().all()

    unmatched_names = set([r[0] for r in unmatched_sales if r[0]] + [r[0] for r in unmatched_purchase if r[0]])

    results = []
    for raw in sorted(list(unmatched_names)):
        pred = matcher.match_outlet(raw)
        # Count records
        s_cnt = db.query(func.count(SalesRecord.id)).filter(SalesRecord.raw_outlet_name == raw).scalar() or 0
        p_cnt = db.query(func.count(PurchaseRecord.id)).filter(PurchaseRecord.raw_outlet_name == raw).scalar() or 0
        results.append({
            "raw_name": raw,
            "sales_records_count": s_cnt,
            "purchase_records_count": p_cnt,
            "prediction": pred
        })

    return results


@router.post("/confirm-mapping")
def confirm_mapping(mapping: CommitMapping, db: Session = Depends(get_db)):
    """
    Permanently map a raw outlet name to an outlet (or create a new outlet),
    and backfill all existing unmapped SalesRecord and PurchaseRecord rows!
    """
    matcher = OutletMatcher(db)

    target_outlet = None
    if mapping.create_new:
        new_name = (mapping.new_outlet_name or mapping.raw_name).strip()
        norm = normalize_text(new_name)
        target_outlet = Outlet(
            official_name=new_name,
            normalized_name=norm,
            code=mapping.new_outlet_code,
            city=mapping.new_outlet_city,
            is_active=True
        )
        db.add(target_outlet)
        db.commit()
        db.refresh(target_outlet)
    elif mapping.outlet_id:
        target_outlet = db.query(Outlet).filter(Outlet.id == mapping.outlet_id).first()
        if not target_outlet:
            raise HTTPException(status_code=404, detail="Target outlet not found")
    else:
        raise HTTPException(status_code=400, detail="Must provide outlet_id or create_new=True")

    # Save alias
    matcher.confirm_and_save_alias(
        raw_alias=mapping.raw_name,
        outlet_id=target_outlet.id,
        action="user_confirmed"
    )

    # Backfill sales and purchase records
    updated_sales = db.query(SalesRecord).filter(
        SalesRecord.raw_outlet_name == mapping.raw_name,
        SalesRecord.outlet_id.is_(None)
    ).update({"outlet_id": target_outlet.id}, synchronize_session=False)

    updated_purchase = db.query(PurchaseRecord).filter(
        PurchaseRecord.raw_outlet_name == mapping.raw_name,
        PurchaseRecord.outlet_id.is_(None)
    ).update({"outlet_id": target_outlet.id}, synchronize_session=False)

    db.commit()

    return {
        "success": True,
        "outlet_id": target_outlet.id,
        "official_name": target_outlet.official_name,
        "updated_sales_records": updated_sales,
        "updated_purchase_records": updated_purchase
    }


@router.post("/merge")
def merge_outlets(
    source_outlet_id: int,
    target_outlet_id: int,
    db: Session = Depends(get_db)
):
    """
    Merges source outlet into target outlet:
    - Moves all aliases, sales records, purchase records
    - Adds source outlet's official name as an alias of target
    - Deactivates source outlet
    """
    if source_outlet_id == target_outlet_id:
        raise HTTPException(status_code=400, detail="Cannot merge an outlet into itself")

    source = db.query(Outlet).filter(Outlet.id == source_outlet_id).first()
    target = db.query(Outlet).filter(Outlet.id == target_outlet_id).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or Target outlet not found")

    # Reassign aliases
    for a in source.aliases:
        a.outlet_id = target.id

    # Add source official name as alias of target
    existing_alias = db.query(OutletAlias).filter(
        OutletAlias.outlet_id == target.id,
        OutletAlias.normalized_alias == source.normalized_name
    ).first()
    if not existing_alias:
        new_alias = OutletAlias(
            outlet_id=target.id,
            raw_alias=source.official_name,
            normalized_alias=source.normalized_name,
            is_confirmed=True,
            confidence=1.0
        )
        db.add(new_alias)

    # Reassign sales and purchase records
    db.query(SalesRecord).filter(SalesRecord.outlet_id == source.id).update(
        {"outlet_id": target.id}, synchronize_session=False
    )
    db.query(PurchaseRecord).filter(PurchaseRecord.outlet_id == source.id).update(
        {"outlet_id": target.id}, synchronize_session=False
    )

    # Record history
    history = OutletMappingHistory(
        raw_alias=source.official_name,
        previous_outlet_id=source.id,
        new_outlet_id=target.id,
        action="merged",
        notes=f"Merged outlet '{source.official_name}' into '{target.official_name}'"
    )
    db.add(history)

    # Deactivate source
    source.is_active = False

    db.commit()
    return {"success": True, "message": f"Successfully merged '{source.official_name}' into '{target.official_name}'"}


@router.get("/{outlet_id}", response_model=OutletResponse)
def get_outlet(outlet_id: int, db: Session = Depends(get_db)):
    outlet = db.query(Outlet).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return outlet


@router.post("/", response_model=OutletResponse)
def create_outlet(data: OutletCreate, db: Session = Depends(get_db)):
    norm = normalize_text(data.official_name)
    existing = db.query(Outlet).filter(Outlet.normalized_name == norm).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"An outlet with name '{data.official_name}' already exists")

    outlet = Outlet(
        official_name=data.official_name.strip(),
        normalized_name=norm,
        code=data.code.strip() if data.code else None,
        city=data.city.strip() if data.city else None,
        state=data.state.strip() if data.state else None,
        is_active=data.is_active
    )
    db.add(outlet)
    db.commit()
    db.refresh(outlet)

    # Add optional initial aliases
    if data.aliases:
        for a_str in data.aliases:
            if a_str and a_str.strip():
                a_norm = normalize_text(a_str)
                alias = OutletAlias(
                    outlet_id=outlet.id,
                    raw_alias=a_str.strip(),
                    normalized_alias=a_norm,
                    is_confirmed=True,
                    confidence=1.0
                )
                db.add(alias)
        db.commit()
        db.refresh(outlet)

    return outlet


@router.put("/{outlet_id}", response_model=OutletResponse)
def update_outlet(outlet_id: int, data: OutletUpdate, db: Session = Depends(get_db)):
    outlet = db.query(Outlet).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    if data.official_name is not None:
        outlet.official_name = data.official_name.strip()
        outlet.normalized_name = normalize_text(data.official_name)
    if data.code is not None:
        outlet.code = data.code.strip() if data.code else None
    if data.city is not None:
        outlet.city = data.city.strip() if data.city else None
    if data.state is not None:
        outlet.state = data.state.strip() if data.state else None
    if data.is_active is not None:
        outlet.is_active = data.is_active

    db.commit()
    db.refresh(outlet)
    return outlet


@router.delete("/{outlet_id}")
def delete_outlet(outlet_id: int, db: Session = Depends(get_db)):
    outlet = db.query(Outlet).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    db.delete(outlet)
    db.commit()
    return {"success": True, "message": f"Outlet '{outlet.official_name}' deleted"}


@router.delete("/aliases/{alias_id}")
def delete_alias(alias_id: int, db: Session = Depends(get_db)):
    alias = db.query(OutletAlias).filter(OutletAlias.id == alias_id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    db.delete(alias)
    db.commit()
    return {"success": True, "message": "Alias deleted"}

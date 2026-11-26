from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from backend.database import Base


class Outlet(Base):
    __tablename__ = "outlets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), nullable=True, index=True)
    official_name = Column(String(255), unique=True, nullable=False, index=True)
    normalized_name = Column(String(255), nullable=False, index=True)
    city = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    aliases = relationship("OutletAlias", back_populates="outlet", cascade="all, delete-orphan")
    sales_records = relationship("SalesRecord", back_populates="outlet")
    purchase_records = relationship("PurchaseRecord", back_populates="outlet")


class OutletAlias(Base):
    __tablename__ = "outlet_aliases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False)
    raw_alias = Column(String(255), nullable=False, index=True)
    normalized_alias = Column(String(255), nullable=False, index=True)
    source_file = Column(String(255), nullable=True)
    is_confirmed = Column(Boolean, default=True, nullable=False)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    outlet = relationship("Outlet", back_populates="aliases")

    __table_args__ = (
        Index("idx_alias_norm", "normalized_alias"),
    )


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(100), nullable=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    normalized_name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True)
    standard_price = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sales_records = relationship("SalesRecord", back_populates="item")
    purchase_records = relationship("PurchaseRecord", back_populates="item")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(64), unique=True, nullable=False, index=True)
    report_type = Column(String(20), nullable=False, index=True)  # 'sales' | 'purchase'
    filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)
    parser_used = Column(String(100), nullable=True)
    sheet_name = Column(String(100), nullable=True)
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    total_records = Column(Integer, default=0)
    total_quantity = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String(50), default="completed")  # 'completed', 'rolled_back'
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sales_records = relationship("SalesRecord", back_populates="batch", cascade="all, delete-orphan")
    purchase_records = relationship("PurchaseRecord", back_populates="batch", cascade="all, delete-orphan")
    errors = relationship("ImportErrorLog", back_populates="batch", cascade="all, delete-orphan")


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="SET NULL"), nullable=True, index=True)
    raw_outlet_name = Column(String(255), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    raw_item_name = Column(String(255), nullable=False)
    item_code = Column(String(100), nullable=True)
    quantity = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, nullable=True)
    amount = Column(Float, default=0.0, nullable=False)
    transaction_date = Column(String(50), nullable=True, index=True)
    source_row_idx = Column(Integer, nullable=True)
    raw_data_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ImportBatch", back_populates="sales_records")
    outlet = relationship("Outlet", back_populates="sales_records")
    item = relationship("Item", back_populates="sales_records")


class PurchaseRecord(Base):
    __tablename__ = "purchase_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False)
    outlet_id = Column(Integer, ForeignKey("outlets.id", ondelete="SET NULL"), nullable=True, index=True)
    raw_outlet_name = Column(String(255), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    raw_item_name = Column(String(255), nullable=False)
    item_code = Column(String(100), nullable=True)
    quantity = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, nullable=True)
    amount = Column(Float, default=0.0, nullable=False)
    transaction_date = Column(String(50), nullable=True, index=True)
    source_row_idx = Column(Integer, nullable=True)
    raw_data_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ImportBatch", back_populates="purchase_records")
    outlet = relationship("Outlet", back_populates="purchase_records")
    item = relationship("Item", back_populates="purchase_records")


class ImportErrorLog(Base):
    __tablename__ = "import_errors"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False)
    row_index = Column(Integer, nullable=True)
    raw_data = Column(Text, nullable=True)
    error_message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ImportBatch", back_populates="errors")


class OutletMappingHistory(Base):
    __tablename__ = "outlet_mapping_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    raw_alias = Column(String(255), nullable=False, index=True)
    previous_outlet_id = Column(Integer, nullable=True)
    new_outlet_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)  # 'auto_matched', 'user_confirmed', 'reassigned', 'merged'
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

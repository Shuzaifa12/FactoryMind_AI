"""SQLAlchemy models. Every table carries a nullable-by-design workspace_id (default 1) so
authentication / multi-user support can be added later without a schema rewrite."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class _Common:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int | None] = mapped_column(Integer, default=1, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Dataset(_Common, Base):
    __tablename__ = "datasets"

    name: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20), default="upload")  # demo | upload
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    original_filename: Mapped[str | None] = mapped_column(String(300), nullable=True)
    stored_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # uploaded | mapped | processing | ready | failed
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    column_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    quality_report: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    machines: Mapped[list["Machine"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan"
    )


class Machine(_Common, Base):
    __tablename__ = "machines"
    __table_args__ = (Index("ix_machines_dataset", "dataset_id"),)

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    criticality: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    production_priority: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    loss_per_hour: Mapped[float | None] = mapped_column(Float, nullable=True)
    maintenance_cost_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)
    # user | illustrative | unknown
    assumption_source: Mapped[str] = mapped_column(String(20), default="unknown")

    dataset: Mapped[Dataset] = relationship(back_populates="machines")


class SensorReading(_Common, Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (Index("ix_readings_lookup", "dataset_id", "machine_id", "timestamp"),)

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id", ondelete="CASCADE"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    vibration: Mapped[float | None] = mapped_column(Float, nullable=True)
    current: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    extra: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class ProcessingRun(_Common, Base):
    __tablename__ = "processing_runs"

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    method: Mapped[str] = mapped_column(String(30))  # isolation_forest | rule_fallback
    config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    library_versions: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class Alert(_Common, Base):
    __tablename__ = "alerts"
    __table_args__ = (Index("ix_alerts_dataset", "dataset_id", "severity"),)

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    run_id: Mapped[int] = mapped_column(ForeignKey("processing_runs.id", ondelete="CASCADE"))
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id", ondelete="CASCADE"))
    start_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    anomaly_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_anomaly_label: Mapped[bool] = mapped_column(Boolean, default=True)
    severity: Mapped[str] = mapped_column(String(20))  # low | medium | high | critical
    severity_reason: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    data_quality_warnings: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    inspection_steps: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|reviewed|dismissed

    impact_estimates: Mapped[list["ImpactEstimate"]] = relationship(
        back_populates="alert", cascade="all, delete-orphan"
    )


class ImpactEstimate(_Common, Base):
    __tablename__ = "impact_estimates"

    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"))
    assumed_downtime_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    downtime_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    maintenance_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_estimated_impact: Mapped[float | None] = mapped_column(Float, nullable=True)
    priority_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    inputs_used: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    missing_inputs: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    formula_version: Mapped[str] = mapped_column(String(20), default="v1")

    alert: Mapped["Alert"] = relationship(back_populates="impact_estimates")


class Document(_Common, Base):
    __tablename__ = "documents"

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(300))
    stored_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    extracted_text_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extraction_notes: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)


class MaintenanceRecord(_Common, Base):
    __tablename__ = "maintenance_records"

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )
    date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="csv")  # csv | pdf
    source_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    # exact_id | user_confirmed | unmatched
    match_confidence: Mapped[str] = mapped_column(String(20), default="unmatched")


class Investigation(_Common, Base):
    __tablename__ = "investigations"

    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"))
    language: Mapped[str] = mapped_column(String(5), default="en")
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    messages: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    tool_calls: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")


class Report(_Common, Base):
    __tablename__ = "reports"

    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    alert_id: Mapped[int | None] = mapped_column(
        ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True
    )
    language: Mapped[str] = mapped_column(String(5), default="en")
    format: Mapped[str] = mapped_column(String(10), default="md")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    assumptions: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)


class AppSetting(_Common, Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True)
    value: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

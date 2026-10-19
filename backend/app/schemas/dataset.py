from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ColumnMappingRequest(BaseModel):
    timestamp_col: str
    machine_id_col: str
    temperature_col: str | None = None
    vibration_col: str | None = None
    current_col: str | None = None


class ProcessDatasetRequest(BaseModel):
    contamination: float = Field(default=0.1, ge=0.01, le=0.5)
    use_fallback_if_small: bool = True


class QualityReport(BaseModel):
    total_rows: int
    valid_rows: int
    missing_values_count: int
    duplicate_rows_count: int
    timestamp_range: dict[str, str | None]
    detected_machines: list[str]
    notes: list[str]


class UploadPreviewResponse(BaseModel):
    dataset_id: int
    filename: str
    file_type: str
    size_bytes: int
    total_rows: int
    headers: list[str]
    preview_rows: list[dict[str, Any]]
    suggested_mapping: dict[str, str | None]
    quality_warnings: list[str]


class DatasetResponse(BaseModel):
    id: int
    name: str
    source: str
    is_simulated: bool
    original_filename: str | None = None
    row_count: int
    status: str
    is_active: bool
    quality_report: dict[str, Any] | None = None
    created_at: datetime


class DatasetSummaryResponse(BaseModel):
    dataset_id: int
    dataset_name: str
    is_simulated: bool
    total_machines: int
    active_alerts_count: int
    anomalies_detected_count: int
    total_estimated_impact: float

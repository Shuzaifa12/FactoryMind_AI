from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SensorEvidenceItem(BaseModel):
    feature: str
    observed_value: float
    baseline_median: float
    deviation_mad: float
    unit: str


class ImpactEstimateResponse(BaseModel):
    assumed_downtime_hours: float | None = None
    downtime_loss: float | None = None
    maintenance_cost: float | None = None
    total_estimated_impact: float | None = None
    priority_score: float | None = None
    inputs_used: dict[str, Any] | None = None
    formula_version: str


class AlertResponse(BaseModel):
    id: int
    dataset_id: int
    machine_id: str
    machine_name: str
    start_ts: datetime
    end_ts: datetime
    anomaly_score: float | None = None
    is_anomaly_label: bool = True
    severity: str
    severity_reason: list[str]
    evidence: list[dict[str, Any]]
    data_quality_warnings: list[str]
    inspection_steps: list[str]
    status: str
    impact: ImpactEstimateResponse


class UpdateAlertStatusRequest(BaseModel):
    status: str  # "open" | "reviewed" | "dismissed"

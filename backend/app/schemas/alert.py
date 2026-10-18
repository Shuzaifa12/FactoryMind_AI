from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class SensorEvidenceItem(BaseModel):
    feature: str
    observed_value: float
    baseline_median: float
    deviation_mad: float
    unit: str


class ImpactEstimateResponse(BaseModel):
    assumed_downtime_hours: Optional[float] = None
    downtime_loss: Optional[float] = None
    maintenance_cost: Optional[float] = None
    total_estimated_impact: Optional[float] = None
    priority_score: Optional[float] = None
    inputs_used: Optional[Dict[str, Any]] = None
    formula_version: str


class AlertResponse(BaseModel):
    id: int
    dataset_id: int
    machine_id: str
    machine_name: str
    start_ts: datetime
    end_ts: datetime
    anomaly_score: Optional[float] = None
    is_anomaly_label: bool = True
    severity: str
    severity_reason: List[str]
    evidence: List[Dict[str, Any]]
    data_quality_warnings: List[str]
    inspection_steps: List[str]
    status: str
    impact: ImpactEstimateResponse


class UpdateAlertStatusRequest(BaseModel):
    status: str  # "open" | "reviewed" | "dismissed"

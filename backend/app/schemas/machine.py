
from pydantic import BaseModel, Field


class UpdateAssumptionsRequest(BaseModel):
    loss_per_hour: float = Field(ge=0, description="Downtime loss rate in $/hr")
    maintenance_cost_estimate: float = Field(ge=0, description="Estimated repair cost in $")
    criticality: int = Field(ge=1, le=5, description="Asset criticality from 1 (low) to 5 (bottleneck)")
    production_priority: int = Field(ge=1, le=5, description="Production priority rating from 1 to 5")


class MachineResponse(BaseModel):
    id: int
    dataset_id: int
    external_id: str
    name: str
    criticality: int | None = None
    production_priority: int | None = None
    loss_per_hour: float | None = None
    maintenance_cost_estimate: float | None = None
    assumption_source: str
    active_alerts_count: int = 0


class SensorReadingResponse(BaseModel):
    timestamp: str
    machine_id: str
    temperature: float | None = None
    vibration: float | None = None
    current: float | None = None
    is_anomalous: bool = False


class MaintenanceRecordResponse(BaseModel):
    id: int
    machine_id: str
    date: str | None = None
    description: str
    source: str = "csv"
    match_confidence: str = "exact_id"


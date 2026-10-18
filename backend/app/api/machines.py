from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Alert, Machine, MaintenanceRecord, SensorReading
from app.db.session import get_db
from app.schemas.machine import (
    MachineResponse,
    MaintenanceRecordResponse,
    SensorReadingResponse,
    UpdateAssumptionsRequest,
)
from app.services.impact import compute_alert_impact

router = APIRouter(tags=["machines"])


@router.get("/datasets/{dataset_id}/machines", response_model=List[MachineResponse])
def get_dataset_machines(dataset_id: int, db: Session = Depends(get_db)) -> List[MachineResponse]:
    machines = db.query(Machine).filter(Machine.dataset_id == dataset_id).all()
    results = []
    for m in machines:
        alert_count = (
            db.query(Alert)
            .filter(Alert.machine_id == m.id, Alert.status == "open")
            .count()
        )
        results.append(
            MachineResponse(
                id=m.id,
                dataset_id=m.dataset_id,
                external_id=m.external_id,
                name=m.name,
                criticality=m.criticality,
                production_priority=m.production_priority,
                loss_per_hour=m.loss_per_hour,
                maintenance_cost_estimate=m.maintenance_cost_estimate,
                assumption_source=m.assumption_source,
                active_alerts_count=alert_count,
            )
        )
    return results


@router.get("/machines/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: int, db: Session = Depends(get_db)) -> MachineResponse:
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise AppError(code="MACHINE_NOT_FOUND", message=f"Machine {machine_id} not found", status_code=status.HTTP_404_NOT_FOUND)

    alert_count = (
        db.query(Alert)
        .filter(Alert.machine_id == m.id, Alert.status == "open")
        .count()
    )
    return MachineResponse(
        id=m.id,
        dataset_id=m.dataset_id,
        external_id=m.external_id,
        name=m.name,
        criticality=m.criticality,
        production_priority=m.production_priority,
        loss_per_hour=m.loss_per_hour,
        maintenance_cost_estimate=m.maintenance_cost_estimate,
        assumption_source=m.assumption_source,
        active_alerts_count=alert_count,
    )


@router.put("/machines/{machine_id}/assumptions", response_model=MachineResponse)
def update_machine_assumptions(
    machine_id: int,
    req: UpdateAssumptionsRequest,
    db: Session = Depends(get_db),
) -> MachineResponse:
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise AppError(code="MACHINE_NOT_FOUND", message=f"Machine {machine_id} not found", status_code=status.HTTP_404_NOT_FOUND)

    m.loss_per_hour = req.loss_per_hour
    m.maintenance_cost_estimate = req.maintenance_cost_estimate
    m.criticality = req.criticality
    m.production_priority = req.production_priority
    m.assumption_source = "user"

    # Recalculate impact for open alerts on this machine
    alerts = db.query(Alert).filter(Alert.machine_id == m.id).all()
    for a in alerts:
        hours = 4.5 if a.severity == "critical" else 3.0 if a.severity == "high" else 1.5
        new_impact = compute_alert_impact(
            assumed_hours=hours,
            loss_per_hour=m.loss_per_hour,
            repair_cost=m.maintenance_cost_estimate,
            criticality=m.criticality,
            severity=a.severity,
        )
        if a.impact_estimates and len(a.impact_estimates) > 0:
            est = a.impact_estimates[0]
            est.assumed_downtime_hours = new_impact["assumed_downtime_hours"]
            est.downtime_loss = new_impact["downtime_loss"]
            est.maintenance_cost = new_impact["maintenance_cost"]
            est.total_estimated_impact = new_impact["total_estimated_impact"]
            est.priority_score = new_impact["priority_score"]
            est.inputs_used = new_impact["inputs_used"]

    db.commit()
    db.refresh(m)

    alert_count = (
        db.query(Alert)
        .filter(Alert.machine_id == m.id, Alert.status == "open")
        .count()
    )

    return MachineResponse(
        id=m.id,
        dataset_id=m.dataset_id,
        external_id=m.external_id,
        name=m.name,
        criticality=m.criticality,
        production_priority=m.production_priority,
        loss_per_hour=m.loss_per_hour,
        maintenance_cost_estimate=m.maintenance_cost_estimate,
        assumption_source=m.assumption_source,
        active_alerts_count=alert_count,
    )


@router.get("/machines/{machine_id}/readings", response_model=List[SensorReadingResponse])
def get_machine_sensor_readings(
    machine_id: int,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> List[SensorReadingResponse]:
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise AppError(code="MACHINE_NOT_FOUND", message=f"Machine {machine_id} not found", status_code=status.HTTP_404_NOT_FOUND)

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == m.id)
        .order_by(SensorReading.timestamp.asc())
        .limit(limit)
        .all()
    )

    results = []
    for r in readings:
        results.append(
            SensorReadingResponse(
                timestamp=r.timestamp.isoformat(),
                machine_id=m.external_id,
                temperature=r.temperature,
                vibration=r.vibration,
                current=r.current,
                is_anomalous=r.status == "anomalous",
            )
        )
    return results


@router.get("/machines/{machine_id}/maintenance", response_model=List[MaintenanceRecordResponse])
def get_machine_maintenance_records(
    machine_id: int,
    db: Session = Depends(get_db),
) -> List[MaintenanceRecordResponse]:
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise AppError(
            code="MACHINE_NOT_FOUND",
            message=f"Machine {machine_id} not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    records = (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.machine_id == m.id)
        .order_by(MaintenanceRecord.date.desc().nullslast(), MaintenanceRecord.id.desc())
        .all()
    )

    results = []
    for r in records:
        results.append(
            MaintenanceRecordResponse(
                id=r.id,
                machine_id=m.external_id,
                date=r.date.isoformat() if r.date else None,
                description=r.description,
                source=r.source or "csv",
                match_confidence=r.match_confidence or "exact_id",
            )
        )
    return results


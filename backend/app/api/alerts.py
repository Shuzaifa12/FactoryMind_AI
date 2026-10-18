from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Alert, Machine
from app.db.session import get_db
from app.schemas.alert import AlertResponse, ImpactEstimateResponse, UpdateAlertStatusRequest

router = APIRouter(tags=["alerts"])


def _format_alert(a: Alert, mach: Machine) -> AlertResponse:
    imp_resp = ImpactEstimateResponse(
        assumed_downtime_hours=None,
        downtime_loss=None,
        maintenance_cost=None,
        total_estimated_impact=None,
        priority_score=None,
        inputs_used=None,
        formula_version="v1.0",
    )
    if a.impact_estimates and len(a.impact_estimates) > 0:
        ie = a.impact_estimates[0]
        imp_resp = ImpactEstimateResponse(
            assumed_downtime_hours=ie.assumed_downtime_hours,
            downtime_loss=ie.downtime_loss,
            maintenance_cost=ie.maintenance_cost,
            total_estimated_impact=ie.total_estimated_impact,
            priority_score=ie.priority_score,
            inputs_used=ie.inputs_used,
            formula_version=ie.formula_version or "v1.0",
        )

    return AlertResponse(
        id=a.id,
        dataset_id=a.dataset_id,
        machine_id=mach.external_id if mach else "UNKNOWN",
        machine_name=mach.name if mach else "Unknown Asset",
        start_ts=a.start_ts,
        end_ts=a.end_ts,
        anomaly_score=a.anomaly_score,
        is_anomaly_label=a.is_anomaly_label,
        severity=a.severity,
        severity_reason=a.severity_reason or [],
        evidence=a.evidence or [],
        data_quality_warnings=a.data_quality_warnings or [],
        inspection_steps=a.inspection_steps or [],
        status=a.status,
        impact=imp_resp,
    )


@router.get("/datasets/{dataset_id}/alerts", response_model=List[AlertResponse])
def get_dataset_alerts(
    dataset_id: int,
    severity: Optional[str] = Query(default=None),
    machine_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> List[AlertResponse]:
    q = db.query(Alert, Machine).join(Machine, Alert.machine_id == Machine.id).filter(Alert.dataset_id == dataset_id)

    if severity and severity.lower() != "all":
        q = q.filter(Alert.severity == severity.lower())
    if machine_id and machine_id != "all":
        q = q.filter((Machine.external_id == machine_id) | (Machine.id == int(machine_id) if machine_id.isdigit() else False))
    if status_filter and status_filter.lower() != "all":
        q = q.filter(Alert.status == status_filter.lower())

    alerts_and_machines = q.order_by(Alert.id.desc()).all()
    return [_format_alert(a, m) for a, m in alerts_and_machines]


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)) -> AlertResponse:
    res = db.query(Alert, Machine).join(Machine, Alert.machine_id == Machine.id).filter(Alert.id == alert_id).first()
    if not res:
        raise AppError(code="ALERT_NOT_FOUND", message=f"Alert {alert_id} not found", status_code=status.HTTP_404_NOT_FOUND)
    a, m = res
    return _format_alert(a, m)


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
def update_alert_status(
    alert_id: int,
    req: UpdateAlertStatusRequest,
    db: Session = Depends(get_db),
) -> AlertResponse:
    allowed = ["open", "reviewed", "dismissed"]
    if req.status.lower() not in allowed:
        raise AppError(code="INVALID_STATUS", message=f"Status must be one of {allowed}")

    res = db.query(Alert, Machine).join(Machine, Alert.machine_id == Machine.id).filter(Alert.id == alert_id).first()
    if not res:
        raise AppError(code="ALERT_NOT_FOUND", message=f"Alert {alert_id} not found", status_code=status.HTTP_404_NOT_FOUND)

    a, m = res
    a.status = req.status.lower()
    db.commit()
    db.refresh(a)
    return _format_alert(a, m)

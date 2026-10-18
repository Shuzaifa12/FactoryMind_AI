from typing import Any, Dict, List
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Alert, Dataset, Machine, SensorReading
from app.db.session import get_db
from app.schemas.dataset import (
    ColumnMappingRequest,
    DatasetResponse,
    DatasetSummaryResponse,
    ProcessDatasetRequest,
    QualityReport,
    UploadPreviewResponse,
)
from app.services.upload_service import (
    apply_column_mapping,
    create_uploaded_dataset,
    ingest_and_process_dataset,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("/active", response_model=DatasetResponse)
def get_active_dataset(db: Session = Depends(get_db)) -> DatasetResponse:
    dataset = db.query(Dataset).filter(Dataset.is_active == True).order_by(Dataset.id.desc()).first()
    if not dataset:
        dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()
    if not dataset:
        raise AppError(code="NO_DATASET", message="No active or uploaded dataset found. Load demo data first.", status_code=status.HTTP_404_NOT_FOUND)
    return DatasetResponse(
        id=dataset.id,
        name=dataset.name,
        source=dataset.source,
        is_simulated=dataset.is_simulated,
        original_filename=dataset.original_filename,
        row_count=dataset.row_count,
        status=dataset.status,
        is_active=dataset.is_active,
        quality_report=dataset.quality_report,
        created_at=dataset.created_at,
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)) -> DatasetResponse:
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise AppError(code="DATASET_NOT_FOUND", message=f"Dataset {dataset_id} not found", status_code=status.HTTP_404_NOT_FOUND)
    return DatasetResponse(
        id=dataset.id,
        name=dataset.name,
        source=dataset.source,
        is_simulated=dataset.is_simulated,
        original_filename=dataset.original_filename,
        row_count=dataset.row_count,
        status=dataset.status,
        is_active=dataset.is_active,
        quality_report=dataset.quality_report,
        created_at=dataset.created_at,
    )


@router.get("/{dataset_id}/summary", response_model=DatasetSummaryResponse)
def get_dataset_summary(dataset_id: int, db: Session = Depends(get_db)) -> DatasetSummaryResponse:
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise AppError(code="DATASET_NOT_FOUND", message=f"Dataset {dataset_id} not found", status_code=status.HTTP_404_NOT_FOUND)

    machines = db.query(Machine).filter(Machine.dataset_id == dataset_id).all()
    open_alerts = db.query(Alert).filter(Alert.dataset_id == dataset_id, Alert.status == "open").all()

    total_impact = 0.0
    for a in open_alerts:
        if a.impact_estimates and len(a.impact_estimates) > 0:
            imp = a.impact_estimates[0].total_estimated_impact
            if imp:
                total_impact += imp

    anom_count = (
        db.query(SensorReading)
        .filter(SensorReading.dataset_id == dataset_id, SensorReading.status == "anomalous")
        .count()
    )

    return DatasetSummaryResponse(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        is_simulated=dataset.is_simulated,
        total_machines=len(machines),
        active_alerts_count=len(open_alerts),
        anomalies_detected_count=anom_count,
        total_estimated_impact=round(total_impact, 2),
    )


@router.post("/upload", response_model=UploadPreviewResponse)
async def upload_dataset_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadPreviewResponse:
    content = await file.read()
    return create_uploaded_dataset(db, file.filename or "uploaded.csv", content)


@router.post("/{dataset_id}/mapping", response_model=QualityReport)
def map_dataset_columns(
    dataset_id: int,
    mapping: ColumnMappingRequest,
    db: Session = Depends(get_db),
) -> QualityReport:
    return apply_column_mapping(db, dataset_id, mapping)


@router.post("/{dataset_id}/process")
def process_dataset(
    dataset_id: int,
    req: ProcessDatasetRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return ingest_and_process_dataset(db, dataset_id, contamination=req.contamination)

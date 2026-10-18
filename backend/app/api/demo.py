from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dataset import DatasetResponse
from app.services.demo_data import load_or_reset_demo_dataset

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/load", response_model=DatasetResponse)
def load_demo(db: Session = Depends(get_db)) -> DatasetResponse:
    """Loads or resets the deterministic demo dataset with machines, readings, and alerts."""
    demo_dataset = load_or_reset_demo_dataset(db)
    return DatasetResponse(
        id=demo_dataset.id,
        name=demo_dataset.name,
        source=demo_dataset.source,
        is_simulated=demo_dataset.is_simulated,
        original_filename=demo_dataset.original_filename,
        row_count=demo_dataset.row_count,
        status=demo_dataset.status,
        is_active=demo_dataset.is_active,
        quality_report=demo_dataset.quality_report,
        created_at=demo_dataset.created_at,
    )

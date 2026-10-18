import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])
logger = logging.getLogger("factorymind.health")


@router.get("/health", response_model=HealthResponse)
def health(
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> HealthResponse:
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Database health check failed")
        db_status = "unavailable"
    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        database=db_status,
        version=settings.app_version,
        environment=settings.environment,
        database_engine="sqlite" if settings.is_sqlite else "postgresql",
    )

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str  # "ok" | "degraded"
    database: str  # "ok" | "unavailable"
    version: str
    environment: str
    database_engine: str  # "sqlite" | "postgresql"

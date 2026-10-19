import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from app.api import alerts, assistant, datasets, demo, health, machines
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Initialize database tables safely using existing Base and engine
    try:
        from app.db.models import Base
        from app.db.session import engine

        # Base.metadata.create_all(bind=engine)
        # logging.getLogger("factorymind").info("Database tables verified and initialized")
        Base.metadata.create_all(bind=engine)

        # Safely add the new column to existing SQLite/PostgreSQL databases.
        dataset_columns = {
            column["name"] for column in inspect(engine).get_columns("datasets")
        }

        if "original_content" not in dataset_columns:
            binary_type = (
                "BYTEA" if engine.dialect.name == "postgresql" else "BLOB"
            )
            with engine.begin() as connection:
                connection.execute(
                    text(
                        f"ALTER TABLE datasets "
                        f"ADD COLUMN original_content {binary_type}"
                    )
                )

        logging.getLogger("factorymind").info(
            "Database tables verified and initialized"
        )
    # except SQLAlchemyError as exc:
    #     logging.getLogger("factorymind").error(f"Database table initialization notice: {exc}")
    # yield
    except SQLAlchemyError as exc:
        logging.getLogger("factorymind").exception(
            "Database initialization failed"
        )
        raise RuntimeError("Database initialization failed") from exc

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    # Register API routers
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(demo.router, prefix=API_PREFIX)
    app.include_router(datasets.router, prefix=API_PREFIX)
    app.include_router(machines.router, prefix=API_PREFIX)
    app.include_router(alerts.router, prefix=API_PREFIX)
    app.include_router(assistant.router, prefix=API_PREFIX)

    logging.getLogger("factorymind").info("App created with core endpoints", extra={})
    return app


app = create_app()

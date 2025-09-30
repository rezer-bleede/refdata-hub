"""Application entrypoint."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, load_settings
from .database import create_db_engine, init_db
from .routes import config as config_routes
from .routes import reference as reference_routes
from .routes import source as source_routes


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""

    settings = settings or load_settings()
    app = FastAPI(title="RefData Hub API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    engine = create_db_engine(settings)
    app.state.engine = engine
    app.state.settings = settings
    init_db(engine, settings=settings)

    api_router = APIRouter(prefix="/api")
    api_router.include_router(reference_routes.router)
    api_router.include_router(config_routes.router)
    api_router.include_router(source_routes.router)
    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

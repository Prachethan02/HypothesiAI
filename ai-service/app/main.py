import sys
import asyncio

# Fix Windows WinError 64 IOCP socket crash in Python 3.13
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.logging import logger
from app.core.model_manager import model_manager
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan event handler for AI service startup and shutdown."""
    logger.info("Initializing HypothesiAI Python AI Service...")
    logger.info(f"Environment: {settings.ENVIRONMENT} | API prefix: {settings.API_V1_STR}")
    
    # Initialize ModelManager hardware detection
    resources = model_manager.get_system_resources()
    logger.info(
        f"Hardware diagnostic: Device={resources['device']} | "
        f"RAM={resources['available_ram_mb']}/{resources['total_ram_mb']} MB free | "
        f"CPUs={resources['cpu_count']}"
    )
    
    yield
    logger.info("HypothesiAI AI Service shutting down cleanly.")


def create_application() -> FastAPI:
    """FastAPI application factory with production security and error handling."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENVIRONMENT != "production" else None,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request timing & correlation middleware
    @app.middleware("http")
    async def request_timing_middleware(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Response-Time"] = f"{duration_ms}ms"
        
        # Log non-healthcheck requests
        if not request.url.path.endswith("/health"):
            logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)")
        return response

    # Global Exception Handlers
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "statusCode": exc.status_code,
                    "message": exc.detail,
                    "path": request.url.path,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "statusCode": 422,
                    "message": "Input validation error",
                    "details": exc.errors(),
                    "path": request.url.path,
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "statusCode": 500,
                    "message": "Internal AI Service Error",
                    "detail": str(exc) if settings.ENVIRONMENT != "production" else "An unexpected error occurred in AI pipeline",
                    "path": request.url.path,
                },
            },
        )

    # Register API routes
    app.include_router(api_router, prefix=settings.API_V1_STR)

    # Root and API health probes
    @app.get("/health", tags=["health"])
    @app.get(f"{settings.API_V1_STR}/health", tags=["health"])
    async def root_health():
        return {
            "status": "ok",
            "service": "hypothesiai-ai-service",
            "environment": settings.ENVIRONMENT,
            "version": settings.VERSION,
        }

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
        workers=settings.MAX_WORKERS if settings.ENVIRONMENT == "production" else 1,
    )

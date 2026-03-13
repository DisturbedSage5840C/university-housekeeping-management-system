"""
ILGC Tracker - AI/ML Service Main Application
Production-grade FastAPI application with ML pipeline
"""
import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import APIKeyHeader
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from config import settings
from routers import complaints, tasks, predictions, insights, health
from services.ml_service import MLService
from services.cache_service import CacheService

# Structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer() if settings.DEBUG else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency", ["method", "endpoint"])
ML_PREDICTION_COUNT = Counter("ml_predictions_total", "Total ML predictions", ["model", "status"])
ML_PREDICTION_LATENCY = Histogram("ml_prediction_duration_seconds", "ML prediction latency", ["model"])

# Global ML service instance
ml_service: MLService = None
cache_service: CacheService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    global ml_service, cache_service

    logger.info("Starting ILGC AI Service", version=settings.APP_VERSION)

    # Initialize ML models
    ml_service = MLService()
    await ml_service.initialize()
    logger.info("ML models loaded successfully")

    # Initialize cache
    cache_service = CacheService(settings.REDIS_URL)
    await cache_service.connect()
    logger.info("Redis cache connected")

    # Store in app state
    app.state.ml_service = ml_service
    app.state.cache_service = cache_service

    yield

    # Shutdown
    logger.info("Shutting down AI Service")
    await cache_service.disconnect()


app = FastAPI(
    title="ILGC Tracker AI/ML Service",
    description="Production AI/ML backend for hostel care management",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# API Key Security
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key or api_key != settings.API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """Log requests and collect metrics."""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)

    duration = time.time() - start_time
    endpoint = request.url.path

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=endpoint,
        status=response.status_code,
    ).inc()
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=endpoint,
    ).observe(duration)

    logger.info(
        "request_completed",
        method=request.method,
        path=endpoint,
        status=response.status_code,
        duration=round(duration, 4),
    )

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration:.4f}s"
    return response


# Prometheus metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(
    complaints.router,
    prefix="/api/v1/complaints",
    tags=["Complaints AI"],
    dependencies=[Depends(verify_api_key)],
)
app.include_router(
    tasks.router,
    prefix="/api/v1/tasks",
    tags=["Task Optimization"],
    dependencies=[Depends(verify_api_key)],
)
app.include_router(
    predictions.router,
    prefix="/api/v1/predictions",
    tags=["Predictive Analytics"],
    dependencies=[Depends(verify_api_key)],
)
app.include_router(
    insights.router,
    prefix="/api/v1/insights",
    tags=["AI Insights"],
    dependencies=[Depends(verify_api_key)],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
    )

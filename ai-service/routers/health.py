"""
Health Check Router - Service health and readiness endpoints
"""
from datetime import datetime
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health_check(request: Request):
    """Basic health check."""
    ml_ready = hasattr(request.app.state, "ml_service") and request.app.state.ml_service.is_initialized
    cache_ready = hasattr(request.app.state, "cache_service") and request.app.state.cache_service.client is not None

    status = "healthy" if ml_ready else "degraded"

    return {
        "status": status,
        "service": "ILGC AI Service",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "ml_models": "ready" if ml_ready else "not_ready",
            "cache": "connected" if cache_ready else "disconnected",
        },
    }


@router.get("/ready")
async def readiness_check(request: Request):
    """Kubernetes-style readiness probe."""
    ml_ready = hasattr(request.app.state, "ml_service") and request.app.state.ml_service.is_initialized
    if not ml_ready:
        return {"ready": False}
    return {"ready": True}

"""
Celery Worker - Async task processing for heavy ML operations
"""
from celery import Celery
from config import settings

celery_app = Celery(
    "ilgc_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
)


@celery_app.task(bind=True, max_retries=3)
def retrain_models_task(self, training_data: list):
    """Background task to retrain ML models."""
    import asyncio
    from services.ml_service import MLService

    async def _retrain():
        ml = MLService()
        await ml.initialize()
        await ml.retrain(training_data)

    asyncio.run(_retrain())
    return {"status": "completed", "samples": len(training_data)}


@celery_app.task(bind=True)
def generate_batch_predictions(self, complaints: list):
    """Batch process multiple complaints for analysis."""
    from services.ml_service import MLService
    import asyncio

    async def _analyze():
        ml = MLService()
        await ml.initialize()
        results = []
        for complaint in complaints:
            result = ml.analyze_complaint(complaint.get("text", ""))
            result["complaint_id"] = complaint.get("id")
            results.append(result)
        return results

    return asyncio.run(_analyze())

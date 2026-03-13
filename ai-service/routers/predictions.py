"""
Predictions Router - Predictive analytics for maintenance and operations
"""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request
import structlog

from services.predictive_service import PredictiveService

logger = structlog.get_logger()
router = APIRouter()

predictive_service = PredictiveService()


class PredictionRequest(BaseModel):
    historical_data: list[dict] = Field(default=[], description="Historical complaint data")
    days_ahead: int = Field(default=30, ge=7, le=365, description="Days to predict ahead")


class AnomalyRequest(BaseModel):
    current_stats: dict = Field(..., description="Current system statistics")
    historical_averages: dict = Field(default={}, description="Historical averages")


@router.post("/maintenance")
async def predict_maintenance(body: PredictionRequest):
    """Predict upcoming maintenance needs based on historical data."""
    result = predictive_service.predict_maintenance(body.historical_data)
    return {"data": result}


@router.post("/anomalies")
async def detect_anomalies(body: AnomalyRequest):
    """Detect anomalies in current system statistics."""
    anomalies = []
    current = body.current_stats
    averages = body.historical_averages

    # Check for anomalies
    if averages:
        for key in current:
            if key in averages and averages[key] > 0:
                ratio = current[key] / averages[key]
                if ratio > 1.5:
                    anomalies.append({
                        "metric": key,
                        "current_value": current[key],
                        "average_value": averages[key],
                        "deviation_ratio": round(ratio, 2),
                        "severity": "high" if ratio > 2.5 else "medium" if ratio > 1.8 else "low",
                        "message": f"{key} is {ratio:.1f}x higher than average",
                    })
                elif ratio < 0.3:
                    anomalies.append({
                        "metric": key,
                        "current_value": current[key],
                        "average_value": averages[key],
                        "deviation_ratio": round(ratio, 2),
                        "severity": "medium",
                        "message": f"{key} is unusually low ({ratio:.1f}x of average)",
                    })

    return {
        "data": {
            "anomalies": sorted(anomalies, key=lambda a: a["deviation_ratio"], reverse=True),
            "total_anomalies": len(anomalies),
            "status": "alert" if any(a["severity"] == "high" for a in anomalies) else "normal",
        }
    }


@router.post("/workload")
async def predict_workload(body: PredictionRequest):
    """Predict staff workload for upcoming period."""
    data = body.historical_data

    if not data:
        return {
            "data": {
                "predicted_daily_complaints": 5,
                "staff_needed": 3,
                "peak_hours": ["09:00-11:00", "14:00-16:00"],
                "recommendation": "Maintain current staffing levels",
            }
        }

    # Calculate averages
    from collections import Counter
    from datetime import datetime

    daily_counts = Counter()
    hourly_counts = Counter()

    for d in data:
        date_str = d.get("created_at", "")
        if isinstance(date_str, str) and len(date_str) >= 10:
            daily_counts[date_str[:10]] += 1
            if len(date_str) >= 13:
                try:
                    hour = int(date_str[11:13])
                    hourly_counts[hour] += 1
                except ValueError:
                    pass

    avg_daily = sum(daily_counts.values()) / max(len(daily_counts), 1)

    # Find peak hours
    peak_hours = sorted(hourly_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    peak_ranges = [f"{h:02d}:00-{h + 1:02d}:00" for h, _ in peak_hours]

    # Staff recommendation (1 staff per 8 complaints/day)
    staff_needed = max(2, int(avg_daily / 8) + 1)

    return {
        "data": {
            "predicted_daily_complaints": round(avg_daily, 1),
            "staff_needed": staff_needed,
            "peak_hours": peak_ranges,
            "daily_distribution": dict(sorted(
                [(f"{h:02d}:00", c) for h, c in hourly_counts.items()]
            )),
            "recommendation": (
                f"Based on {len(data)} historical complaints, maintain at least {staff_needed} staff. "
                f"Peak activity at {', '.join(peak_ranges[:2])}."
            ),
        }
    }

"""
Insights Router - AI-generated dashboard insights
"""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request
import structlog

from services.openai_service import OpenAIService

logger = structlog.get_logger()
router = APIRouter()

openai_service = OpenAIService()


class InsightsRequest(BaseModel):
    stats: dict = Field(..., description="Current system statistics")
    period: str = Field(default="7d", description="Analysis period: 7d, 30d, 90d")


class SentimentReportRequest(BaseModel):
    complaints: list[dict] = Field(..., min_length=1, description="Recent complaints for sentiment analysis")


@router.post("/dashboard")
async def generate_dashboard_insights(request: Request, body: InsightsRequest):
    """Generate AI-powered dashboard insights."""
    cache_service = request.app.state.cache_service

    # Cache key based on stats hash
    import json
    cache_key = json.dumps(body.stats, sort_keys=True)
    cached = await cache_service.get("insights", cache_key)
    if cached:
        return {"data": cached, "cached": True}

    # Try GPT insights
    gpt_insights = await openai_service.generate_insights(body.stats)

    if gpt_insights:
        result = gpt_insights
    else:
        # Fallback rule-based insights
        result = _generate_rule_based_insights(body.stats)

    await cache_service.set("insights", cache_key, result, ttl=1800)
    return {"data": result, "cached": False}


@router.post("/sentiment-report")
async def generate_sentiment_report(request: Request, body: SentimentReportRequest):
    """Generate sentiment analysis report from recent complaints."""
    from services.nlp_service import NLPService
    nlp = NLPService()

    sentiments = []
    for complaint in body.complaints:
        text = complaint.get("description", "") or complaint.get("text", "")
        if text:
            analysis = nlp.analyze_text(text)
            sentiments.append({
                "complaint_id": complaint.get("id"),
                "sentiment": analysis["sentiment"],
                "urgency": analysis["urgency"],
            })

    # Aggregate
    if sentiments:
        avg_polarity = sum(s["sentiment"]["polarity"] for s in sentiments) / len(sentiments)
        sentiment_dist = {}
        for s in sentiments:
            label = s["sentiment"]["label"]
            sentiment_dist[label] = sentiment_dist.get(label, 0) + 1

        urgency_dist = {}
        for s in sentiments:
            level = s["urgency"]["level"]
            urgency_dist[level] = urgency_dist.get(level, 0) + 1
    else:
        avg_polarity = 0
        sentiment_dist = {}
        urgency_dist = {}

    return {
        "data": {
            "total_analyzed": len(sentiments),
            "average_polarity": round(avg_polarity, 4),
            "overall_sentiment": (
                "negative" if avg_polarity < -0.1
                else "positive" if avg_polarity > 0.1
                else "neutral"
            ),
            "sentiment_distribution": sentiment_dist,
            "urgency_distribution": urgency_dist,
            "details": sentiments,
        }
    }


def _generate_rule_based_insights(stats: dict) -> dict:
    """Generate insights using rules when GPT is unavailable."""
    alerts = []
    recommendations = []
    trends = []

    total_complaints = stats.get("total_complaints", 0)
    pending = stats.get("pending_complaints", 0)
    resolved = stats.get("resolved_complaints", 0)
    avg_resolution = stats.get("avg_resolution_hours", 0)

    # Alert checks
    if pending > total_complaints * 0.4:
        alerts.append({
            "level": "warning",
            "message": f"High backlog: {pending} complaints pending ({int(pending / max(total_complaints, 1) * 100)}% of total)",
        })

    if avg_resolution > 48:
        alerts.append({
            "level": "warning",
            "message": f"Slow resolution: Average {avg_resolution:.0f} hours. Target is under 24 hours.",
        })

    resolution_rate = resolved / max(total_complaints, 1) * 100
    if resolution_rate > 80:
        trends.append({"direction": "positive", "message": f"Strong resolution rate: {resolution_rate:.0f}%"})
    elif resolution_rate < 50:
        trends.append({"direction": "negative", "message": f"Low resolution rate: {resolution_rate:.0f}%"})

    # Recommendations
    if pending > 10:
        recommendations.append("Consider assigning additional staff to reduce complaint backlog")
    if avg_resolution > 24:
        recommendations.append("Review complaint assignment workflow to speed up resolution")

    recommendations.append("Schedule regular predictive maintenance to prevent recurring issues")

    return {
        "summary": f"{total_complaints} total complaints, {pending} pending, {resolution_rate:.0f}% resolution rate",
        "alerts": alerts,
        "recommendations": recommendations,
        "trends": trends,
    }

"""
Complaints AI Router - ML-powered complaint analysis endpoints
"""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request, HTTPException
import structlog

from services.nlp_service import NLPService
from services.openai_service import OpenAIService

logger = structlog.get_logger()
router = APIRouter()

nlp_service = NLPService()
openai_service = OpenAIService()


class ComplaintAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=5000, description="Complaint text")
    room_number: str = Field(default=None, description="Room number")
    floor: int = Field(default=None, ge=1, le=20, description="Floor number")
    resident_id: int = Field(default=None, description="Resident user ID")
    include_gpt_enhancement: bool = Field(default=False, description="Include GPT-4 enhanced analysis")


class ComplaintCategorizeRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=5000)


class ResponseTemplateRequest(BaseModel):
    complaint_text: str = Field(..., min_length=3, max_length=5000)
    category: str = Field(default="other")


class RetrainRequest(BaseModel):
    data: list[dict] = Field(..., min_length=1, description="New training data")


@router.post("/analyze")
async def analyze_complaint(request: Request, body: ComplaintAnalyzeRequest):
    """Full AI analysis of a complaint: ML classification + NLP + optional GPT enhancement."""
    ml_service = request.app.state.ml_service
    cache_service = request.app.state.cache_service

    # Check cache
    cached = await cache_service.get("analyze", body.text)
    if cached and not body.include_gpt_enhancement:
        return {"data": cached, "cached": True}

    # ML Analysis
    ml_result = ml_service.analyze_complaint(body.text)

    # NLP Analysis
    nlp_result = nlp_service.analyze_text(body.text)

    # Combine results
    result = {
        "ml_analysis": ml_result,
        "nlp_analysis": nlp_result,
        "summary": nlp_service.generate_summary(body.text),
    }

    # GPT Enhancement (optional)
    if body.include_gpt_enhancement:
        gpt_result = await openai_service.enhance_analysis(body.text, ml_result)
        if gpt_result:
            result["gpt_enhancement"] = gpt_result

    # Cache result
    await cache_service.set("analyze", body.text, result, ttl=1800)

    return {"data": result, "cached": False}


@router.post("/categorize")
async def categorize_complaint(request: Request, body: ComplaintCategorizeRequest):
    """Quick ML categorization of a complaint."""
    ml_service = request.app.state.ml_service
    cache_service = request.app.state.cache_service

    cached = await cache_service.get("categorize", body.text)
    if cached:
        return {"data": cached, "cached": True}

    category = ml_service.classify_complaint(body.text)
    priority = ml_service.predict_priority(body.text)

    result = {"category": category, "priority": priority}
    await cache_service.set("categorize", body.text, result, ttl=3600)

    return {"data": result, "cached": False}


@router.post("/response-templates")
async def get_response_templates(body: ResponseTemplateRequest):
    """Generate response templates for a complaint."""
    templates = await openai_service.generate_response_templates(body.complaint_text, body.category)

    if templates:
        return {"data": templates}

    # Fallback templates
    return {
        "data": [
            {
                "tone": "formal",
                "message": f"Thank you for reporting this {body.category} issue. Our team has been notified and will address it promptly. You will receive updates on the progress."
            },
            {
                "tone": "empathetic",
                "message": f"We understand how frustrating this {body.category} issue must be. Rest assured, we take this seriously and our team is already on it."
            },
            {
                "tone": "brief",
                "message": f"Your {body.category} complaint has been received and assigned. Expected resolution within 24 hours."
            },
        ],
        "fallback": True,
    }


@router.post("/retrain")
async def retrain_models(request: Request, body: RetrainRequest):
    """Retrain ML models with new complaint data."""
    ml_service = request.app.state.ml_service
    cache_service = request.app.state.cache_service

    await ml_service.retrain(body.data)
    await cache_service.clear_prefix("analyze")
    await cache_service.clear_prefix("categorize")

    return {"message": "Models retrained successfully", "samples_added": len(body.data)}

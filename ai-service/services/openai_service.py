"""
OpenAI Service - GPT-4 integration for enhanced AI features
"""
import structlog
from typing import Optional
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from config import settings

logger = structlog.get_logger()


class OpenAIService:
    """Production OpenAI integration with retry logic and fallbacks."""

    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        self.is_available = False

        if settings.OPENAI_API_KEY:
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.is_available = True
            logger.info("OpenAI client initialized")
        else:
            logger.warning("OpenAI API key not set, GPT features disabled")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_gpt(self, system_prompt: str, user_prompt: str, max_tokens: int = None) -> str:
        """Make a GPT API call with retry logic."""
        if not self.is_available:
            return None

        response = await self.client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens or settings.OPENAI_MAX_TOKENS,
            temperature=settings.OPENAI_TEMPERATURE,
        )
        return response.choices[0].message.content

    async def enhance_analysis(self, text: str, ml_result: dict) -> Optional[dict]:
        """Use GPT-4 to enhance ML analysis results."""
        if not self.is_available:
            return None

        system_prompt = """You are an expert hostel facility manager AI assistant.
        Analyze the complaint and the ML analysis results. Provide:
        1. A refined, human-readable summary
        2. Specific actionable steps tailored to this exact situation
        3. Root cause analysis
        4. Prevention recommendations
        Respond in JSON format."""

        user_prompt = f"""Complaint: {text}

ML Analysis:
- Category: {ml_result.get('category', {}).get('category', 'unknown')}
- Priority: {ml_result.get('priority', {}).get('priority', 'medium')}
- Keywords: {ml_result.get('keywords', [])}

Provide enhanced analysis in JSON format with keys:
summary, detailed_actions (array), root_cause, prevention_tips (array), similar_issues_to_check (array)"""

        try:
            response = await self._call_gpt(system_prompt, user_prompt)
            if response:
                import json
                # Try to parse JSON from response
                try:
                    return json.loads(response)
                except json.JSONDecodeError:
                    # Extract JSON from markdown code block if present
                    import re
                    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(1))
                    return {"summary": response}
        except Exception as e:
            logger.error("GPT enhancement failed", error=str(e))
            return None

    async def generate_response_templates(self, complaint_text: str, category: str) -> Optional[list]:
        """Generate response templates for staff."""
        if not self.is_available:
            return None

        system_prompt = """You are a hostel management communication expert.
        Generate 3 professional response templates for the given complaint.
        Each template should be ready to send to the resident.
        Return as JSON array of objects with 'tone' and 'message' keys.
        Tones: 'formal', 'empathetic', 'brief'."""

        user_prompt = f"Complaint Category: {category}\nComplaint: {complaint_text}"

        try:
            response = await self._call_gpt(system_prompt, user_prompt, max_tokens=1000)
            if response:
                import json
                try:
                    return json.loads(response)
                except json.JSONDecodeError:
                    import re
                    json_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", response, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(1))
            return None
        except Exception as e:
            logger.error("Response template generation failed", error=str(e))
            return None

    async def generate_insights(self, stats: dict) -> Optional[dict]:
        """Generate dashboard insights from system statistics."""
        if not self.is_available:
            return None

        system_prompt = """You are a hostel operations analytics expert.
        Analyze the provided statistics and generate actionable insights.
        Return JSON with: alerts (array), recommendations (array),
        trends (array), summary (string)."""

        user_prompt = f"System Statistics:\n{stats}"

        try:
            response = await self._call_gpt(system_prompt, user_prompt)
            if response:
                import json
                try:
                    return json.loads(response)
                except json.JSONDecodeError:
                    return {"summary": response, "alerts": [], "recommendations": [], "trends": []}
            return None
        except Exception as e:
            logger.error("Insight generation failed", error=str(e))
            return None

    async def optimize_task_route(self, rooms: list, staff_location: str = None) -> Optional[dict]:
        """Use GPT to optimize cleaning task routes."""
        if not self.is_available:
            return None

        system_prompt = """You are a logistics optimization expert for hostel operations.
        Given a list of rooms to clean/inspect, optimize the route for efficiency.
        Consider floor proximity, task type, and urgency.
        Return JSON with: optimized_order (array of room objects with estimated_time),
        total_estimated_minutes, efficiency_tips (array)."""

        user_prompt = f"""Rooms to service: {rooms}
Staff starting location: {staff_location or 'Reception'}
Optimize the route for minimum travel time and maximum efficiency."""

        try:
            response = await self._call_gpt(system_prompt, user_prompt)
            if response:
                import json
                try:
                    return json.loads(response)
                except json.JSONDecodeError:
                    return {"optimized_order": rooms, "total_estimated_minutes": len(rooms) * 15}
            return None
        except Exception as e:
            logger.error("Route optimization failed", error=str(e))
            return None

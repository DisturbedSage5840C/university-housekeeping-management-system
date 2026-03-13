"""
NLP Service - Natural Language Processing for complaint analysis
"""
import re
import structlog
from typing import Optional
from textblob import TextBlob

logger = structlog.get_logger()


class NLPService:
    """Advanced NLP processing for hostel complaints."""

    def __init__(self):
        self.urgency_keywords = {
            "critical": [
                "fire", "flood", "emergency", "danger", "unsafe", "collapse",
                "electrocution", "gas leak", "explosion", "smoke", "theft",
                "assault", "break in", "sparking", "exposed wire", "burst",
            ],
            "high": [
                "urgent", "immediately", "asap", "serious", "severe", "broken",
                "overflow", "leak", "blocked", "stuck", "critical", "hazard",
                "no water", "no power", "outage", "security", "stolen",
            ],
            "medium": [
                "not working", "slow", "dirty", "noisy", "damaged", "cracked",
                "stain", "smell", "odor", "clogged", "dripping", "pest",
            ],
            "low": [
                "minor", "small", "cosmetic", "request", "extra", "need",
                "could you", "would be nice", "suggestion", "prefer",
            ]
        }

    def analyze_text(self, text: str) -> dict:
        """Comprehensive NLP analysis of complaint text."""
        blob = TextBlob(text)

        sentiment = self._analyze_sentiment(blob)
        urgency = self._detect_urgency(text)
        entities = self._extract_entities(text)
        room_info = self._extract_room_info(text)
        language_quality = self._assess_language_quality(blob)

        return {
            "sentiment": sentiment,
            "urgency": urgency,
            "entities": entities,
            "room_info": room_info,
            "language_quality": language_quality,
            "word_count": len(text.split()),
            "is_actionable": urgency["level"] != "unclear" and len(text.split()) >= 3,
        }

    def _analyze_sentiment(self, blob: TextBlob) -> dict:
        """Analyze sentiment polarity and subjectivity."""
        return {
            "polarity": round(blob.sentiment.polarity, 4),
            "subjectivity": round(blob.sentiment.subjectivity, 4),
            "label": (
                "very_negative" if blob.sentiment.polarity < -0.5
                else "negative" if blob.sentiment.polarity < -0.1
                else "neutral" if blob.sentiment.polarity < 0.1
                else "positive" if blob.sentiment.polarity < 0.5
                else "very_positive"
            ),
        }

    def _detect_urgency(self, text: str) -> dict:
        """Detect urgency level from text keywords."""
        text_lower = text.lower()
        matched = {}

        for level, keywords in self.urgency_keywords.items():
            matches = [kw for kw in keywords if kw in text_lower]
            if matches:
                matched[level] = matches

        if "critical" in matched:
            return {"level": "critical", "keywords": matched.get("critical", []), "score": 1.0}
        elif "high" in matched:
            return {"level": "high", "keywords": matched.get("high", []), "score": 0.75}
        elif "medium" in matched:
            return {"level": "medium", "keywords": matched.get("medium", []), "score": 0.5}
        elif "low" in matched:
            return {"level": "low", "keywords": matched.get("low", []), "score": 0.25}
        else:
            return {"level": "medium", "keywords": [], "score": 0.5}

    def _extract_entities(self, text: str) -> dict:
        """Extract relevant entities from text."""
        entities = {
            "locations": [],
            "items": [],
            "people": [],
        }

        # Location patterns
        location_patterns = [
            r"room\s*#?\s*(\d+)",
            r"floor\s*#?\s*(\d+)",
            r"wing\s+([A-Za-z])",
            r"block\s+([A-Za-z])",
            r"corridor", r"hallway", r"bathroom", r"kitchen",
            r"laundry", r"common\s+area", r"lobby", r"parking",
            r"balcony", r"terrace", r"staircase", r"elevator",
        ]

        text_lower = text.lower()
        for pattern in location_patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                entities["locations"].extend(
                    matches if isinstance(matches[0], str) else [m for m in matches]
                )

        # Item patterns
        item_patterns = [
            r"(ac|air\s*conditioner)", r"(fan)", r"(light|bulb|tube)",
            r"(tap|faucet)", r"(toilet)", r"(sink)", r"(shower)",
            r"(bed|mattress)", r"(chair|table|desk)", r"(wardrobe|cupboard)",
            r"(door|window)", r"(pipe)", r"(switch|socket|outlet)",
            r"(router|wifi)", r"(geyser|heater)", r"(washing\s*machine)",
        ]

        for pattern in item_patterns:
            if re.search(pattern, text_lower):
                entities["items"].append(re.search(pattern, text_lower).group())

        return entities

    def _extract_room_info(self, text: str) -> Optional[dict]:
        """Extract room number and floor info."""
        room_match = re.search(r"room\s*#?\s*(\d+)", text, re.IGNORECASE)
        floor_match = re.search(r"floor\s*#?\s*(\d+)", text, re.IGNORECASE)

        if room_match or floor_match:
            info = {}
            if room_match:
                info["room_number"] = room_match.group(1)
            if floor_match:
                info["floor"] = int(floor_match.group(1))
            elif room_match:
                # Infer floor from room number
                room_num = int(room_match.group(1))
                if room_num >= 100:
                    info["floor"] = room_num // 100
            return info
        return None

    def _assess_language_quality(self, blob: TextBlob) -> dict:
        """Assess the quality of the complaint text."""
        words = blob.words
        word_count = len(words)

        return {
            "is_descriptive": word_count >= 5,
            "has_specifics": word_count >= 8,
            "clarity_score": min(1.0, word_count / 15),
        }

    def generate_summary(self, text: str, max_length: int = 50) -> str:
        """Generate a short summary of the complaint."""
        sentences = TextBlob(text).sentences
        if not sentences:
            return text[:max_length]

        # Return first sentence truncated
        summary = str(sentences[0])
        if len(summary) > max_length:
            summary = summary[:max_length - 3] + "..."
        return summary

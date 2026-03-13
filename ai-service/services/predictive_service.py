"""
Predictive Service - Time series and pattern analysis for maintenance prediction
"""
import numpy as np
import structlog
from datetime import datetime, timedelta
from typing import Optional
from collections import Counter

logger = structlog.get_logger()


class PredictiveService:
    """Predictive analytics for hostel maintenance and operations."""

    def __init__(self):
        self.category_weights = {
            "plumbing": 1.2, "electrical": 1.3, "cleaning": 0.8,
            "furniture": 0.6, "pest_control": 1.1, "maintenance": 1.0,
            "hvac": 1.1, "security": 1.4, "internet": 0.7,
            "appliance": 0.8, "noise": 0.5, "other": 0.6,
        }

    def predict_maintenance(self, historical_data: list[dict]) -> dict:
        """Predict upcoming maintenance needs based on historical patterns."""
        if not historical_data:
            return self._default_prediction()

        # Analyze patterns
        category_counts = Counter(d.get("category", "other") for d in historical_data)
        monthly_trends = self._compute_monthly_trends(historical_data)
        seasonal_patterns = self._detect_seasonal_patterns(historical_data)
        hotspots = self._identify_hotspots(historical_data)

        # Generate predictions
        predictions = []
        for category, count in category_counts.most_common(5):
            trend = monthly_trends.get(category, 0)
            weight = self.category_weights.get(category, 1.0)

            # Prediction score based on frequency, trend, and weight
            score = min(1.0, (count / max(len(historical_data), 1)) * weight * (1 + trend))

            predictions.append({
                "category": category,
                "probability": round(score, 3),
                "trend": "increasing" if trend > 0.1 else "decreasing" if trend < -0.1 else "stable",
                "historical_count": count,
                "expected_next_30_days": max(1, int(count * (1 + trend) / max(1, self._months_span(historical_data)))),
                "recommended_action": self._get_preventive_action(category, score),
            })

        return {
            "predictions": sorted(predictions, key=lambda x: x["probability"], reverse=True),
            "hotspot_rooms": hotspots[:10],
            "seasonal_patterns": seasonal_patterns,
            "overall_trend": self._compute_overall_trend(historical_data),
            "predicted_at": datetime.utcnow().isoformat(),
        }

    def _compute_monthly_trends(self, data: list[dict]) -> dict:
        """Compute month-over-month trend for each category."""
        trends = {}
        now = datetime.utcnow()

        for category in set(d.get("category", "other") for d in data):
            cat_data = [d for d in data if d.get("category") == category]

            # Last 30 days vs previous 30 days
            recent = sum(1 for d in cat_data if self._parse_date(d) >= now - timedelta(days=30))
            previous = sum(1 for d in cat_data if now - timedelta(days=60) <= self._parse_date(d) < now - timedelta(days=30))

            if previous > 0:
                trends[category] = (recent - previous) / previous
            elif recent > 0:
                trends[category] = 0.5  # New category appearing
            else:
                trends[category] = 0.0

        return trends

    def _detect_seasonal_patterns(self, data: list[dict]) -> list[dict]:
        """Detect seasonal patterns in complaints."""
        patterns = []

        # Group by month
        monthly = {}
        for d in data:
            dt = self._parse_date(d)
            month_key = dt.strftime("%B")
            monthly.setdefault(month_key, []).append(d)

        # Find peaks
        if monthly:
            avg_per_month = np.mean([len(v) for v in monthly.values()])
            for month, complaints in monthly.items():
                if len(complaints) > avg_per_month * 1.3:
                    top_categories = Counter(c.get("category", "other") for c in complaints).most_common(3)
                    patterns.append({
                        "month": month,
                        "spike_factor": round(len(complaints) / max(1, avg_per_month), 2),
                        "top_categories": [{"category": c, "count": n} for c, n in top_categories],
                    })

        return patterns

    def _identify_hotspots(self, data: list[dict]) -> list[dict]:
        """Identify rooms with most frequent issues."""
        room_counts = Counter()
        room_categories = {}

        for d in data:
            room = d.get("room_number") or d.get("room")
            if room:
                room_counts[room] += 1
                room_categories.setdefault(room, []).append(d.get("category", "other"))

        hotspots = []
        for room, count in room_counts.most_common(10):
            categories = Counter(room_categories.get(room, [])).most_common(3)
            hotspots.append({
                "room": room,
                "complaint_count": count,
                "top_issues": [{"category": c, "count": n} for c, n in categories],
                "risk_level": "high" if count > 5 else "medium" if count > 2 else "low",
            })

        return hotspots

    def _compute_overall_trend(self, data: list[dict]) -> dict:
        """Compute overall complaint trend."""
        now = datetime.utcnow()
        recent_30 = sum(1 for d in data if self._parse_date(d) >= now - timedelta(days=30))
        previous_30 = sum(1 for d in data if now - timedelta(days=60) <= self._parse_date(d) < now - timedelta(days=30))

        if previous_30 > 0:
            change = ((recent_30 - previous_30) / previous_30) * 100
        elif recent_30 > 0:
            change = 100
        else:
            change = 0

        return {
            "direction": "increasing" if change > 10 else "decreasing" if change < -10 else "stable",
            "change_percent": round(change, 1),
            "recent_30_days": recent_30,
            "previous_30_days": previous_30,
        }

    def _get_preventive_action(self, category: str, probability: float) -> str:
        """Get preventive maintenance recommendation."""
        actions = {
            "plumbing": "Schedule quarterly plumbing inspection across all floors",
            "electrical": "Conduct electrical safety audit of all rooms and common areas",
            "cleaning": "Review and optimize cleaning schedules and staffing levels",
            "furniture": "Perform furniture condition assessment across all rooms",
            "pest_control": "Schedule preventive pest treatment for the entire hostel",
            "maintenance": "Plan comprehensive maintenance drive for high-risk areas",
            "hvac": "Service all HVAC units and replace filters",
            "security": "Review and upgrade security infrastructure",
            "internet": "Upgrade network infrastructure and test coverage",
            "appliance": "Inspect and service all common appliances",
            "noise": "Review and enforce quiet hours policy",
            "other": "Conduct general facility assessment",
        }

        action = actions.get(category, actions["other"])
        if probability > 0.7:
            return f"URGENT: {action}"
        return action

    def _parse_date(self, data: dict) -> datetime:
        """Parse date from complaint data."""
        date_str = data.get("created_at") or data.get("date") or data.get("timestamp")
        if isinstance(date_str, str):
            for fmt in ["%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
        return datetime.utcnow()

    def _months_span(self, data: list[dict]) -> int:
        """Calculate number of months the data spans."""
        if not data:
            return 1
        dates = [self._parse_date(d) for d in data]
        span = (max(dates) - min(dates)).days / 30
        return max(1, int(span))

    def _default_prediction(self) -> dict:
        """Return default prediction when no historical data available."""
        return {
            "predictions": [
                {"category": "cleaning", "probability": 0.5, "trend": "stable",
                 "historical_count": 0, "expected_next_30_days": 5,
                 "recommended_action": "Maintain regular cleaning schedules"},
                {"category": "plumbing", "probability": 0.3, "trend": "stable",
                 "historical_count": 0, "expected_next_30_days": 2,
                 "recommended_action": "Schedule quarterly plumbing checks"},
            ],
            "hotspot_rooms": [],
            "seasonal_patterns": [],
            "overall_trend": {"direction": "stable", "change_percent": 0,
                              "recent_30_days": 0, "previous_30_days": 0},
            "predicted_at": datetime.utcnow().isoformat(),
        }

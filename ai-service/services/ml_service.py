"""
ML Service - Core Machine Learning Pipeline
Handles model loading, training, prediction for all ML features
"""
import os
import json
import numpy as np
import joblib
import structlog
from typing import Optional
from datetime import datetime, timedelta

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder

from config import settings

logger = structlog.get_logger()


class MLService:
    """Production ML service with model lifecycle management."""

    def __init__(self):
        self.complaint_classifier: Optional[Pipeline] = None
        self.priority_predictor: Optional[Pipeline] = None
        self.category_encoder: Optional[LabelEncoder] = None
        self.priority_encoder: Optional[LabelEncoder] = None
        self.is_initialized = False

        # Training data for initial bootstrap
        self.categories = [
            "plumbing", "electrical", "cleaning", "furniture",
            "pest_control", "noise", "security", "maintenance",
            "internet", "appliance", "hvac", "other"
        ]
        self.priorities = ["low", "medium", "high", "critical"]

    async def initialize(self):
        """Load or train ML models on startup."""
        model_dir = settings.MODEL_DIR
        os.makedirs(model_dir, exist_ok=True)

        classifier_path = os.path.join(model_dir, "complaint_classifier.joblib")
        priority_path = os.path.join(model_dir, "priority_predictor.joblib")
        cat_encoder_path = os.path.join(model_dir, "category_encoder.joblib")
        pri_encoder_path = os.path.join(model_dir, "priority_encoder.joblib")

        if os.path.exists(classifier_path) and os.path.exists(priority_path):
            logger.info("Loading pre-trained models")
            self.complaint_classifier = joblib.load(classifier_path)
            self.priority_predictor = joblib.load(priority_path)
            self.category_encoder = joblib.load(cat_encoder_path)
            self.priority_encoder = joblib.load(pri_encoder_path)
        else:
            logger.info("Training initial models with bootstrap data")
            await self._train_initial_models()
            # Save models
            joblib.dump(self.complaint_classifier, classifier_path)
            joblib.dump(self.priority_predictor, priority_path)
            joblib.dump(self.category_encoder, cat_encoder_path)
            joblib.dump(self.priority_encoder, pri_encoder_path)
            logger.info("Models saved to disk")

        self.is_initialized = True

    async def _train_initial_models(self):
        """Train models with comprehensive bootstrap training data."""
        training_data = self._get_training_data()

        texts = [item["text"] for item in training_data]
        categories = [item["category"] for item in training_data]
        priorities = [item["priority"] for item in training_data]

        # Encode labels
        self.category_encoder = LabelEncoder()
        self.priority_encoder = LabelEncoder()
        cat_labels = self.category_encoder.fit_transform(categories)
        pri_labels = self.priority_encoder.fit_transform(priorities)

        # Complaint Category Classifier
        self.complaint_classifier = Pipeline([
            ("tfidf", TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 3),
                stop_words="english",
                min_df=1,
                sublinear_tf=True,
            )),
            ("clf", RandomForestClassifier(
                n_estimators=200,
                max_depth=20,
                min_samples_split=2,
                min_samples_leaf=1,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            )),
        ])

        self.complaint_classifier.fit(texts, cat_labels)

        # Priority Predictor
        self.priority_predictor = Pipeline([
            ("tfidf", TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 3),
                stop_words="english",
                min_df=1,
                sublinear_tf=True,
            )),
            ("clf", GradientBoostingClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
            )),
        ])

        self.priority_predictor.fit(texts, pri_labels)

        # Log training metrics
        cat_scores = cross_val_score(self.complaint_classifier, texts, cat_labels, cv=3, scoring="accuracy")
        pri_scores = cross_val_score(self.priority_predictor, texts, pri_labels, cv=3, scoring="accuracy")
        logger.info("Model training complete",
                     category_accuracy=f"{cat_scores.mean():.3f}",
                     priority_accuracy=f"{pri_scores.mean():.3f}")

    def classify_complaint(self, text: str) -> dict:
        """Classify complaint category with confidence scores."""
        if not self.is_initialized:
            return {"category": "other", "confidence": 0.0, "all_scores": {}}

        cat_pred = self.complaint_classifier.predict([text])[0]
        cat_proba = self.complaint_classifier.predict_proba([text])[0]

        category = self.category_encoder.inverse_transform([cat_pred])[0]
        confidence = float(max(cat_proba))

        # Get all category scores
        all_scores = {}
        for idx, score in enumerate(cat_proba):
            cat_name = self.category_encoder.inverse_transform([idx])[0]
            all_scores[cat_name] = round(float(score), 4)

        # Sort by score
        all_scores = dict(sorted(all_scores.items(), key=lambda x: x[1], reverse=True))

        return {
            "category": category,
            "confidence": round(confidence, 4),
            "all_scores": all_scores,
        }

    def predict_priority(self, text: str) -> dict:
        """Predict complaint priority with confidence."""
        if not self.is_initialized:
            return {"priority": "medium", "confidence": 0.0, "all_scores": {}}

        pri_pred = self.priority_predictor.predict([text])[0]
        pri_proba = self.priority_predictor.predict_proba([text])[0]

        priority = self.priority_encoder.inverse_transform([pri_pred])[0]
        confidence = float(max(pri_proba))

        all_scores = {}
        for idx, score in enumerate(pri_proba):
            pri_name = self.priority_encoder.inverse_transform([idx])[0]
            all_scores[pri_name] = round(float(score), 4)

        all_scores = dict(sorted(all_scores.items(), key=lambda x: x[1], reverse=True))

        return {
            "priority": priority,
            "confidence": round(confidence, 4),
            "all_scores": all_scores,
        }

    def analyze_complaint(self, text: str, metadata: dict = None) -> dict:
        """Full complaint analysis pipeline."""
        category_result = self.classify_complaint(text)
        priority_result = self.predict_priority(text)

        # Extract keywords using TF-IDF
        keywords = self._extract_keywords(text)

        # Determine suggested actions
        actions = self._suggest_actions(category_result["category"], priority_result["priority"])

        # Estimate resolution time
        resolution_estimate = self._estimate_resolution_time(
            category_result["category"], priority_result["priority"]
        )

        return {
            "category": category_result,
            "priority": priority_result,
            "keywords": keywords,
            "suggested_actions": actions,
            "estimated_resolution_hours": resolution_estimate,
            "requires_immediate_attention": priority_result["priority"] in ["critical", "high"],
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    def _extract_keywords(self, text: str, top_n: int = 5) -> list[str]:
        """Extract top keywords using TF-IDF."""
        tfidf = self.complaint_classifier.named_steps["tfidf"]
        tfidf_matrix = tfidf.transform([text])
        feature_names = tfidf.get_feature_names_out()

        scores = tfidf_matrix.toarray()[0]
        top_indices = np.argsort(scores)[-top_n:][::-1]

        return [feature_names[i] for i in top_indices if scores[i] > 0]

    def _suggest_actions(self, category: str, priority: str) -> list[str]:
        """Suggest resolution actions based on category and priority."""
        action_map = {
            "plumbing": [
                "Dispatch plumbing team to inspect",
                "Check for water damage in adjacent rooms",
                "Document leak/blockage severity with photos",
                "Assess if water supply needs temporary shutoff",
            ],
            "electrical": [
                "Send electrician for safety inspection",
                "Ensure area is safe (no exposed wires)",
                "Check circuit breakers and wiring",
                "Test all outlets and switches in room",
            ],
            "cleaning": [
                "Schedule deep cleaning of the area",
                "Assign housekeeping staff for immediate cleaning",
                "Restock cleaning supplies if needed",
                "Follow up with resident after cleaning",
            ],
            "furniture": [
                "Inspect damaged furniture",
                "Arrange replacement or repair",
                "Check inventory for available replacements",
                "Schedule furniture delivery/installation",
            ],
            "pest_control": [
                "Schedule pest control inspection",
                "Identify pest type and infestation level",
                "Apply appropriate treatment",
                "Inspect neighboring rooms for spread",
                "Schedule follow-up treatment in 2 weeks",
            ],
            "noise": [
                "Issue noise warning to source",
                "Document noise complaint details",
                "Check if quiet hours policy violated",
                "Consider room reassignment if persistent",
            ],
            "security": [
                "Dispatch security personnel immediately",
                "Review CCTV footage if available",
                "Document incident details",
                "Notify hostel management",
                "File police report if needed",
            ],
            "maintenance": [
                "Schedule maintenance inspection",
                "Assess repair requirements",
                "Order replacement parts if needed",
                "Arrange repair appointment with resident",
            ],
            "internet": [
                "Check network connectivity in the area",
                "Restart local router/access point",
                "Contact ISP if widespread issue",
                "Provide temporary hotspot if extended outage",
            ],
            "appliance": [
                "Inspect faulty appliance",
                "Check warranty status",
                "Arrange repair or replacement",
                "Provide temporary alternative if available",
            ],
            "hvac": [
                "Check HVAC system settings",
                "Inspect filters and vents",
                "Schedule AC/heating technician",
                "Monitor temperature after fix",
            ],
            "other": [
                "Review complaint details",
                "Assign to appropriate department",
                "Follow up with resident for clarification",
                "Escalate to management if needed",
            ],
        }

        actions = action_map.get(category, action_map["other"])

        if priority in ["critical", "high"]:
            actions.insert(0, "URGENT: Escalate to supervisor immediately")
            actions.insert(1, "Notify hostel warden within 30 minutes")

        return actions

    def _estimate_resolution_time(self, category: str, priority: str) -> float:
        """Estimate resolution time in hours."""
        base_hours = {
            "plumbing": 6, "electrical": 4, "cleaning": 2, "furniture": 24,
            "pest_control": 48, "noise": 1, "security": 2, "maintenance": 12,
            "internet": 4, "appliance": 24, "hvac": 8, "other": 12,
        }

        priority_multiplier = {
            "critical": 0.25, "high": 0.5, "medium": 1.0, "low": 1.5,
        }

        base = base_hours.get(category, 12)
        multiplier = priority_multiplier.get(priority, 1.0)
        return round(base * multiplier, 1)

    async def retrain(self, new_data: list[dict]):
        """Retrain models with new data (incremental learning)."""
        if not new_data:
            return

        logger.info("Retraining models", new_samples=len(new_data))

        existing_data = self._get_training_data()
        combined_data = existing_data + new_data

        texts = [item["text"] for item in combined_data]
        categories = [item["category"] for item in combined_data]
        priorities = [item["priority"] for item in combined_data]

        cat_labels = self.category_encoder.fit_transform(categories)
        pri_labels = self.priority_encoder.fit_transform(priorities)

        self.complaint_classifier.fit(texts, cat_labels)
        self.priority_predictor.fit(texts, pri_labels)

        # Save updated models
        model_dir = settings.MODEL_DIR
        joblib.dump(self.complaint_classifier, os.path.join(model_dir, "complaint_classifier.joblib"))
        joblib.dump(self.priority_predictor, os.path.join(model_dir, "priority_predictor.joblib"))
        joblib.dump(self.category_encoder, os.path.join(model_dir, "category_encoder.joblib"))
        joblib.dump(self.priority_encoder, os.path.join(model_dir, "priority_encoder.joblib"))

        logger.info("Model retraining complete", total_samples=len(combined_data))

    def _get_training_data(self) -> list[dict]:
        """Comprehensive bootstrap training data for hostel complaint classification."""
        return [
            # Plumbing
            {"text": "Water leaking from bathroom ceiling badly", "category": "plumbing", "priority": "high"},
            {"text": "Toilet is clogged and overflowing", "category": "plumbing", "priority": "critical"},
            {"text": "Sink faucet dripping non-stop all night", "category": "plumbing", "priority": "medium"},
            {"text": "No hot water in the shower for 3 days", "category": "plumbing", "priority": "high"},
            {"text": "Water pressure is very low in my room", "category": "plumbing", "priority": "medium"},
            {"text": "Bathroom drain is blocked with hair and soap", "category": "plumbing", "priority": "medium"},
            {"text": "Pipe burst in the corridor flooding the floor", "category": "plumbing", "priority": "critical"},
            {"text": "Washbasin tap handle broke off", "category": "plumbing", "priority": "medium"},
            {"text": "Sewage smell coming from bathroom drain", "category": "plumbing", "priority": "high"},
            {"text": "Water is brown and rusty coming from tap", "category": "plumbing", "priority": "high"},

            # Electrical
            {"text": "Power outlet sparking when plugging in charger", "category": "electrical", "priority": "critical"},
            {"text": "Room light flickering constantly", "category": "electrical", "priority": "medium"},
            {"text": "Complete power outage in room 302", "category": "electrical", "priority": "high"},
            {"text": "Fan making grinding noise and stopping randomly", "category": "electrical", "priority": "medium"},
            {"text": "Switch board is broken and wires are exposed", "category": "electrical", "priority": "critical"},
            {"text": "Corridor lights are not working at night", "category": "electrical", "priority": "high"},
            {"text": "MCB keeps tripping every few hours", "category": "electrical", "priority": "high"},
            {"text": "Socket burnt and melted near bed", "category": "electrical", "priority": "critical"},
            {"text": "Tube light buzzing sound very loudly", "category": "electrical", "priority": "low"},
            {"text": "Emergency light not charging properly", "category": "electrical", "priority": "medium"},

            # Cleaning
            {"text": "Room not cleaned for past 3 days", "category": "cleaning", "priority": "medium"},
            {"text": "Bathroom is very dirty and stinks", "category": "cleaning", "priority": "high"},
            {"text": "Dustbin overflowing in corridor", "category": "cleaning", "priority": "medium"},
            {"text": "Stains on bed sheets need replacement", "category": "cleaning", "priority": "medium"},
            {"text": "Common area floors are filthy and sticky", "category": "cleaning", "priority": "high"},
            {"text": "Cobwebs all over ceiling and corners", "category": "cleaning", "priority": "low"},
            {"text": "Vomit stain in hallway needs cleaning urgently", "category": "cleaning", "priority": "critical"},
            {"text": "Washroom needs deep cleaning and sanitization", "category": "cleaning", "priority": "high"},
            {"text": "Mold growing on bathroom walls", "category": "cleaning", "priority": "high"},
            {"text": "Garbage not collected from wing B", "category": "cleaning", "priority": "medium"},

            # Furniture
            {"text": "Chair leg is broken and wobbling", "category": "furniture", "priority": "low"},
            {"text": "Bed frame collapsed while sleeping", "category": "furniture", "priority": "high"},
            {"text": "Wardrobe door hinge broken falls off", "category": "furniture", "priority": "medium"},
            {"text": "Study table drawer is jammed stuck", "category": "furniture", "priority": "low"},
            {"text": "Mattress has springs poking through", "category": "furniture", "priority": "medium"},
            {"text": "Window curtain rod fell down", "category": "furniture", "priority": "low"},
            {"text": "Bookshelf is leaning and about to fall", "category": "furniture", "priority": "high"},
            {"text": "Room door lock not working properly", "category": "furniture", "priority": "high"},
            {"text": "Desk lamp is broken need new one", "category": "furniture", "priority": "low"},
            {"text": "Mirror in room is cracked", "category": "furniture", "priority": "low"},

            # Pest Control
            {"text": "Cockroaches everywhere in kitchen area", "category": "pest_control", "priority": "high"},
            {"text": "Found bed bugs biting me at night", "category": "pest_control", "priority": "critical"},
            {"text": "Rats running in the corridor at night", "category": "pest_control", "priority": "high"},
            {"text": "Mosquitoes breeding in stagnant water outside", "category": "pest_control", "priority": "high"},
            {"text": "Ants crawling all over food storage area", "category": "pest_control", "priority": "medium"},
            {"text": "Termites eating wooden furniture", "category": "pest_control", "priority": "high"},
            {"text": "Spider webs and large spiders in room", "category": "pest_control", "priority": "low"},
            {"text": "Lizards everywhere on walls and ceiling", "category": "pest_control", "priority": "low"},
            {"text": "Found mouse droppings in kitchen drawer", "category": "pest_control", "priority": "high"},
            {"text": "Wasp nest near window very dangerous", "category": "pest_control", "priority": "critical"},

            # Noise
            {"text": "Loud music from room 405 at 2am", "category": "noise", "priority": "high"},
            {"text": "Construction noise starting at 6am every day", "category": "noise", "priority": "medium"},
            {"text": "Neighbours partying late night every weekend", "category": "noise", "priority": "medium"},
            {"text": "Generator noise is unbearable at night", "category": "noise", "priority": "high"},
            {"text": "People shouting in corridor during exam time", "category": "noise", "priority": "medium"},
            {"text": "Loud TV volume from adjacent room late night", "category": "noise", "priority": "low"},
            {"text": "Constant banging and thumping from above", "category": "noise", "priority": "medium"},
            {"text": "Water pump making excessive noise", "category": "noise", "priority": "medium"},

            # Security
            {"text": "Someone tried to break into my room", "category": "security", "priority": "critical"},
            {"text": "Main gate lock is broken anyone can enter", "category": "security", "priority": "critical"},
            {"text": "Suspicious person loitering in hostel", "category": "security", "priority": "high"},
            {"text": "My belongings were stolen from room", "category": "security", "priority": "critical"},
            {"text": "CCTV camera in corridor not working", "category": "security", "priority": "high"},
            {"text": "Fire extinguisher is expired needs replacement", "category": "security", "priority": "high"},
            {"text": "Emergency exit blocked by furniture", "category": "security", "priority": "critical"},
            {"text": "Window lock is broken ground floor room", "category": "security", "priority": "high"},

            # Maintenance
            {"text": "Wall paint is peeling off in room", "category": "maintenance", "priority": "low"},
            {"text": "Floor tiles are cracked and sharp edges", "category": "maintenance", "priority": "medium"},
            {"text": "Window glass is cracked leaking rain water", "category": "maintenance", "priority": "high"},
            {"text": "Roof leaking during heavy rain", "category": "maintenance", "priority": "high"},
            {"text": "Door does not close properly gaps visible", "category": "maintenance", "priority": "medium"},
            {"text": "Ceiling plaster falling off in chunks", "category": "maintenance", "priority": "high"},
            {"text": "Balcony railing is loose and unsafe", "category": "maintenance", "priority": "critical"},
            {"text": "Staircase railing broken on 3rd floor", "category": "maintenance", "priority": "high"},
            {"text": "Wall has developed big crack near window", "category": "maintenance", "priority": "high"},
            {"text": "Gutter outside room is broken overflowing", "category": "maintenance", "priority": "medium"},

            # Internet
            {"text": "WiFi not working in entire wing A", "category": "internet", "priority": "high"},
            {"text": "Internet speed is extremely slow cannot stream", "category": "internet", "priority": "medium"},
            {"text": "WiFi keeps disconnecting every few minutes", "category": "internet", "priority": "medium"},
            {"text": "Cannot connect to hostel WiFi network", "category": "internet", "priority": "medium"},
            {"text": "LAN port in room not working at all", "category": "internet", "priority": "medium"},
            {"text": "WiFi router in common room is down", "category": "internet", "priority": "high"},
            {"text": "Internet outage since yesterday morning", "category": "internet", "priority": "high"},
            {"text": "Very high ping and packet loss on WiFi", "category": "internet", "priority": "low"},

            # Appliance
            {"text": "Room AC not cooling at all very hot", "category": "appliance", "priority": "high"},
            {"text": "Washing machine in laundry room is broken", "category": "appliance", "priority": "medium"},
            {"text": "Water cooler not dispensing cold water", "category": "appliance", "priority": "medium"},
            {"text": "Geyser leaking water from bottom", "category": "appliance", "priority": "high"},
            {"text": "Microwave in common kitchen sparking inside", "category": "appliance", "priority": "critical"},
            {"text": "Iron box not heating up properly", "category": "appliance", "priority": "low"},
            {"text": "Refrigerator making loud humming noise", "category": "appliance", "priority": "low"},
            {"text": "Water purifier filter needs change tastes bad", "category": "appliance", "priority": "medium"},

            # HVAC
            {"text": "Central heating not working room freezing cold", "category": "hvac", "priority": "high"},
            {"text": "AC vent blowing hot air instead of cool", "category": "hvac", "priority": "high"},
            {"text": "Thermostat display is broken cannot set temp", "category": "hvac", "priority": "medium"},
            {"text": "Air conditioning unit leaking water on floor", "category": "hvac", "priority": "high"},
            {"text": "Room ventilation very poor stuffy and humid", "category": "hvac", "priority": "medium"},
            {"text": "Exhaust fan in bathroom not working", "category": "hvac", "priority": "medium"},
            {"text": "Heater blowing fuse when turned on", "category": "hvac", "priority": "high"},
            {"text": "AC remote not working and cant turn it off", "category": "hvac", "priority": "medium"},

            # Other
            {"text": "Need extra blankets for winter season", "category": "other", "priority": "low"},
            {"text": "Requesting room change due to personal issues", "category": "other", "priority": "medium"},
            {"text": "Mess food quality is very poor", "category": "other", "priority": "medium"},
            {"text": "Parking space needed for my bicycle", "category": "other", "priority": "low"},
            {"text": "Laundry service schedule is inconvenient", "category": "other", "priority": "low"},
            {"text": "Need to report damaged common area equipment", "category": "other", "priority": "medium"},
        ]

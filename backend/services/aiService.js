/**
 * AI Service - Communicates with Python AI/ML microservice
 * Falls back to rule-based analysis when AI service is unavailable
 */
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('./cacheService');

class AIService {
    constructor() {
        this.baseUrl = config.ai.serviceUrl;
        this.apiKey = config.ai.apiKey;
        this.timeout = 15000; // 15 seconds
    }

    isAvailable() {
        return !!this.baseUrl;
    }

    async _callAI(endpoint, data) {
        try {
            // Dynamic import for node-fetch (CommonJS compatible)
            const fetch = (await import('node-fetch')).default;
            const url = `${this.baseUrl}${endpoint}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                throw new Error(`AI service responded with ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            logger.warn('AI service call failed', { endpoint, error: error.message });
            return null;
        }
    }

    /**
     * Analyze a complaint with ML + NLP
     */
    async analyzeComplaint(complaint) {
        // Check cache first
        const cacheKey = `ai:analyze:${complaint.description?.substring(0, 50)}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const result = await this._callAI('/api/v1/complaints/analyze', {
            text: complaint.description,
            room_number: complaint.room_number,
            include_gpt_enhancement: false,
        });

        if (result?.data) {
            await cache.set(cacheKey, result.data, 1800);
            return result.data;
        }

        return this.getFallbackAnalysis(complaint);
    }

    /**
     * Smart complaint categorization via ML
     */
    async categorizeComplaint(description) {
        const result = await this._callAI('/api/v1/complaints/categorize', {
            text: description,
        });

        if (result?.data) return result.data;
        return this.getFallbackCategorization(description);
    }

    /**
     * Optimize task schedule for staff
     */
    async optimizeTaskSchedule(tasks, staffId) {
        const rooms = tasks.map(t => ({
            room_number: t.room_number || `R${t.id}`,
            floor: t.floor_id || 1,
            task_type: t.type || 'cleaning',
            priority: t.priority || 'medium',
            estimated_minutes: 15,
        }));

        const result = await this._callAI('/api/v1/tasks/optimize-route', {
            rooms,
            staff_location: 'Reception',
        });

        if (result?.data) return result.data;
        return {
            optimizedOrder: tasks.map(t => t.id),
            reasoning: 'Default order (AI unavailable)',
            estimatedTotalTime: `${tasks.length * 15} minutes`,
        };
    }

    /**
     * Predictive maintenance insights
     */
    async predictMaintenanceNeeds(roomHistory) {
        const result = await this._callAI('/api/v1/predictions/maintenance', {
            historical_data: roomHistory,
            days_ahead: 30,
        });

        if (result?.data) return result.data;
        return { predictions: [], confidence: 0 };
    }

    /**
     * Generate response suggestions for complaints
     */
    async generateResponseSuggestions(complaint) {
        const result = await this._callAI('/api/v1/complaints/response-templates', {
            complaint_text: complaint.description,
            category: complaint.category,
        });

        if (result?.data) return result.data;
        return this.getFallbackResponses(complaint);
    }

    /**
     * Generate dashboard insights
     */
    async generateDashboardInsights(stats) {
        const result = await this._callAI('/api/v1/insights/dashboard', {
            stats,
            period: '7d',
        });

        if (result?.data) return result.data;
        return this.getFallbackInsights(stats);
    }

    // ---- Fallback methods when AI service is unavailable ----

    getFallbackAnalysis(complaint) {
        const priorityMap = {
            'electrical': 'high', 'plumbing': 'high', 'security': 'urgent',
            'pest_control': 'medium', 'cleaning': 'low', 'furniture': 'low',
            'hvac': 'medium', 'internet': 'medium', 'noise': 'low',
            'appliance': 'medium', 'maintenance': 'medium', 'other': 'medium',
        };

        const category = (complaint.category || 'other').toLowerCase();
        return {
            ml_analysis: {
                category: { category, confidence: 0.5 },
                priority: { priority: priorityMap[category] || 'medium', confidence: 0.5 },
                suggested_actions: ['Assess the issue', 'Assign appropriate staff', 'Follow up with resident'],
                estimated_resolution_hours: 24,
            },
            nlp_analysis: {
                sentiment: { label: 'negative', polarity: -0.3 },
                urgency: { level: priorityMap[category] === 'urgent' ? 'critical' : 'medium' },
            },
            summary: `${complaint.category} issue reported in room ${complaint.room_number}`,
            fallback: true,
        };
    }

    getFallbackCategorization(description) {
        const keywords = {
            'plumbing': ['leak', 'water', 'pipe', 'drain', 'toilet', 'faucet', 'shower', 'tap'],
            'electrical': ['light', 'power', 'switch', 'outlet', 'electrical', 'fan', 'sparking', 'wire'],
            'pest_control': ['bug', 'insect', 'cockroach', 'ant', 'pest', 'mouse', 'rat', 'lizard'],
            'furniture': ['chair', 'table', 'bed', 'desk', 'broken', 'furniture', 'mattress', 'wardrobe'],
            'cleaning': ['clean', 'dirty', 'dust', 'trash', 'smell', 'odor', 'stain', 'mold'],
            'internet': ['wifi', 'internet', 'network', 'router', 'connection'],
            'hvac': ['ac', 'air conditioner', 'heating', 'ventilation', 'temperature', 'hot', 'cold'],
            'security': ['lock', 'theft', 'stolen', 'break in', 'unsafe', 'cctv', 'gate'],
            'noise': ['noise', 'loud', 'music', 'shouting', 'disturbance'],
        };

        const lowerDesc = description.toLowerCase();
        for (const [category, words] of Object.entries(keywords)) {
            if (words.some(word => lowerDesc.includes(word))) {
                return { category: { category, confidence: 0.7 }, priority: { priority: 'medium', confidence: 0.5 } };
            }
        }
        return { category: { category: 'other', confidence: 0.5 }, priority: { priority: 'medium', confidence: 0.5 } };
    }

    getFallbackResponses(complaint) {
        return [
            {
                tone: 'formal',
                message: `Thank you for reporting this ${complaint.category} issue. We have received your complaint and will address it promptly.`,
            },
            {
                tone: 'empathetic',
                message: `We understand this ${complaint.category} issue is inconvenient. Our team is already on it and will resolve it soon.`,
            },
            {
                tone: 'brief',
                message: `Your ${complaint.category} complaint has been received. Expected resolution within 24 hours.`,
            },
        ];
    }

    getFallbackInsights(stats) {
        const insights = [];
        if (stats.pendingComplaints > 10) {
            insights.push('High number of pending complaints - consider adding more staff');
        }
        if (stats.cleanedToday < stats.totalRooms * 0.5) {
            insights.push('Cleaning progress below 50% - review task assignments');
        }
        return {
            summary: `${stats.totalRooms || 0} rooms, ${stats.pendingComplaints || 0} pending complaints`,
            insights: insights.length ? insights : ['Operations running normally'],
            recommendations: ['Continue monitoring daily metrics'],
            alerts: stats.pendingComplaints > 20 ? [{ level: 'warning', message: 'Many unresolved complaints' }] : [],
        };
    }
}

module.exports = new AIService();

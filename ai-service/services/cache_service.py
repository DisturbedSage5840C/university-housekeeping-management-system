"""
Cache Service - Redis caching layer for ML predictions
"""
import json
import hashlib
import structlog
from typing import Optional, Any

import redis.asyncio as redis

logger = structlog.get_logger()


class CacheService:
    """Redis-backed caching for ML predictions and API responses."""

    def __init__(self, redis_url: str, default_ttl: int = 3600):
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self.client: Optional[redis.Redis] = None

    async def connect(self):
        """Connect to Redis."""
        try:
            self.client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            await self.client.ping()
            logger.info("Redis cache connected")
        except Exception as e:
            logger.warning("Redis connection failed, caching disabled", error=str(e))
            self.client = None

    async def disconnect(self):
        """Disconnect from Redis."""
        if self.client:
            await self.client.close()

    def _make_key(self, prefix: str, data: str) -> str:
        """Create a cache key from prefix and data."""
        data_hash = hashlib.sha256(data.encode()).hexdigest()[:16]
        return f"ilgc:ai:{prefix}:{data_hash}"

    async def get(self, prefix: str, data: str) -> Optional[dict]:
        """Get cached result."""
        if not self.client:
            return None

        try:
            key = self._make_key(prefix, data)
            cached = await self.client.get(key)
            if cached:
                logger.debug("Cache hit", key=key)
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning("Cache get failed", error=str(e))
            return None

    async def set(self, prefix: str, data: str, value: Any, ttl: int = None):
        """Set cache value."""
        if not self.client:
            return

        try:
            key = self._make_key(prefix, data)
            await self.client.setex(
                key,
                ttl or self.default_ttl,
                json.dumps(value, default=str),
            )
            logger.debug("Cache set", key=key, ttl=ttl or self.default_ttl)
        except Exception as e:
            logger.warning("Cache set failed", error=str(e))

    async def invalidate(self, prefix: str, data: str):
        """Invalidate a cache entry."""
        if not self.client:
            return

        try:
            key = self._make_key(prefix, data)
            await self.client.delete(key)
        except Exception as e:
            logger.warning("Cache invalidate failed", error=str(e))

    async def clear_prefix(self, prefix: str):
        """Clear all cache entries with a given prefix."""
        if not self.client:
            return

        try:
            pattern = f"ilgc:ai:{prefix}:*"
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(cursor, match=pattern, count=100)
                if keys:
                    await self.client.delete(*keys)
                if cursor == 0:
                    break
            logger.info("Cache cleared", prefix=prefix)
        except Exception as e:
            logger.warning("Cache clear failed", error=str(e))

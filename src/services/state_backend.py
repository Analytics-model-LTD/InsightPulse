import hashlib
import json
from datetime import datetime, timezone
from io import StringIO
from typing import Any
from uuid import uuid4

import pandas as pd
from pydantic import BaseModel


class PostgresStateBackend:
    """Persist engine configuration and execution metadata in PostgreSQL."""

    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise ValueError("A PostgreSQL database URL is required")
        self.database_url = database_url

    def _connect(self) -> Any:
        try:
            import psycopg
        except ImportError as error:
            raise RuntimeError(
                "PostgreSQL persistence requires the 'psycopg[binary]' package"
            ) from error
        return psycopg.connect(self.database_url)

    def ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS kpi_engine_configurations (
                    config_id TEXT PRIMARY KEY,
                    config JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS kpi_engine_executions (
                    execution_id UUID PRIMARY KEY,
                    config_id TEXT NOT NULL REFERENCES kpi_engine_configurations(config_id),
                    started_at TIMESTAMPTZ NOT NULL,
                    completed_at TIMESTAMPTZ,
                    status TEXT NOT NULL,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
                )
                """
            )

    def save_configuration(self, config_id: str, config: BaseModel | dict[str, Any]) -> None:
        serialized = (
            config.model_dump(mode="json")
            if isinstance(config, BaseModel)
            else config
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO kpi_engine_configurations (config_id, config)
                VALUES (%s, %s::jsonb)
                ON CONFLICT (config_id) DO UPDATE
                SET config = EXCLUDED.config, updated_at = now()
                """,
                (config_id, json.dumps(serialized)),
            )

    def record_execution(
        self,
        config_id: str,
        status: str,
        metadata: dict[str, Any],
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        execution_id: str | None = None,
    ) -> str:
        identifier = execution_id or str(uuid4())
        start = started_at or datetime.now(timezone.utc)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO kpi_engine_executions
                    (execution_id, config_id, started_at, completed_at, status, metadata)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (identifier, config_id, start, completed_at, status, json.dumps(metadata)),
            )
        return identifier


class RedisStateBackend:
    """Cache query frames and atomically claim per-alert cooldown windows."""

    def __init__(self, redis_url: str, cache_ttl_seconds: int = 300) -> None:
        if not redis_url:
            raise ValueError("A Redis URL is required")
        if cache_ttl_seconds < 1:
            raise ValueError("cache_ttl_seconds must be at least 1")
        try:
            import redis
        except ImportError as error:
            raise RuntimeError("Redis state requires the 'redis' package") from error
        self._client = redis.Redis.from_url(redis_url, decode_responses=True)
        self.cache_ttl_seconds = cache_ttl_seconds

    @staticmethod
    def query_cache_key(query: str, arguments: dict[str, Any]) -> str:
        payload = json.dumps(
            {"query": query, "arguments": arguments},
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return f"kpi:query:{digest}"

    def cache_query_result(
        self, query: str, arguments: dict[str, Any], frame: pd.DataFrame
    ) -> None:
        key = self.query_cache_key(query, arguments)
        self._client.set(
            key,
            frame.to_json(orient="split", date_format="iso"),
            ex=self.cache_ttl_seconds,
        )

    def get_cached_query_result(
        self, query: str, arguments: dict[str, Any]
    ) -> pd.DataFrame | None:
        cached = self._client.get(self.query_cache_key(query, arguments))
        if cached is None:
            return None
        return pd.read_json(StringIO(cached), orient="split")

    def claim_alert_cooldown(self, alert_key: str, minutes: int) -> bool:
        if minutes < 0:
            raise ValueError("Cooldown minutes cannot be negative")
        if minutes == 0:
            return True
        return bool(
            self._client.set(
                f"kpi:cooldown:{alert_key}",
                "1",
                nx=True,
                ex=minutes * 60,
            )
        )

    def release_alert_cooldown(self, alert_key: str) -> None:
        self._client.delete(f"kpi:cooldown:{alert_key}")

    def close(self) -> None:
        self._client.close()

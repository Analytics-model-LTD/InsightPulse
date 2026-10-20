import asyncio
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import pandas as pd

from src.config import KPIEngineConfig, TimeWindowConfig, WebhookConfig
from src.core.calculation import TimeSeriesCalculator
from src.core.detection import (
    IsolationForestDetector,
    MADDetector,
    ZScoreDetector,
)
from src.services.mcp_connector import MCPDataConnector
from src.services.notifications import NotificationDispatcher
from src.services.analysis_pipeline import AnalysisPipeline, AnomalyAnalysis
from src.services.scheduler import KPIJobScheduler
from src.services.state_backend import RedisStateBackend


class EngineConfigTests(unittest.TestCase):
    def test_validates_nested_engine_configuration(self) -> None:
        config = KPIEngineConfig.model_validate(
            {
                "kpi_config": {
                    "kpi_sets": [
                        {
                            "name": "revenue",
                            "time_column": "recorded_at",
                            "grain": "hour",
                            "measures": [{"id": "revenue", "column": "revenue"}],
                        }
                    ]
                },
                "data_source": {
                    "command": "example-mcp",
                    "tool_name": "query",
                },
                "time_window": {"lookback_days": 30, "grain": "hour"},
                "frequency": "daily",
                "cooldown_period_minutes": 15,
            }
        )

        self.assertEqual(config.time_window.lookback_days, 30)
        self.assertEqual(config.frequency, "daily")
        self.assertEqual(config.cooldown_period_minutes, 15)


class TimeSeriesCalculatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.calculator = TimeSeriesCalculator()

    def test_filters_window_and_calculates_each_supported_aggregation(self) -> None:
        data = pd.DataFrame(
            {
                "recorded_at": pd.to_datetime(
                    [
                        "2025-01-01T10:00:00Z",
                        "2025-01-01T10:30:00Z",
                        "2025-01-01T11:00:00Z",
                        "2024-12-30T10:00:00Z",
                    ]
                ),
                "amount": [2, 4, 10, 100],
            }
        )
        window = TimeWindowConfig(lookback_days=1, grain="hour")
        end = datetime(2025, 1, 1, 11, tzinfo=timezone.utc)

        results = {
            name: self.calculator.aggregate(
                data,
                time_column="recorded_at",
                value_column="amount",
                window=window,
                aggregation=name,
                end_time=end,
            )
            for name in ("sum", "avg", "median")
        }

        self.assertEqual(results["sum"]["value"].tolist(), [6, 10])
        self.assertEqual(results["avg"]["value"].tolist(), [3, 10])
        self.assertEqual(results["median"]["value"].tolist(), [3, 10])
        self.assertEqual(len(results["sum"]), 2)

    def test_builds_weekday_hour_baseline_per_dimension(self) -> None:
        history = pd.DataFrame(
            {
                "timestamp": pd.to_datetime(
                    ["2025-01-06T10:00Z", "2025-01-13T10:00Z", "2025-01-07T10:00Z"]
                ),
                "region": ["north", "north", "north"],
                "value": [10, 14, 100],
            }
        )
        current = pd.DataFrame(
            {
                "timestamp": pd.to_datetime(["2025-01-20T10:00Z"]),
                "region": ["north"],
                "value": [50],
            }
        )

        result = self.calculator.build_baseline(
            current,
            history,
            time_column="timestamp",
            dimensions=["region"],
            grain="hour",
        )

        self.assertEqual(result.loc[0, "baseline"], 12)
        self.assertEqual(result.loc[0, "value"], 50)


class DetectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.frame = pd.DataFrame(
            {"value": [10, 11, 9, 10, 10, 11, 9, 10, 100]},
            index=list("abcdefghi"),
        )

    def test_zscore_and_mad_return_index_and_bounded_severity(self) -> None:
        zscore = ZScoreDetector(threshold=2.5).detect(self.frame, "value")
        mad = MADDetector(threshold=3.5).detect(self.frame, "value")

        self.assertEqual([item.index for item in zscore], ["i"])
        self.assertEqual([item.index for item in mad], ["i"])
        self.assertTrue(0 <= mad[0].severity_score <= 1)
        self.assertEqual(mad[0].method, "mad")

    def test_isolation_forest_returns_scored_rows(self) -> None:
        frame = pd.DataFrame(
            {"value": [10, 11, 9, 10, 10, 11, 9, 10, 100, 10, 11, 9]}
        )

        results = IsolationForestDetector(contamination=0.1).detect(frame, "value")

        self.assertTrue(results)
        self.assertTrue(all(0 <= result.severity_score <= 1 for result in results))
        self.assertEqual(results[0].method, "isolation_forest")


class MCPResultNormalizationTests(unittest.TestCase):
    def test_normalizes_json_rows_csv_and_scalar_arrays(self) -> None:
        json_frame = MCPDataConnector.normalize_result('{"rows":[{"x":1}]}')
        csv_frame = MCPDataConnector.normalize_result("x,y\n1,2\n")
        scalar_frame = MCPDataConnector.normalize_result("[1,2,3]")

        self.assertEqual(json_frame.to_dict("records"), [{"x": 1}])
        self.assertEqual(csv_frame.to_dict("records"), [{"x": 1, "y": 2}])
        self.assertEqual(scalar_frame["value"].tolist(), [1, 2, 3])

    def test_query_uses_cache_and_writes_successful_mcp_results(self) -> None:
        class Cache:
            def __init__(self) -> None:
                self.frame: pd.DataFrame | None = None
                self.writes = 0

            def get_cached_query_result(self, query, arguments):
                return self.frame

            def cache_query_result(self, query, arguments, frame):
                self.frame = frame
                self.writes += 1

        class Result:
            isError = False
            structuredContent = {"rows": [{"value": 8}]}

        class Session:
            calls = 0

            async def call_tool(self, name, arguments):
                self.calls += 1
                return Result()

        async def exercise() -> None:
            cache = Cache()
            connector = MCPDataConnector("server", query_cache=cache)
            connector._session = Session()
            first = await connector.query("query", {})
            second = await connector.query("query", {})

            self.assertEqual(first["value"].tolist(), [8])
            self.assertEqual(second["value"].tolist(), [8])
            self.assertEqual(connector._session.calls, 1)
            self.assertEqual(cache.writes, 1)

        asyncio.run(exercise())


class NotificationTests(unittest.TestCase):
    class Cooldown:
        def __init__(self) -> None:
            self.claimed = False
            self.released: list[str] = []

        def claim_alert_cooldown(self, alert_key: str, minutes: int) -> bool:
            if self.claimed:
                return False
            self.claimed = True
            return True

        def release_alert_cooldown(self, alert_key: str) -> None:
            self.released.append(alert_key)
            self.claimed = False

    def test_severity_gate_and_cooldown_claim(self) -> None:
        store = self.Cooldown()
        webhook = WebhookConfig(
            name="slack", kind="slack", url="https://example.test/hook"
        )
        dispatcher = NotificationDispatcher(store, [webhook], 10)

        with patch.object(dispatcher, "_send") as send:
            self.assertEqual(
                dispatcher.dispatch(
                    "revenue", {"summary": "spike"}, "info", "warning"
                ),
                [],
            )
            self.assertEqual(
                dispatcher.dispatch("revenue", {"summary": "spike"}, "critical"),
                ["slack"],
            )
            self.assertEqual(
                dispatcher.dispatch("revenue", {"summary": "spike"}, "critical"), []
            )
            send.assert_called_once()


class AnalysisPipelineTests(unittest.TestCase):
    class LLM:
        def __init__(self, response) -> None:
            self.response = response
            self.calls = 0

        def with_structured_output(self, schema):
            self.schema = schema
            return self

        async def ainvoke(self, prompt):
            self.calls += 1
            if isinstance(self.response, Exception):
                raise self.response
            if isinstance(self.response, list):
                response = self.response.pop(0)
                if isinstance(response, Exception):
                    raise response
                return response
            return self.response

    def test_emits_structured_analysis_and_retries_token_limit_with_compact_context(self):
        response = {
            "root_cause_hypothesis": "Unexpected demand increase.",
            "confidence_score": 0.8,
            "business_impact": "Revenue may be affected.",
        }
        llm = self.LLM([RuntimeError("context_length_exceeded"), response])
        pipeline = AnalysisPipeline(llm)
        context = pipeline.build_context(
            [{"value": 100}],
            pd.DataFrame({"timestamp": ["2025-01-01"], "value": [10]}),
            {"metric": "revenue"},
        )

        result = asyncio.run(pipeline.analyze(context))

        self.assertIsInstance(result, AnomalyAnalysis)
        self.assertEqual(result.confidence_score, 0.8)
        self.assertEqual(llm.calls, 2)

    def test_returns_explicit_fallback_on_api_timeout(self):
        pipeline = AnalysisPipeline(self.LLM(RuntimeError("Request timed out")))

        result = asyncio.run(pipeline.analyze({"anomalies": [{"value": 10}]}))

        self.assertEqual(result.confidence_score, 0)
        self.assertIn("timed out", result.fallback_reason)


class BackendAndSchedulerTests(unittest.TestCase):
    def test_redis_cache_round_trip_and_cooldown_ttl(self) -> None:
        backend = RedisStateBackend("redis://localhost:6379/0", cache_ttl_seconds=90)

        class Client:
            values: dict[str, str] = {}

            def set(self, key, value, **kwargs):
                if kwargs.get("nx") and key in self.values:
                    return None
                self.values[key] = value
                return True

            def get(self, key):
                return self.values.get(key)

            def delete(self, key):
                self.values.pop(key, None)

        client = Client()
        backend._client = client
        frame = pd.DataFrame({"value": [1, 2]})
        backend.cache_query_result("query", {"table": "sales"}, frame)

        pd.testing.assert_frame_equal(
            backend.get_cached_query_result("query", {"table": "sales"}),
            frame,
        )
        self.assertTrue(backend.claim_alert_cooldown("revenue", 5))
        self.assertFalse(backend.claim_alert_cooldown("revenue", 5))
        backend.release_alert_cooldown("revenue")
        self.assertTrue(backend.claim_alert_cooldown("revenue", 5))

    def test_frequency_maps_to_timezone_aware_cron_triggers(self) -> None:
        scheduler = KPIJobScheduler(timezone="UTC")

        hourly = scheduler._trigger("hourly")
        cron = scheduler._trigger("cron:15 3 * * *")

        self.assertEqual(str(hourly.fields[6]), "0")
        self.assertEqual(str(cron.fields[6]), "15")


if __name__ == "__main__":
    unittest.main()

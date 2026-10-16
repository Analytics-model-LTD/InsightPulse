import tempfile
import unittest
from pathlib import Path

import pandas as pd
from pydantic import ValidationError

from src.config import KpiConfig, KpiSet, load_kpi_config
from src.core.seasonal import SeasonalZScore


def hourly_history(spike: float = 180) -> pd.DataFrame:
    timestamps = pd.date_range("2025-01-02 09:00", periods=9, freq="7D", tz="UTC")
    values = [100, 102, 99, 101, 98, 103, 100, 101, spike]
    return pd.DataFrame({"recorded_at": timestamps, "revenue": values})


def sample_kpi(**overrides: object) -> KpiSet:
    values: dict[str, object] = {
        "name": "revenue",
        "time_column": "recorded_at",
        "grain": "hour",
        "measures": [{"id": "revenue", "column": "revenue"}],
        "dimensions": [],
        "min_n": 7,
        "min_volume": 0,
    }
    values.update(overrides)
    return KpiSet.model_validate(values)


class KpiConfigTests(unittest.TestCase):
    def test_loads_yaml_configuration(self) -> None:
        config_text = """
kpi_sets:
  - name: revenue
    time_column: recorded_at
    grain: hour
    measures:
      - id: revenue
        column: revenue
        direction: down_good
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "kpis.yaml"
            path.write_text(config_text, encoding="utf-8")

            config = load_kpi_config(path)

        self.assertIsInstance(config, KpiConfig)
        self.assertEqual(config.kpi_sets[0].measures[0].direction, "down_good")

    def test_rejects_unknown_timezone_and_invalid_minimum_history(self) -> None:
        with self.assertRaises(ValidationError):
            sample_kpi(timezone="Not/A_Timezone")
        with self.assertRaises(ValidationError):
            sample_kpi(min_n=1)

    def test_loads_single_kpi_set_and_extended_measure_options(self) -> None:
        config_text = """
kpi_set:
  name: Churn by tenure cohort
  llm: claude-sonnet-5-5
  detector: zscore
  detector_params: {baseline: tenure_curve, window: 8}
  source: service
  time_column: MonthsInService
  grain: month
  measures:
    - id: customers
      agg: count_distinct
      column: CustomerID
    - id: churn_rate
      agg: ratio
      numerator: churned
      denominator: customers
      direction: down_good
  dimensions: [ServiceArea, CreditRating, IncomeGroup]
  top_n: 5
  top_n_strategy: contribution
  alerting:
    z_threshold: 3.0
    min_abs_change: 20
    min_pct_change: 0.10
    channels: [slack, email]
    recipients:
      - employee: retention.lead@example.com
        channels: [slack, email]
        min_severity: warning
        measures: [churn_rate]
  min_n: 7
  min_volume: 30
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "kpis.yaml"
            path.write_text(config_text, encoding="utf-8")

            config = load_kpi_config(path)

        self.assertEqual(len(config.kpi_sets), 1)
        kpi = config.kpi_sets[0]
        self.assertEqual(kpi.name, "Churn by tenure cohort")
        self.assertEqual(kpi.measures[1].agg, "ratio")
        self.assertEqual(kpi.z_threshold, 3.0)
        self.assertEqual(kpi.alerting.recipients[0].min_severity, "warning")


class SeasonalZScoreTests(unittest.TestCase):
    def test_detects_latest_bucket_against_same_hour_and_weekday(self) -> None:
        data = hourly_history()
        original = data.copy(deep=True)

        anomalies = SeasonalZScore().detect(data, sample_kpi())

        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].measure, "revenue")
        self.assertEqual(anomalies[0].value, 180)
        self.assertEqual(anomalies[0].severity, "critical")
        pd.testing.assert_frame_equal(data, original)

    def test_skips_when_seasonal_history_is_insufficient(self) -> None:
        anomalies = SeasonalZScore().detect(
            hourly_history().tail(5), sample_kpi(min_n=7)
        )

        self.assertEqual(anomalies, [])

    def test_respects_absolute_and_percentage_change_gates(self) -> None:
        data = hourly_history(spike=110)

        anomalies = SeasonalZScore().detect(
            data, sample_kpi(min_abs_change=20, min_pct_change=0.5)
        )

        self.assertEqual(anomalies, [])

    def test_favorable_increase_is_not_critical(self) -> None:
        anomalies = SeasonalZScore().detect(
            hourly_history(), sample_kpi(
                measures=[{"id": "revenue", "column": "revenue", "direction": "up_good"}]
            )
        )

        self.assertEqual(anomalies[0].severity, "info")

    def test_detects_anomalies_per_dimension_series(self) -> None:
        data = pd.concat(
            [
                hourly_history().assign(region="north"),
                hourly_history(spike=101).assign(region="south"),
            ],
            ignore_index=True,
        )
        kpi = sample_kpi(dimensions=["region"])

        anomalies = SeasonalZScore().detect(data, kpi)

        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].dimensions, {"region": "north"})

    def test_rejects_duplicate_bucket_rows(self) -> None:
        data = pd.concat([hourly_history(), hourly_history().tail(1)])

        with self.assertRaisesRegex(ValueError, "at most one row per time bucket"):
            SeasonalZScore().detect(data, sample_kpi())

    def test_rejects_missing_input_columns(self) -> None:
        with self.assertRaisesRegex(ValueError, "Missing required data columns"):
            SeasonalZScore().detect(pd.DataFrame({"revenue": [1]}), sample_kpi())


if __name__ == "__main__":
    unittest.main()

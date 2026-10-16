import tempfile
import unittest
from pathlib import Path

import pandas as pd

from src.config import KpiConfig, SnapshotSet, load_kpi_config
from src.core.snapshot import CustomerSnapshotAnalyzer


class SnapshotConfigTests(unittest.TestCase):
    def test_loads_snapshot_yaml_configuration(self) -> None:
        config_text = """
snapshot_sets:
  - name: customer-monthly-revenue
    measure_column: MonthlyRevenue
    dimensions:
      - CreditRating
    min_customers: 2
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "kpis.yaml"
            path.write_text(config_text, encoding="utf-8")

            config = load_kpi_config(path)

        self.assertIsInstance(config, KpiConfig)
        self.assertEqual(config.snapshot_sets[0].measure_column, "MonthlyRevenue")


class CustomerSnapshotAnalyzerTests(unittest.TestCase):
    def test_summarizes_segments_against_overall_baseline(self) -> None:
        data = pd.DataFrame(
            {
                "MonthlyRevenue": [10, 10, 10, 30, 30, None],
                "CreditRating": ["low", "low", "low", "high", "high", "low"],
            }
        )
        snapshot = SnapshotSet(
            name="revenue",
            measure_column="MonthlyRevenue",
            dimensions=["CreditRating"],
            min_customers=2,
        )

        report = CustomerSnapshotAnalyzer().analyze(data, snapshot)

        self.assertEqual(report.customers_analyzed, 5)
        self.assertEqual(report.overall_mean, 18)
        self.assertEqual(len(report.segments), 2)
        low, high = report.segments
        self.assertEqual((low.value, low.customer_count, low.mean), ("low", 3, 10))
        self.assertEqual((high.value, high.customer_count, high.mean), ("high", 2, 30))
        self.assertAlmostEqual(high.percent_difference_from_overall, 66.6666667)

    def test_omits_small_groups(self) -> None:
        data = pd.DataFrame(
            {"MonthlyRevenue": [10, 10, 30], "CreditRating": ["low", "low", "rare"]}
        )
        snapshot = SnapshotSet(
            name="revenue",
            measure_column="MonthlyRevenue",
            dimensions=["CreditRating"],
            min_customers=2,
        )

        report = CustomerSnapshotAnalyzer().analyze(data, snapshot)

        self.assertEqual(len(report.segments), 1)
        self.assertEqual(report.segments[0].value, "low")

    def test_rejects_missing_columns_and_non_numeric_measure_values(self) -> None:
        snapshot = SnapshotSet(
            name="revenue",
            measure_column="MonthlyRevenue",
            dimensions=["CreditRating"],
        )
        analyzer = CustomerSnapshotAnalyzer()

        with self.assertRaisesRegex(ValueError, "Missing required data columns"):
            analyzer.analyze(pd.DataFrame({"MonthlyRevenue": [10]}), snapshot)
        with self.assertRaisesRegex(ValueError, "non-numeric values"):
            analyzer.analyze(
                pd.DataFrame(
                    {"MonthlyRevenue": ["bad"], "CreditRating": ["low"]}
                ),
                snapshot,
            )


if __name__ == "__main__":
    unittest.main()

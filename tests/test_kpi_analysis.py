import unittest

import pandas as pd

from src.config import KpiSet, Measure
from src.core.kpi_analysis import KpiAnalyzer


class KpiAnalyzerTests(unittest.TestCase):
    def test_analyzes_measures_across_time_and_dimension_columns(self) -> None:
        data = pd.DataFrame(
            {
                "MonthsInService": [1, 1, 2, 2],
                "Region": ["north", "south", "north", "south"],
                "CustomerID": [10, 11, 12, 13],
                "Churn": [None, None, None, None],
                "MonthlyRevenue": [20, 30, 40, 50],
            }
        )
        kpi = KpiSet(
            name="Churn by tenure",
            time_column="MonthsInService",
            grain="month",
            dimensions=["Region"],
            min_n=2,
            min_volume=2,
            top_n=2,
            measures=[
                Measure(
                    id="churn_rate",
                    agg="ratio",
                    numerator="churned",
                    denominator="customers",
                ),
                Measure(id="churned", agg="count_distinct", column="CustomerID",
                        where="Churn = 'Yes'"),
                Measure(id="customers", agg="count_distinct", column="CustomerID"),
                Measure(id="avg_revenue", agg="avg", column="MonthlyRevenue"),
                Measure(id="median_revenue", agg="median", column="MonthlyRevenue"),
            ],
        )

        report = KpiAnalyzer().analyze(data, kpi)

        self.assertEqual(report.rows_analyzed, 4)
        self.assertEqual(report.overall["customers"].value, 4)
        self.assertIsNone(report.overall["churned"].value)
        self.assertIn("no non-null values", report.overall["churned"].status)
        self.assertIsNone(report.overall["churn_rate"].value)
        self.assertEqual(report.overall["avg_revenue"].value, 35)
        self.assertEqual(report.overall["median_revenue"].value, 35)
        self.assertEqual(
            {dimension.dimension for dimension in report.dimensions},
            {"MonthsInService", "Region"},
        )
        self.assertTrue(
            any("filter column 'Churn'" in warning for warning in report.warnings)
        )
        self.assertEqual(len(report.dimensions[0].segments), 2)

    def test_computes_ratio_from_filtered_distinct_counts(self) -> None:
        data = pd.DataFrame(
            {
                "MonthsInService": [1, 1, 2, 2],
                "CustomerID": [10, 11, 12, 13],
                "Churn": ["Yes", "No", "Yes", "Yes"],
            }
        )
        kpi = KpiSet(
            name="Churn rate",
            time_column="MonthsInService",
            grain="month",
            min_n=2,
            min_volume=2,
            measures=[
                Measure(
                    id="churn_rate",
                    agg="ratio",
                    numerator="churned",
                    denominator="customers",
                ),
                Measure(
                    id="churned",
                    agg="count_distinct",
                    column="CustomerID",
                    where="Churn = 'Yes'",
                ),
                Measure(
                    id="customers", agg="count_distinct", column="CustomerID"
                ),
            ],
        )

        report = KpiAnalyzer().analyze(data, kpi)

        self.assertEqual(report.overall["churned"].value, 3)
        self.assertEqual(report.overall["customers"].value, 4)
        self.assertEqual(report.overall["churn_rate"].value, 0.75)

    def test_rejects_unsupported_filter_expressions(self) -> None:
        data = pd.DataFrame(
            {"MonthsInService": [1], "Churn": ["Yes"], "CustomerID": [1]}
        )
        kpi = KpiSet(
            name="Unsafe filter",
            time_column="MonthsInService",
            grain="month",
            min_n=2,
            measures=[
                Measure(
                    id="churned",
                    agg="count_distinct",
                    column="CustomerID",
                    where="Churn = 'Yes' OR 1=1",
                )
            ],
        )

        with self.assertRaisesRegex(ValueError, "Unsupported filter"):
            KpiAnalyzer().analyze(data, kpi)


if __name__ == "__main__":
    unittest.main()

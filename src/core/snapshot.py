from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from src.config import SnapshotSet


@dataclass(frozen=True)
class SegmentSummary:
    dimension: str
    value: Any
    customer_count: int
    mean: float
    median: float
    difference_from_overall: float
    percent_difference_from_overall: float | None


@dataclass(frozen=True)
class SnapshotReport:
    name: str
    measure: str
    customers_analyzed: int
    overall_mean: float
    overall_median: float
    segments: list[SegmentSummary]


class CustomerSnapshotAnalyzer:
    """Summarize a numeric customer measure across configured categories."""

    def analyze(self, data: pd.DataFrame, snapshot: SnapshotSet) -> SnapshotReport:
        required_columns = {snapshot.measure_column, *snapshot.dimensions}
        missing_columns = required_columns.difference(data.columns)
        if missing_columns:
            raise ValueError(
                f"Missing required data columns: {sorted(missing_columns)}"
            )
        if data.empty:
            raise ValueError("Customer snapshot data must not be empty")

        values = pd.to_numeric(data[snapshot.measure_column], errors="coerce")
        invalid_values = data[snapshot.measure_column].notna() & values.isna()
        if invalid_values.any():
            raise ValueError(
                f"Measure column '{snapshot.measure_column}' contains "
                "non-numeric values"
            )
        numeric_values = values.dropna().to_numpy(dtype=float)
        if np.isinf(numeric_values).any():
            raise ValueError(
                f"Measure column '{snapshot.measure_column}' contains infinite values"
            )
        if len(numeric_values) == 0:
            raise ValueError(
                f"Measure column '{snapshot.measure_column}' has no numeric values"
            )

        overall_mean = float(np.mean(numeric_values))
        overall_median = float(np.median(numeric_values))
        working = data.loc[values.notna(), snapshot.dimensions].copy()
        working["_value"] = values.loc[values.notna()]
        segments: list[SegmentSummary] = []

        for dimension in snapshot.dimensions:
            grouped = working.dropna(subset=[dimension]).groupby(
                dimension, sort=False, observed=True
            )["_value"]
            for value, group in grouped:
                customer_count = len(group)
                if customer_count < snapshot.min_customers:
                    continue
                mean = float(group.mean())
                difference = mean - overall_mean
                percent_difference = (
                    difference / abs(overall_mean) * 100
                    if overall_mean != 0
                    else None
                )
                segments.append(
                    SegmentSummary(
                        dimension=dimension,
                        value=self._python_value(value),
                        customer_count=customer_count,
                        mean=mean,
                        median=float(group.median()),
                        difference_from_overall=difference,
                        percent_difference_from_overall=percent_difference,
                    )
                )

        return SnapshotReport(
            name=snapshot.name,
            measure=snapshot.measure_column,
            customers_analyzed=len(numeric_values),
            overall_mean=overall_mean,
            overall_median=overall_median,
            segments=segments,
        )

    @staticmethod
    def _python_value(value: Any) -> Any:
        if isinstance(value, np.generic):
            return value.item()
        return value

import re
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from src.config import KpiSet, Measure


@dataclass(frozen=True)
class MeasureResult:
    value: int | float | None
    status: str | None = None


@dataclass(frozen=True)
class SegmentResult:
    dimension: str
    value: Any
    row_count: int
    measures: dict[str, MeasureResult]


@dataclass(frozen=True)
class DimensionAnalysis:
    dimension: str
    segments: list[SegmentResult]
    omitted_small_groups: int
    ranking: str


@dataclass(frozen=True)
class KpiAnalysis:
    name: str
    rows_analyzed: int
    overall: dict[str, MeasureResult]
    dimensions: list[DimensionAnalysis]
    warnings: list[str]


_FILTER_PATTERN = re.compile(
    r"""^\s*([A-Za-z_]\w*)\s*(==|=|!=|<>|>=|<=|>|<)\s*
    (?:
        '((?:''|[^'])*)'
        |"((?:""|[^"])*)"
        |(-?(?:\d+(?:\.\d*)?|\.\d+))
    )\s*$""",
    re.VERBOSE,
)


class KpiAnalyzer:
    """Evaluate configured aggregations and compare them across dataset segments."""

    def analyze(self, data: pd.DataFrame, kpi: KpiSet) -> KpiAnalysis:
        if data.empty:
            raise ValueError("Dataset must not be empty")

        dimensions = list(dict.fromkeys([kpi.time_column, *kpi.dimensions]))
        required_columns = set(dimensions)
        for measure in kpi.measures:
            if measure.column:
                required_columns.add(measure.column)
            if measure.where:
                required_columns.add(self._parse_filter(measure.where)[0])

        missing_columns = required_columns.difference(data.columns)
        if missing_columns:
            raise ValueError(
                f"Missing required dataset columns: {sorted(missing_columns)}"
            )

        measures = {measure.id: measure for measure in kpi.measures}
        self._validate_ratio_references(measures)
        warnings: list[str] = []
        for measure in kpi.measures:
            if measure.where:
                filter_column, _, _ = self._parse_filter(measure.where)
                if data[filter_column].notna().sum() == 0:
                    warnings.append(
                        f"Measure '{measure.id}' cannot be calculated: filter "
                        f"column '{filter_column}' has no non-null values."
                    )
        if kpi.top_n_strategy != "volume":
            warnings.append(
                f"Top-N strategy '{kpi.top_n_strategy}' is not available for "
                "snapshot analysis; groups are ranked by row count instead."
            )

        overall = self._measure_results(data, kpi.measures, measures)
        dimension_results = []
        minimum_rows = max(kpi.min_n, int(np.ceil(kpi.min_volume)))
        for dimension in dimensions:
            segments = []
            omitted_small_groups = 0
            grouped = data.dropna(subset=[dimension]).groupby(
                dimension, sort=False, observed=True
            )
            for value, group in grouped:
                if len(group) < minimum_rows:
                    omitted_small_groups += 1
                    continue
                segments.append(
                    SegmentResult(
                        dimension=dimension,
                        value=self._python_value(value),
                        row_count=len(group),
                        measures=self._measure_results(
                            group, kpi.measures, measures
                        ),
                    )
                )

            segments.sort(key=lambda segment: (-segment.row_count, str(segment.value)))
            dimension_results.append(
                DimensionAnalysis(
                    dimension=dimension,
                    segments=segments[: kpi.top_n],
                    omitted_small_groups=omitted_small_groups,
                    ranking="group_size",
                )
            )

        return KpiAnalysis(
            name=kpi.name,
            rows_analyzed=len(data),
            overall=overall,
            dimensions=dimension_results,
            warnings=warnings,
        )

    @classmethod
    def _measure_results(
        cls,
        data: pd.DataFrame,
        ordered_measures: list[Measure],
        measures_by_id: dict[str, Measure],
    ) -> dict[str, MeasureResult]:
        results: dict[str, MeasureResult] = {}
        visiting: set[str] = set()

        def evaluate(measure: Measure) -> MeasureResult:
            if measure.id in results:
                return results[measure.id]
            if measure.agg == "ratio":
                if measure.id in visiting:
                    raise ValueError(f"Circular ratio dependency at '{measure.id}'")
                visiting.add(measure.id)
                numerator = evaluate(measures_by_id[measure.numerator])
                denominator = evaluate(measures_by_id[measure.denominator])
                visiting.remove(measure.id)
                if numerator.value is None:
                    result = MeasureResult(
                        None, f"numerator unavailable: {numerator.status}"
                    )
                elif denominator.value in (None, 0):
                    reason = (
                        "denominator unavailable"
                        if denominator.value is None
                        else "denominator is zero"
                    )
                    result = MeasureResult(None, reason)
                else:
                    result = MeasureResult(
                        float(numerator.value) / float(denominator.value)
                    )
            else:
                rows = data
                if measure.where:
                    filter_column, operator, target = cls._parse_filter(measure.where)
                    values = rows[filter_column]
                    valid = values.notna()
                    if not valid.any():
                        result = MeasureResult(
                            None,
                            f"filter column '{filter_column}' has no non-null values",
                        )
                        results[measure.id] = result
                        return result
                    try:
                        matched = cls._compare(values, operator, target)
                    except (TypeError, ValueError) as error:
                        raise ValueError(
                            f"Cannot evaluate filter for measure '{measure.id}': "
                            f"{error}"
                        ) from error
                    rows = rows.loc[valid & matched]

                result = cls._aggregate(rows, measure)
            results[measure.id] = result
            return result

        for measure in ordered_measures:
            evaluate(measure)

        return results

    @staticmethod
    def _aggregate(rows: pd.DataFrame, measure: Measure) -> MeasureResult:
        if measure.agg == "count":
            return MeasureResult(
                len(rows) if measure.column is None else int(rows[measure.column].count())
            )

        values = rows[measure.column]
        if measure.agg == "count_distinct":
            return MeasureResult(int(values.nunique(dropna=True)))

        numeric = pd.to_numeric(values, errors="coerce")
        invalid = values.notna() & numeric.isna()
        if invalid.any():
            raise ValueError(
                f"Measure '{measure.id}' column '{measure.column}' "
                "contains non-numeric values"
            )
        usable = numeric.dropna().to_numpy(dtype=float)
        if np.isinf(usable).any():
            raise ValueError(
                f"Measure '{measure.id}' column '{measure.column}' "
                "contains infinite values"
            )
        if len(usable) == 0:
            return MeasureResult(None, "no numeric values")
        if measure.agg == "sum":
            return MeasureResult(float(np.sum(usable)))
        return MeasureResult(float(np.mean(usable)))

    @staticmethod
    def _parse_filter(expression: str) -> tuple[str, str, str | float]:
        match = _FILTER_PATTERN.fullmatch(expression)
        if match is None:
            raise ValueError(
                f"Unsupported filter '{expression}'. Use one comparison such as "
                "Churn = 'Yes' or MonthlyRevenue >= 50."
            )
        column, operator, single_quoted, double_quoted, number = match.groups()
        if single_quoted is not None:
            target: str | float = single_quoted.replace("''", "'")
        elif double_quoted is not None:
            target = double_quoted.replace('""', '"')
        else:
            target = float(number)
        return column, operator, target

    @staticmethod
    def _compare(
        values: pd.Series, operator: str, target: str | float
    ) -> pd.Series:
        if operator in ("=", "=="):
            return values.eq(target)
        if operator in ("!=", "<>"):
            return values.ne(target)
        if operator == ">":
            return values.gt(target)
        if operator == ">=":
            return values.ge(target)
        if operator == "<":
            return values.lt(target)
        return values.le(target)

    @staticmethod
    def _validate_ratio_references(measures: dict[str, Measure]) -> None:
        for measure in measures.values():
            if measure.agg != "ratio":
                continue
            for reference in (measure.numerator, measure.denominator):
                if reference not in measures:
                    raise ValueError(
                        f"Ratio measure '{measure.id}' references unknown measure "
                        f"'{reference}'"
                    )
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(measure_id: str) -> None:
            if measure_id in visiting:
                raise ValueError(f"Circular ratio dependency at '{measure_id}'")
            if measure_id in visited:
                return
            visiting.add(measure_id)
            measure = measures[measure_id]
            if measure.agg == "ratio":
                visit(measure.numerator)
                visit(measure.denominator)
            visiting.remove(measure_id)
            visited.add(measure_id)

        for measure_id in measures:
            visit(measure_id)

    @staticmethod
    def _python_value(value: Any) -> Any:
        if isinstance(value, np.generic):
            return value.item()
        return value

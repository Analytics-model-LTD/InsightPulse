from dataclasses import dataclass
from typing import Any, Literal, Protocol

import numpy as np
import pandas as pd

from src.config import Direction, Grain, KpiSet

Severity = Literal["info", "warning", "critical"]


@dataclass(frozen=True)
class Anomaly:
    kpi: str
    measure: str
    timestamp: str
    dimensions: dict[str, Any]
    value: float
    baseline_median: float
    baseline_mad: float
    change: float
    pct_change: float | None
    z_score: float
    severity: Severity


class Detector(Protocol):
    def detect(self, data: pd.DataFrame, kpi: KpiSet) -> list[Anomaly]: ...


class SeasonalZScore:
    """Compare each series' latest value with prior matching seasonal buckets."""

    def detect(self, data: pd.DataFrame, kpi: KpiSet) -> list[Anomaly]:
        required_columns = {
            kpi.time_column,
            *kpi.dimensions,
            *(measure.column for measure in kpi.measures),
        }
        missing_columns = required_columns.difference(data.columns)
        if missing_columns:
            raise ValueError(
                f"Missing required data columns: {sorted(missing_columns)}"
            )
        if data.empty:
            return []

        timestamps = pd.to_datetime(data[kpi.time_column], errors="coerce", utc=True)
        if timestamps.isna().any():
            raise ValueError(f"Column '{kpi.time_column}' contains invalid timestamps")

        local_timestamps = timestamps.dt.tz_convert(kpi.timezone)
        if data.assign(_timestamp=local_timestamps).duplicated(
            subset=["_timestamp", *kpi.dimensions]
        ).any():
            raise ValueError(
                "Data must contain at most one row per time bucket and dimension"
            )

        working = data.copy()
        working["_timestamp"] = local_timestamps
        anomalies: list[Anomaly] = []

        for measure in kpi.measures:
            numeric_values = pd.to_numeric(working[measure.column], errors="coerce")
            invalid_values = working[measure.column].notna() & numeric_values.isna()
            if invalid_values.any():
                raise ValueError(
                    f"Measure column '{measure.column}' contains non-numeric values"
                )
            if np.isinf(numeric_values.dropna().to_numpy(dtype=float)).any():
                raise ValueError(
                    f"Measure column '{measure.column}' contains infinite values"
                )
            working["_value"] = numeric_values

            for dimensions, series in self._series_groups(working, kpi.dimensions):
                valid = series.dropna(subset=["_value"]).sort_values("_timestamp")
                if valid.empty:
                    continue

                latest = valid.iloc[-1]
                latest_time = latest["_timestamp"]
                baseline = valid[
                    (valid["_timestamp"] < latest_time)
                    & self._same_season(valid["_timestamp"], latest_time, kpi.grain)
                ]["_value"].to_numpy(dtype=float)
                if len(baseline) < kpi.min_n:
                    continue

                baseline_median = float(np.median(baseline))
                if abs(baseline_median) < kpi.min_volume:
                    continue

                baseline_mad = float(np.median(np.abs(baseline - baseline_median)))
                scale = 1.4826 * baseline_mad
                if scale == 0:
                    continue

                value = float(latest["_value"])
                change = value - baseline_median
                z_score = change / scale
                pct_change = (
                    change / abs(baseline_median) if baseline_median != 0 else None
                )
                if abs(z_score) < kpi.z_threshold:
                    continue
                if abs(change) < kpi.min_abs_change:
                    continue
                if (
                    pct_change is None
                    or abs(pct_change) < kpi.min_pct_change
                ) and kpi.min_pct_change > 0:
                    continue

                anomalies.append(
                    Anomaly(
                        kpi=kpi.name,
                        measure=measure.id,
                        timestamp=latest_time.isoformat(),
                        dimensions=dimensions,
                        value=value,
                        baseline_median=baseline_median,
                        baseline_mad=baseline_mad,
                        change=change,
                        pct_change=pct_change,
                        z_score=z_score,
                        severity=self._severity(
                            z_score, change, measure.direction
                        ),
                    )
                )

        return anomalies

    @staticmethod
    def _series_groups(
        data: pd.DataFrame, dimensions: list[str]
    ) -> list[tuple[dict[str, Any], pd.DataFrame]]:
        if not dimensions:
            return [({}, data)]

        groups = []
        for key, group in data.groupby(dimensions, dropna=False, sort=False):
            values = key if isinstance(key, tuple) else (key,)
            dimension_values = {
                column: SeasonalZScore._python_value(value)
                for column, value in zip(dimensions, values)
            }
            groups.append((dimension_values, group))
        return groups

    @staticmethod
    def _same_season(
        timestamps: pd.Series, latest: pd.Timestamp, grain: Grain
    ) -> pd.Series:
        if grain == "hour":
            return (timestamps.dt.dayofweek == latest.dayofweek) & (
                timestamps.dt.hour == latest.hour
            )
        if grain == "day":
            return timestamps.dt.dayofweek == latest.dayofweek
        if grain == "week":
            return timestamps.dt.isocalendar().week == latest.isocalendar().week
        return timestamps.dt.month == latest.month

    @staticmethod
    def _severity(
        z_score: float, change: float, direction: Direction
    ) -> Severity:
        is_adverse = (
            direction == "neutral"
            or (direction == "up_good" and change < 0)
            or (direction == "down_good" and change > 0)
        )
        if not is_adverse:
            return "info"
        if abs(z_score) >= 8:
            return "critical"
        if abs(z_score) >= 5:
            return "warning"
        return "info"

    @staticmethod
    def _python_value(value: Any) -> Any:
        if pd.isna(value):
            return None
        if isinstance(value, np.generic):
            return value.item()
        return value

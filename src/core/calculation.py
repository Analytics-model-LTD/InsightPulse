from datetime import datetime, timezone
from typing import Literal

import numpy as np
import pandas as pd

from src.config import Grain, TimeWindowConfig

Aggregation = Literal["sum", "avg", "median"]

_FREQUENCIES: dict[Grain, str] = {
    "hour": "h",
    "day": "D",
    "week": "W",
    "month": "MS",
}


class TimeSeriesCalculator:
    """Filter, aggregate, and build seasonal baselines for KPI time series."""

    def aggregate(
        self,
        data: pd.DataFrame,
        *,
        time_column: str,
        value_column: str,
        window: TimeWindowConfig,
        aggregation: Aggregation = "sum",
        dimensions: list[str] | None = None,
        end_time: datetime | None = None,
    ) -> pd.DataFrame:
        dimensions = dimensions or []
        required = {time_column, value_column, *dimensions}
        missing = required.difference(data.columns)
        if missing:
            raise ValueError(f"Missing required data columns: {sorted(missing)}")
        if aggregation not in {"sum", "avg", "median"}:
            raise ValueError(f"Unsupported aggregation: {aggregation}")

        working = data.loc[:, [time_column, value_column, *dimensions]].copy()
        timestamps = pd.to_datetime(working[time_column], errors="coerce", utc=True)
        if timestamps.isna().any():
            raise ValueError(f"Column '{time_column}' contains invalid timestamps")
        values = pd.to_numeric(working[value_column], errors="coerce")
        invalid = working[value_column].notna() & values.isna()
        if invalid.any() or np.isinf(values.dropna().to_numpy(dtype=float)).any():
            raise ValueError(f"Column '{value_column}' must contain finite numbers")

        end = pd.Timestamp(end_time or datetime.now(timezone.utc))
        end = end.tz_localize("UTC") if end.tzinfo is None else end.tz_convert("UTC")
        start = end - pd.Timedelta(days=window.lookback_days)
        working["_timestamp"] = timestamps
        working["_value"] = values
        working = working.loc[
            (working["_timestamp"] >= start) & (working["_timestamp"] <= end)
        ]
        groupers: list[object] = [*dimensions, pd.Grouper(key="_timestamp", freq=_FREQUENCIES[window.grain])]
        grouped = working.groupby(groupers, dropna=False, observed=True)["_value"]
        if aggregation == "sum":
            result = grouped.sum(min_count=1)
        elif aggregation == "avg":
            result = grouped.mean()
        else:
            result = grouped.median()
        result = result.rename("value").reset_index().rename(
            columns={"_timestamp": time_column}
        )
        result = result.sort_values([*dimensions, time_column] if dimensions else time_column)
        return result.reset_index(drop=True)

    def build_baseline(
        self,
        current: pd.DataFrame,
        history: pd.DataFrame,
        *,
        time_column: str,
        value_column: str = "value",
        dimensions: list[str] | None = None,
        grain: Grain = "hour",
    ) -> pd.DataFrame:
        dimensions = dimensions or []
        required = {time_column, value_column, *dimensions}
        for label, frame in (("current", current), ("history", history)):
            missing = required.difference(frame.columns)
            if missing:
                raise ValueError(
                    f"{label} data is missing required columns: {sorted(missing)}"
                )

        current_work = current.copy()
        history_work = history.copy()
        current_work["_timestamp"] = pd.to_datetime(
            current_work[time_column], errors="coerce", utc=True
        )
        history_work["_timestamp"] = pd.to_datetime(
            history_work[time_column], errors="coerce", utc=True
        )
        if current_work["_timestamp"].isna().any() or history_work["_timestamp"].isna().any():
            raise ValueError(f"Column '{time_column}' contains invalid timestamps")

        for frame in (current_work, history_work):
            frame["_season"] = self._season_key(frame["_timestamp"], grain)
        keys = [*dimensions, "_season"]
        historical_values = pd.to_numeric(history_work[value_column], errors="coerce")
        invalid = history_work[value_column].notna() & historical_values.isna()
        if invalid.any():
            raise ValueError(f"Column '{value_column}' contains non-numeric values")
        history_work["_value"] = historical_values
        baseline = (
            history_work.groupby(keys, dropna=False, observed=True)["_value"]
            .median()
            .rename("baseline")
            .reset_index()
        )
        result = current_work.merge(baseline, on=keys, how="left", validate="many_to_one")
        return result.drop(columns=["_timestamp", "_season"]).reset_index(drop=True)

    @staticmethod
    def _season_key(timestamps: pd.Series, grain: Grain) -> pd.Series:
        if grain == "hour":
            return timestamps.dt.dayofweek.astype(str) + ":" + timestamps.dt.hour.astype(str)
        if grain == "day":
            return timestamps.dt.dayofweek
        if grain == "week":
            return timestamps.dt.isocalendar().week
        return timestamps.dt.month

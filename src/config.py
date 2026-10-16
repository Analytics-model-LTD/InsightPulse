from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

Direction = Literal["up_good", "down_good", "neutral"]
Grain = Literal["hour", "day", "week", "month"]
Aggregation = Literal["count_distinct", "sum", "count", "avg", "ratio"]
TopNStrategy = Literal["contribution", "volatility", "volume", "manual"]
Severity = Literal["info", "warning", "critical"]


class Measure(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str = Field(min_length=1)
    agg: Aggregation = "sum"
    column: str | None = None
    numerator: str | None = None
    denominator: str | None = None
    where: str | None = None
    direction: Direction = "neutral"
    priority: int = Field(default=99, ge=0)

    @model_validator(mode="after")
    def validate_measure_inputs(self) -> "Measure":
        if self.agg == "ratio":
            if not self.numerator or not self.denominator:
                raise ValueError(
                    "Ratio measures require both numerator and denominator"
                )
            if self.column is not None:
                raise ValueError("Ratio measures use numerator/denominator, not column")
        elif self.agg != "count" and not self.column:
            raise ValueError(f"{self.agg} measures require a column")
        elif self.numerator is not None or self.denominator is not None:
            raise ValueError("Only ratio measures may define numerator/denominator")
        return self


class Recipient(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    employee: str | None = None
    team: str | None = None
    role: str | None = None
    channels: list[str] = Field(min_length=1)
    min_severity: Severity = "info"
    measures: list[str] | None = None
    dimensions: dict[str, list[str]] | None = None

    @model_validator(mode="after")
    def validate_target(self) -> "Recipient":
        targets = [self.employee, self.team, self.role]
        if sum(target is not None for target in targets) != 1:
            raise ValueError("Specify exactly one recipient: employee, team, or role")
        return self


class Alerting(BaseModel):
    model_config = ConfigDict(extra="forbid")

    z_threshold: float | None = Field(default=None, gt=0)
    min_abs_change: float | None = Field(default=None, ge=0)
    min_pct_change: float | None = Field(default=None, ge=0)
    channels: list[str] = Field(default_factory=list)
    recipients: list[Recipient] = Field(default_factory=list)


class KpiSet(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1)
    time_column: str = Field(min_length=1)
    grain: Grain
    timezone: str = "UTC"
    measures: list[Measure] = Field(min_length=1)
    dimensions: list[str] = Field(default_factory=list)
    llm: str | None = None
    detector: str = "seasonal_zscore"
    detector_params: dict[str, Any] = Field(default_factory=dict)
    source: str | None = None
    top_n: int = Field(default=5, ge=1)
    top_n_strategy: TopNStrategy = "contribution"
    alerting: Alerting = Field(default_factory=Alerting)
    min_n: int = Field(default=7, ge=2)
    min_volume: float = Field(default=20, ge=0)
    z_threshold: float = Field(default=3.5, gt=0)
    min_abs_change: float = Field(default=0, ge=0)
    min_pct_change: float = Field(default=0, ge=0)

    @model_validator(mode="before")
    @classmethod
    def apply_alerting_thresholds(cls, value: Any) -> Any:
        if not isinstance(value, dict) or not isinstance(value.get("alerting"), dict):
            return value
        value = value.copy()
        alerting = value["alerting"].copy()
        for field_name in ("z_threshold", "min_abs_change", "min_pct_change"):
            if field_name in alerting:
                value.setdefault(field_name, alerting[field_name])
        value["alerting"] = alerting
        return value

    @model_validator(mode="after")
    def validate_columns_and_timezone(self) -> "KpiSet":
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError(f"Unknown timezone: {self.timezone}") from error

        measure_ids = [measure.id for measure in self.measures]
        if len(measure_ids) != len(set(measure_ids)):
            raise ValueError("Measure ids must be unique within a KPI set")
        if len(self.dimensions) != len(set(self.dimensions)):
            raise ValueError("Dimensions must be unique within a KPI set")
        if any(not dimension for dimension in self.dimensions):
            raise ValueError("Dimension column names cannot be empty")
        if self.time_column in self.dimensions:
            raise ValueError("The time column cannot also be a dimension")
        measure_columns = {
            measure.column for measure in self.measures if measure.column is not None
        }
        if self.time_column in measure_columns or measure_columns.intersection(
            self.dimensions
        ):
            raise ValueError(
                "Measure columns must be distinct from time and dimension columns"
            )

        return self


class SnapshotSet(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1)
    measure_column: str = Field(min_length=1)
    dimensions: list[str] = Field(min_length=1)
    min_customers: int = Field(default=50, ge=1)

    @model_validator(mode="after")
    def validate_columns(self) -> "SnapshotSet":
        if len(self.dimensions) != len(set(self.dimensions)):
            raise ValueError("Dimensions must be unique within a snapshot set")
        if any(not dimension for dimension in self.dimensions):
            raise ValueError("Dimension column names cannot be empty")
        if self.measure_column in self.dimensions:
            raise ValueError("The measure column cannot also be a dimension")
        return self


class KpiConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kpi_sets: list[KpiSet] = Field(default_factory=list)
    snapshot_sets: list[SnapshotSet] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_single_kpi_set(cls, value: Any) -> Any:
        if not isinstance(value, dict) or "kpi_set" not in value:
            return value
        if "kpi_sets" in value:
            raise ValueError("Use either 'kpi_set' or 'kpi_sets', not both")
        value = value.copy()
        single_set = value.pop("kpi_set")
        value["kpi_sets"] = (
            single_set if isinstance(single_set, list) else [single_set]
        )
        return value

    @model_validator(mode="after")
    def require_analysis_sets(self) -> "KpiConfig":
        if not self.kpi_sets and not self.snapshot_sets:
            raise ValueError("At least one KPI or snapshot set must be configured")
        return self


def load_kpi_config(path: str | Path) -> KpiConfig:
    with Path(path).open(encoding="utf-8") as config_file:
        raw_config = yaml.safe_load(config_file)
    return KpiConfig.model_validate(raw_config)

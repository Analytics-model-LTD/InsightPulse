from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.ensemble import IsolationForest


@dataclass(frozen=True)
class DetectedAnomaly:
    index: Any
    value: float
    severity_score: float
    method: str


class AnomalyDetector(Protocol):
    def detect(
        self, data: pd.DataFrame, value_column: str
    ) -> list[DetectedAnomaly]: ...


def _numeric_series(data: pd.DataFrame, value_column: str) -> pd.Series:
    if value_column not in data:
        raise ValueError(f"Missing value column: {value_column}")
    values = pd.to_numeric(data[value_column], errors="coerce")
    invalid = data[value_column].notna() & values.isna()
    if invalid.any():
        raise ValueError(f"Column '{value_column}' contains non-numeric values")
    if np.isinf(values.dropna().to_numpy(dtype=float)).any():
        raise ValueError(f"Column '{value_column}' contains infinite values")
    return values


def _results(
    data: pd.DataFrame,
    values: pd.Series,
    mask: np.ndarray,
    scores: np.ndarray,
    method: str,
) -> list[DetectedAnomaly]:
    output = []
    for position in np.flatnonzero(mask):
        score = float(scores[position])
        output.append(
            DetectedAnomaly(
                index=data.index[position],
                value=float(values.iloc[position]),
                severity_score=float(np.clip(score, 0, 1)),
                method=method,
            )
        )
    return output


class ZScoreDetector:
    def __init__(self, threshold: float = 3.0) -> None:
        if threshold <= 0:
            raise ValueError("Z-score threshold must be greater than zero")
        self.threshold = threshold

    def detect(self, data: pd.DataFrame, value_column: str) -> list[DetectedAnomaly]:
        values = _numeric_series(data, value_column)
        valid = values.notna().to_numpy()
        if valid.sum() < 2:
            return []
        scores = np.zeros(len(values), dtype=float)
        scores[valid] = np.abs(
            stats.zscore(values.to_numpy(dtype=float)[valid], nan_policy="raise")
        )
        mask = valid & (scores >= self.threshold)
        severity = np.where(mask, 1.0 - np.exp(-scores / self.threshold), 0.0)
        return _results(data, values, mask, severity, "zscore")


class MADDetector:
    def __init__(self, threshold: float = 3.5) -> None:
        if threshold <= 0:
            raise ValueError("MAD threshold must be greater than zero")
        self.threshold = threshold

    def detect(self, data: pd.DataFrame, value_column: str) -> list[DetectedAnomaly]:
        values = _numeric_series(data, value_column)
        valid = values.notna().to_numpy()
        if valid.sum() < 3:
            return []
        sample = values.to_numpy(dtype=float)[valid]
        median = float(np.median(sample))
        mad = float(stats.median_abs_deviation(sample, scale="normal"))
        if mad == 0 or not np.isfinite(mad):
            return []
        scores = np.zeros(len(values), dtype=float)
        scores[valid] = np.abs((sample - median) / mad)
        mask = valid & (scores >= self.threshold)
        severity = np.where(mask, 1.0 - np.exp(-scores / self.threshold), 0.0)
        return _results(data, values, mask, severity, "mad")


class IsolationForestDetector:
    def __init__(
        self,
        contamination: float = 0.05,
        random_state: int = 42,
        n_estimators: int = 100,
    ) -> None:
        if not 0 < contamination <= 0.5:
            raise ValueError("contamination must be in the interval (0, 0.5]")
        if n_estimators < 1:
            raise ValueError("n_estimators must be at least 1")
        self.contamination = contamination
        self.random_state = random_state
        self.n_estimators = n_estimators

    def detect(self, data: pd.DataFrame, value_column: str) -> list[DetectedAnomaly]:
        values = _numeric_series(data, value_column)
        valid = values.notna().to_numpy()
        if valid.sum() < 4:
            return []
        sample = values.to_numpy(dtype=float)[valid].reshape(-1, 1)
        model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=self.n_estimators,
        )
        labels = model.fit_predict(sample)
        raw_scores = -model.decision_function(sample)
        scale = float(np.max(np.abs(raw_scores)))
        normalized = raw_scores / scale if scale else np.zeros_like(raw_scores)
        mask = np.zeros(len(values), dtype=bool)
        scores = np.zeros(len(values), dtype=float)
        mask[valid] = labels == -1
        scores[valid] = np.clip(normalized, 0, 1)
        return _results(data, values, mask, scores, "isolation_forest")


def create_detector(method: str, **parameters: Any) -> AnomalyDetector:
    detectors: dict[str, type] = {
        "zscore": ZScoreDetector,
        "mad": MADDetector,
        "isolation_forest": IsolationForestDetector,
    }
    try:
        detector = detectors[method.lower()]
    except KeyError as error:
        raise ValueError(f"Unsupported detection method: {method}") from error
    return detector(**parameters)

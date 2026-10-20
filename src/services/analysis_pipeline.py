import asyncio
import json
from dataclasses import asdict, is_dataclass
from typing import Any, TypedDict

from pydantic import BaseModel, Field


class AnomalyAnalysis(BaseModel):
    root_cause_hypothesis: str
    confidence_score: float = Field(ge=0, le=1)
    business_impact: str
    fallback_reason: str | None = None


class _AnalysisState(TypedDict):
    context: dict[str, Any]
    result: AnomalyAnalysis | None


class AnalysisPipeline:
    """Use a LangGraph workflow to produce structured anomaly explanations."""

    def __init__(
        self,
        llm: Any,
        timeout_seconds: float = 30,
        max_context_chars: int = 12_000,
    ) -> None:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be greater than zero")
        if max_context_chars < 500:
            raise ValueError("max_context_chars must be at least 500")
        try:
            from langgraph.graph import END, START, StateGraph
        except ImportError as error:
            raise RuntimeError("Analysis workflow requires the 'langgraph' package") from error

        self._structured_llm = llm.with_structured_output(AnomalyAnalysis)
        self.timeout_seconds = timeout_seconds
        self.max_context_chars = max_context_chars
        graph = StateGraph(_AnalysisState)
        graph.add_node("analyze", self._analyze)
        graph.add_edge(START, "analyze")
        graph.add_edge("analyze", END)
        self._graph = graph.compile()

    async def analyze(self, context: dict[str, Any]) -> AnomalyAnalysis:
        result = await self._graph.ainvoke({"context": context, "result": None})
        analysis = result["result"]
        if analysis is None:
            raise RuntimeError("Analysis workflow completed without a result")
        return analysis

    @staticmethod
    def build_context(
        anomalies: list[Any],
        historical_context: Any,
        metric_metadata: dict[str, Any],
    ) -> dict[str, Any]:
        if isinstance(historical_context, list):
            history = historical_context
        elif hasattr(historical_context, "to_dict"):
            history = historical_context.to_dict(orient="records")
        else:
            raise ValueError(
                "historical_context must be a list or a DataFrame-like object"
            )

        def serialize(value: Any) -> Any:
            if is_dataclass(value) and not isinstance(value, type):
                return asdict(value)
            if hasattr(value, "model_dump"):
                return value.model_dump(mode="json")
            return value

        return {
            "anomalies": [serialize(anomaly) for anomaly in anomalies],
            "historical_context": [serialize(row) for row in history],
            "metric_metadata": metric_metadata,
        }

    async def _analyze(self, state: _AnalysisState) -> dict[str, AnomalyAnalysis]:
        context = state["context"]
        attempts = [context, self._compact_context(context)]
        for attempt_number, attempt in enumerate(attempts):
            prompt = self._prompt(attempt)
            try:
                response = await asyncio.wait_for(
                    self._structured_llm.ainvoke(prompt),
                    timeout=self.timeout_seconds,
                )
                if isinstance(response, AnomalyAnalysis):
                    analysis = response
                else:
                    analysis = AnomalyAnalysis.model_validate(response)
                return {"result": analysis}
            except (asyncio.TimeoutError, TimeoutError):
                return {
                    "result": self._fallback(
                        context, "LLM request timed out; deterministic fallback used."
                    )
                }
            except Exception as error:
                if self._is_timeout_error(error):
                    return {
                        "result": self._fallback(
                            context,
                            "LLM request timed out; deterministic fallback used.",
                        )
                    }
                if self._is_token_limit_error(error) and attempt_number == 0:
                    continue
                if self._is_token_limit_error(error):
                    return {
                        "result": self._fallback(
                            context,
                            "LLM token limit exceeded after context reduction; "
                            "deterministic fallback used.",
                        )
                    }
                raise
        raise RuntimeError("Analysis workflow exhausted its context retry")

    def _compact_context(self, context: dict[str, Any]) -> dict[str, Any]:
        compact = dict(context)
        anomalies = compact.get("anomalies")
        if isinstance(anomalies, list):
            compact["anomalies"] = anomalies[:10]
        history = compact.get("historical_context")
        if isinstance(history, list):
            compact["historical_context"] = history[-20:]

        while len(json.dumps(compact, default=str)) > self.max_context_chars:
            if isinstance(compact.get("historical_context"), list) and compact["historical_context"]:
                compact["historical_context"] = compact["historical_context"][::2]
                continue
            if isinstance(compact.get("anomalies"), list) and len(compact["anomalies"]) > 1:
                compact["anomalies"] = compact["anomalies"][: max(1, len(compact["anomalies"]) // 2)]
                continue
            compact = {
                key: value
                for key, value in compact.items()
                if key in {"metric_metadata", "anomalies"}
            }
            if len(json.dumps(compact, default=str)) <= self.max_context_chars:
                break
            compact = {"anomalies": []}
            break
        return compact

    @staticmethod
    def _prompt(context: dict[str, Any]) -> list[tuple[str, str]]:
        return [
            (
                "system",
                "Analyze the KPI anomalies using only the supplied facts. Do not "
                "invent causes. Return root_cause_hypothesis, confidence_score "
                "between 0 and 1, and business_impact.",
            ),
            ("human", json.dumps(context, default=str, separators=(",", ":"))),
        ]

    @staticmethod
    def _is_token_limit_error(error: Exception) -> bool:
        message = str(error).lower()
        return any(
            marker in message
            for marker in (
                "context_length",
                "token limit",
                "too many tokens",
                "maximum context",
                "maximum tokens",
            )
        )

    @staticmethod
    def _is_timeout_error(error: Exception) -> bool:
        message = str(error).lower()
        return any(
            marker in message
            for marker in ("timed out", "timeout", "deadline exceeded")
        )

    @staticmethod
    def _fallback(
        context: dict[str, Any], reason: str
    ) -> AnomalyAnalysis:
        anomalies = context.get("anomalies", [])
        count = len(anomalies) if isinstance(anomalies, list) else 0
        return AnomalyAnalysis(
            root_cause_hypothesis=(
                f"Automated analysis was unavailable. {count} anomaly record(s) "
                "require manual review; no root cause is inferred."
            ),
            confidence_score=0,
            business_impact=(
                "Potential impact cannot be assessed without a successful "
                "language-model analysis."
            ),
            fallback_reason=reason,
        )

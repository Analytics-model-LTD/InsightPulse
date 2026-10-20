from typing import Any, Protocol

from src.config import WebhookConfig


class CooldownStore(Protocol):
    def claim_alert_cooldown(self, alert_key: str, minutes: int) -> bool: ...

    def release_alert_cooldown(self, alert_key: str) -> None: ...


class NotificationDispatcher:
    """Send Slack or generic REST alerts while respecting Redis cooldowns."""

    _SEVERITY = {"info": 0, "warning": 1, "critical": 2}

    def __init__(
        self,
        cooldown_store: CooldownStore,
        webhooks: list[WebhookConfig],
        cooldown_period_minutes: int,
    ) -> None:
        if cooldown_period_minutes < 0:
            raise ValueError("Cooldown period cannot be negative")
        self.cooldown_store = cooldown_store
        self.webhooks = webhooks
        self.cooldown_period_minutes = cooldown_period_minutes

    def dispatch(
        self,
        alert_key: str,
        payload: dict[str, Any],
        severity: str = "warning",
        minimum_severity: str = "info",
    ) -> list[str]:
        if severity not in self._SEVERITY or minimum_severity not in self._SEVERITY:
            raise ValueError("Severity must be info, warning, or critical")
        if self._SEVERITY[severity] < self._SEVERITY[minimum_severity]:
            return []
        if not self.webhooks:
            return []
        if not self.cooldown_store.claim_alert_cooldown(
            alert_key, self.cooldown_period_minutes
        ):
            return []

        delivered: list[str] = []
        try:
            for webhook in self.webhooks:
                self._send(webhook, payload, severity)
                delivered.append(webhook.name)
        except Exception:
            self.cooldown_store.release_alert_cooldown(alert_key)
            raise
        return delivered

    @staticmethod
    def _send(
        webhook: WebhookConfig, payload: dict[str, Any], severity: str
    ) -> None:
        try:
            import httpx
        except ImportError as error:
            raise RuntimeError("Webhook delivery requires the 'httpx' package") from error

        body: dict[str, Any]
        if webhook.kind == "slack":
            body = {
                "text": f"[{severity.upper()}] {payload.get('summary', 'KPI anomaly')}",
                "attachments": [{"color": "danger" if severity == "critical" else "warning", "text": str(payload)}],
            }
        else:
            body = {**payload, "severity": severity}
        with httpx.Client(timeout=webhook.timeout_seconds) as client:
            response = client.post(
                webhook.url,
                json=body,
                headers=webhook.headers,
            )
            response.raise_for_status()

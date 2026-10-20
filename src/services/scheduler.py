from collections.abc import Callable
from typing import Any


class KPIJobScheduler:
    """Map named frequencies or five-field cron expressions to APScheduler jobs."""

    def __init__(self, timezone: str = "UTC") -> None:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
        except ImportError as error:
            raise RuntimeError(
                "KPI scheduling requires 'APScheduler<4'"
            ) from error
        self.timezone = timezone
        self._scheduler = BackgroundScheduler(timezone=timezone)

    def add_job(
        self,
        job_id: str,
        frequency: str,
        callback: Callable[[], Any],
    ) -> None:
        trigger = self._trigger(frequency)
        self._scheduler.add_job(
            callback,
            trigger=trigger,
            id=job_id,
            replace_existing=True,
        )

    def start(self) -> None:
        self._scheduler.start()

    def shutdown(self, wait: bool = True) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown(wait=wait)

    def _trigger(self, frequency: str) -> Any:
        try:
            from apscheduler.triggers.cron import CronTrigger
        except ImportError as error:
            raise RuntimeError(
                "KPI scheduling requires 'APScheduler<4'"
            ) from error

        normalized = frequency.strip().lower()
        if normalized == "hourly":
            return CronTrigger(minute=0, timezone=self.timezone)
        if normalized == "daily":
            return CronTrigger(hour=0, minute=0, timezone=self.timezone)
        if normalized == "weekly":
            return CronTrigger(
                day_of_week="mon", hour=0, minute=0, timezone=self.timezone
            )
        expression = normalized.removeprefix("cron:").strip()
        try:
            return CronTrigger.from_crontab(expression, timezone=self.timezone)
        except ValueError as error:
            raise ValueError(
                "Frequency must be hourly, daily, weekly, or a five-field cron expression"
            ) from error

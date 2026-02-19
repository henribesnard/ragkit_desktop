"""Alert evaluator for dashboard metrics."""

from __future__ import annotations

from ragkit.config.monitoring_schema import AlertModel, MonitoringConfig


class AlertEvaluator:
    """Evaluates current metrics against configured thresholds."""

    def __init__(self, config: MonitoringConfig):
        self.config = config

    def evaluate(
        self,
        *,
        metrics: dict,
        feedback_stats: dict | None = None,
    ) -> list[AlertModel]:
        alerts: list[AlertModel] = []

        p95_latency = float(metrics.get("p95_latency_ms", 0.0) or 0.0)
        if p95_latency > float(self.config.alert_latency_p95_ms):
            alerts.append(
                AlertModel(
                    metric="latency_p95",
                    message=(
                        f"Latence elevee : p95 = {int(round(p95_latency))}ms "
                        f"(seuil : {self.config.alert_latency_p95_ms}ms)"
                    ),
                    current_value=p95_latency,
                    threshold=float(self.config.alert_latency_p95_ms),
                    severity="warning",
                )
            )

        success_rate = float(metrics.get("success_rate", 1.0) or 0.0)
        if success_rate < float(self.config.alert_success_rate):
            severity = "critical" if success_rate < 0.7 else "warning"
            alerts.append(
                AlertModel(
                    metric="success_rate",
                    message=(
                        f"Taux de reussite degrade : {success_rate * 100:.0f}% "
                        f"(seuil : {self.config.alert_success_rate * 100:.0f}%)"
                    ),
                    current_value=success_rate,
                    threshold=float(self.config.alert_success_rate),
                    severity=severity,
                )
            )

        daily_cost = float(metrics.get("total_cost_usd", 0.0) or 0.0)
        if daily_cost > float(self.config.alert_daily_cost):
            alerts.append(
                AlertModel(
                    metric="daily_cost",
                    message=(
                        f"Cout eleve : ${daily_cost:.4f} aujourd'hui "
                        f"(seuil : ${self.config.alert_daily_cost:.2f})"
                    ),
                    current_value=daily_cost,
                    threshold=float(self.config.alert_daily_cost),
                    severity="warning",
                )
            )

        feedback_payload = feedback_stats or {}
        negative = int(feedback_payload.get("negative", 0) or 0)
        positive = int(feedback_payload.get("positive", 0) or 0)
        with_feedback = positive + negative
        negative_rate = (negative / with_feedback) if with_feedback else 0.0
        if negative_rate > float(self.config.alert_negative_feedback):
            alerts.append(
                AlertModel(
                    metric="negative_feedback",
                    message=(
                        f"Feedback negatif eleve : {negative_rate * 100:.0f}% "
                        f"(seuil : {self.config.alert_negative_feedback * 100:.0f}%)"
                    ),
                    current_value=negative_rate,
                    threshold=float(self.config.alert_negative_feedback),
                    severity="warning",
                )
            )

        return alerts

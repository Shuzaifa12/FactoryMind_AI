"""Business impact calculation engine.
Deterministic calculations implemented in pure Python independent of LLMs.
"""

from typing import Any


def calculate_downtime_loss(
    downtime_hours: float | None, loss_per_hour: float | None
) -> float | None:
    """Calculates downtime loss = downtime_hours * loss_per_hour.
    Returns None if either input is missing or unknown.
    """
    if downtime_hours is None or loss_per_hour is None:
        return None
    if downtime_hours < 0 or loss_per_hour < 0:
        raise ValueError("Downtime hours and loss per hour must be non-negative.")
    return round(downtime_hours * loss_per_hour, 2)


def calculate_total_impact(
    downtime_loss: float | None, maintenance_cost: float | None
) -> float | None:
    """Total impact = downtime_loss + maintenance_cost.
    Avoids double counting. If downtime_loss is unknown, returns maintenance_cost if available.
    """
    if downtime_loss is None and maintenance_cost is None:
        return None
    total = 0.0
    if downtime_loss is not None:
        total += downtime_loss
    if maintenance_cost is not None:
        total += maintenance_cost
    return round(total, 2)


def calculate_priority_score(
    criticality: int | None,
    severity: str,
    total_impact: float | None,
) -> float:
    """Calculates operational priority score (0 to 100).
    Factors in machine criticality (1-5), severity tier, and financial magnitude.
    """
    # Base from criticality (1 to 5) -> 10 to 50 pts
    crit_val = criticality if criticality is not None else 3
    crit_points = max(1, min(5, crit_val)) * 10

    # Severity points -> 15 to 40 pts
    sev_map = {
        "critical": 40.0,
        "high": 30.0,
        "medium": 20.0,
        "low": 10.0,
    }
    sev_points = sev_map.get(severity.lower(), 15.0)

    # Impact points -> 0 to 10 pts
    impact_points = 0.0
    if total_impact is not None and total_impact > 0:
        impact_points = min(10.0, total_impact / 1000.0)

    score = round(crit_points + sev_points + impact_points, 1)
    return min(100.0, max(0.0, score))


def compute_alert_impact(
    assumed_hours: float | None,
    loss_per_hour: float | None,
    repair_cost: float | None,
    criticality: int | None,
    severity: str,
    formula_version: str = "v1.0",
) -> dict[str, Any]:
    dt_loss = calculate_downtime_loss(assumed_hours, loss_per_hour)
    tot_impact = calculate_total_impact(dt_loss, repair_cost)
    priority = calculate_priority_score(criticality, severity, tot_impact)

    inputs_used = {}
    missing_inputs = []

    if assumed_hours is not None:
        inputs_used["hours"] = assumed_hours
    else:
        missing_inputs.append("hours")

    if loss_per_hour is not None:
        inputs_used["loss_per_hour"] = loss_per_hour
    else:
        missing_inputs.append("loss_per_hour")

    if repair_cost is not None:
        inputs_used["repair_cost"] = repair_cost
    else:
        missing_inputs.append("repair_cost")

    return {
        "assumed_downtime_hours": assumed_hours,
        "downtime_loss": dt_loss,
        "maintenance_cost": repair_cost,
        "total_estimated_impact": tot_impact,
        "priority_score": priority,
        "formula_version": formula_version,
        "inputs_used": inputs_used,
        "missing_inputs": missing_inputs,
    }

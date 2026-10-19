import pytest

from app.services.impact import (
    calculate_downtime_loss,
    calculate_priority_score,
    calculate_total_impact,
    compute_alert_impact,
)


def test_calculate_downtime_loss():
    # Valid calculation
    assert calculate_downtime_loss(4.5, 1200.0) == 5400.0
    assert calculate_downtime_loss(0.0, 1000.0) == 0.0
    assert calculate_downtime_loss(3.0, 0.0) == 0.0

    # Missing inputs return None (not a fabricated number)
    assert calculate_downtime_loss(None, 1200.0) is None
    assert calculate_downtime_loss(4.5, None) is None
    assert calculate_downtime_loss(None, None) is None

    # Negative inputs raise ValueError
    with pytest.raises(ValueError):
        calculate_downtime_loss(-1.0, 100.0)
    with pytest.raises(ValueError):
        calculate_downtime_loss(1.0, -100.0)


def test_calculate_total_impact():
    # Both available
    assert calculate_total_impact(5400.0, 3500.0) == 8900.0
    # One available
    assert calculate_total_impact(5400.0, None) == 5400.0
    assert calculate_total_impact(None, 3500.0) == 3500.0
    # Both missing
    assert calculate_total_impact(None, None) is None


def test_calculate_priority_score():
    # High criticality (5) + critical severity (40 pts) + high impact -> near 100
    score_high = calculate_priority_score(criticality=5, severity="critical", total_impact=8900.0)
    assert 90 <= score_high <= 100

    # Low criticality (1) + low severity (10 pts) + zero impact
    score_low = calculate_priority_score(criticality=1, severity="low", total_impact=0.0)
    assert 20 <= score_low <= 25

    # Missing criticality falls back to 3
    score_default = calculate_priority_score(criticality=None, severity="medium", total_impact=1000.0)
    assert 50 <= score_default <= 55


def test_compute_alert_impact():
    result = compute_alert_impact(
        assumed_hours=4.5,
        loss_per_hour=1200.0,
        repair_cost=3500.0,
        criticality=5,
        severity="critical",
    )
    assert result["downtime_loss"] == 5400.0
    assert result["total_estimated_impact"] == 8900.0
    assert "hours" in result["inputs_used"]
    assert len(result["missing_inputs"]) == 0

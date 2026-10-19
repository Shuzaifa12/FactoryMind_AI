"""Anomaly detection engine using scikit-learn Isolation Forest with statistical rule fallback."""

import logging
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from app.db.models import Alert, ImpactEstimate, Machine, ProcessingRun, SensorReading
from app.services.impact import compute_alert_impact

logger = logging.getLogger("factorymind.ml")


def compute_mad(series: pd.Series) -> float:
    """Computes Median Absolute Deviation (MAD)."""
    median = series.median()
    diff = (series - median).abs()
    mad = diff.median()
    return float(mad) if mad > 1e-6 else float(series.std()) if series.std() > 1e-6 else 1.0


def run_isolation_forest(
    features_df: pd.DataFrame, contamination: float = 0.1
) -> tuple[np.ndarray, np.ndarray]:
    """Runs scikit-learn Isolation Forest on validated numerical columns.
    Returns: (is_anomaly_labels: bool[], anomaly_scores: float[])
    Note: Anomaly scores are relative uncalibrated detector scores (0.0 to 1.0),
    never calibrated failure probabilities.
    """
    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=100,
    )
    model.fit(features_df)
    preds = model.predict(features_df)  # -1 for anomaly, 1 for inlier
    is_anomaly = preds == -1

    # score_samples returns opposite of anomaly score (lower is more anomalous)
    raw_scores = model.score_samples(features_df)
    # Normalize raw score to range [0.0, 1.0] where 1.0 is most anomalous
    min_s, max_s = raw_scores.min(), raw_scores.max()
    if max_s > min_s:
        norm_scores = 1.0 - ((raw_scores - min_s) / (max_s - min_s))
    else:
        norm_scores = np.zeros_like(raw_scores)

    return is_anomaly, norm_scores


def detect_anomalies_for_dataset(
    db: Session,
    dataset_id: int,
    contamination: float = 0.1,
    min_samples_for_ml: int = 15,
) -> dict[str, Any]:
    """Detects anomalies across all sensor readings in a dataset."""
    # Query specific columns as tuples for fast vectorized DataFrame construction
    reading_rows = (
        db.query(
            SensorReading.id,
            SensorReading.machine_id,
            SensorReading.timestamp,
            SensorReading.temperature,
            SensorReading.vibration,
            SensorReading.current,
        )
        .filter(SensorReading.dataset_id == dataset_id)
        .order_by(SensorReading.timestamp.asc())
        .all()
    )

    if not reading_rows:
        raise ValueError(f"No sensor readings found for dataset ID {dataset_id}")

    df = pd.DataFrame(
        reading_rows,
        columns=["id", "machine_id", "timestamp", "temperature", "vibration", "current"],
    )

    numeric_cols = [c for c in ["temperature", "vibration", "current"] if c in df.columns and df[c].notna().sum() > 0]
    if not numeric_cols:
        raise ValueError("Dataset has no numerical sensor channels for anomaly detection.")

    # Determine method: ML (Isolation Forest) vs rule_fallback
    method = "isolation_forest"
    if len(df) < min_samples_for_ml:
        method = "rule_fallback"

    started_at = datetime.now(UTC)
    proc_run = ProcessingRun(
        dataset_id=dataset_id,
        method=method,
        config={"contamination": contamination, "features": numeric_cols},
        status="running",
        started_at=started_at,
        library_versions={"scikit-learn": "1.5+", "pandas": "2.2+", "numpy": "2.0+"},
    )
    db.add(proc_run)
    db.flush()

    # Clear previous alerts for this dataset to allow repeatable runs
    db.query(Alert).filter(Alert.dataset_id == dataset_id).delete()
    db.flush()

    machines = db.query(Machine).filter(Machine.dataset_id == dataset_id).all()
    machine_by_id = {m.id: m for m in machines}
    machine_by_ext = {m.external_id: m for m in machines}

    total_alerts_created = 0

    for m_id, group in df.groupby("machine_id"):
        mach = machine_by_ext.get(str(m_id)) or machine_by_id.get(int(m_id) if str(m_id).isdigit() else -1)
        if not mach:
            continue

        clean_group = group.dropna(subset=numeric_cols)
        if len(clean_group) == 0:
            continue

        # Baselines: median and MAD per feature
        medians = {col: float(clean_group[col].median()) for col in numeric_cols}
        mads = {col: compute_mad(clean_group[col]) for col in numeric_cols}

        if method == "isolation_forest" and len(clean_group) >= min_samples_for_ml:
            feature_data = clean_group[numeric_cols].fillna(clean_group[numeric_cols].median())
            is_anomaly_arr, scores_arr = run_isolation_forest(feature_data, contamination=contamination)
        else:
            # Rule fallback: vectorized points deviating > 2.5 MAD
            if numeric_cols:
                dev_cols = [
                    np.abs(clean_group[col].to_numpy(dtype=float) - medians[col])
                    / (mads[col] if mads[col] > 1e-4 else 1.0)
                    for col in numeric_cols
                ]
                dev_matrix = np.column_stack(dev_cols)
                max_devs = np.max(dev_matrix, axis=1)
                is_anomaly_arr = max_devs >= 2.5
                scores_arr = np.clip(max_devs / 5.0, 0.0, 1.0)
            else:
                is_anomaly_arr = np.zeros(len(clean_group), dtype=bool)
                scores_arr = np.zeros(len(clean_group), dtype=float)

        anom_indices = np.where(is_anomaly_arr)[0]
        if len(anom_indices) == 0:
            continue

        # Group consecutive or clustered anomalies
        anom_rows = clean_group.iloc[anom_indices]
        start_ts = anom_rows["timestamp"].min()
        end_ts = anom_rows["timestamp"].max()
        max_score = round(float(scores_arr[anom_indices].max()), 2)

        # Build evidence
        evidence = []
        severity_rules = []
        inspection_steps = []

        max_deviations = {}
        for col in numeric_cols:
            peak_val = float(anom_rows[col].max())
            dev = (peak_val - medians[col]) / (mads[col] if mads[col] > 1e-4 else 1.0)
            max_deviations[col] = dev
            unit = "°C" if col == "temperature" else "mm/s" if col == "vibration" else "A"
            evidence.append({
                "feature": col.capitalize(),
                "observed_value": round(peak_val, 2),
                "baseline_median": round(medians[col], 2),
                "deviation_mad": round(dev, 2),
                "unit": unit,
            })

        # Severity rule determination
        highest_dev = max(max_deviations.values()) if max_deviations else 1.0
        crit = mach.criticality or 3

        if highest_dev > 3.0 and crit >= 4:
            severity = "critical"
            severity_rules.append(f"Severe telemetry deviation ({highest_dev:.1f}x MAD) on Tier {crit} asset.")
            inspection_steps.append("Immediate physical acoustic and thermographic inspection required.")
            inspection_steps.append("Verify rotational lubrication delivery and motor drive current draw.")
        elif highest_dev > 2.5 or crit >= 4:
            severity = "high"
            severity_rules.append(f"Elevated telemetry deviation ({highest_dev:.1f}x MAD) exceeding safe bounds.")
            inspection_steps.append("Inspect mechanical couplings, bearing cartridge, and foundation bolts.")
        elif highest_dev > 1.8:
            severity = "medium"
            severity_rules.append("Moderate sensor pattern anomaly observed.")
            inspection_steps.append("Schedule sensor calibration and check operational filters.")
        else:
            severity = "low"
            severity_rules.append("Minor statistical transient deviation.")
            inspection_steps.append("Monitor sensor trend over next 24 operating hours.")

        inspection_steps.append("All recommendations require qualified human technician confirmation.")

        # Business Impact
        assumed_hours = 4.5 if severity == "critical" else 3.0 if severity == "high" else 1.5
        impact_data = compute_alert_impact(
            assumed_hours=assumed_hours,
            loss_per_hour=mach.loss_per_hour,
            repair_cost=mach.maintenance_cost_estimate,
            criticality=mach.criticality,
            severity=severity,
        )

        alert = Alert(
            dataset_id=dataset_id,
            run_id=proc_run.id,
            machine_id=mach.id,
            start_ts=start_ts,
            end_ts=end_ts,
            anomaly_score=max_score,
            is_anomaly_label=True,
            severity=severity,
            severity_reason=severity_rules,
            evidence=evidence,
            data_quality_warnings=[
                f"Detector method used: {method}.",
                "Alert is a statistical indicator, not proof of machine failure.",
            ],
            inspection_steps=inspection_steps,
            status="open",
        )
        db.add(alert)
        db.flush()

        estimate = ImpactEstimate(
            alert_id=alert.id,
            assumed_downtime_hours=impact_data["assumed_downtime_hours"],
            downtime_loss=impact_data["downtime_loss"],
            maintenance_cost=impact_data["maintenance_cost"],
            total_estimated_impact=impact_data["total_estimated_impact"],
            priority_score=impact_data["priority_score"],
            inputs_used=impact_data["inputs_used"],
            missing_inputs=impact_data["missing_inputs"],
            formula_version=impact_data["formula_version"],
        )
        db.add(estimate)
        total_alerts_created += 1

    proc_run.status = "completed"
    proc_run.finished_at = datetime.now(UTC)
    db.commit()

    return {
        "run_id": proc_run.id,
        "method": method,
        "total_alerts": total_alerts_created,
        "features": numeric_cols,
    }

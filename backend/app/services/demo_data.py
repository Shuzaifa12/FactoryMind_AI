"""Deterministic demo data service for FactoryMind AI.
Populates four production units (CNC-01, PRESS-04, PUMP-12, CONV-02),
simulated multi-channel telemetry readings with deliberate anomalies,
and runs the anomaly detection pipeline to produce traceable alerts and impact estimates.
"""

import math
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models import (
    Dataset,
    Machine,
    MaintenanceRecord,
    SensorReading,
)
from app.services.anomaly_detector import detect_anomalies_for_dataset

DEMO_MACHINES_CONFIG = [
    {
        "external_id": "CNC-01",
        "name": "5-Axis High-Speed CNC Milling Center",
        "criticality": 5,
        "production_priority": 5,
        "loss_per_hour": 1200.0,
        "maintenance_cost_estimate": 3500.0,
        "assumption_source": "illustrative",
    },
    {
        "external_id": "PRESS-04",
        "name": "Hydraulic Stamping Press (800T)",
        "criticality": 4,
        "production_priority": 4,
        "loss_per_hour": 950.0,
        "maintenance_cost_estimate": 4200.0,
        "assumption_source": "illustrative",
    },
    {
        "external_id": "PUMP-12",
        "name": "High-Pressure Coolant Circulation Pump",
        "criticality": 3,
        "production_priority": 3,
        "loss_per_hour": 400.0,
        "maintenance_cost_estimate": 1200.0,
        "assumption_source": "illustrative",
    },
    {
        "external_id": "CONV-02",
        "name": "Outfeed Packaging Conveyor Line",
        "criticality": 2,
        "production_priority": 2,
        "loss_per_hour": 250.0,
        "maintenance_cost_estimate": 650.0,
        "assumption_source": "illustrative",
    },
]

DEMO_MAINTENANCE_LOGS = [
    {
        "machine_id": "CNC-01",
        "date": datetime(2026, 9, 12, 9, 0, tzinfo=UTC),
        "description": "Scheduled spindle bearing inspection and high-speed grease replenishment.",
        "source": "pdf",
        "match_confidence": "exact_id",
    },
    {
        "machine_id": "PRESS-04",
        "date": datetime(2026, 8, 4, 14, 30, tzinfo=UTC),
        "description": "Hydraulic piston seal replacement and oil filter change.",
        "source": "csv",
        "match_confidence": "exact_id",
    },
    {
        "machine_id": "PUMP-12",
        "date": datetime(2026, 7, 20, 11, 15, tzinfo=UTC),
        "description": "Suction strainer flushed; impeller inspected for cavitation wear.",
        "source": "pdf",
        "match_confidence": "exact_id",
    },
    {
        "machine_id": "CONV-02",
        "date": datetime(2026, 9, 28, 8, 0, tzinfo=UTC),
        "description": "Conveyor drive roller alignment and belt tension calibration.",
        "source": "csv",
        "match_confidence": "exact_id",
    },
]


def load_or_reset_demo_dataset(db: Session) -> Dataset:
    """Safely and repeatably seeds or resets the deterministic demo dataset."""
    # Find existing demo dataset if present
    existing_demos = db.query(Dataset).filter(Dataset.source == "demo").all()
    for d in existing_demos:
        # Cascade delete removes machines, readings, processing runs, alerts, impact estimates
        db.delete(d)
    db.commit()

    # Create active demo dataset
    demo_dataset = Dataset(
        name="Standard Plant Operations (Judge Demo Dataset)",
        source="demo",
        is_simulated=True,
        original_filename="simulated_plant_telemetry_oct2026.csv",
        file_type="csv",
        size_bytes=24500,
        status="ready",
        row_count=200,
        is_active=True,
        quality_report={
            "total_rows": 200,
            "valid_rows": 200,
            "missing_values_count": 0,
            "duplicate_rows_count": 0,
            "timestamp_range": {
                "start": "2026-10-16T00:00:00Z",
                "end": "2026-10-17T13:15:00Z",
            },
            "sampling_rate": "45 minutes",
            "notes": [
                "Dataset contains deterministic multi-channel telemetry for 4 production assets.",
                "Deliberate anomalous sensor clusters present on CNC-01, PRESS-04, and PUMP-12.",
                "Clearly labeled as simulated data for judging evaluation.",
            ],
        },
    )
    db.add(demo_dataset)
    db.flush()

    # Create machines
    machine_map = {}
    for m_cfg in DEMO_MACHINES_CONFIG:
        machine = Machine(
            dataset_id=demo_dataset.id,
            external_id=m_cfg["external_id"],
            name=m_cfg["name"],
            criticality=m_cfg["criticality"],
            production_priority=m_cfg["production_priority"],
            loss_per_hour=m_cfg["loss_per_hour"],
            maintenance_cost_estimate=m_cfg["maintenance_cost_estimate"],
            assumption_source=m_cfg["assumption_source"],
        )
        db.add(machine)
        db.flush()
        machine_map[m_cfg["external_id"]] = machine

    # Create Maintenance Records
    for m_log in DEMO_MAINTENANCE_LOGS:
        target_mach = machine_map.get(m_log["machine_id"])
        record = MaintenanceRecord(
            dataset_id=demo_dataset.id,
            machine_id=target_mach.id if target_mach else None,
            date=m_log["date"],
            description=m_log["description"],
            source=m_log["source"],
            match_confidence=m_log["match_confidence"],
        )
        db.add(record)

    # Generate 50 points (spaced 45 mins apart) for each of the 4 machines = 200 rows
    base_time = datetime(2026, 10, 16, 0, 0, tzinfo=UTC)
    total_points = 50

    for i in range(total_points):
        ts = base_time + timedelta(minutes=i * 45)

        # CNC-01 (Spindle vibration spike & temp climb at points 35-44)
        is_cnc_anom = 35 <= i <= 44
        cnc_temp = (
            54.0 + (i - 35) * 0.7 + (math.sin(i) * 0.8)
            if is_cnc_anom
            else 41.5 + math.sin(i * 0.5) * 1.5
        )
        cnc_vib = (
            4.6 + (i - 35) * 0.12 + (math.cos(i) * 0.4)
            if is_cnc_anom
            else 1.7 + math.cos(i * 0.8) * 0.2
        )
        cnc_curr = 14.2 + (2.8 if is_cnc_anom else 0.0) + math.sin(i) * 0.5

        db.add(
            SensorReading(
                dataset_id=demo_dataset.id,
                machine_id=machine_map["CNC-01"].id,
                timestamp=ts,
                temperature=round(cnc_temp, 2),
                vibration=round(cnc_vib, 2),
                current=round(cnc_curr, 2),
                status="anomalous" if is_cnc_anom else "normal",
            )
        )

        # PRESS-04 (Current surge and temp rise at points 18-26)
        is_press_anom = 18 <= i <= 26
        press_temp = (
            64.0 + math.sin(i) * 2.2
            if is_press_anom
            else 51.5 + math.sin(i * 0.3) * 1.8
        )
        press_vib = (
            3.9 + math.cos(i) * 0.4
            if is_press_anom
            else 2.8 + math.cos(i * 0.5) * 0.3
        )
        press_curr = (
            43.5 + math.sin(i) * 3.0
            if is_press_anom
            else 27.0 + math.sin(i * 0.7) * 1.5
        )

        db.add(
            SensorReading(
                dataset_id=demo_dataset.id,
                machine_id=machine_map["PRESS-04"].id,
                timestamp=ts,
                temperature=round(press_temp, 2),
                vibration=round(press_vib, 2),
                current=round(press_curr, 2),
                status="anomalous" if is_press_anom else "normal",
            )
        )

        # PUMP-12 (Cavitational casing vibration spike at points 28-34)
        is_pump_anom = 28 <= i <= 34
        pump_temp = 36.8 + math.sin(i * 0.4) * 1.1
        pump_vib = (
            2.85 + math.sin(i) * 0.35
            if is_pump_anom
            else 0.82 + math.cos(i * 0.6) * 0.15
        )
        pump_curr = 8.1 + (1.4 if is_pump_anom else 0.0) + math.sin(i * 0.5) * 0.3

        db.add(
            SensorReading(
                dataset_id=demo_dataset.id,
                machine_id=machine_map["PUMP-12"].id,
                timestamp=ts,
                temperature=round(pump_temp, 2),
                vibration=round(pump_vib, 2),
                current=round(pump_curr, 2),
                status="anomalous" if is_pump_anom else "normal",
            )
        )

        # CONV-02 (Normal throughout)
        conv_temp = 31.5 + math.sin(i * 0.5) * 0.9
        conv_vib = 0.58 + math.cos(i * 0.4) * 0.08
        conv_curr = 5.1 + math.sin(i * 0.3) * 0.25

        db.add(
            SensorReading(
                dataset_id=demo_dataset.id,
                machine_id=machine_map["CONV-02"].id,
                timestamp=ts,
                temperature=round(conv_temp, 2),
                vibration=round(conv_vib, 2),
                current=round(conv_curr, 2),
                status="normal",
            )
        )

    db.commit()

    # Execute anomaly detection pipeline on seeded demo readings
    detect_anomalies_for_dataset(db, demo_dataset.id, contamination=0.1)

    return demo_dataset

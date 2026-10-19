"""Upload processing and validation service for CSV and XLSX datasets."""

import io
import os
from typing import Any

import numpy as np
import pandas as pd
from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import Dataset, Machine, SensorReading
from app.schemas.dataset import (
    ColumnMappingRequest,
    QualityReport,
    UploadPreviewResponse,
)

settings = get_settings()

def read_dataset_content(dataset: Dataset) -> bytes:
    """Read uploaded content from the database, with legacy file fallback."""
    if dataset.original_content is not None:
        return bytes(dataset.original_content)

    # Compatibility for datasets uploaded before database-backed storage.
    if dataset.stored_path and os.path.isfile(dataset.stored_path):
        with open(dataset.stored_path, "rb") as file:
            return file.read()

    raise AppError(
        code="STORED_FILE_MISSING",
        message="The dataset file is unavailable. Please upload the dataset again.",
    )


def parse_numeric_series(series: pd.Series) -> list[float | None]:
    """Converts a pandas Series to a list of Optional[float].

    Robustness guarantees:
    - Handles floats and ints directly.
    - Handles strings with leading and trailing whitespace (e.g. ' 42.5 ', '1.85\\r').
    - Handles missing/null values (None, np.nan, pd.NA, '', '   ', 'nan', 'null', 'none', 'n/a', 'na', '-') -> None.
    - Handles invalid text cells (e.g. 'fault', 'error', 'abc') -> None.
    - Replaces infinite values (inf, -inf) with None.
    - NEVER fabricates readings or silently invents 0.0 for non-zeros.
    """
    if series is None or len(series) == 0:
        return []

    if pd.api.types.is_numeric_dtype(series):
        arr = series.to_numpy(dtype=float, na_value=np.nan)
        return [float(x) if np.isfinite(x) else None for x in arr]

    cleaned = series.astype(str).str.strip()
    null_strings = {"", "nan", "none", "null", "n/a", "na", "-", "?", "nil", "inf", "-inf"}
    cleaned = cleaned.replace({s: np.nan for s in null_strings}, regex=False)
    converted = pd.to_numeric(cleaned, errors="coerce")
    arr = converted.to_numpy(dtype=float, na_value=np.nan)
    return [float(x) if np.isfinite(x) else None for x in arr]


def suggest_column_mappings(columns: list[str]) -> dict[str, str | None]:
    """Heuristically suggests mappings for standard industrial channels."""
    lower_map = {c.lower().strip(): c for c in columns}

    def find_match(*keywords: str) -> str | None:
        for kw in keywords:
            for l_col, orig_col in lower_map.items():
                if kw in l_col:
                    return orig_col
        return None

    ts = find_match("time", "date", "ts", "datetime", "timestamp", "recorded")
    m_id = find_match("machine", "asset", "unit", "equipment", "device", "motor", "tool", "id")
    temp = find_match("temp", "temperature", "deg", "thermal", "heat", "celsius", "fahrenheit", "t_")
    vib = find_match("vib", "vibration", "velocity", "accel", "oscil", "displacement", "v_")
    curr = find_match("current", "amp", "power", "energy", "load", "kw", "watt", "voltage", "volt", "c_")

    # If keyword matching left all sensor channels empty, suggest first available unassigned columns
    used = {ts, m_id, temp, vib, curr}
    unassigned = [c for c in columns if c not in used and c is not None]

    if not temp and unassigned:
        temp = unassigned.pop(0)
    if not vib and unassigned:
        vib = unassigned.pop(0)
    if not curr and unassigned:
        curr = unassigned.pop(0)

    return {
        "timestamp_col": ts,
        "machine_id_col": m_id,
        "temperature_col": temp,
        "vibration_col": vib,
        "current_col": curr,
    }


def parse_and_validate_file(
    content: bytes, filename: str
) -> tuple[pd.DataFrame, str, list[str]]:
    """Parses raw CSV or XLSX bytes into a pandas DataFrame with validation."""
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise AppError(
            code="FILE_TOO_LARGE",
            message=f"File size exceeds maximum allowed limit of {settings.max_upload_mb} MB.",
        )

    ext = os.path.splitext(filename)[1].lower()
    warnings: list[str] = []

    try:
        if ext in [".csv", ".txt"]:
            file_type = "csv"
            df = pd.read_csv(io.BytesIO(content))
        elif ext in [".xlsx", ".xls"]:
            file_type = "xlsx"
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise AppError(
                code="UNSUPPORTED_FILE_TYPE",
                message=f"Unsupported file format '{ext}'. Allowed: CSV, XLSX.",
            )
    except Exception as e:
        if isinstance(e, AppError):
            raise
        raise AppError(
            code="FILE_PARSE_ERROR",
            message=f"Could not parse uploaded spreadsheet: {e!s}",
        )

    if df.empty or len(df) == 0:
        raise AppError(
            code="EMPTY_DATASET",
            message="Uploaded file contains no rows.",
        )

    if len(df.columns) < 2:
        raise AppError(
            code="INVALID_COLUMNS",
            message="Uploaded dataset must contain at least 2 columns (e.g. timestamp and machine or sensor).",
        )

    # Clean whitespace in column names
    df.columns = [str(c).strip() for c in df.columns]

    return df, file_type, warnings


def create_uploaded_dataset(
    db: Session,
    filename: str,
    content: bytes,
) -> UploadPreviewResponse:
    df, file_type, warnings = parse_and_validate_file(content, filename)

    # Save content to disk in uploads directory
    # os.makedirs(settings.upload_dir, exist_ok=True)
    # safe_filename = f"{int(datetime.now(UTC).timestamp())}_{filename}"
    # file_path = os.path.join(settings.upload_dir, safe_filename)
    # with open(file_path, "wb") as f:
    #     f.write(content)

    # Store file bytes in the database because serverless filesystems
    # may be read-only or ephemeral.
    file_path = None

    total_rows = len(df)
    headers = list(df.columns)
    suggested = suggest_column_mappings(headers)

    if not suggested.get("timestamp_col"):
        warnings.append("Could not automatically identify timestamp column; please map manually.")
    if not suggested.get("machine_id_col"):
        warnings.append("Could not automatically identify machine identifier column.")

    dataset = Dataset(
        name=filename,
        source="upload",
        is_simulated=False,
        original_filename=filename,
        stored_path=file_path,
        original_content=content,
        file_type=file_type,
        size_bytes=len(content),
        status="uploaded",
        column_mapping=suggested,
        row_count=total_rows,
        is_active=False,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Preview top 5 rows with JSON serializable types
    preview_df = df.head(5).copy()
    preview_rows = preview_df.where(pd.notnull(preview_df), None).to_dict(orient="records")

    return UploadPreviewResponse(
        dataset_id=dataset.id,
        filename=filename,
        file_type=file_type,
        size_bytes=len(content),
        total_rows=total_rows,
        headers=headers,
        preview_rows=preview_rows,
        suggested_mapping=suggested,
        quality_warnings=warnings,
    )


def apply_column_mapping(
    db: Session,
    dataset_id: int,
    mapping: ColumnMappingRequest,
) -> QualityReport:
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise AppError(code="DATASET_NOT_FOUND", message=f"Dataset {dataset_id} not found.")

    # if not dataset.stored_path or not os.path.exists(dataset.stored_path):
    #     raise AppError(code="STORED_FILE_MISSING", message="Underlying dataset file could not be found on server.")

    content = read_dataset_content(dataset)

    # with open(dataset.stored_path, "rb") as f: # type: ignore
    #     content = f.read()

    df, _, _ = parse_and_validate_file(content, dataset.original_filename or "data.csv")

    ts_col = (mapping.timestamp_col or "").strip()
    m_col = (mapping.machine_id_col or "").strip()
    t_col = (mapping.temperature_col or "").strip() or None
    v_col = (mapping.vibration_col or "").strip() or None
    c_col = (mapping.current_col or "").strip() or None

    if not ts_col or not m_col:
        raise AppError(
            code="MISSING_REQUIRED_MAPPING",
            message="Both timestamp and machine identifier columns must be mapped.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if ts_col not in df.columns:
        raise AppError(
            code="MAPPING_COLUMN_NOT_FOUND",
            message=f"Mapped timestamp column '{ts_col}' not found in dataset columns: {list(df.columns)}",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if m_col not in df.columns:
        raise AppError(
            code="MAPPING_COLUMN_NOT_FOUND",
            message=f"Mapped machine ID column '{m_col}' not found in dataset columns: {list(df.columns)}",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Validate sensor columns
    for label, col in [("temperature", t_col), ("vibration", v_col), ("current", c_col)]:
        if col:
            if col not in df.columns:
                raise AppError(
                    code="MAPPING_COLUMN_NOT_FOUND",
                    message=f"Mapped {label} column '{col}' not found in dataset columns: {list(df.columns)}",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if col in (ts_col, m_col):
                raise AppError(
                    code="INVALID_SENSOR_MAPPING",
                    message=f"Column '{col}' cannot be mapped both as identifier/timestamp and as {label} telemetry.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

    # Validate timestamps without fabricating missing
    ts_series = pd.to_datetime(df[ts_col], errors="coerce")
    invalid_ts_count = int(ts_series.isna().sum())

    # Detect unique machines
    machines_found = [str(m).strip() for m in df[m_col].dropna().unique() if str(m).strip()]

    duplicate_rows = int(df.duplicated(subset=[ts_col, m_col]).sum())

    notes = []
    if invalid_ts_count > 0:
        notes.append(f"Found {invalid_ts_count} rows with invalid timestamps (these rows will be skipped, never fabricated).")
    if duplicate_rows > 0:
        notes.append(f"Found {duplicate_rows} duplicate machine-timestamp rows.")

    sensor_mapped = [c for c in (t_col, v_col, c_col) if c]
    if not sensor_mapped:
        notes.append("Warning: No numerical sensor channels mapped. At least one sensor channel is required for anomaly detection.")
    else:
        # Check that mapped sensor columns contain valid numeric cells
        total_valid_sensor_cells = 0
        for sc in sensor_mapped:
            valid_cells = sum(1 for v in parse_numeric_series(df[sc]) if v is not None)
            total_valid_sensor_cells += valid_cells
            if valid_cells == 0:
                notes.append(f"Warning: Mapped sensor column '{sc}' contains no valid numerical values.")
        if total_valid_sensor_cells == 0:
            notes.append("Warning: None of the mapped sensor columns contain valid numeric values.")

    quality: dict[str, Any] = {
        "total_rows": len(df),
        "valid_rows": len(df) - invalid_ts_count,
        "missing_values_count": int(df.isna().sum().sum()),
        "duplicate_rows_count": duplicate_rows,
        "timestamp_range": {
            "start": ts_series.min().isoformat() if not ts_series.isna().all() else None,
            "end": ts_series.max().isoformat() if not ts_series.isna().all() else None,
        },
        "detected_machines": machines_found,
        "notes": notes,
    }

    normalized_mapping = {
        "timestamp_col": ts_col,
        "machine_id_col": m_col,
        "temperature_col": t_col,
        "vibration_col": v_col,
        "current_col": c_col,
    }

    dataset.column_mapping = normalized_mapping
    dataset.quality_report = quality
    dataset.status = "mapped"
    db.commit()

    return QualityReport(**quality)


def ingest_and_process_dataset(
    db: Session,
    dataset_id: int,
    contamination: float = 0.1,
) -> dict[str, Any]:
    """Ingests mapped readings into DB tables and executes Anomaly Detection."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise AppError(code="DATASET_NOT_FOUND", message=f"Dataset {dataset_id} not found.")

    if not dataset.column_mapping:
        raise AppError(code="DATASET_NOT_MAPPED", message="Dataset columns must be mapped before processing.")

    # if not dataset.stored_path or not os.path.exists(dataset.stored_path):
    #     raise AppError(code="STORED_FILE_MISSING", message="Underlying dataset file could not be found on server.")

    # with open(dataset.stored_path, "rb") as f:
    #     content = f.read()
    content = read_dataset_content(dataset)

    df, _, _ = parse_and_validate_file(content, dataset.original_filename or "data.csv")
    mapping = dataset.column_mapping

    ts_col = (mapping.get("timestamp_col") or "").strip()
    m_col = (mapping.get("machine_id_col") or "").strip()
    t_col = (mapping.get("temperature_col") or "").strip() or None
    v_col = (mapping.get("vibration_col") or "").strip() or None
    c_col = (mapping.get("current_col") or "").strip() or None

    sensor_mapped = [c for c in (t_col, v_col, c_col) if c and c in df.columns]
    if not sensor_mapped:
        dataset.status = "failed"
        db.commit()
        raise AppError(
            code="NO_NUMERICAL_CHANNELS",
            message="Dataset has no numerical sensor channels mapped. Anomaly detection requires at least one mapped sensor channel (e.g. temperature, vibration, or current).",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Parse timestamps
    df["_parsed_ts"] = pd.to_datetime(df[ts_col], errors="coerce", utc=True)
    df = df.dropna(subset=["_parsed_ts"])

    if len(df) == 0:
        dataset.status = "failed"
        db.commit()
        raise AppError(
            code="NO_VALID_ROWS",
            message="No rows with valid timestamps were found in the dataset.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Parse numeric sensor values with whitespace and missing value resilience
    t_vals = parse_numeric_series(df[t_col]) if t_col and t_col in df.columns else [None] * len(df)
    v_vals = parse_numeric_series(df[v_col]) if v_col and v_col in df.columns else [None] * len(df)
    c_vals = parse_numeric_series(df[c_col]) if c_col and c_col in df.columns else [None] * len(df)

    # Verify at least one usable numerical value was extracted
    total_valid_numeric = (
        sum(1 for x in t_vals if x is not None)
        + sum(1 for x in v_vals if x is not None)
        + sum(1 for x in c_vals if x is not None)
    )

    if total_valid_numeric == 0:
        dataset.status = "failed"
        db.commit()
        raise AppError(
            code="NO_NUMERICAL_DATA",
            message="Mapped sensor columns contain no valid numerical data (all values were missing, blank, or non-numeric). Anomaly detection requires at least one numerical sensor channel with valid readings.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Update dataset status to processing during ingestion
    dataset.status = "processing"
    db.commit()

    try:
        # Clean existing data for this dataset
        db.query(Machine).filter(Machine.dataset_id == dataset_id).delete()
        db.flush()

        # Create machine records
        unique_machines = df[m_col].dropna().unique()
        machine_map = {}
        for ext_id in unique_machines:
            str_id = str(ext_id).strip()
            if not str_id:
                continue
            m = Machine(
                dataset_id=dataset_id,
                external_id=str_id,
                name=f"Production Asset {str_id}",
                criticality=3,
                production_priority=3,
                loss_per_hour=500.0,
                maintenance_cost_estimate=1500.0,
                assumption_source="user",
            )
            db.add(m)
            db.flush()
            machine_map[str_id] = m

        # Fast vectorized extraction across rows
        m_ids = [str(x).strip() for x in df[m_col]]
        timestamps = [ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts for ts in df["_parsed_ts"]]

        readings = []
        for m_id, ts, temp_val, vib_val, curr_val in zip(m_ids, timestamps, t_vals, v_vals, c_vals):
            mach = machine_map.get(m_id)
            if not mach:
                continue

            readings.append(
                SensorReading(
                    dataset_id=dataset_id,
                    machine_id=mach.id,
                    timestamp=ts,
                    temperature=temp_val,
                    vibration=vib_val,
                    current=curr_val,
                    status="normal",
                )
            )

        db.bulk_save_objects(readings)
        db.flush()

        # Run anomaly detector
        from app.services.anomaly_detector import detect_anomalies_for_dataset
        detection_res = detect_anomalies_for_dataset(db, dataset_id, contamination=contamination)

        # Set status to ready only on success
        dataset.status = "ready"
        dataset.row_count = len(readings)
        dataset.is_active = True

        # Mark other datasets as inactive
        db.query(Dataset).filter(Dataset.id != dataset_id).update({"is_active": False})
        db.commit()

        return {
            "dataset_id": dataset_id,
            "status": "ready",
            "rows_ingested": len(readings),
            "machines_created": len(machine_map),
            "detection": detection_res,
        }

    except Exception:
        db.rollback()
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if ds:
            ds.status = "failed"
            db.commit()
        raise


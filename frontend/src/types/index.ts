export interface HealthResponse {
  status: "ok" | "degraded";
  database: "ok" | "unavailable";
  version: string;
  environment: string;
  database_engine: string;
}

export interface Dataset {
  id: number;
  name: string;
  source: string;
  is_simulated: boolean;
  original_filename?: string;
  row_count: number;
  status: string;
  is_active: boolean;
  quality_report?: {
    total_rows: number;
    valid_rows: number;
    missing_values_count: number;
    duplicate_rows_count: number;
    timestamp_range: { start?: string; end?: string };
    detected_machines?: string[];
    notes?: string[];
  };
  created_at: string;
}

export interface DatasetSummary {
  dataset_id: number;
  dataset_name: string;
  is_simulated: boolean;
  total_machines: number;
  active_alerts_count: number;
  anomalies_detected_count: number;
  total_estimated_impact: number;
}

export interface Machine {
  id: number;
  dataset_id: number;
  external_id: string;
  name: string;
  criticality?: number;
  production_priority?: number;
  loss_per_hour?: number;
  maintenance_cost_estimate?: number;
  assumption_source: string;
  active_alerts_count: number;
}

export interface SensorReading {
  timestamp: string;
  machine_id: string;
  temperature?: number;
  vibration?: number;
  current?: number;
  is_anomalous: boolean;
}

export interface SensorEvidenceItem {
  feature: string;
  observed_value: number;
  baseline_median: number;
  deviation_mad: number;
  unit: string;
}

export interface ImpactEstimate {
  assumed_downtime_hours?: number;
  downtime_loss?: number;
  maintenance_cost?: number;
  total_estimated_impact?: number;
  priority_score?: number;
  inputs_used?: {
    hours?: number;
    loss_per_hour?: number;
    repair_cost?: number;
  };
  formula_version: string;
}

export interface Alert {
  id: number;
  dataset_id: number;
  machine_id: string;
  machine_name: string;
  start_ts: string;
  end_ts: string;
  anomaly_score?: number;
  is_anomaly_label: boolean;
  severity: string;
  severity_reason: string[];
  evidence: SensorEvidenceItem[];
  data_quality_warnings: string[];
  inspection_steps: string[];
  status: "open" | "reviewed" | "dismissed";
  impact: ImpactEstimate;
}

export interface UploadPreviewResponse {
  dataset_id: number;
  filename: string;
  file_type: string;
  size_bytes: number;
  total_rows: number;
  headers: string[];
  preview_rows: Record<string, unknown>[];
  suggested_mapping: {
    timestamp_col?: string;
    machine_id_col?: string;
    temperature_col?: string;
    vibration_col?: string;
    current_col?: string;
  };
  quality_warnings: string[];
}

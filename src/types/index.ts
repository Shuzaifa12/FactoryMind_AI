export type AssumptionSource = "user" | "illustrative" | "unknown";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "reviewed" | "dismissed";
export type DatasetSource = "demo" | "upload";

export interface Machine {
  id: number;
  dataset_id?: number;
  external_id: string; // e.g., 'CNC-01'
  name: string;
  criticality?: number; // 1-5
  production_priority?: number; // 1-5
  loss_per_hour?: number; // e.g. 1200 ($/hr)
  maintenance_cost_estimate?: number; // e.g. 2400 ($)
  assumption_source: AssumptionSource;
  active_alerts_count?: number;
}

export interface SensorReading {
  timestamp: string; // ISO string
  machine_id: string;
  temperature: number; // °C
  vibration: number; // mm/s
  current: number; // Amps
  status?: string;
  is_anomalous?: boolean;
}

export interface ImpactEstimate {
  assumed_downtime_hours?: number;
  downtime_loss?: number;
  maintenance_cost?: number;
  total_estimated_impact?: number;
  priority_score?: number;
  formula_version?: string;
  inputs_used?: {
    loss_per_hour?: number;
    hours?: number;
    repair_cost?: number;
    [key: string]: unknown;
  };
}

export interface SensorEvidenceItem {
  feature: string;
  observed_value: number;
  baseline_median: number;
  deviation_mad: number; // multiples of MAD
  unit: string;
}

export interface Alert {
  id: number;
  machine_id: string;
  machine_name: string;
  start_ts: string;
  end_ts: string;
  anomaly_score: number; // 0.0 - 1.0
  is_anomaly_label: boolean;
  severity: AlertSeverity;
  severity_reason: string[];
  evidence: SensorEvidenceItem[];
  data_quality_warnings: string[];
  inspection_steps: string[];
  status: AlertStatus;
  impact: ImpactEstimate;
}

export interface MaintenanceRecord {
  id: number;
  machine_id: string;
  date: string;
  description: string;
  source: "csv" | "pdf";
  match_confidence: "exact_id" | "user_confirmed" | "unmatched";
}

export interface DatasetQualityReport {
  total_rows: number;
  valid_rows: number;
  missing_values_count: number;
  duplicate_rows_count: number;
  timestamp_range: { start?: string | null; end?: string | null };
  sampling_rate?: string;
  detected_machines?: string[];
  notes: string[];
}

export interface ProcessDatasetResult {
  dataset_id: number;
  status: string;
  rows_ingested: number;
  machines_created: number;
  detection: {
    dataset_id: number;
    rows_analyzed: number;
    anomalies_flagged: number;
    alerts_generated: number;
    method: string;
    machines_analyzed: number;
  };
}

export interface Dataset {
  id: number;
  name: string;
  source: DatasetSource;
  is_simulated: boolean;
  original_filename: string;
  row_count: number;
  status?: string;
  is_active: boolean;
  quality_report?: DatasetQualityReport;
  created_at?: string;
}

export interface ToolCallTrace {
  tool: string;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface InvestigationMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
  language: "en" | "ur";
  toolCalls?: ToolCallTrace[];
  evidenceCited?: string[];
}

export interface MaintenanceReport {
  id: number;
  title: string;
  generated_at: string;
  dataset_name: string;
  is_simulated: boolean;
  language: "en" | "ur";
  format: "md" | "txt" | "pdf";
  content: string;
  alert_ids: number[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  database: "ok" | "unavailable";
  version: string;
  environment: string;
  database_engine: string;
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


import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Sliders,
  Table,
  Upload,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api";
import type {
  DatasetQualityReport,
  ProcessDatasetResult,
  UploadPreviewResponse,
} from "@/types";

interface UploadViewProps {
  onDone: () => void;
}

type UploadStep = "select" | "mapping" | "quality" | "processing" | "success";

interface MappingForm {
  timestamp_col: string;
  machine_id_col: string;
  temperature_col: string;
  vibration_col: string;
  current_col: string;
}

const SAMPLE_CSV = `timestamp,machine_id,temperature,vibration,current
2026-10-18T00:00:00Z,CNC-01,41.2,1.65,14.1
2026-10-18T00:15:00Z,CNC-01,41.5,1.70,14.3
2026-10-18T00:30:00Z,CNC-01,41.8,1.68,14.0
2026-10-18T00:45:00Z,CNC-01,52.4,4.82,16.5
2026-10-18T01:00:00Z,CNC-01,56.1,5.30,17.2
2026-10-18T01:15:00Z,CNC-01,58.9,5.55,17.8
2026-10-18T00:00:00Z,TURB-02,62.1,2.10,32.4
2026-10-18T00:15:00Z,TURB-02,62.3,2.05,32.6
2026-10-18T00:30:00Z,TURB-02,61.9,2.15,32.2
2026-10-18T00:45:00Z,TURB-02,78.5,4.90,44.1
2026-10-18T01:00:00Z,TURB-02,81.2,5.20,46.0`;

export function UploadView({ onDone }: UploadViewProps) {
  const { t } = useI18n();

  // Wizard State
  const [step, setStep] = useState<UploadStep>("select");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Server Response State
  const [previewData, setPreviewData] = useState<UploadPreviewResponse | null>(null);
  const [qualityReport, setQualityReport] = useState<DatasetQualityReport | null>(null);
  const [processResult, setProcessResult] = useState<ProcessDatasetResult | null>(null);

  // Form State
  const [mapping, setMapping] = useState<MappingForm>({
    timestamp_col: "",
    machine_id_col: "",
    temperature_col: "",
    vibration_col: "",
    current_col: "",
  });
  const [contamination, setContamination] = useState<number>(0.1);

  // Status & Error State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMapping, setIsMapping] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [isTimeoutError, setIsTimeoutError] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resetAll = () => {
    setStep("select");
    setSelectedFile(null);
    setPreviewData(null);
    setQualityReport(null);
    setProcessResult(null);
    setMapping({
      timestamp_col: "",
      machine_id_col: "",
      temperature_col: "",
      vibration_col: "",
      current_col: "",
    });
    setContamination(0.1);
    setIsCheckingStatus(false);
    setIsTimeoutError(false);
    setError(null);
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const allowed = [".csv", ".txt", ".xlsx", ".xls"];
    if (!allowed.includes(ext)) {
      setError(
        `Unsupported file format '${ext}'. Please upload CSV or XLSX spreadsheet files (e.g. .csv, .xlsx). PDF files are not supported for raw sensor time-series.`
      );
      return;
    }

    // Limit check in UI as well (25 MB)
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25 MB size limit. Please upload a smaller sensor batch.");
      return;
    }

    setError(null);
    setSelectedFile(file);
    uploadSelectedFile(file);
  };

  const uploadSelectedFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const preview = await api.uploadFile(formData);
      setPreviewData(preview);

      // Pre-fill suggested mappings from backend
      setMapping({
        timestamp_col: preview.suggested_mapping?.timestamp_col || "",
        machine_id_col: preview.suggested_mapping?.machine_id_col || "",
        temperature_col: preview.suggested_mapping?.temperature_col || "",
        vibration_col: preview.suggested_mapping?.vibration_col || "",
        current_col: preview.suggested_mapping?.current_col || "",
      });

      setStep("mapping");
    } catch (err) {
      const isTimeout = err instanceof ApiError && err.isTimeout;
      setIsTimeoutError(Boolean(isTimeout));
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to upload file.";
      setError(msg);
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const file = new File([blob], "factory_production_batch_sample.csv", {
      type: "text/csv",
    });
    handleFileSelect(file);
  };

  const handleConfirmMapping = async () => {
    if (!previewData) return;

    if (!mapping.timestamp_col || !mapping.machine_id_col) {
      setError("Please map both the Timestamp column and the Machine ID column.");
      return;
    }

    setIsMapping(true);
    setError(null);
    setIsTimeoutError(false);

    try {
      const report = await api.mapColumns(previewData.dataset_id, {
        timestamp_col: mapping.timestamp_col,
        machine_id_col: mapping.machine_id_col,
        temperature_col: mapping.temperature_col || undefined,
        vibration_col: mapping.vibration_col || undefined,
        current_col: mapping.current_col || undefined,
      });

      setQualityReport(report);
      setStep("quality");
    } catch (err) {
      const isTimeout = err instanceof ApiError && err.isTimeout;
      setIsTimeoutError(Boolean(isTimeout));
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to validate column mappings.";
      setError(msg);
    } finally {
      setIsMapping(false);
    }
  };

  const handleRunProcessing = async () => {
    if (!previewData) return;

    setIsProcessing(true);
    setStep("processing");
    setError(null);
    setIsTimeoutError(false);

    try {
      const result = await api.processDataset(previewData.dataset_id, contamination);
      setProcessResult(result);
      setStep("success");
    } catch (err) {
      const isTimeout = err instanceof ApiError && err.isTimeout;
      setIsTimeoutError(Boolean(isTimeout));
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to process dataset and detect anomalies.";
      setError(msg);
      // Revert to quality screen so user can retry or adjust contamination
      setStep("quality");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecoverStatus = async () => {
    if (!previewData?.dataset_id) return;
    setIsCheckingStatus(true);
    setError(null);

    try {
      const ds = await api.getDataset(previewData.dataset_id);
      if (ds.status === "ready") {
        setProcessResult({
          dataset_id: ds.id,
          status: "ready",
          rows_ingested: ds.row_count,
          machines_created: ds.quality_report?.detected_machines?.length || 0,
          detection: {
            dataset_id: ds.id,
            rows_analyzed: ds.row_count,
            anomalies_flagged: 0,
            alerts_generated: 0,
            method: "isolation_forest",
            machines_analyzed: ds.quality_report?.detected_machines?.length || 0,
          },
        });
        setStep("success");
        setIsTimeoutError(false);
      } else if (ds.status === "mapped" && ds.quality_report) {
        setQualityReport(ds.quality_report);
        setStep("quality");
        setIsTimeoutError(false);
      } else {
        setError(
          `Dataset status on backend is currently "${ds.status}". The server may still be processing data or awaiting mapping.`
        );
      }
    } catch (checkErr) {
      setError(
        "Could not verify dataset status on server: " +
          (checkErr instanceof Error ? checkErr.message : String(checkErr))
      );
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("upload.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("upload.subtitle")}</p>
        </div>

        {step !== "select" && step !== "processing" && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Upload Another File</span>
          </button>
        )}
      </div>

      {/* Steps Indicator */}
      <div className="grid grid-cols-4 gap-2 rounded-lg border border-line bg-panel p-2 text-xs">
        {[
          { key: "select", label: "1. Select File" },
          { key: "mapping", label: "2. Column Mapping" },
          { key: "quality", label: "3. Validation Quality" },
          { key: "success", label: "4. Anomaly Results" },
        ].map((s) => {
          const isActive =
            step === s.key || (s.key === "quality" && step === "processing");
          const isDone =
            (s.key === "select" && step !== "select") ||
            (s.key === "mapping" && (step === "quality" || step === "processing" || step === "success")) ||
            (s.key === "quality" && step === "success");

          return (
            <div
              key={s.key}
              className={`flex items-center justify-center gap-1.5 rounded py-1.5 px-2 font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-ink font-semibold"
                  : isDone
                  ? "text-ok"
                  : "text-muted"
              }`}
            >
              {isDone && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">
                {isTimeoutError
                  ? "Request Timeout Notice (Long-Running Processing)"
                  : "Backend Notice / Error"}
              </p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsTimeoutError(false);
              }}
              className="text-xs text-danger/80 hover:text-danger underline shrink-0"
            >
              Dismiss
            </button>
          </div>

          {previewData && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-danger/20 pt-2 text-[11px]">
              <span className="text-danger/90">
                Check whether the backend already completed this dataset in the background:
              </span>
              <button
                type="button"
                onClick={handleRecoverStatus}
                disabled={isCheckingStatus}
                className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/15 px-3 py-1 font-semibold text-danger hover:bg-danger/25 disabled:opacity-50 transition-colors"
              >
                {isCheckingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>Check Dataset Status</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Select & Upload File */}
      {step === "select" && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-line bg-panel p-10 text-center transition-colors hover:border-accent">
            {isUploading ? (
              <div className="py-6">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
                <h3 className="mt-4 text-base font-semibold">Uploading to FastAPI Backend...</h3>
                <p className="mt-1 text-xs text-muted">
                  Streaming multipart FormData and inspecting headers on server.
                </p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-10 w-10 text-muted" />
                <h3 className="mt-3 text-base font-semibold">{t("upload.dragDrop")}</h3>
                <p className="mt-1 text-xs text-muted">
                  Supported formats: <strong>CSV (.csv, .txt)</strong> and{" "}
                  <strong>Excel (.xlsx, .xls)</strong> up to 25 MB.
                </p>
                <p className="mt-0.5 text-xs text-muted/80">
                  (PDF sensor ingestion is not supported; spreadsheets only.)
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <label className="cursor-pointer rounded-md bg-accent px-5 py-2.5 text-xs font-semibold text-accent-ink hover:opacity-90">
                    <span>Browse CSV / XLSX File</span>
                    <input
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleUseSample}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-4 py-2.5 text-xs font-medium text-ink hover:bg-accent-soft disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-accent" />
                    <span>Load Real Sample CSV</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping & Raw Preview */}
      {step === "mapping" && previewData && (
        <div className="space-y-6">
          {/* File Meta Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel p-4 text-xs">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-ink">{previewData.filename}</p>
                <p className="text-muted">
                  Dataset ID: #{previewData.dataset_id} • Type: {previewData.file_type.toUpperCase()} • Size:{" "}
                  {(previewData.size_bytes / 1024).toFixed(1)} KB • Total Rows:{" "}
                  <strong>{previewData.total_rows.toLocaleString()}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Warnings from preview */}
          {previewData.quality_warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-500">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Backend Inspection Notice</span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {previewData.quality_warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Mapping Controls */}
          <div className="rounded-lg border border-line bg-panel p-6 shadow-sm space-y-5">
            <div className="border-b border-line pb-3">
              <h3 className="text-sm font-semibold">{t("upload.previewTitle")}</h3>
              <p className="text-xs text-muted mt-0.5">
                Verify or adjust the column headers from your file mapped to FactoryMind sensor channels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Timestamp Column */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("upload.mapTimestamp")}{" "}
                  <span className="text-danger font-bold">* (Required)</span>
                </label>
                <select
                  value={mapping.timestamp_col}
                  onChange={(e) => setMapping((m) => ({ ...m, timestamp_col: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">-- Select Timestamp Header --</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine ID Column */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("upload.mapMachine")}{" "}
                  <span className="text-danger font-bold">* (Required)</span>
                </label>
                <select
                  value={mapping.machine_id_col}
                  onChange={(e) => setMapping((m) => ({ ...m, machine_id_col: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">-- Select Machine ID Header --</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperature Column */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("upload.mapTemp")}{" "}
                  <span className="text-muted font-normal">(Optional sensor channel)</span>
                </label>
                <select
                  value={mapping.temperature_col}
                  onChange={(e) => setMapping((m) => ({ ...m, temperature_col: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">-- None / Skip Channel --</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vibration Column */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("upload.mapVib")}{" "}
                  <span className="text-muted font-normal">(Optional sensor channel)</span>
                </label>
                <select
                  value={mapping.vibration_col}
                  onChange={(e) => setMapping((m) => ({ ...m, vibration_col: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">-- None / Skip Channel --</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Column */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink">
                  {t("upload.mapCurrent")}{" "}
                  <span className="text-muted font-normal">(Optional sensor channel)</span>
                </label>
                <select
                  value={mapping.current_col}
                  onChange={(e) => setMapping((m) => ({ ...m, current_col: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">-- None / Skip Channel --</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Server-Returned Preview Table */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-muted">
                  First 5 Rows from Backend:
                </span>
                <span className="text-[11px] text-muted">
                  {previewData.headers.length} columns detected
                </span>
              </div>
              <div className="overflow-x-auto rounded border border-line bg-bg">
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-line bg-panel/70">
                      {previewData.headers.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-semibold text-ink truncate max-w-[150px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview_rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-line/40 hover:bg-panel/30">
                        {previewData.headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-1.5 text-muted truncate max-w-[150px]"
                          >
                            {String(row[h] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Confirm Mapping Action */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={resetAll}
                className="rounded-md border border-line bg-panel px-4 py-2 text-xs font-medium text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMapping}
                disabled={isMapping || isCheckingStatus || !mapping.timestamp_col || !mapping.machine_id_col}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
              >
                {isMapping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validating Schema...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Mapping & Validate</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Quality Report & Contamination Tuning */}
      {step === "quality" && qualityReport && previewData && (
        <div className="space-y-6">
          <div className="rounded-lg border border-line bg-panel p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-semibold">{t("upload.validationReport")}</h3>
                <p className="text-xs text-muted mt-0.5">
                  Server-side statistical quality check for dataset #{previewData.dataset_id}
                </p>
              </div>
              <span className="rounded bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
                Validated
              </span>
            </div>

            {/* Quality Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-line bg-bg p-3">
                <p className="text-[11px] text-muted">Total Rows</p>
                <p className="mt-1 text-lg font-bold font-mono text-ink">
                  {qualityReport.total_rows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-line bg-bg p-3">
                <p className="text-[11px] text-muted">Valid Rows</p>
                <p className="mt-1 text-lg font-bold font-mono text-ok">
                  {qualityReport.valid_rows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-line bg-bg p-3">
                <p className="text-[11px] text-muted">Duplicate Records</p>
                <p className="mt-1 text-lg font-bold font-mono text-ink">
                  {qualityReport.duplicate_rows_count}
                </p>
              </div>
              <div className="rounded-md border border-line bg-bg p-3">
                <p className="text-[11px] text-muted">Missing Values</p>
                <p className="mt-1 text-lg font-bold font-mono text-amber-500">
                  {qualityReport.missing_values_count}
                </p>
              </div>
            </div>

            {/* Detected Assets & Timestamp Range */}
            <div className="rounded-md border border-line bg-bg p-4 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">Detected Assets:</span>
                <span className="font-mono text-muted">
                  {qualityReport.detected_machines?.length || 0} unique machine(s) found
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {qualityReport.detected_machines?.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded bg-panel border border-line px-2 py-0.5 font-mono text-[11px] text-accent"
                  >
                    <Cpu className="h-3 w-3" />
                    {m}
                  </span>
                ))}
              </div>

              {qualityReport.timestamp_range && (
                <div className="pt-2 text-[11px] text-muted border-t border-line/50">
                  <span>Timestamp Range: </span>
                  <strong className="font-mono text-ink">
                    {qualityReport.timestamp_range.start
                      ? new Date(qualityReport.timestamp_range.start).toLocaleString()
                      : "N/A"}
                  </strong>
                  <span> to </span>
                  <strong className="font-mono text-ink">
                    {qualityReport.timestamp_range.end
                      ? new Date(qualityReport.timestamp_range.end).toLocaleString()
                      : "N/A"}
                  </strong>
                </div>
              )}
            </div>

            {/* Quality Notes */}
            {qualityReport.notes && qualityReport.notes.length > 0 && (
              <div className="rounded-md bg-accent-soft/30 p-3 text-xs text-ink/90">
                <p className="font-semibold text-accent mb-1">Data Quality Findings:</p>
                <ul className="list-inside list-disc space-y-1">
                  {qualityReport.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contamination Parameter Selection */}
            <div className="rounded-md border border-line bg-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Sliders className="h-3.5 w-3.5 text-accent" />
                  <span>Isolation Forest Sensitivity (Expected Contamination Rate):</span>
                </label>
                <span className="font-mono text-xs font-bold text-accent">
                  {(contamination * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.25"
                step="0.01"
                value={contamination}
                onChange={(e) => setContamination(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <p className="text-[11px] text-muted">
                Controls the statistical outlier proportion (2% to 25%) used by Isolation Forest and
                per-machine MAD baseline algorithms. Default is 10%.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setStep("mapping")}
                className="rounded-md border border-line bg-panel px-4 py-2 text-xs font-medium text-muted hover:text-ink"
              >
                Back to Mapping
              </button>

              <button
                type="button"
                onClick={handleRunProcessing}
                disabled={isProcessing || isCheckingStatus}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                <span>{t("upload.processButton")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: In-Flight Processing Spinner */}
      {step === "processing" && (
        <div className="rounded-lg border border-line bg-panel p-12 text-center shadow-sm">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-accent" />
          <h3 className="mt-4 text-base font-semibold">{t("upload.processing")}</h3>
          <p className="mt-2 text-xs text-muted max-w-md mx-auto">
            The FastAPI server is running Isolation Forest and MAD multi-channel anomaly detection,
            creating machine registries, and evaluating financial downtime exposure.
          </p>
        </div>
      )}

      {/* STEP 4: Success & Navigation */}
      {step === "success" && processResult && (
        <div className="rounded-lg border border-ok/40 bg-panel p-8 text-center shadow-sm space-y-6">
          <CheckCircle2 className="mx-auto h-12 w-12 text-ok" />
          <div>
            <h2 className="text-xl font-semibold text-ink">{t("upload.success")}</h2>
            <p className="mt-2 text-xs text-muted max-w-md mx-auto">
              Real anomaly scores, multi-channel MAD deviations, and financial downtime impact
              rankings have been computed and stored in the database.
            </p>
          </div>

          {/* Results Summary Box */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
            <div className="rounded-md border border-line bg-bg p-3">
              <p className="text-[11px] text-muted">Rows Ingested</p>
              <p className="mt-1 text-lg font-bold font-mono text-ink">
                {processResult.rows_ingested.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-line bg-bg p-3">
              <p className="text-[11px] text-muted">Assets Created</p>
              <p className="mt-1 text-lg font-bold font-mono text-ink">
                {processResult.machines_created}
              </p>
            </div>
            <div className="rounded-md border border-line bg-bg p-3">
              <p className="text-[11px] text-muted">Anomalies Flagged</p>
              <p className="mt-1 text-lg font-bold font-mono text-amber-500">
                {processResult.detection?.anomalies_flagged ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-line bg-bg p-3">
              <p className="text-[11px] text-muted">Alerts Generated</p>
              <p className="mt-1 text-lg font-bold font-mono text-ok">
                {processResult.detection?.alerts_generated ?? 0}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onDone}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
            >
              <span>View In Dashboard</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-md border border-line bg-panel px-4 py-2.5 text-xs font-medium text-ink hover:bg-accent-soft"
            >
              Upload Another Dataset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

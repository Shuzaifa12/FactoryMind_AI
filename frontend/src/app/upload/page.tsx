"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  Table,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { UploadPreviewResponse } from "@/types";

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

export default function UploadPage() {
  const { t } = useI18n();

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<UploadPreviewResponse | null>(null);
  const [timestampCol, setTimestampCol] = useState<string>("");
  const [machineIdCol, setMachineIdCol] = useState<string>("");
  const [tempCol, setTempCol] = useState<string>("");
  const [vibCol, setVibCol] = useState<string>("");
  const [currCol, setCurrCol] = useState<string>("");

  const [uploading, setUploading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError(null);
    setPreview(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUseSample = () => {
    const sampleBlob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const sampleFile = new File([sampleBlob], "sample_telemetry_batch.csv", {
      type: "text/csv",
    });
    handleFileSelect(sampleFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV or XLSX file first.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await api.uploadFile(formData);
      setPreview(resp);
      setTimestampCol(resp.suggested_mapping.timestamp_col || resp.headers[0] || "");
      setMachineIdCol(resp.suggested_mapping.machine_id_col || resp.headers[1] || "");
      setTempCol(resp.suggested_mapping.temperature_col || "");
      setVibCol(resp.suggested_mapping.vibration_col || "");
      setCurrCol(resp.suggested_mapping.current_col || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!preview) return;
    if (!timestampCol || !machineIdCol) {
      setError("Timestamp column and Machine ID column are required for mapping.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. Save mapping
      await api.mapColumns(preview.dataset_id, {
        timestamp_col: timestampCol,
        machine_id_col: machineIdCol,
        temperature_col: tempCol || undefined,
        vibration_col: vibCol || undefined,
        current_col: currCol || undefined,
      });

      // 2. Ingest and execute ML detection
      await api.processDataset(preview.dataset_id, 0.1);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("upload.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("upload.subtitle")}</p>
      </div>

      {success ? (
        <div className="rounded-lg border border-ok/40 bg-panel p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-ok" />
          <h2 className="mt-4 text-lg font-semibold">{t("upload.success")}</h2>
          <p className="mt-2 text-sm text-muted">
            The dataset has been ingested into the database, verified for quality, and analyzed
            using Isolation Forest anomaly detection.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* File Upload Box */}
          <div className="rounded-lg border-2 border-dashed border-line bg-panel p-8 text-center transition-colors hover:border-accent">
            <Upload className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-3 text-base font-semibold">{t("upload.dragDrop")}</h3>
            <p className="mt-1 text-xs text-muted">{t("upload.supportedFormats")}</p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <label className="cursor-pointer rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90">
                <span>Browse Local CSV / XLSX</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  onChange={handleFileInputChange}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={handleUseSample}
                className="rounded-md border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-accent-soft"
              >
                Use Sample CSV Template
              </button>
            </div>

            {fileName && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-accent">
                  Selected: <strong>{fileName}</strong>
                </span>
                {!preview && (
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="ms-2 inline-flex items-center gap-1 rounded bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
                  >
                    {uploading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Upload & Preview</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview & Mapping Interface */}
          {preview && (
            <div className="space-y-5 rounded-lg border border-line bg-panel p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold">{t("upload.previewTitle")}</h3>
                </div>
                <span className="text-xs text-muted">
                  {preview.total_rows} total rows detected • {preview.headers.length} columns
                </span>
              </div>

              {/* Table Preview */}
              <div className="overflow-x-auto rounded border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-bg text-muted">
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-start font-medium font-mono">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.preview_rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {preview.headers.map((h, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 font-mono text-[11px]">
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Column Mapping Selectors */}
              <div className="rounded-md border border-line bg-bg/50 p-4">
                <h4 className="text-xs font-semibold">Column Identification & Channel Mapping</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <div>
                    <label className="block text-muted">{t("upload.mapTimestamp")} *</label>
                    <select
                      value={timestampCol}
                      onChange={(e) => setTimestampCol(e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-panel px-2.5 py-1.5 text-xs text-ink"
                    >
                      <option value="">Select column...</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted">{t("upload.mapMachine")} *</label>
                    <select
                      value={machineIdCol}
                      onChange={(e) => setMachineIdCol(e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-panel px-2.5 py-1.5 text-xs text-ink"
                    >
                      <option value="">Select column...</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted">{t("upload.mapTemp")}</label>
                    <select
                      value={tempCol}
                      onChange={(e) => setTempCol(e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-panel px-2.5 py-1.5 text-xs text-ink"
                    >
                      <option value="">(None)</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted">{t("upload.mapVib")}</label>
                    <select
                      value={vibCol}
                      onChange={(e) => setVibCol(e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-panel px-2.5 py-1.5 text-xs text-ink"
                    >
                      <option value="">(None)</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted">{t("upload.mapCurrent")}</label>
                    <select
                      value={currCol}
                      onChange={(e) => setCurrCol(e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-panel px-2.5 py-1.5 text-xs text-ink"
                    >
                      <option value="">(None)</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={processing || !timestampCol || !machineIdCol}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("upload.processing")}</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      <span>{t("upload.processButton")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

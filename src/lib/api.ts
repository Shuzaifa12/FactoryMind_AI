/// <reference types="vite/client" />

import type {
  Alert,
  Dataset,
  DatasetQualityReport,
  DatasetSummary,
  HealthResponse,
  InvestigationMessage,
  Machine,
  MaintenanceRecord,
  ProcessDatasetResult,
  SensorReading,
  UploadPreviewResponse,
} from "@/types";

export type { HealthResponse };


export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly isNetworkError: boolean = false,
    public readonly isTimeout: boolean = false
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "";
}

export const DEFAULT_TIMEOUT_MS = 30000; // 30s general timeout
export const HEAVY_TIMEOUT_MS = 120000; // 120s (2 min) for 10k+ rows upload/mapping/detection

export async function request<T>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  let isTimedOut = false;
  const timer = setTimeout(() => {
    isTimedOut = true;
    controller.abort();
  }, timeoutMs);

  signal?.addEventListener("abort", () => controller.abort());

  const base = apiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      let code: string | undefined;
      let message = `Request failed with status ${res.status}`;
      try {
        const body = await res.json();
        code = body?.error?.code;
        message = body?.error?.message ?? message;
      } catch {
        /* response was not JSON */
      }
      throw new ApiError(message, res.status, code, false, false);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    if (isTimedOut || (err instanceof Error && err.name === "AbortError" && isTimedOut)) {
      throw new ApiError(
        `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Large datasets may still be validating or processing on the server.`,
        408,
        "TIMEOUT",
        true,
        true
      );
    }

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Request cancelled by client.", undefined, "CANCELLED", false, false);
    }

    const targetDesc = base || "local Vite proxy (/api)";
    throw new ApiError(
      `Backend disconnected: Unable to reach API server at ${targetDesc}. Please verify the FastAPI backend is running.`,
      undefined,
      "BACKEND_DISCONNECTED",
      true,
      false
    );
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Health & Connectivity (fast 5s timeout)
  getHealth: (signal?: AbortSignal) =>
    request<HealthResponse>("/api/v1/health", {}, signal, 5000),

  // Demo Dataset
  loadDemo: () =>
    request<Dataset>("/api/v1/demo/load", { method: "POST" }),

  // Datasets
  getActiveDataset: () =>
    request<Dataset>("/api/v1/datasets/active"),

  getDataset: (id: number) =>
    request<Dataset>(`/api/v1/datasets/${id}`),

  getDatasetSummary: (id: number) =>
    request<DatasetSummary>(`/api/v1/datasets/${id}/summary`),

  uploadFile: (formData: FormData, signal?: AbortSignal) =>
    request<UploadPreviewResponse>(
      "/api/v1/datasets/upload",
      {
        method: "POST",
        body: formData,
      },
      signal,
      HEAVY_TIMEOUT_MS
    ),

  mapColumns: (
    id: number,
    mapping: {
      timestamp_col: string;
      machine_id_col: string;
      temperature_col?: string;
      vibration_col?: string;
      current_col?: string;
    },
    signal?: AbortSignal
  ) =>
    request<DatasetQualityReport>(
      `/api/v1/datasets/${id}/mapping`,
      {
        method: "POST",
        body: JSON.stringify(mapping),
      },
      signal,
      HEAVY_TIMEOUT_MS
    ),

  processDataset: (id: number, contamination: number = 0.1, signal?: AbortSignal) =>
    request<ProcessDatasetResult>(
      `/api/v1/datasets/${id}/process`,
      {
        method: "POST",
        body: JSON.stringify({ contamination, use_fallback_if_small: true }),
      },
      signal,
      HEAVY_TIMEOUT_MS
    ),

  // Machines
  getDatasetMachines: (datasetId: number) =>
    request<Machine[]>(`/api/v1/datasets/${datasetId}/machines`),

  getMachine: (id: number) =>
    request<Machine>(`/api/v1/machines/${id}`),

  updateMachineAssumptions: (
    id: number,
    data: {
      loss_per_hour: number;
      maintenance_cost_estimate: number;
      criticality: number;
      production_priority: number;
    }
  ) =>
    request<Machine>(`/api/v1/machines/${id}/assumptions`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getMachineReadings: (machineId: number, limit: number = 100) =>
    request<SensorReading[]>(`/api/v1/machines/${machineId}/readings?limit=${limit}`),

  getMachineMaintenance: (machineId: number) =>
    request<MaintenanceRecord[]>(`/api/v1/machines/${machineId}/maintenance`),

  // Alerts
  getDatasetAlerts: (
    datasetId: number,
    filters?: { severity?: string; machine_id?: string; status?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.severity) params.append("severity", filters.severity);
    if (filters?.machine_id) params.append("machine_id", filters.machine_id);
    if (filters?.status) params.append("status", filters.status);
    const qs = params.toString();
    return request<Alert[]>(`/api/v1/datasets/${datasetId}/alerts${qs ? `?${qs}` : ""}`);
  },

  getAlert: (id: number) =>
    request<Alert>(`/api/v1/alerts/${id}`),

  updateAlertStatus: (id: number, status: string) =>
    request<Alert>(`/api/v1/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  queryAssistant: (prompt: string, datasetId: number, language: "en" | "ur") =>
    request<InvestigationMessage>("/api/v1/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ prompt, dataset_id: datasetId, language }),
    }),
};

export const getHealth = api.getHealth;


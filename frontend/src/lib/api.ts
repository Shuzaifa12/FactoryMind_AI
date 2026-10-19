import type {
  Alert,
  Dataset,
  DatasetSummary,
  HealthResponse,
  Machine,
  SensorReading,
  UploadPreviewResponse,
} from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
  }
  return "http://localhost:8000";
}

const TIMEOUT_MS = 10000;

export async function request<T>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());

  const base = apiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      let code: string | undefined;
      let message = `Request failed with status ${res.status}`;
      try {
        const body = await res.json();
        code = body?.error?.code;
        message = body?.error?.message ?? message;
      } catch {}
      throw new ApiError(message, res.status, code);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error && err.name === "AbortError"
        ? "Request timed out"
        : `Network error: Could not connect to API at ${base}`
    );
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Health
  getHealth: (signal?: AbortSignal) =>
    request<HealthResponse>("/api/v1/health", {}, signal),

  // Demo
  loadDemo: () =>
    request<Dataset>("/api/v1/demo/load", { method: "POST" }),

  // Datasets
  getActiveDataset: () =>
    request<Dataset>("/api/v1/datasets/active"),

  getDataset: (id: number) =>
    request<Dataset>(`/api/v1/datasets/${id}`),

  getDatasetSummary: (id: number) =>
    request<DatasetSummary>(`/api/v1/datasets/${id}/summary`),

  uploadFile: (formData: FormData) =>
    request<UploadPreviewResponse>("/api/v1/datasets/upload", {
      method: "POST",
      body: formData,
    }),

  mapColumns: (id: number, mapping: Record<string, string | undefined>) =>
    request(`/api/v1/datasets/${id}/mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapping),
    }),

  processDataset: (id: number, contamination: number = 0.1) =>
    request(`/api/v1/datasets/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contamination }),
    }),

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getMachineReadings: (machineId: number, limit: number = 100) =>
    request<SensorReading[]>(`/api/v1/machines/${machineId}/readings?limit=${limit}`),

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
};

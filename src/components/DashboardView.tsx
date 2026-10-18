import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CircleAlert,
  Cpu,
  DollarSign,
  Download,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusCard } from "@/components/StatusCard";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Alert, Dataset, DatasetSummary, Machine, SensorReading } from "@/types";

interface DashboardViewProps {
  onNavigate: (tab: string, extra?: { alertId?: number; machineId?: string }) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("CNC-01");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"vibration" | "temperature" | "current">("vibration");

  const loadReadingsForMachine = useCallback(async (mach: Machine) => {
    setReadingsLoading(true);
    try {
      const data = await api.getMachineReadings(mach.id, 100);
      setReadings(data);
    } catch {
      setReadings([]);
    } finally {
      setReadingsLoading(false);
    }
  }, []);

  const loadDatasetData = useCallback(async (targetDataset: Dataset) => {
    setDataset(targetDataset);
    try {
      const [sum, machs, alts] = await Promise.all([
        api.getDatasetSummary(targetDataset.id).catch(() => null),
        api.getDatasetMachines(targetDataset.id).catch(() => []),
        api.getDatasetAlerts(targetDataset.id, { status: "open" }).catch(() => []),
      ]);

      setSummary(sum);
      setMachines(machs);
      setAlerts(alts);

      if (machs.length > 0) {
        const found = machs.find((m) => m.external_id === selectedMachine) || machs[0];
        setSelectedMachine(found.external_id);
        await loadReadingsForMachine(found);
      } else {
        setReadings([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset details");
    }
  }, [loadReadingsForMachine, selectedMachine]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await api.getActiveDataset();
      await loadDatasetData(active);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDataset(null);
        setSummary(null);
        setMachines([]);
        setAlerts([]);
        setReadings([]);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not connect to the FactoryMind backend API."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [loadDatasetData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleMachineChange = async (extId: string) => {
    setSelectedMachine(extId);
    const mach = machines.find((m) => m.external_id === extId);
    if (mach) {
      await loadReadingsForMachine(mach);
    }
  };

  const handleLoadOrResetDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const demoDataset = await api.loadDemo();
      await loadDatasetData(demoDataset);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load demo dataset from backend."
      );
    } finally {
      setDemoLoading(false);
    }
  };

  // Chart data formatting
  const chartData = readings.map((r, idx) => ({
    time: r.timestamp.slice(11, 16) || `P${idx}`,
    temperature: r.temperature,
    vibration: r.vibration,
    current: r.current,
    is_anomalous: r.is_anomalous,
    idx,
  }));

  // Identify anomalous segments for reference area highlight
  const anomalousIndices = chartData
    .map((d, i) => (d.is_anomalous ? i : -1))
    .filter((i) => i !== -1);
  const anomalyStart = anomalousIndices.length > 0 ? chartData[anomalousIndices[0]]?.time : undefined;
  const anomalyEnd =
    anomalousIndices.length > 0
      ? chartData[anomalousIndices[anomalousIndices.length - 1]]?.time
      : undefined;

  const openAlerts = alerts.filter((a) => a.status === "open");

  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 text-sm text-muted">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span>Loading plant telemetry from backend...</span>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Error / Backend Disconnected Banner */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-danger">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>API Connectivity Notice</span>
          </div>
          <p className="mt-1 text-ink/80">{error}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={loadInitialData}
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:opacity-90"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Dataset Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-line bg-panel p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              dataset?.is_simulated
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {dataset?.is_simulated ? t("common.simulated") : t("common.realData")}
          </span>
          <div>
            <h2 className="text-sm font-semibold">
              {dataset ? dataset.name : "No Dataset Active"}
            </h2>
            <p className="text-xs text-muted">
              {dataset
                ? `${dataset.row_count} readings recorded • ${dataset.original_filename || "telemetry stream"}`
                : "Load the demo dataset or upload a CSV to initialize monitoring."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadOrResetDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${demoLoading ? "animate-spin" : ""}`} />
            {dataset?.is_simulated ? t("dashboard.resetDemo") : t("dashboard.loadDemo")}
          </button>
          <button
            type="button"
            onClick={() => onNavigate("upload")}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink hover:opacity-90"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            {t("dashboard.uploadPrompt")}
          </button>
        </div>
      </div>

      {!dataset ? (
        /* Honest Empty State */
        <div className="rounded-lg border border-dashed border-line bg-panel p-10 text-center">
          <Cpu className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-3 text-base font-semibold">{t("empty.title")}</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            The platform is configured to read live telemetry from the FastAPI backend.
            Click below to initialize the deterministic 4-machine benchmark demo dataset.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={handleLoadOrResetDemo}
              disabled={demoLoading}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${demoLoading ? "animate-spin" : ""}`} />
              <span>{t("dashboard.loadDemo")}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Overview Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{t("dashboard.totalMachines")}</span>
                <Cpu className="h-4 w-4 text-accent" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {summary?.total_machines ?? machines.length}
                </span>
                <span className="text-xs text-muted">active units</span>
              </div>
              <p className="mt-2 text-xs text-muted">Monitored plant assets</p>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{t("dashboard.activeAlerts")}</span>
                <AlertTriangle className="h-4 w-4 text-danger" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-danger">
                  {summary?.active_alerts_count ?? openAlerts.length}
                </span>
                <span className="text-xs text-muted">require human review</span>
              </div>
              <p className="mt-2 text-xs font-medium text-danger">
                {alerts.filter((a) => a.severity === "critical").length} Critical •{" "}
                {alerts.filter((a) => a.severity === "high").length} High
              </p>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{t("dashboard.anomaliesDetected")}</span>
                <Activity className="h-4 w-4 text-warn" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-warn">
                  {summary?.anomalies_detected_count ?? 0}
                </span>
                <span className="text-xs text-muted">sensor points</span>
              </div>
              <p className="mt-2 text-xs text-muted">Isolation Forest & MAD multi-channel</p>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{t("dashboard.totalEstimatedImpact")}</span>
                <DollarSign className="h-4 w-4 text-ok" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ok">
                  ${(summary?.total_estimated_impact ?? 0).toLocaleString()}
                </span>
                <span className="text-xs text-muted">exposure</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {dataset.is_simulated
                  ? "Illustrative downtime cost formula"
                  : "Configured rate formula"}
              </p>
            </div>
          </div>

          {/* Main Grid: Telemetry Chart & Priority Alerts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Sensor Telemetry Chart (2 cols) */}
            <div className="space-y-4 rounded-lg border border-line bg-panel p-5 lg:col-span-2">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-semibold">{t("dashboard.telemetryTitle")}</h3>
                  <p className="text-xs text-muted">{t("dashboard.telemetrySubtitle")}</p>
                </div>
                {/* Machine & Channel Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Select Machine"
                    value={selectedMachine}
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="rounded-md border border-line bg-bg px-2.5 py-1 text-xs font-medium text-ink focus:outline-accent"
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.external_id}>
                        {m.external_id} - {m.name.slice(0, 22)}...
                      </option>
                    ))}
                  </select>

                  <div
                    role="group"
                    aria-label="Select Sensor Channel"
                    className="inline-flex rounded-md border border-line bg-bg p-0.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveChannel("vibration")}
                      className={`rounded px-2 py-0.5 font-medium ${
                        activeChannel === "vibration" ? "bg-accent text-accent-ink" : "text-muted"
                      }`}
                    >
                      Vibration (mm/s)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChannel("temperature")}
                      className={`rounded px-2 py-0.5 font-medium ${
                        activeChannel === "temperature" ? "bg-accent text-accent-ink" : "text-muted"
                      }`}
                    >
                      Temp (°C)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChannel("current")}
                      className={`rounded px-2 py-0.5 font-medium ${
                        activeChannel === "current" ? "bg-accent text-accent-ink" : "text-muted"
                      }`}
                    >
                      Current (A)
                    </button>
                  </div>
                </div>
              </div>

              {/* Chart Graphic */}
              <div className="h-64 w-full">
                {readingsLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    <span>Loading sensor data...</span>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    No readings found for {selectedMachine}.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--panel)",
                          borderColor: "var(--line)",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      {anomalyStart && anomalyEnd && (
                        <ReferenceArea
                          x1={anomalyStart}
                          x2={anomalyEnd}
                          stroke="var(--danger)"
                          strokeOpacity={0.4}
                          fill="var(--danger)"
                          fillOpacity={0.12}
                          label={{
                            value: "Anomaly Window",
                            fill: "var(--danger)",
                            fontSize: 10,
                            position: "insideTopLeft",
                          }}
                        />
                      )}
                      {activeChannel === "vibration" && (
                        <Line
                          type="monotone"
                          dataKey="vibration"
                          name="Vibration (mm/s)"
                          stroke="#0b7285"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {activeChannel === "temperature" && (
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          name="Temperature (°C)"
                          stroke="#f0a03a"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {activeChannel === "current" && (
                        <Line
                          type="monotone"
                          dataKey="current"
                          name="Drive Current (A)"
                          stroke="#1b7f4b"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  Asset: <strong>{selectedMachine}</strong> • Showing telemetry sample stream
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-danger"></span>
                  Shaded red indicates flagged anomaly event window
                </span>
              </div>
            </div>

            {/* Priority Alerts Sidebar (1 col) */}
            <div className="flex flex-col rounded-lg border border-line bg-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">{t("dashboard.criticalPriorities")}</h3>
                <button
                  type="button"
                  onClick={() => onNavigate("alerts")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  {t("dashboard.viewAllAlerts")}
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto">
                {openAlerts.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted">{t("dashboard.noAlerts")}</p>
                ) : (
                  openAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-md border border-line p-3 transition-colors hover:bg-accent-soft/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              alert.severity === "critical"
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : alert.severity === "high"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <h4 className="mt-1 text-xs font-semibold">{alert.machine_name}</h4>
                        </div>
                        <span className="text-xs font-bold text-ink">
                          ${(alert.impact.total_estimated_impact ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted">
                        {alert.severity_reason?.[0] || "Anomaly detected"}
                      </p>
                      <div className="mt-2 flex items-center justify-between border-t border-line/50 pt-2 text-[11px]">
                        <span className="text-muted">Score: {alert.anomaly_score}</span>
                        <button
                          type="button"
                          onClick={() => onNavigate("alerts", { alertId: alert.id })}
                          className="text-xs font-medium text-accent hover:underline"
                        >
                          {t("common.viewDetails")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Assistant Callout */}
              <div className="mt-4 rounded-md bg-accent-soft p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-accent">
                  <Bot className="h-4 w-4" />
                  <span>Investigate Alerts</span>
                </div>
                <p className="mt-1 text-[11px] text-ink/80">
                  Query the bilingual assistant for tool-grounded inspection steps and maintenance logs.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate("assistant")}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  Open Assistant <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Backend Connection Health Card */}
      <StatusCard />

      {/* Human Review Regulatory Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-line bg-panel p-4 text-xs text-muted">
        <Info className="h-5 w-5 shrink-0 text-accent" />
        <p>{t("common.disclaimer")}</p>
      </div>
    </div>
  );
}

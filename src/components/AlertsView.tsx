import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Alert, AlertStatus, Dataset, Machine } from "@/types";

interface AlertsViewProps {
  initialAlertId?: number;
  onInvestigateAI?: (alert: Alert) => void;
}

export function AlertsView({ initialAlertId, onInvestigateAI }: AlertsViewProps) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadAlerts = useCallback(
    async (
      datasetId: number,
      filters: { severity?: string; machine_id?: string; status?: string }
    ) => {
      const data = await api.getDatasetAlerts(datasetId, {
        severity: filters.severity !== "all" ? filters.severity : undefined,
        machine_id: filters.machine_id !== "all" ? filters.machine_id : undefined,
        status: filters.status !== "all" ? filters.status : undefined,
      });
      return data;
    },
    []
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeDs = await api.getActiveDataset();
      setDataset(activeDs);

      const [machs, alertList] = await Promise.all([
        api.getDatasetMachines(activeDs.id).catch(() => []),
        loadAlerts(activeDs.id, {
          severity: severityFilter,
          machine_id: machineFilter,
          status: statusFilter,
        }),
      ]);

      setMachines(machs);
      setAlerts(alertList);

      if (initialAlertId) {
        const found = alertList.find((a) => a.id === initialAlertId);
        if (found) {
          setSelectedAlert(found);
        } else {
          try {
            const specific = await api.getAlert(initialAlertId);
            setSelectedAlert(specific);
          } catch {
            setSelectedAlert(alertList[0] || null);
          }
        }
      } else {
        setSelectedAlert(alertList[0] || null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDataset(null);
        setMachines([]);
        setAlerts([]);
        setSelectedAlert(null);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not retrieve anomaly alerts from the backend."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [initialAlertId, loadAlerts, severityFilter, machineFilter, statusFilter]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // When filters change, refetch alerts for active dataset
  const handleFilterChange = async (
    newSeverity: string,
    newMachine: string,
    newStatus: string
  ) => {
    if (!dataset) return;
    setFiltering(true);
    setError(null);
    try {
      const data = await loadAlerts(dataset.id, {
        severity: newSeverity,
        machine_id: newMachine,
        status: newStatus,
      });
      setAlerts(data);
      setSelectedAlert((prev) => {
        if (!prev) return data[0] || null;
        const exists = data.find((a) => a.id === prev.id);
        return exists || data[0] || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to filter alerts from backend.");
    } finally {
      setFiltering(false);
    }
  };

  const onSelectSeverity = (val: string) => {
    setSeverityFilter(val);
    handleFilterChange(val, machineFilter, statusFilter);
  };

  const onSelectMachine = (val: string) => {
    setMachineFilter(val);
    handleFilterChange(severityFilter, val, statusFilter);
  };

  const onSelectStatus = (val: string) => {
    setStatusFilter(val);
    handleFilterChange(severityFilter, machineFilter, val);
  };

  const handleResetFilters = () => {
    setSeverityFilter("all");
    setMachineFilter("all");
    setStatusFilter("all");
    handleFilterChange("all", "all", "all");
  };

  const handleStatusChange = async (id: number, nextStatus: AlertStatus) => {
    setUpdatingStatus(true);
    setStatusUpdateError(null);
    try {
      const updated = await api.updateAlertStatus(id, nextStatus);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (selectedAlert && selectedAlert.id === id) {
        setSelectedAlert(updated);
      }
      // If current filter excludes new status, refetch alerts
      if (statusFilter !== "all" && statusFilter !== nextStatus && dataset) {
        const refreshed = await loadAlerts(dataset.id, {
          severity: severityFilter,
          machine_id: machineFilter,
          status: statusFilter,
        });
        setAlerts(refreshed);
      }
    } catch (err) {
      setStatusUpdateError(
        err instanceof Error ? err.message : "Failed to update alert status on backend."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const hasActiveFilters =
    severityFilter !== "all" || machineFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">{t("alerts.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("alerts.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={loadInitialData}
          disabled={loading || filtering}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading || filtering ? "animate-spin" : ""}`} />
          <span>{t("common.refresh")}</span>
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-danger">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>API Connectivity Notice</span>
          </div>
          <p className="mt-1 text-ink/80">{error}</p>
          <div className="mt-3">
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

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>

        {/* Severity */}
        <select
          aria-label="Filter by Severity"
          value={severityFilter}
          onChange={(e) => onSelectSeverity(e.target.value)}
          disabled={loading}
          className="rounded-md border border-line bg-bg px-2.5 py-1 text-ink focus:outline-accent disabled:opacity-50"
        >
          <option value="all">{t("alerts.filterSeverity")}: All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Machine */}
        <select
          aria-label="Filter by Machine"
          value={machineFilter}
          onChange={(e) => onSelectMachine(e.target.value)}
          disabled={loading}
          className="rounded-md border border-line bg-bg px-2.5 py-1 text-ink focus:outline-accent disabled:opacity-50"
        >
          <option value="all">{t("alerts.filterMachine")}: All</option>
          {machines.map((m) => (
            <option key={m.id} value={m.external_id}>
              {m.external_id} - {m.name}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          aria-label="Filter by Status"
          value={statusFilter}
          onChange={(e) => onSelectStatus(e.target.value)}
          disabled={loading}
          className="rounded-md border border-line bg-bg px-2.5 py-1 text-ink focus:outline-accent disabled:opacity-50"
        >
          <option value="all">{t("alerts.filterStatus")}: All</option>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-accent hover:underline"
          >
            Reset Filters
          </button>
        )}

        {filtering && (
          <div className="flex items-center gap-1 text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            <span>Filtering...</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span>Loading anomaly alerts from backend...</span>
        </div>
      ) : !dataset ? (
        /* Empty Dataset State */
        <div className="rounded-lg border border-dashed border-line bg-panel p-10 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-3 text-base font-semibold">No Active Dataset</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            No active telemetry dataset was found on the backend. Please load the benchmark demo dataset from the Dashboard or upload a dataset to run anomaly detection.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={loadInitialData}
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t("common.retry")}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Split View: Alert List & Detail Panel */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Alerts List (5 cols) */}
          <div className="space-y-3 lg:col-span-5">
            {alerts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-panel p-8 text-center text-sm text-muted">
                {hasActiveFilters ? t("alerts.noAlertsFound") : "No alerts recorded for this dataset."}
                {hasActiveFilters && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Clear active filters
                    </button>
                  </div>
                )}
              </div>
            ) : (
              alerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected
                        ? "border-accent bg-accent-soft/30 shadow-sm"
                        : "border-line bg-panel hover:border-line/80 hover:bg-bg/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            alert.severity === "critical"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : alert.severity === "high"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="font-mono text-xs font-semibold text-accent">
                          {alert.machine_id}
                        </span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                          alert.status === "open"
                            ? "bg-danger/10 text-danger"
                            : alert.status === "reviewed"
                            ? "bg-ok/10 text-ok"
                            : "bg-muted/10 text-muted"
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-semibold">{alert.machine_name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {alert.severity_reason?.[0] || "Statistical anomaly trigger"}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                      <span className="font-medium text-ink">
                        Est. Impact: ${(alert.impact?.total_estimated_impact ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-muted">
                        Score: <strong>{alert.anomaly_score}</strong>
                        <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detailed Inspection Drawer (7 cols) */}
          <div className="lg:col-span-7">
            {selectedAlert ? (
              <div className="space-y-5 rounded-lg border border-line bg-panel p-6 shadow-sm">
                {/* Header */}
                <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded px-2.5 py-0.5 text-xs font-bold uppercase ${
                          selectedAlert.severity === "critical"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : selectedAlert.severity === "high"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {selectedAlert.severity}
                      </span>
                      <h2 className="text-lg font-semibold">{selectedAlert.machine_name}</h2>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      Window: {new Date(selectedAlert.start_ts).toLocaleTimeString()} –{" "}
                      {new Date(selectedAlert.end_ts).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Status action buttons */}
                  <div className="flex items-center gap-2">
                    {selectedAlert.status === "open" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(selectedAlert.id, "reviewed")}
                          disabled={updatingStatus}
                          className="inline-flex items-center gap-1 rounded bg-ok px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {updatingStatus ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>{t("alerts.markReviewed")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(selectedAlert.id, "dismissed")}
                          disabled={updatingStatus}
                          className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-accent-soft disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>{t("alerts.dismiss")}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedAlert.id, "open")}
                        disabled={updatingStatus}
                        className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                      >
                        {updatingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{t("alerts.reopen")}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Update Error Notice */}
                {statusUpdateError && (
                  <div className="rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
                    {statusUpdateError}
                  </div>
                )}

                {/* Anomaly Score & Trigger Rules */}
                <div className="rounded-md border border-line bg-bg/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">{t("alerts.anomalyScore")}</span>
                    <span className="font-mono text-sm font-bold text-accent">
                      {selectedAlert.anomaly_score} / 1.00
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedAlert.anomaly_score > 0.85
                          ? "bg-danger"
                          : selectedAlert.anomaly_score > 0.75
                          ? "bg-warn"
                          : "bg-accent"
                      }`}
                      style={{ width: `${Math.round(selectedAlert.anomaly_score * 100)}%` }}
                    ></div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <span className="font-semibold text-ink">Detector Rules Triggered:</span>
                    <ul className="list-inside list-disc text-muted space-y-0.5">
                      {(selectedAlert.severity_reason || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Sensor Evidence Table */}
                <div>
                  <h3 className="text-sm font-semibold">{t("alerts.evidence")}</h3>
                  <div className="mt-2 overflow-x-auto rounded-md border border-line">
                    <table className="w-full text-xs">
                      <thead className="bg-bg text-muted">
                        <tr>
                          <th className="px-3 py-2 text-start font-medium">Channel</th>
                          <th className="px-3 py-2 text-start font-medium">Measured Value</th>
                          <th className="px-3 py-2 text-start font-medium">Baseline Median</th>
                          <th className="px-3 py-2 text-end font-medium">Deviation (MAD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {(selectedAlert.evidence || []).map((ev, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium">{ev.feature}</td>
                            <td className="px-3 py-2 font-mono font-bold text-danger">
                              {ev.observed_value} {ev.unit}
                            </td>
                            <td className="px-3 py-2 font-mono text-muted">
                              {ev.baseline_median} {ev.unit}
                            </td>
                            <td className="px-3 py-2 text-end font-mono font-semibold text-accent">
                              +{ev.deviation_mad}x
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Business Impact Breakdown */}
                {selectedAlert.impact && (
                  <div className="rounded-md border border-line p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <DollarSign className="h-4 w-4 text-ok" />
                      <span>{t("impact.title")}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div className="rounded bg-bg p-2.5">
                        <span className="text-muted">{t("impact.assumedDowntime")}</span>
                        <p className="mt-1 font-mono text-sm font-semibold">
                          {selectedAlert.impact.assumed_downtime_hours ?? 0} hrs
                        </p>
                      </div>
                      <div className="rounded bg-bg p-2.5">
                        <span className="text-muted">{t("impact.downtimeLoss")}</span>
                        <p className="mt-1 font-mono text-sm font-semibold">
                          ${(selectedAlert.impact.downtime_loss ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded bg-bg p-2.5">
                        <span className="text-muted">{t("impact.maintenanceCost")}</span>
                        <p className="mt-1 font-mono text-sm font-semibold">
                          ${(selectedAlert.impact.maintenance_cost ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded bg-ok/10 p-2.5 text-ok">
                        <span className="font-medium text-ok">{t("impact.totalImpact")}</span>
                        <p className="mt-1 font-mono text-sm font-bold">
                          ${(selectedAlert.impact.total_estimated_impact ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      Formula: {selectedAlert.impact.formula_version || "v1.0"} (
                      {selectedAlert.impact.assumed_downtime_hours ?? 0}h × $
                      {selectedAlert.impact.inputs_used?.loss_per_hour ?? 0}/hr + $
                      {selectedAlert.impact.maintenance_cost ?? 0}).
                    </p>
                  </div>
                )}

                {/* Recommended Inspection Steps */}
                <div>
                  <h3 className="text-sm font-semibold">{t("alerts.inspectionSteps")}</h3>
                  <div className="mt-2 space-y-2">
                    {(selectedAlert.inspection_steps || []).map((step, idx) => {
                      const stepKey = `${selectedAlert.id}_${idx}`;
                      const isDone = !!checkedSteps[stepKey];
                      return (
                        <label
                          key={idx}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-xs transition-colors ${
                            isDone
                              ? "border-ok/40 bg-ok/5 line-through text-muted"
                              : "border-line bg-panel hover:bg-bg"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleStep(stepKey)}
                            className="mt-0.5 rounded border-line text-accent focus:ring-accent"
                          />
                          <span>{step}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons: Investigate with AI */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="text-xs text-muted">
                    Priority Score: <strong>{selectedAlert.impact?.priority_score ?? 0} / 100</strong>
                  </span>

                  {onInvestigateAI && (
                    <button
                      type="button"
                      onClick={() => onInvestigateAI(selectedAlert)}
                      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90"
                    >
                      <Bot className="h-4 w-4" />
                      {t("alerts.investigateWithAI")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-panel p-12 text-center text-sm text-muted">
                Select an alert from the left to inspect sensor evidence.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

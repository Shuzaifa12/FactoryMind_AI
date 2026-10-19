"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Alert, Machine } from "@/types";

export default function AlertsPage() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [datasetId, setDatasetId] = useState<number | null>(null);

  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchAlerts = async (dId: number) => {
    try {
      const filters: { severity?: string; machine_id?: string; status?: string } = {};
      if (severityFilter !== "all") filters.severity = severityFilter;
      if (machineFilter !== "all") filters.machine_id = machineFilter;
      if (statusFilter !== "all") filters.status = statusFilter;

      const data = await api.getDatasetAlerts(dId, filters);
      setAlerts(data);
      if (data.length > 0 && (!selectedAlert || !data.some((a) => a.id === selectedAlert.id))) {
        setSelectedAlert(data[0]);
      } else if (data.length === 0) {
        setSelectedAlert(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    }
  };

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const ds = await api.getActiveDataset();
        setDatasetId(ds.id);
        const [machs, alts] = await Promise.all([
          api.getDatasetMachines(ds.id).catch(() => []),
          api.getDatasetAlerts(ds.id).catch(() => []),
        ]);
        setMachines(machs);
        setAlerts(alts);
        if (alts.length > 0) setSelectedAlert(alts[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize alerts page");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (datasetId) {
      fetchAlerts(datasetId);
    }
  }, [severityFilter, machineFilter, statusFilter]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const updated = await api.updateAlertStatus(id, newStatus);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (selectedAlert && selectedAlert.id === id) {
        setSelectedAlert(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update alert status");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span>Loading anomaly detections from database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("alerts.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("alerts.subtitle")}</p>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>

        <select
          aria-label="Filter by Severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-md border border-line bg-bg px-2.5 py-1 text-ink focus:outline-accent"
        >
          <option value="all">{t("alerts.filterSeverity")}: All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          aria-label="Filter by Machine"
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="rounded-md border border-line bg-bg px-2.5 py-1 text-ink focus:outline-accent"
        >
          <option value="all">{t("alerts.filterMachine")}: All</option>
          {machines.map((m) => (
            <option key={m.id} value={m.external_id}>
              {m.external_id} - {m.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-line bg-bg px-2.5 py-1 text-ink focus:outline-accent"
        >
          <option value="all">{t("alerts.filterStatus")}: All</option>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
        </select>

        {(severityFilter !== "all" || machineFilter !== "all" || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSeverityFilter("all");
              setMachineFilter("all");
              setStatusFilter("all");
            }}
            className="text-accent hover:underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Split View: Alert List & Detail Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Alerts List (5 cols) */}
        <div className="space-y-3 lg:col-span-5">
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-panel p-8 text-center text-sm text-muted">
              {t("alerts.noAlertsFound")}
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
                    {alert.severity_reason[0]}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                    <span className="font-medium text-ink">
                      Est. Impact: ${alert.impact.total_estimated_impact?.toLocaleString() ?? 0}
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
                  <p className="mt-1 flex items-center gap-2 font-mono text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    Window: {new Date(selectedAlert.start_ts).toLocaleTimeString()} –{" "}
                    {new Date(selectedAlert.end_ts).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedAlert.status === "open" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedAlert.id, "reviewed")}
                        className="inline-flex items-center gap-1 rounded bg-ok px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("alerts.markReviewed")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedAlert.id, "dismissed")}
                        className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-accent-soft"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("alerts.dismiss")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedAlert.id, "open")}
                      className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft"
                    >
                      {t("alerts.reopen")}
                    </button>
                  )}
                </div>
              </div>

              {/* Anomaly Score & Trigger Rules */}
              <div className="rounded-md border border-line bg-bg/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">{t("alerts.anomalyScore")}</span>
                  <span className="font-mono text-sm font-bold text-accent">
                    {selectedAlert.anomaly_score} / 1.00
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${
                      (selectedAlert.anomaly_score ?? 0) > 0.85
                        ? "bg-danger"
                        : (selectedAlert.anomaly_score ?? 0) > 0.75
                        ? "bg-warn"
                        : "bg-accent"
                    }`}
                    style={{ width: `${Math.round((selectedAlert.anomaly_score ?? 0) * 100)}%` }}
                  ></div>
                </div>

                <div className="mt-3 space-y-1 text-xs">
                  <span className="font-semibold text-ink">Detector Rules Triggered:</span>
                  <ul className="list-inside list-disc space-y-0.5 text-muted">
                    {selectedAlert.severity_reason.map((r, i) => (
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
                      {selectedAlert.evidence.map((ev, i) => (
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
                      ${selectedAlert.impact.downtime_loss?.toLocaleString() ?? 0}
                    </p>
                  </div>
                  <div className="rounded bg-bg p-2.5">
                    <span className="text-muted">{t("impact.maintenanceCost")}</span>
                    <p className="mt-1 font-mono text-sm font-semibold">
                      ${selectedAlert.impact.maintenance_cost?.toLocaleString() ?? 0}
                    </p>
                  </div>
                  <div className="rounded bg-ok/10 p-2.5 text-ok">
                    <span className="font-medium text-ok">{t("impact.totalImpact")}</span>
                    <p className="mt-1 font-mono text-sm font-bold">
                      ${selectedAlert.impact.total_estimated_impact?.toLocaleString() ?? 0}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Formula: {selectedAlert.impact.formula_version}
                </p>
              </div>

              {/* Actionable Inspection Steps */}
              <div>
                <h3 className="text-sm font-semibold">{t("alerts.inspectionSteps")}</h3>
                <div className="mt-2 space-y-2">
                  {selectedAlert.inspection_steps.map((step, idx) => {
                    const stepKey = `${selectedAlert.id}_${idx}`;
                    const isDone = !!checkedSteps[stepKey];
                    return (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-xs transition-colors ${
                          isDone
                            ? "border-ok/40 bg-ok/5 text-muted line-through"
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-xs text-muted">
                  Priority Score: <strong>{selectedAlert.impact.priority_score ?? 0} / 100</strong>
                </span>

                <Link
                  href="/assistant"
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90"
                >
                  <Bot className="h-4 w-4" />
                  {t("alerts.investigateWithAI")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-panel p-12 text-center text-sm text-muted">
              Select an alert from the left to inspect sensor evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

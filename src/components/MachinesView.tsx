import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  Clock,
  Cpu,
  Edit3,
  History,
  Loader2,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Machine, MaintenanceRecord } from "@/types";

export function MachinesView() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);

  // Assumptions modal state
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [savingAssumptions, setSavingAssumptions] = useState(false);
  const [assumptionsError, setAssumptionsError] = useState<string | null>(null);
  const [lossRate, setLossRate] = useState<number>(1000);
  const [repairCost, setRepairCost] = useState<number>(3000);
  const [criticality, setCriticality] = useState<number>(5);
  const [priority, setPriority] = useState<number>(5);

  // History modal state
  const [historyMachine, setHistoryMachine] = useState<Machine | null>(null);
  const [historyRecords, setHistoryRecords] = useState<MaintenanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchMachines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dataset = await api.getActiveDataset();
      const data = await api.getDatasetMachines(dataset.id);
      setMachines(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setMachines([]);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not retrieve machine registry from the backend."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const openEditModal = (m: Machine) => {
    setEditingMachine(m);
    setAssumptionsError(null);
    setLossRate(m.loss_per_hour ?? 1000);
    setRepairCost(m.maintenance_cost_estimate ?? 3000);
    setCriticality(m.criticality ?? 3);
    setPriority(m.production_priority ?? 3);
  };

  const handleSaveAssumptions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    setSavingAssumptions(true);
    setAssumptionsError(null);
    try {
      const updated = await api.updateMachineAssumptions(editingMachine.id, {
        loss_per_hour: Number(lossRate),
        maintenance_cost_estimate: Number(repairCost),
        criticality: Number(criticality),
        production_priority: Number(priority),
      });
      setMachines((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
      );
      setEditingMachine(null);
      // Re-fetch in background to refresh server-recalculated alert impacts
      fetchMachines();
    } catch (err) {
      setAssumptionsError(
        err instanceof Error ? err.message : "Failed to update assumptions on backend."
      );
    } finally {
      setSavingAssumptions(false);
    }
  };

  const loadHistoryForMachine = async (m: Machine) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const records = await api.getMachineMaintenance(m.id);
      setHistoryRecords(records);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to load maintenance records."
      );
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (m: Machine) => {
    setHistoryMachine(m);
    loadHistoryForMachine(m);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">{t("machines.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("machines.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={fetchMachines}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{t("common.refresh")}</span>
        </button>
      </div>

      {/* Error Banner */}
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
              onClick={fetchMachines}
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:opacity-90"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span>Loading machine registry from backend...</span>
        </div>
      ) : machines.length === 0 ? (
        /* Empty State */
        <div className="rounded-lg border border-dashed border-line bg-panel p-10 text-center">
          <Cpu className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-3 text-base font-semibold">No Machines Found</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            No machine telemetry registry is currently active. Load the benchmark demo dataset from the Dashboard or upload your plant sensor dataset.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={fetchMachines}
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t("common.retry")}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Machines Table */
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line bg-bg/50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.machineId")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.name")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.criticality")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.lossPerHour")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.maintenanceCost")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.source")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("machines.activeAlerts")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-accent-soft/20">
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-accent">
                      {m.external_id}
                    </td>
                    <td className="px-4 py-3.5 font-medium">{m.name}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                          (m.criticality ?? 3) >= 4
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : (m.criticality ?? 3) === 3
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        <Shield className="h-3 w-3" />
                        Tier {m.criticality ?? 3}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-ink">
                      ${(m.loss_per_hour ?? 0).toLocaleString()}/hr
                    </td>
                    <td className="px-4 py-3.5 font-mono text-ink">
                      ${(m.maintenance_cost_estimate ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          m.assumption_source === "user"
                            ? "border-accent text-accent"
                            : "border-line text-muted"
                        }`}
                      >
                        {m.assumption_source === "user"
                          ? t("machines.userTag")
                          : t("machines.illustrativeTag")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {m.active_alerts_count && m.active_alerts_count > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {m.active_alerts_count} Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-ok">
                          <Check className="h-3.5 w-3.5" />
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openHistoryModal(m)}
                          title="View Maintenance Records"
                          className="inline-flex items-center gap-1 rounded border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-accent-soft"
                        >
                          <History className="h-3 w-3" />
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink hover:opacity-90"
                        >
                          <Edit3 className="h-3 w-3" />
                          {t("machines.editAssumptions")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Assumptions Modal */}
      {editingMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-line bg-panel p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-semibold">{t("machines.modalTitle")}</h3>
                <p className="text-xs text-muted">
                  {editingMachine.external_id} — {editingMachine.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMachine(null)}
                aria-label="Close modal"
                className="rounded p-1 text-muted hover:bg-accent-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssumptions} className="mt-4 space-y-4">
              {assumptionsError && (
                <div className="rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
                  {assumptionsError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted">
                  Downtime Production Loss Rate ($/hour)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={lossRate}
                  onChange={(e) => setLossRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-accent"
                  required
                />
                <span className="text-[11px] text-muted">
                  Used in deterministic formula: Downtime Hours × Rate.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">
                  Estimated Component Replacement / Repair Cost ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={repairCost}
                  onChange={(e) => setRepairCost(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted">
                    Asset Criticality (1 = Low, 5 = Critical)
                  </label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-accent"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        Tier {v} {v === 5 ? "(Bottleneck)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">
                    Production Priority (1 = Low, 5 = High)
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-accent"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        Priority {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditingMachine(null)}
                  disabled={savingAssumptions}
                  className="rounded-md border border-line px-4 py-2 text-xs font-medium hover:bg-accent-soft disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingAssumptions}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
                >
                  {savingAssumptions && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{t("common.save")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Drawer */}
      {historyMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-line bg-panel p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-accent" />
                <h3 className="text-base font-semibold">
                  Maintenance History — {historyMachine.external_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryMachine(null)}
                aria-label="Close history modal"
                className="rounded p-1 text-muted hover:bg-accent-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {historyLoading ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                  <span>Loading maintenance records...</span>
                </div>
              ) : historyError ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                  <p>{historyError}</p>
                  <button
                    type="button"
                    onClick={() => loadHistoryForMachine(historyMachine)}
                    className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : historyRecords.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">
                  No historical maintenance logs found for this machine.
                </p>
              ) : (
                historyRecords.map((r) => (
                  <div key={r.id} className="rounded-md border border-line p-3 text-xs">
                    <div className="flex items-center justify-between text-muted">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {new Date(r.date).toLocaleDateString()}
                      </span>
                      <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Source: {r.source}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-ink">{r.description}</p>
                    <span className="mt-2 inline-block text-[10px] text-muted">
                      Confidence match: {r.match_confidence}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryMachine(null)}
                className="rounded-md border border-line px-4 py-2 text-xs font-medium hover:bg-accent-soft"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

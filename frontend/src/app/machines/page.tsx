"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Cpu, Edit3, Loader2, Shield, X } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Machine } from "@/types";

export default function MachinesPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal form states
  const [lossRate, setLossRate] = useState<number>(1000);
  const [repairCost, setRepairCost] = useState<number>(3000);
  const [criticality, setCriticality] = useState<number>(5);
  const [priority, setPriority] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      setError(null);
      const dataset = await api.getActiveDataset();
      const machs = await api.getDatasetMachines(dataset.id);
      setMachines(machs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load machines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const openEditModal = (m: Machine) => {
    setEditingMachine(m);
    setLossRate(m.loss_per_hour ?? 1000);
    setRepairCost(m.maintenance_cost_estimate ?? 3000);
    setCriticality(m.criticality ?? 3);
    setPriority(m.production_priority ?? 3);
  };

  const handleSaveAssumptions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    setSaving(true);
    try {
      const updated = await api.updateMachineAssumptions(editingMachine.id, {
        loss_per_hour: Number(lossRate),
        maintenance_cost_estimate: Number(repairCost),
        criticality: Number(criticality),
        production_priority: Number(priority),
      });
      setMachines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMachine(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save assumptions");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span>Loading machine registry from database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("machines.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("machines.subtitle")}</p>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          {error}
        </div>
      )}

      {machines.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center text-sm text-muted">
          No machines found in the current dataset. Please load the demo or upload data.
        </div>
      ) : (
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
                      ${m.loss_per_hour?.toLocaleString() ?? 0}/hr
                    </td>
                    <td className="px-4 py-3.5 font-mono text-ink">
                      ${m.maintenance_cost_estimate?.toLocaleString() ?? 0}
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
                      {m.active_alerts_count > 0 ? (
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
                      <button
                        type="button"
                        onClick={() => openEditModal(m)}
                        className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink hover:opacity-90"
                      >
                        <Edit3 className="h-3 w-3" />
                        {t("machines.editAssumptions")}
                      </button>
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
                  className="rounded-md border border-line px-4 py-2 text-xs font-medium hover:bg-accent-soft"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{t("common.save")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

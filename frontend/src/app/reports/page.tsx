"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Info,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Alert } from "@/types";

export default function ReportsPage() {
  const { t, locale } = useI18n();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [reportLang, setReportLang] = useState<"en" | "ur">(locale);
  const [reportFormat, setReportFormat] = useState<"md" | "txt">("md");
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const ds = await api.getActiveDataset();
        const data = await api.getDatasetAlerts(ds.id);
        setAlerts(data);
        generateLocalPreview(data, selectedAlertId, reportLang);
      } catch {
        generateLocalPreview([], selectedAlertId, reportLang);
      }
    }
    fetchAlerts();
  }, [reportLang, selectedAlertId]);

  const generateLocalPreview = (
    alts: Alert[],
    targetId: number | null,
    lang: "en" | "ur"
  ) => {
    const isUrdu = lang === "ur";
    const dateStr = new Date().toISOString();
    const targetAlerts =
      targetId !== null ? alts.filter((a) => a.id === targetId) : alts;

    let text = "";
    if (isUrdu) {
      text = `# فیکٹری مائنڈ AI — تکنیکی دیکھ بھال کی رپورٹ (پیش نظارہ)
**تیاری کی تاریخ**: ${dateStr}
**اسٹیٹس**: جائزہ برائے چیف انجینئر (مرحلہ 4 میں بیک اینڈ رپورٹ جنریشن مربوط ہوگی)

---

## 1. ایگزیکٹو خلاصہ
- الرٹس کی تعداد: ${targetAlerts.length}
- کل متوقع مالی اثر: $${targetAlerts.reduce((s, a) => s + (a.impact.total_estimated_impact ?? 0), 0).toLocaleString()}

---

## 2. الرٹس کی تفصیل اور شواہد
${targetAlerts
  .map(
    (a) => `### الرٹ #${a.id}: ${a.machine_name} (${a.machine_id})
- شدت: ${a.severity.toUpperCase()}
- انوملی اسکور: ${a.anomaly_score}
- سینسر شواہد:
${a.evidence.map((e) => `  * ${e.feature}: ${e.observed_value} ${e.unit} (معمول: ${e.baseline_median} ${e.unit}, انحراف: ${e.deviation_mad}x MAD)`).join("\n")}
- متوقع ڈاؤن ٹائم نقصان: $${a.impact.total_estimated_impact?.toLocaleString() ?? 0}
- معائنہ کے اقدامات:
${a.inspection_steps.map((s) => `  [ ] ${s}`).join("\n")}
`
  )
  .join("\n")}

---

## 3. انسانی توثیق
تمام سفارشات شماریاتی ماڈلز پر مبنی ہیں اور حتمی کارروائی سے قبل فیلڈ انجینئر کی تصدیق لازمی ہے۔`;
    } else {
      text = `# FACTORYMIND AI — EVIDENCE-BASED MAINTENANCE REPORT (PREVIEW)
**Generated**: ${dateStr}
**Status**: Pending Plant Engineering Review (Stage 4 Backend Report Generation Pending)

---

## 1. Executive Summary
- Active Anomalies Reviewed: ${targetAlerts.length}
- Total Estimated Financial Exposure: $${targetAlerts.reduce((s, a) => s + (a.impact.total_estimated_impact ?? 0), 0).toLocaleString()}

---

## 2. Priority Asset Anomalies & Sensor Evidence
${targetAlerts
  .map(
    (a) => `### Alert #${a.id}: ${a.machine_name} [${a.machine_id}]
- Severity: ${a.severity.toUpperCase()} | Anomaly Score: ${a.anomaly_score}
- Direct Sensor Evidence:
${a.evidence.map((e) => `  * ${e.feature}: Observed ${e.observed_value} ${e.unit} vs baseline ${e.baseline_median} ${e.unit} (${e.deviation_mad}x MAD deviation)`).join("\n")}
- Business Impact:
  * Downtime Loss: $${a.impact.downtime_loss?.toLocaleString() ?? 0}
  * Component Repair: $${a.impact.maintenance_cost?.toLocaleString() ?? 0}
  * Total Estimated Impact: $${a.impact.total_estimated_impact?.toLocaleString() ?? 0}
- Actionable Inspection Checklist:
${a.inspection_steps.map((s) => `  [ ] ${s}`).join("\n")}
`
  )
  .join("\n")}

---

## 3. Human Review Certification
All financial figures are derived deterministically from configured loss rates. Anomaly alerts represent unusual operational patterns, requiring qualified technician confirmation before halting production.`;
    }
    setContent(text);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `factorymind_maintenance_report.${reportFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("reports.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("reports.subtitle")}</p>
      </div>

      {/* Control Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-panel p-5 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-muted">
            {t("reports.selectAlert")}
          </label>
          <select
            value={selectedAlertId === null ? "all" : String(selectedAlertId)}
            onChange={(e) =>
              setSelectedAlertId(e.target.value === "all" ? null : Number(e.target.value))
            }
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-1.5 text-xs text-ink focus:outline-accent"
          >
            <option value="all">{t("reports.allAlerts")}</option>
            {alerts.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} - {a.machine_id} ({a.severity.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted">Language / زبان</label>
          <select
            value={reportLang}
            onChange={(e) => setReportLang(e.target.value as "en" | "ur")}
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-1.5 text-xs text-ink focus:outline-accent"
          >
            <option value="en">English</option>
            <option value="ur">اردو (Urdu)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted">
            {t("reports.format")}
          </label>
          <select
            value={reportFormat}
            onChange={(e) => setReportFormat(e.target.value as "md" | "txt")}
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-1.5 text-xs text-ink focus:outline-accent"
          >
            <option value="md">{t("reports.markdown")}</option>
            <option value="txt">{t("reports.text")}</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => generateLocalPreview(alerts, selectedAlertId, reportLang)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t("reports.generateNew")}</span>
          </button>
        </div>
      </div>

      {/* Report Preview Panel */}
      <div className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold">Evidence-Based Maintenance Report</span>
            <span className="rounded bg-bg px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
              {reportFormat}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t("reports.download")}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <pre
            className="overflow-x-auto whitespace-pre-wrap rounded-md border border-line bg-bg p-4 font-mono text-xs leading-relaxed text-ink"
            dir={reportLang === "ur" ? "rtl" : "ltr"}
          >
            {content}
          </pre>
        </div>

        <div className="flex items-center gap-2 border-t border-line bg-bg/40 px-5 py-3 text-xs text-muted">
          <Info className="h-4 w-4 shrink-0 text-accent" />
          <span>{t("reports.assumptionsNotice")}</span>
        </div>
      </div>
    </div>
  );
}

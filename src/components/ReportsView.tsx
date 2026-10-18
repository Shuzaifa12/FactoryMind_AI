import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCheck,
  FileText,
  Info,
  Printer,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { store } from "@/services/store";
import { generatePdfReport } from "@/services/pdfReportGenerator";
import type { Alert, MaintenanceReport } from "@/types";

export function ReportsView() {
  const { t, locale } = useI18n();
  const [alerts, setAlerts] = useState<Alert[]>(() => store.getAlerts());
  const [activeDataset, setActiveDataset] = useState(() => store.getDataset());

  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [reportLang, setReportLang] = useState<"en" | "ur">(locale);
  const [reportFormat, setReportFormat] = useState<"md" | "txt">("md");
  const [copied, setCopied] = useState<boolean>(false);

  const [currentReport, setCurrentReport] = useState<MaintenanceReport>(() =>
    store.generateReport(null, locale, "md")
  );

  // Sync store alerts from backend when active dataset changes
  useEffect(() => {
    store.syncWithBackendDataset(activeDataset.id);
  }, [activeDataset.id]);

  // Subscribe to store changes so dataset switching/uploads automatically update reports & alerts
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const newAlerts = store.getAlerts();
      setAlerts(newAlerts);
      setActiveDataset(store.getDataset());
      // Reset selected alert if it doesn't exist in the new dataset's alerts
      if (selectedAlertId !== null && !newAlerts.some((a) => a.id === selectedAlertId)) {
        setSelectedAlertId(null);
      }
      setCurrentReport(store.generateReport(selectedAlertId, reportLang, reportFormat));
    });
    return unsubscribe;
  }, [selectedAlertId, reportLang, reportFormat]);

  const handleGenerate = () => {
    const rep = store.generateReport(selectedAlertId, reportLang, reportFormat);
    setCurrentReport(rep);
  };

  const handleDownloadPdf = async () => {
    const doc = await generatePdfReport({
      report: currentReport,
      alerts,
      machines: store.getMachines(),
      dataset: store.getDataset(),
    });
    doc.save(`factorymind_maintenance_report_${currentReport.id}.pdf`);
  };

  const handleDownload = () => {
    const blob = new Blob([currentReport.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `factorymind_maintenance_report_${currentReport.id}.${currentReport.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentReport.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">{t("reports.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 text-xs">
          <span className="text-muted">Active Dataset:</span>
          <span className="font-semibold text-ink">{activeDataset.name}</span>
          <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
            ID: {activeDataset.id}
          </span>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-panel p-5 sm:grid-cols-4">
        {/* Select Target */}
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
            {alerts.length === 0 ? (
              <option value="all">No alerts detected in active dataset</option>
            ) : (
              <>
                <option value="all">{t("reports.allAlerts")}</option>
                {alerts.map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.id} - {a.machine_id} ({a.severity.toUpperCase()})
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Language */}
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

        {/* Format */}
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

        {/* Generate Button */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleGenerate}
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
            <span className="text-xs font-semibold">{currentReport.title}</span>
            <span className="rounded bg-bg px-2 py-0.5 font-mono text-[10px] text-muted uppercase">
              {currentReport.format}
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
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-ink transition-colors"
            >
              <FileCheck className="h-3.5 w-3.5" />
              <span>{t("reports.downloadPdf")}</span>
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

        {/* Content Box */}
        <div className="p-6">
          <pre
            className="overflow-x-auto whitespace-pre-wrap rounded-md bg-bg p-4 font-mono text-xs leading-relaxed text-ink border border-line"
            dir={currentReport.language === "ur" ? "rtl" : "ltr"}
          >
            {currentReport.content}
          </pre>
        </div>

        {/* Footer Disclaimer */}
        <div className="flex items-center gap-2 border-t border-line bg-bg/40 px-5 py-3 text-xs text-muted">
          <Info className="h-4 w-4 text-accent shrink-0" />
          <span>{t("reports.assumptionsNotice")}</span>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DashboardView } from "@/components/DashboardView";
import { MachinesView } from "@/components/MachinesView";
import { AlertsView } from "@/components/AlertsView";
import { UploadView } from "@/components/UploadView";
import { AssistantView } from "@/components/AssistantView";
import { ReportsView } from "@/components/ReportsView";
import type { Alert } from "@/types";

type Tab = "dashboard" | "machines" | "alerts" | "upload" | "assistant" | "reports";

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [targetAlertId, setTargetAlertId] = useState<number | undefined>(undefined);
  const [assistantTargetAlert, setAssistantTargetAlert] = useState<Alert | null>(null);

  const handleNavigate = (
    nextTab: string,
    extra?: { alertId?: number; machineId?: string }
  ) => {
    if (extra?.alertId) {
      setTargetAlertId(extra.alertId);
    }
    setTab(nextTab as Tab);
  };

  const handleInvestigateAI = (alert: Alert) => {
    setAssistantTargetAlert(alert);
    setTab("assistant");
  };

  return (
    <AppShell currentTab={tab} onSelectTab={(t) => setTab(t)}>
      {tab === "dashboard" && <DashboardView onNavigate={handleNavigate} />}
      {tab === "machines" && <MachinesView />}
      {tab === "alerts" && (
        <AlertsView
          initialAlertId={targetAlertId}
          onInvestigateAI={handleInvestigateAI}
        />
      )}
      {tab === "upload" && <UploadView onDone={() => setTab("dashboard")} />}
      {tab === "assistant" && <AssistantView initialAlert={assistantTargetAlert} />}
      {tab === "reports" && <ReportsView />}
    </AppShell>
  );
}

export default App;

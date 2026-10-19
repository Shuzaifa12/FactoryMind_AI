"use client";

import { CheckCircle2, CircleAlert, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api, apiBaseUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { HealthResponse } from "@/types";

type State =
  | { phase: "loading" }
  | { phase: "done"; data: HealthResponse }
  | { phase: "error" };

export function StatusCard() {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getHealth(controller.signal)
      .then((data) => setState({ phase: "done", data }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setState({ phase: "loading" });
    setAttempt((n) => n + 1);
  };

  const rows =
    state.phase === "done"
      ? ([
          ["status.apiUrl", apiBaseUrl()],
          [
            "status.database",
            t(
              state.data.database === "ok"
                ? "status.value.ok"
                : "status.value.unavailable"
            ),
          ],
          ["status.engine", state.data.database_engine],
          ["status.version", state.data.version],
          ["status.environment", state.data.environment],
        ] as const)
      : [];

  return (
    <section
      aria-labelledby="status-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <h2 id="status-title" className="mb-3 text-base font-semibold">
        {t("status.title")}
      </h2>

      {state.phase === "loading" && (
        <p role="status" className="flex items-center gap-2 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("status.loading")}
        </p>
      )}

      {state.phase === "error" && (
        <div role="alert" className="space-y-3">
          <p className="flex items-center gap-2 text-danger">
            <CircleAlert className="h-5 w-5" aria-hidden="true" />
            {t("status.error")}
          </p>
          <p className="text-sm text-muted">{t("status.errorHelp")}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink hover:opacity-90"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <div className="space-y-4">
          <p
            role="status"
            className={`flex items-center gap-2 font-medium ${
              state.data.status === "ok" ? "text-ok" : "text-warn"
            }`}
          >
            {state.data.status === "ok" ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            )}
            {t(state.data.status === "ok" ? "status.ok" : "status.degraded")}
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-3 border-b border-line py-1"
              >
                <dt className="text-muted">{t(label)}</dt>
                <dd className="font-medium" dir="auto">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

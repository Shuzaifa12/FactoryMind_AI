import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Globe,
  Info,
  Loader2,
  Send,
  Sparkles,
  Terminal,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { store } from "@/services/store";
import { api } from "@/lib/api";
import { generateMessageId } from "@/services/idGenerator";
import type { Alert, InvestigationMessage } from "@/types";

interface AssistantViewProps {
  initialAlert?: Alert | null;
}

export function AssistantView({ initialAlert }: AssistantViewProps) {
  const { t, locale } = useI18n();
  const lastInvestigatedAlertId = useRef<number | null>(null);
  const [activeDataset, setActiveDataset] = useState(() => store.getDataset());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setActiveDataset(store.getDataset());
    });
    return unsubscribe;
  }, []);

  const [messages, setMessages] = useState<InvestigationMessage[]>([
    {
      id: generateMessageId("init"),
      sender: "assistant",
      content:
        locale === "ur"
          ? `خوش آمدید! میں فیکٹری مائنڈ AI اسسٹنٹ ہوں۔ اس وقت فعال ڈیٹاسیٹ: **${activeDataset.name}** (ID: ${activeDataset.id}) ہے۔`
          : `Welcome! I am the FactoryMind AI Investigation Assistant. Currently grounded in active dataset: **${activeDataset.name}** (ID: ${activeDataset.id}).`,
      timestamp: new Date().toISOString(),
      language: locale,
    },
  ]);
  const [input, setInput] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-fill prompt if initialAlert provided (guarded against duplicate execution)
  useEffect(() => {
    if (initialAlert && lastInvestigatedAlertId.current !== initialAlert.id) {
      lastInvestigatedAlertId.current = initialAlert.id;
      const prompt =
        locale === "ur"
          ? `مشین ${initialAlert.machine_id} کے الرٹ #${initialAlert.id} کی تفتیش کریں۔`
          : `Investigate alert #${initialAlert.id} on ${initialAlert.machine_id} (${initialAlert.machine_name}).`;
      sendMessage(prompt);
    }
  }, [initialAlert, locale]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const sendMessage = async (promptText: string) => {
    const text = promptText.trim();
    if (!text) return;

    const userMsg: InvestigationMessage = {
      id: generateMessageId("user"),
      sender: "user",
      content: text,
      timestamp: new Date().toISOString(),
      language: locale,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    const currentDataset = store.getDataset();

    try {
      // Attempt backend FastAPI assistant endpoint with real active dataset ID
      const aiResponse = await api.queryAssistant(text, currentDataset.id, locale);
      setMessages((prev) => [...prev, aiResponse]);
    } catch {
      // Graceful fallback to client-side store tool-grounded reasoning if backend is unreachable
      const fallbackResponse = store.queryAssistant(text, locale);
      setMessages((prev) => [...prev, fallbackResponse]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[500px] flex-col rounded-lg border border-line bg-panel shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("assistant.title")}</h2>
            <p className="text-xs text-muted">
              Active Dataset: <span className="font-medium text-ink">{activeDataset.name}</span> (ID: <span className="font-mono">{activeDataset.id}</span>)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-1 font-mono text-accent">
            <Cpu className="h-3 w-3" />
            Dataset ID: {activeDataset.id}
          </span>
          <div className="flex items-center gap-1.5 text-ok">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Tools Grounded</span>
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const meta = (msg as any).metadata;
          const sources = meta?.sources || [];

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isUser
                    ? "bg-accent text-accent-ink"
                    : "border border-line bg-panel text-accent"
                }`}
              >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div
                className={`max-w-2xl rounded-lg p-4 text-xs ${
                  isUser
                    ? "bg-accent text-accent-ink"
                    : "border border-line bg-bg/50 text-ink"
                }`}
              >
                {/* Tool Traces if Assistant */}
                {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-3 space-y-1.5 border-b border-line/60 pb-2">
                    <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-accent">
                      <Terminal className="h-3 w-3" />
                      Executed Dataset-Scoped Tools (ID: {activeDataset.id}):
                    </span>
                    {msg.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className="rounded bg-panel/80 p-1.5 font-mono text-[10px] text-muted border border-line"
                      >
                        <span className="font-semibold text-accent">{tc.tool}</span>(
                        {JSON.stringify(tc.arguments)})
                      </div>
                    ))}
                  </div>
                )}

                {/* Body Content */}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                {/* Evidence citations chips */}
                {!isUser && msg.evidenceCited && msg.evidenceCited.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2 text-[10px]">
                    <span className="font-semibold text-muted">Cited Evidence:</span>
                    {msg.evidenceCited.map((ev, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-panel px-2 py-0.5 font-mono text-ink border border-line"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}

                {/* Web Research Sources */}
                {!isUser && sources.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1 border-t border-line/60 pt-2 text-[10px]">
                    <span className="flex items-center gap-1 font-semibold text-accent">
                      <Globe className="h-3 w-3" />
                      External Research Grounding (Web Sources):
                    </span>
                    {sources.map((src: any, idx: number) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline font-mono truncate"
                      >
                        • {src.title} ({src.url})
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-accent">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-bg/50 px-4 py-3 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>Investigating telemetry and running database tools on active dataset ({activeDataset.name})...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-line p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              locale === "ur"
                ? "فعال ڈیٹاسیٹ سے متعلق کوئی بھی سوال پوچھیں (مثلاً: الرٹ #25 یا مشین کی تاریخ)..."
                : `Ask about active dataset (${activeDataset.name}) or investigate an alert (e.g. alert #25)...`
            }
            className="flex-1 rounded-md border border-line bg-bg px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-ink transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <span>{t("assistant.send")}</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

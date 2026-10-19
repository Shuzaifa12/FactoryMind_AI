"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Info,
  Loader2,
  Send,
  Terminal,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Message {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
  language: "en" | "ur";
  toolCalls?: Array<{ tool: string; arguments: Record<string, unknown> }>;
  evidenceCited?: string[];
}

export default function AssistantPage() {
  const { t, locale } = useI18n();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init_1",
      sender: "assistant",
      content:
        locale === "ur"
          ? "خوش آمدید! میں فیکٹری مائنڈ انڈسٹریل اسسٹنٹ ہوں۔ اگلے مرحلے میں بیک اینڈ کے کثیر لسانی AI انویسٹی گیشن روٹس (/api/v1/investigations) کو مربوط کیا جائے گا۔ فی الوقت آپ انٹرفیس کا معائنہ کر سکتے ہیں۔"
          : "Welcome! I am the FactoryMind Industrial Investigation Assistant. Full backend integration with the AI investigation engine (/api/v1/investigations) is scheduled for Stage 4. You can explore the UI and sample queries below.",
      timestamp: new Date().toISOString(),
      language: locale,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    const userMsg: Message = {
      id: "usr_" + Date.now(),
      sender: "user",
      content: text,
      timestamp: new Date().toISOString(),
      language: locale,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      const isUrdu = locale === "ur";
      const replyMsg: Message = {
        id: "ai_" + Date.now(),
        sender: "assistant",
        content: isUrdu
          ? `### موصول شدہ سوال کا جائزہ:
"${text}"
- **نوٹ**: یہ اسسٹنٹ انٹرفیس مرحلہ 4 میں مکمل بیک اینڈ ٹول کالنگ سروس (Tool-Grounded Agent) کے ساتھ فعال ہوگا۔
- **منسلک ٹولز**: get_alert_details, get_machine_history, calculate_business_impact`
          : `### Investigation Preview for:
"${text}"
- **Integration Note**: This assistant interface will be connected to the dedicated backend agent endpoint (\`POST /api/v1/investigations\`) in Stage 4.
- **Available Grounded Tools**: \`get_alert_details\`, \`get_machine_history\`, \`calculate_business_impact\`.`,
        timestamp: new Date().toISOString(),
        language: locale,
        toolCalls: [
          { tool: "get_alert_details", arguments: { query: text } },
        ],
        evidenceCited: ["Telemetry status: Connected", "Database: Active"],
      };

      setMessages((prev) => [...prev, replyMsg]);
      setThinking(false);
    }, 600);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[500px] flex-col rounded-lg border border-line bg-panel shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("assistant.title")}</h2>
            <p className="text-xs text-muted">Bilingual tool-grounded industrial reasoning</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-warn">
          <Info className="h-3.5 w-3.5" />
          <span>Stage 4 Endpoint Pending</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
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
                {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-3 space-y-1.5 border-b border-line/60 pb-2">
                    <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-accent">
                      <Terminal className="h-3 w-3" />
                      Planned Tool Execution:
                    </span>
                    {msg.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-line bg-panel/80 p-1.5 font-mono text-[10px] text-muted"
                      >
                        <span className="font-semibold text-accent">{tc.tool}</span>(
                        {JSON.stringify(tc.arguments)})
                      </div>
                    ))}
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                {!isUser && msg.evidenceCited && msg.evidenceCited.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2 text-[10px]">
                    <span className="font-semibold text-muted">Evidence:</span>
                    {msg.evidenceCited.map((ev, idx) => (
                      <span
                        key={idx}
                        className="rounded border border-line bg-panel px-1.5 py-0.5 text-muted"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}

                <span
                  className={`mt-2 block text-end text-[10px] ${
                    isUser ? "text-accent-ink/70" : "text-muted"
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}

        {thinking && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span>{t("assistant.thinking")}</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Suggested Starter Prompts */}
      <div className="border-t border-line/50 bg-bg/30 px-5 py-2.5">
        <span className="text-[11px] font-medium text-muted">Quick Investigation Starters:</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSend(t("assistant.samplePrompt1"))}
            className="rounded border border-line bg-panel px-2.5 py-1 text-[11px] text-ink transition-colors hover:bg-accent-soft"
          >
            {t("assistant.samplePrompt1")}
          </button>
          <button
            type="button"
            onClick={() => handleSend(t("assistant.samplePrompt2"))}
            className="rounded border border-line bg-panel px-2.5 py-1 text-[11px] text-ink transition-colors hover:bg-accent-soft"
          >
            {t("assistant.samplePrompt2")}
          </button>
          <button
            type="button"
            onClick={() => handleSend(t("assistant.samplePrompt3"))}
            className="rounded border border-line bg-panel px-2.5 py-1 text-[11px] text-ink transition-colors hover:bg-accent-soft"
          >
            {t("assistant.samplePrompt3")}
          </button>
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("assistant.inputPlaceholder")}
            className="flex-1 rounded-md border border-line bg-bg px-3.5 py-2 text-xs text-ink placeholder:text-muted focus:outline-accent"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{t("assistant.send")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

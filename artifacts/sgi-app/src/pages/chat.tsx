import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import {
  useListOpenaiConversations,
  useGetOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  getGetMyProfileQueryKey,
  getGetSgiHistoryQueryKey,
  getGetOpenaiConversationQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquarePlus, Trash2, Send, Bot, User, TrendingUp, TrendingDown, Minus, Zap, ChevronDown, Lock, Menu, X } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

const MODELS = [
  { id: "claude-haiku-4-5",  label: "Claude Haiku 4",  provider: "Anthropic", badge: "Fast",         minPlan: "free"    },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4", provider: "Anthropic", badge: "Balanced",     minPlan: "premium" },
  { id: "claude-opus-4-8",   label: "Claude Opus 4",   provider: "Anthropic", badge: "Most Capable", minPlan: "pro"     },
  { id: "gpt-4o-mini",       label: "GPT-4o Mini",     provider: "OpenAI",    badge: "Fast",         minPlan: "premium" },
  { id: "gpt-4o",            label: "GPT-4o",          provider: "OpenAI",    badge: "Capable",      minPlan: "pro"     },
] as const;
type ModelId = typeof MODELS[number]["id"];

const PLAN_ORDER: Record<string, number> = { free: 0, premium: 1, pro: 2 };
function modelAllowed(modelMinPlan: string, userPlan: string): boolean {
  return (PLAN_ORDER[userPlan] ?? 0) >= (PLAN_ORDER[modelMinPlan] ?? 99);
}

const API_BASE = "/api";

// Mirror of server-side ALLOWED_MODELS (pricing.ts) — client-side out-of-plan detection only
const ALLOWED_MODELS_CLIENT: Record<string, string[]> = {
  free:    ["claude-haiku-4-5"],
  premium: ["claude-haiku-4-5", "claude-sonnet-4-6", "gpt-4o-mini"],
  pro:     ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8", "gpt-4o-mini", "gpt-4o"],
};
// DEFAULT_MODEL in pricing.ts is "claude-haiku-4-5" for all plans — fallback when model is out-of-plan
const PLAN_DEFAULT_MODEL_ID = "claude-haiku-4-5";

export default function Chat() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>("claude-haiku-4-5");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastSgiDelta, setLastSgiDelta] = useState<number | null>(null);
  const [lastDomains, setLastDomains] = useState<string[]>([]);
  const [progressCard, setProgressCard] = useState<{
    id: string;
    deltaPct: number;
    isPositive: boolean;
    highlightMetric: string;
    highlightDeltaPct: number;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [streamErrored, setStreamErrored] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const lastInputRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelInitializedRef = useRef(false);
  const autoStartDoneRef = useRef(false);

  const { data: usageData, refetch: refetchUsage } = useQuery<{
    used: number; limit: number; remaining: number; plan: string; totalCostCents: number; warning?: boolean;
  }>({
    queryKey: ["openai-usage"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/openai/usage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("Failed to fetch usage");
      return r.json();
    },
    staleTime: 0,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (modelInitializedRef.current || !usageData?.plan) return;
    modelInitializedRef.current = true;
    const d: ModelId = usageData.plan === "pro" ? "claude-opus-4-8" : usageData.plan === "premium" ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    setSelectedModel(d);
  }, [usageData?.plan]);

  // limitBlocked is DERIVED from server data — never stale local state.
  // If the server says remaining > 0, the chat is always unlocked.
  const limitBlocked = usageData != null && usageData.remaining <= 0;

  const { data: conversations, isLoading: convosLoading } = useListOpenaiConversations();
  const { data: activeConvo, isLoading: convoLoading } = useGetOpenaiConversation(activeConvoId!, {
    query: { enabled: !!activeConvoId, queryKey: getGetOpenaiConversationQueryKey(activeConvoId!) }
  });
  const deleteConvo = useDeleteOpenaiConversation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages, streamingContent]);

  const handleNewConversation = useCallback(async (model?: ModelId) => {
    if (isCreating) return;
    const chosenModel = typeof model === "string" ? model : selectedModel;
    setIsCreating(true);
    try {
      let token: string | null = null;
      try {
        token = await Promise.race([
          getToken(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch { token = null; }
      const r = await fetch(`${API_BASE}/openai/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: "Exploration", model: chosenModel }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const convo = await r.json();
      qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      setActiveConvoId(convo.id);
      setLastSgiDelta(null);
      setLastDomains([]);
    } catch (err) {
      console.error("[handleNewConversation] error:", err);
      toast.error(t("chat.failedCreate"));
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, selectedModel, getToken, qc, t]);

  useEffect(() => {
    if (autoStartDoneRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") !== "1") return;
    if (conversations === undefined) return;
    autoStartDoneRef.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    void handleNewConversation();
  }, [conversations, handleNewConversation]);

  const handleDeleteConversation = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConvo.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (activeConvoId === id) {
          setActiveConvoId(null);
          setLastSgiDelta(null);
          setLastDomains([]);
        }
      },
      onError: () => toast.error(t("chat.failedDelete")),
    });
  }, [deleteConvo, qc, activeConvoId]);

  const handleRetry = useCallback(() => {
    if (!lastInputRef.current) return;
    setStreamErrored(false);
    setInput(lastInputRef.current);
    lastInputRef.current = "";
  }, []);

  const handleSend = useCallback(async () => {
    if (!activeConvoId || !input.trim() || isStreaming) return;
    const content = input.trim();
    lastInputRef.current = content;
    setInput("");
    setStreamingContent("");
    setIsStreaming(true);
    setStreamErrored(false);
    setLastSgiDelta(null);
    setProgressCard(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/openai/conversations/${activeConvoId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      });

      if (response.status === 429) {
        const err = await response.json().catch(() => ({}));
        // Update cache so limitBlocked (derived) becomes true immediately
        qc.setQueryData(["openai-usage"], (old: { used: number; limit: number; remaining: number; plan: string; totalCostCents: number } | undefined) => ({
          used: err.used ?? old?.used ?? 0,
          limit: err.limit ?? old?.limit ?? 0,
          remaining: 0,
          plan: err.plan ?? old?.plan ?? "free",
          totalCostCents: old?.totalCostCents ?? 0,
        }));
        const nextPlan = (err.plan === "premium") ? "Pro (€19.99)" : "Premium (€9.99)";
        toast.error(`${t("chat.limitReached")} (${err.used ?? "?"}/${err.limit ?? "?"} msg). → ${nextPlan}.`);
        setIsStreaming(false);
        setStreamingContent("");
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamingContent(accumulated);
            }
            if (parsed.done) {
              if (parsed.streamError) {
                setStreamErrored(true);
              }
              if (parsed.usedFallback) {
                toast.info(t("chat.usedFallback"));
              }
              if (parsed.costCapReached) {
                toast.warning(t("chat.monthlyCostCapReached"));
              }
              if (parsed.opusDowngraded) {
                toast.warning(t("chat.opusMonthlyCapReached", { limit: parsed.opusDowngraded.opusLimit }));
              }
              setLastSgiDelta(parsed.sgiDelta ?? null);
              setLastDomains(parsed.domains ?? []);
              if (parsed.sgiDelta > 0) {
                toast.success(`SGI +${parsed.sgiDelta.toFixed(2)} pts`);
              }
              if (parsed.progressCard) {
                if (parsed.progressCard.isPositive) {
                  setProgressCard(parsed.progressCard);
                } else {
                  qc.invalidateQueries({ queryKey: ["progress-cards"] });
                }
              }
              if (parsed.usage) {
                qc.setQueryData(["openai-usage"], parsed.usage);
              }
              if (parsed.title && activeConvoId) {
                qc.setQueryData(getListOpenaiConversationsQueryKey(), (old: unknown) => {
                  if (!Array.isArray(old)) return old;
                  return old.map((c: { id: number; title: string }) =>
                    c.id === activeConvoId ? { ...c, title: parsed.title } : c
                  );
                });
                qc.setQueryData(getGetOpenaiConversationQueryKey(activeConvoId), (old: unknown) => {
                  if (!old || typeof old !== "object") return old;
                  return { ...(old as object), title: parsed.title };
                });
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      setStreamErrored(true);
      toast.error(t("chat.streamError"));
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      qc.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(activeConvoId) });
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSgiHistoryQueryKey() });
      qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    }
  }, [activeConvoId, input, isStreaming, getToken, qc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  const messages = activeConvo?.messages ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      {/* Mobile conversations toggle */}
      <button
        className="md:hidden self-start flex items-center gap-1.5 mb-2 px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setChatSidebarOpen((o) => !o)}
        aria-label="Toggle conversations"
      >
        {chatSidebarOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
        <span className="ml-0.5">Conversazioni</span>
      </button>
      <div className="flex flex-1 min-h-0 gap-4">
      {/* Sidebar */}
      <div className={`${chatSidebarOpen ? "flex" : "hidden"} md:flex w-64 flex-col gap-2 flex-shrink-0`}>
        {/* Model selector for next conversation */}
        {modelDropdownOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
        )}
        <div className="relative z-50">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-1 px-0.5" style={{ color: "#9090b8" }}>
            {t("chat.modelForNewConvos")}
          </p>
          <button
            onClick={() => setModelDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#a89fff" }}
          >
            <span>{MODELS.find(m => m.id === selectedModel)?.label ?? "Haiku"}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {modelDropdownOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-xl"
              style={{ background: "#12142a", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {MODELS.map(m => {
                const userPlan = usageData?.plan ?? "free";
                const allowed = modelAllowed(m.minPlan, userPlan);
                const planLabel = m.minPlan === "pro" ? "Pro" : m.minPlan === "premium" ? "Premium" : null;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (!allowed) {
                        toast.info(t("chat.modelLockedToast", { model: m.label, plan: planLabel }));
                        setModelDropdownOpen(false);
                        return;
                      }
                      setSelectedModel(m.id);
                      setModelDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                    style={{ color: !allowed ? "rgba(144,144,184,0.4)" : selectedModel === m.id ? "#a89fff" : "#9090b8" }}
                  >
                    <div className="flex items-center gap-2">
                      {!allowed && <Lock className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(144,144,184,0.4)" }} />}
                      <div>
                        <div className="font-medium text-xs" style={{ color: "inherit" }}>{m.label}</div>
                        <div className="text-xs opacity-60">{m.provider}</div>
                      </div>
                    </div>
                    {!allowed && planLabel ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(240,192,64,0.1)", color: "rgba(240,192,64,0.6)", border: "1px solid rgba(240,192,64,0.2)" }}>{planLabel}</span>
                    ) : m.badge ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,107,255,0.2)", color: "#a89fff" }}>{m.badge}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Button
          onClick={() => handleNewConversation()}
          className="w-full gap-2"
          variant="outline"
          data-testid="button-new-conversation"
          disabled={isCreating || limitBlocked}
        >
          <MessageSquarePlus className="w-4 h-4" />
          {t("chat.newExploration")}
        </Button>

        {/* Usage counter */}
        {usageData && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#9090b8" }}>
              <span>{t("chat.usageCounter", { used: usageData.used, limit: usageData.limit })}</span>
              <span className="capitalize" style={{ color: usageData.plan === "premium" ? "#a89fff" : "#9090b8" }}>
                {usageData.plan}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (usageData.used / usageData.limit) * 100)}%`,
                  background: usageData.remaining <= 5
                    ? "linear-gradient(90deg, #f72585, #b5179e)"
                    : "linear-gradient(90deg, #7c6bff, #06d6a0)",
                }}
              />
            </div>
            {usageData.warning && usageData.remaining > 0 && (
              <p className="text-xs mt-1" style={{ color: "#f72585" }}>
                {t("chat.fewLeft", { n: usageData.remaining })}
              </p>
            )}
          </div>
        )}

        {/* Upgrade banner when blocked */}
        {limitBlocked && (
          <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: "rgba(247,37,133,0.08)", border: "1px solid rgba(247,37,133,0.25)" }}
          >
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#f72585" }} />
              <p className="text-xs font-semibold" style={{ color: "#f72585" }}>{t("chat.limitReached")}</p>
            </div>
            {usageData?.plan === "premium" ? (
              <>
                <p className="text-xs" style={{ color: "#9090b8" }}>{t("chat.upgradePro")}</p>
                <button
                  className="text-xs py-1.5 px-3 rounded-full font-semibold transition-[opacity,transform] duration-100 hover:opacity-80 active:scale-[0.94]"
                  style={{ background: "linear-gradient(135deg, #f0c040, #e08020)", color: "#fff" }}
                  onClick={() => setLocation("/settings")}
                >
                  {t("chat.upgradeProBtn")}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs" style={{ color: "#9090b8" }}>{t("chat.upgradePro")}</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    className="text-xs py-1.5 px-3 rounded-full font-semibold transition-[opacity,transform] duration-100 hover:opacity-80 active:scale-[0.94]"
                    style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff" }}
                    onClick={() => setLocation("/settings")}
                  >
                    {t("chat.upgradePremiumBtn")}
                  </button>
                  <button
                    className="text-xs py-1.5 px-3 rounded-full font-semibold transition-[opacity,transform] duration-100 hover:opacity-80 active:scale-[0.94]"
                    style={{ background: "linear-gradient(135deg, #f0c040, #e08020)", color: "#fff" }}
                    onClick={() => setLocation("/settings")}
                  >
                    {t("chat.upgradeProBtn")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {convosLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : conversations?.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-8 px-2">{t("chat.noConversationsYet")}</p>
          ) : (
            conversations?.map(c => (
              <div
                key={c.id}
                data-testid={`button-conversation-${c.id}`}
                onClick={() => { setActiveConvoId(c.id); setLastSgiDelta(null); setProgressCard(null); }}
                className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-[colors,transform] duration-100 active:scale-[0.98] ${
                  activeConvoId === c.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <span className="truncate flex-1">{c.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.sgiDelta != null && c.sgiDelta !== 0 && (
                    <span className={`text-xs font-mono ${c.sgiDelta > 0 ? "text-green-500" : "text-red-500"}`}>
                      {c.sgiDelta > 0 ? "+" : ""}{(c.sgiDelta as number).toFixed(1)}
                    </span>
                  )}
                  <button
                    data-testid={`button-delete-conversation-${c.id}`}
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col bg-card/30 backdrop-blur border-border overflow-hidden">
        {!activeConvoId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <Bot className="w-12 h-12 text-muted-foreground/50" />
            <div>
              <p className="text-lg font-medium">{t("chat.noConvoSelected")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("chat.noConvoSubtitle")}</p>
            </div>
            <Button onClick={() => handleNewConversation()} data-testid="button-start-exploration">
              {t("chat.newExploration")}
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)" }}
                >
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-sm">{activeConvo?.title ?? "Exploration"}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Model badge — static, non-clickable */}
                {(() => {
                  const convoModelId = (activeConvo as any)?.model as string | undefined;
                  const modelEntry = MODELS.find(m => m.id === convoModelId) ?? MODELS[0];
                  const userPlan = usageData?.plan ?? "free";
                  const outOfPlan = convoModelId
                    ? !(ALLOWED_MODELS_CLIENT[userPlan] ?? ["claude-haiku-4-5"]).includes(convoModelId)
                    : false;
                  const planDefault = MODELS.find(m => m.id === PLAN_DEFAULT_MODEL_ID) ?? MODELS[0];
                  return (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium select-none"
                      style={{
                        background: outOfPlan ? "rgba(255,209,102,0.08)" : "rgba(124,107,255,0.12)",
                        border: `1px solid ${outOfPlan ? "rgba(255,209,102,0.3)" : "rgba(124,107,255,0.3)"}`,
                        color: outOfPlan ? "#f0c040" : "#a89fff",
                        cursor: "default",
                      }}
                      title={outOfPlan ? t("chat.modelOutOfPlan", { model: modelEntry.label, plan: userPlan, planModel: planDefault.label }) : modelEntry.label}
                    >
                      {outOfPlan && <span className="text-[11px] leading-none">⚠️</span>}
                      {modelEntry.label}
                    </div>
                  );
                })()}
                {lastSgiDelta !== null && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      background: lastSgiDelta > 0 ? "rgba(6,214,160,0.12)" : lastSgiDelta < 0 ? "rgba(247,37,133,0.12)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${lastSgiDelta > 0 ? "rgba(6,214,160,0.3)" : lastSgiDelta < 0 ? "rgba(247,37,133,0.3)" : "rgba(255,255,255,0.1)"}`,
                      color: lastSgiDelta > 0 ? "#06d6a0" : lastSgiDelta < 0 ? "#f72585" : "#9090b8",
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    SGI {lastSgiDelta > 0 ? "+" : ""}{lastSgiDelta.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Out-of-plan model banner */}
            {(() => {
              const convoModelId = (activeConvo as any)?.model as string | undefined;
              const userPlan = usageData?.plan ?? "free";
              if (!convoModelId || !activeConvo) return null;
              const allowed = (ALLOWED_MODELS_CLIENT[userPlan] ?? ["claude-haiku-4-5"]).includes(convoModelId);
              if (allowed) return null;
              const convoModelLabel = MODELS.find(m => m.id === convoModelId)?.label ?? convoModelId;
              const planDefaultLabel = MODELS.find(m => m.id === PLAN_DEFAULT_MODEL_ID)?.label ?? "Claude Haiku 4";
              return (
                <div className="px-6 pt-3 flex-shrink-0">
                  <div
                    className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
                    style={{ background: "rgba(255,209,102,0.06)", border: "1px solid rgba(255,209,102,0.2)" }}
                  >
                    <span className="text-sm leading-none mt-0.5 flex-shrink-0">⚠️</span>
                    <p style={{ color: "#f0c040", lineHeight: 1.6 }}>
                      {t("chat.modelOutOfPlan", { model: convoModelLabel, plan: userPlan, planModel: planDefaultLabel })}
                    </p>
                  </div>
                </div>
              );
            })()}
            {/* Messages */}
            <div data-clarity-mask="true" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {convoLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-3/4" />
                  <Skeleton className="h-12 w-1/2 ml-auto" />
                </div>
              ) : messages.length === 0 && !streamingContent ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <p className="text-sm text-muted-foreground">{t("chat.placeholder")}</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const isLastAI = msg.role === "assistant" && idx === messages.length - 1 && !isStreaming;
                    return (
                      <div key={msg.id} data-testid={`message-${msg.id}`}>
                        <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          {msg.role === "assistant" && (
                            <div
                              className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                              style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)" }}
                            >
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="max-w-[76%]">
                            <div
                              className="px-4 py-3 rounded-[14px] text-sm"
                              style={
                                msg.role === "user"
                                  ? { background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff", lineHeight: "1.7" }
                                  : { background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)", color: "#eeeeff" }
                              }
                            >
                              <MarkdownMessage content={msg.content} isUser={msg.role === "user"} />
                            </div>
                            {/* SGI update bubble on last AI message */}
                            {isLastAI && lastSgiDelta !== null && (
                              <div className="sgi-update">
                                <Zap className="w-3 h-3 flex-shrink-0" />
                                <span>{t("chat.sgiUpdate")} {lastSgiDelta > 0 ? "+" : ""}{lastSgiDelta.toFixed(2)}</span>
                                {lastDomains.slice(0, 3).map((d) => (
                                  <span key={d} className="sgi-tag">{d.replace(/_/g, " ")}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {msg.role === "user" && (
                            <div
                              className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                              style={{ background: "linear-gradient(135deg, #06d6a0, #04a87a)" }}
                            >
                              <User className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)" }}
                      >
                        <Bot className="w-4 h-4 text-white animate-pulse" />
                      </div>
                      <div
                        className="max-w-[76%] px-4 py-3 rounded-[14px] text-sm"
                        style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)", color: "#eeeeff" }}
                      >
                        <MarkdownMessage content={streamingContent} />
                        <span className="animate-pulse ml-0.5" style={{ color: "#7c6bff" }}>▍</span>
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)" }}
                      >
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div
                        className="flex items-center gap-1 px-4 py-3 rounded-[14px]"
                        style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  )}
                  {/* Progress card banner — only shown for POSITIVE trends (every 5th
                      scored message). Negative trends are never surfaced here; they
                      remain dashboard-only, matching the battle-card share pattern. */}
                  {progressCard && progressCard.isPositive && (
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mx-1"
                      style={{ background: "rgba(6,214,160,0.08)", border: "1px solid rgba(6,214,160,0.3)" }}
                    >
                      <div className="flex items-center gap-2 text-sm min-w-0" style={{ color: "#4eeec0" }}>
                        <TrendingUp className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {t("progressCard.positiveBanner", { delta: progressCard.deltaPct })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setLocation(`/progress-card/${progressCard.id}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-[opacity,transform] duration-100 hover:opacity-80 active:scale-[0.94]"
                          style={{
                            background: "rgba(6,214,160,0.2)",
                            border: "1px solid rgba(6,214,160,0.4)",
                            color: "#4eeec0",
                          }}
                        >
                          {t("progressCard.shareCta")}
                        </button>
                        <button
                          onClick={() => setProgressCard(null)}
                          aria-label={t("progressCard.dismiss")}
                          className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                          style={{ color: "#4eeec0" }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Stream error banner + retry */}
                  {streamErrored && (
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mx-1"
                      style={{ background: "rgba(247,37,133,0.08)", border: "1px solid rgba(247,37,133,0.25)" }}
                    >
                      <div className="flex items-center gap-2 text-sm" style={{ color: "#f72585" }}>
                        <span className="text-base">⚠</span>
                        <span>{t("chat.streamError")}</span>
                      </div>
                      {lastInputRef.current && (
                        <button
                          onClick={handleRetry}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-[opacity,transform] duration-100 hover:opacity-80 active:scale-[0.94]"
                          style={{
                            background: "rgba(247,37,133,0.2)",
                            border: "1px solid rgba(247,37,133,0.4)",
                            color: "#f72585",
                          }}
                        >
                          {t("chat.retryLastMsg")}
                        </button>
                      )}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-border">
              <div className="flex gap-3 items-end">
                <Textarea
                  data-clarity-mask="true"
                  data-testid="input-chat-message"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chat.placeholder")}
                  className="resize-none min-h-[56px] max-h-[200px] bg-background border-border focus-visible:ring-primary/50"
                  disabled={isStreaming || limitBlocked}
                  rows={2}
                />
                <Button
                  data-testid="button-send-message"
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || limitBlocked}
                  className="h-14 px-4 flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Cmd+Enter to send • Each exchange updates your SGI score</p>
            </div>
          </>
        )}
      </Card>
      </div>
    </div>
  );
}

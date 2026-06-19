import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
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
import { MessageSquarePlus, Trash2, Send, Bot, User, TrendingUp, TrendingDown, Minus, Zap, ChevronDown, Lock } from "lucide-react";

const MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4", provider: "Anthropic", badge: "Most Capable" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4", provider: "Anthropic", badge: "Balanced" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4", provider: "Anthropic", badge: "Fast" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", badge: "" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", badge: "" },
] as const;
type ModelId = typeof MODELS[number]["id"];

const API_BASE = "/api";

export default function Chat() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>("claude-opus-4-8");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastSgiDelta, setLastSgiDelta] = useState<number | null>(null);
  const [lastDomains, setLastDomains] = useState<string[]>([]);
  const [limitBlocked, setLimitBlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: usageData, refetch: refetchUsage } = useQuery<{
    used: number; limit: number; remaining: number; plan: string; totalCostCents: number;
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
    staleTime: 30_000,
  });

  const { data: conversations, isLoading: convosLoading } = useListOpenaiConversations();
  const { data: activeConvo, isLoading: convoLoading } = useGetOpenaiConversation(activeConvoId!, {
    query: { enabled: !!activeConvoId, queryKey: getGetOpenaiConversationQueryKey(activeConvoId!) }
  });
  const createConvo = useCreateOpenaiConversation();
  const deleteConvo = useDeleteOpenaiConversation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages, streamingContent]);

  const handleNewConversation = useCallback(async (model?: ModelId) => {
    const chosenModel = model ?? selectedModel;
    createConvo.mutate({ data: { title: "Exploration", model: chosenModel } }, {
      onSuccess: (convo) => {
        qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setActiveConvoId(convo.id);
        setLastSgiDelta(null);
        setLastDomains([]);
      },
      onError: () => toast.error("Failed to create conversation"),
    });
  }, [createConvo, qc, selectedModel]);

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
      onError: () => toast.error("Failed to delete conversation"),
    });
  }, [deleteConvo, qc, activeConvoId]);

  const handleSend = useCallback(async () => {
    if (!activeConvoId || !input.trim() || isStreaming) return;
    const content = input.trim();
    setInput("");
    setStreamingContent("");
    setIsStreaming(true);
    setLastSgiDelta(null);

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
        setLimitBlocked(true);
        toast.error(`Limite mensile raggiunto (${err.used ?? "?"}/${err.limit ?? "?"} messaggi). Passa a Premium.`);
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
              setLastSgiDelta(parsed.sgiDelta ?? null);
              setLastDomains(parsed.domains ?? []);
              if (parsed.sgiDelta > 0) {
                toast.success(`SGI +${parsed.sgiDelta.toFixed(2)} pts`);
              }
              if (parsed.usage) {
                qc.setQueryData(["openai-usage"], parsed.usage);
                if (parsed.usage.remaining === 0) setLimitBlocked(true);
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
      toast.error("Failed to send message");
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
    <div className="flex h-[calc(100vh-4rem)] gap-4 animate-in fade-in duration-300">
      {/* Sidebar */}
      <div className="w-64 flex flex-col gap-2 flex-shrink-0">
        <Button
          onClick={handleNewConversation}
          className="w-full gap-2"
          variant="outline"
          data-testid="button-new-conversation"
          disabled={createConvo.isPending || limitBlocked}
        >
          <MessageSquarePlus className="w-4 h-4" />
          New Exploration
        </Button>

        {/* Usage counter */}
        {usageData && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#9090b8" }}>
              <span>{usageData.used}/{usageData.limit} msg questo mese</span>
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
            {usageData.remaining <= 5 && usageData.remaining > 0 && (
              <p className="text-xs mt-1" style={{ color: "#f72585" }}>
                Solo {usageData.remaining} messaggi rimasti
              </p>
            )}
          </div>
        )}

        {/* Upgrade banner when blocked */}
        {limitBlocked && (
          <div
            className="rounded-xl p-3 text-center flex flex-col gap-2"
            style={{ background: "rgba(247,37,133,0.08)", border: "1px solid rgba(247,37,133,0.25)" }}
          >
            <Lock className="w-4 h-4 mx-auto" style={{ color: "#f72585" }} />
            <p className="text-xs font-medium" style={{ color: "#f72585" }}>Limite mensile raggiunto</p>
            <p className="text-xs" style={{ color: "#9090b8" }}>Passa a Premium per continuare a esplorare</p>
            <button
              className="text-xs py-1.5 px-3 rounded-full font-semibold mt-1 transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg, #7c6bff, #f72585)", color: "#fff" }}
              onClick={() => toast.info("Premium in arrivo presto!")}
            >
              Upgrade a Premium
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {convosLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : conversations?.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-8 px-2">No conversations yet. Start a new exploration.</p>
          ) : (
            conversations?.map(c => (
              <div
                key={c.id}
                data-testid={`button-conversation-${c.id}`}
                onClick={() => { setActiveConvoId(c.id); setLastSgiDelta(null); }}
                className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
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
              <p className="text-lg font-medium">No conversation selected</p>
              <p className="text-sm text-muted-foreground mt-1">Start a new exploration or select an existing one.</p>
            </div>
            <Button onClick={handleNewConversation} data-testid="button-start-exploration">
              Start New Exploration
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
                {/* Model selector */}
                <div className="relative">
                  <button
                    onClick={() => setModelDropdownOpen(o => !o)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{ background: "rgba(124,107,255,0.12)", border: "1px solid rgba(124,107,255,0.3)", color: "#a89fff" }}
                  >
                    {(MODELS.find(m => m.id === ((activeConvo as any)?.model ?? selectedModel)) ?? MODELS[0]).label}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {modelDropdownOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 w-56 rounded-xl overflow-hidden z-50 shadow-xl"
                      style={{ background: "#12142a", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m.id); setModelDropdownOpen(false); }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                          style={{ color: selectedModel === m.id ? "#a89fff" : "#9090b8" }}
                        >
                          <div>
                            <div className="font-medium text-xs" style={{ color: "inherit" }}>{m.label}</div>
                            <div className="text-xs opacity-60">{m.provider}</div>
                          </div>
                          {m.badge && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,107,255,0.2)", color: "#a89fff" }}>{m.badge}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {convoLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-3/4" />
                  <Skeleton className="h-12 w-1/2 ml-auto" />
                </div>
              ) : messages.length === 0 && !streamingContent ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <p className="text-sm text-muted-foreground">Begin the exploration. The depth of your inquiry shapes your semantic trajectory.</p>
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
                              className="px-4 py-3 rounded-[14px] text-sm leading-[1.7] whitespace-pre-wrap"
                              style={
                                msg.role === "user"
                                  ? { background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff" }
                                  : { background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)", color: "#eeeeff" }
                              }
                            >
                              {msg.content}
                            </div>
                            {/* SGI update bubble on last AI message */}
                            {isLastAI && lastSgiDelta !== null && (
                              <div className="sgi-update">
                                <Zap className="w-3 h-3 flex-shrink-0" />
                                <span>SGI {lastSgiDelta > 0 ? "+" : ""}{lastSgiDelta.toFixed(2)}</span>
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
                        className="max-w-[76%] px-4 py-3 rounded-[14px] text-sm leading-[1.7]"
                        style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)", color: "#eeeeff" }}
                      >
                        <p className="whitespace-pre-wrap">{streamingContent}<span className="animate-pulse ml-0.5">▍</span></p>
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
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-border">
              <div className="flex gap-3 items-end">
                <Textarea
                  data-testid="input-chat-message"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Explore an idea, challenge an assumption, make a connection..."
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
  );
}

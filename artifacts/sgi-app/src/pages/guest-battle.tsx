import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Swords, Send, Loader2, AlertCircle, ChevronRight, ArrowLeft, Clock, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

const PURPLE = "#7c6bff";
const PINK   = "#f72585";
const TEAL   = "#06d6a0";
const GOLD   = "#ffd166";
const MUTED  = "rgba(255,255,255,0.4)";
const GUEST_MAX_TURNS = 4;
const MIN_CHARS       = 30;

interface SessionMessage { role: "user" | "assistant"; content: string; timestamp: string }

interface CompletedResult {
  outcome: "win" | "loss" | "tie";
  myRawScore: number;
  aiRawScore: number;
  reasoning: string;
  opponentMessages: SessionMessage[];
  guestId: string;
}

type Phase = "loading" | "error" | "active" | "completing" | "completed";

function guestFetch(path: string, init?: RequestInit) {
  return fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function GuestBattlePage() {
  const { t, i18n } = useTranslation();

  const [phase, setPhase]           = useState<Phase>("loading");
  const [errorCode, setErrorCode]   = useState<string>("");
  const [matchId, setMatchId]       = useState<string>("");
  const [theme, setTheme]           = useState<string>("");
  const [category, setCategory]     = useState<string>("");
  const [messages, setMessages]     = useState<SessionMessage[]>([]);
  const [turnsLeft, setTurnsLeft]   = useState<number>(GUEST_MAX_TURNS);
  const [timeLeft, setTimeLeft]     = useState<number>(390);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [input, setInput]           = useState<string>("");
  const [sending, setSending]       = useState<boolean>(false);
  const [result, setResult]         = useState<CompletedResult | null>(null);
  const [guestId, setGuestId]       = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Countdown timer
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timerRunning, timeLeft]);

  // Start the battle on mount
  useEffect(() => {
    guestFetch("/battles/guest/start", { method: "POST", body: JSON.stringify({ lang: i18n.language }) })
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { code?: string };
          setErrorCode(body.code ?? "GENERIC");
          setPhase("error");
          return;
        }
        const data = await r.json() as {
          matchId: string; theme: string; category: string;
          messages: SessionMessage[]; turnsLeft: number;
          startedAt: string | null; guestId: string;
        };
        setMatchId(data.matchId);
        setTheme(data.theme);
        setCategory(data.category);
        setMessages(data.messages ?? []);
        setTurnsLeft(data.turnsLeft ?? GUEST_MAX_TURNS);
        setGuestId(data.guestId ?? "");
        if (data.startedAt) {
          const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
          setTimeLeft(Math.max(0, 390 - elapsed));
          setTimerRunning(true);
        }
        setPhase("active");
      })
      .catch(() => { setErrorCode("GENERIC"); setPhase("error"); });
  }, []);

  const handleSend = useCallback(async () => {
    if (sending || input.trim().length < MIN_CHARS || turnsLeft <= 0) return;
    setSending(true);
    try {
      const r = await guestFetch(`/battles/guest/${matchId}/turn`, {
        method: "POST", body: JSON.stringify({ content: input.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { code?: string };
        if (body.code === "TIME_UP") { setTimeLeft(0); setTurnsLeft(0); }
        if (body.code === "BUDGET_EXHAUSTED") {
          setErrorCode("BUDGET_EXHAUSTED");
          setPhase("error");
        }
        setSending(false);
        return;
      }
      const data = await r.json() as {
        messages: SessionMessage[]; timeRemaining: number; turnsLeft: number;
      };
      setMessages(data.messages);
      setTimeLeft(data.timeRemaining);
      setTurnsLeft(data.turnsLeft);
      setTimerRunning(true);
      setInput("");
      if (data.turnsLeft <= 0) textareaRef.current?.blur();
    } catch { /* ignore */ }
    setSending(false);
  }, [sending, input, turnsLeft, matchId]);

  const handleComplete = useCallback(async () => {
    setPhase("completing");
    try {
      const r = await guestFetch(`/battles/guest/${matchId}/complete`, { method: "POST" });
      if (!r.ok) { setPhase("active"); return; }
      const data = await r.json() as CompletedResult;
      // Store guestId for post-signup claim
      if (data.guestId) localStorage.setItem("sgi-guest-claim", data.guestId);
      setResult(data);
      setPhase("completed");
    } catch { setPhase("active"); }
  }, [matchId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !sending) { e.preventDefault(); void handleSend(); }
  };

  const charCount = input.length;
  const canSend   = charCount >= MIN_CHARS && !sending && turnsLeft > 0 && timeLeft > 0;
  const canFinish = messages.filter(m => m.role === "user").length >= 1 && phase === "active";

  const outcomeColor = result?.outcome === "win" ? TEAL : result?.outcome === "tie" ? GOLD : PINK;
  const outcomeLabel = result?.outcome === "win"
    ? t("guestBattle.win") : result?.outcome === "tie"
    ? t("guestBattle.tie") : t("guestBattle.loss");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(var(--background, 240 15% 8%))", color: "#eeeeff" }}>

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Link href="/" className="flex items-center gap-1.5 text-xs" style={{ color: MUTED, textDecoration: "none" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> {t("guestBattle.back")}
        </Link>
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4" style={{ color: PINK }} />
          <span className="text-sm font-semibold">{t("guestBattle.title")}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(247,37,133,0.15)", color: PINK, border: "1px solid rgba(247,37,133,0.3)" }}>
            {t("guestBattle.guestBadge")}
          </span>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col gap-4">

          {/* ── LOADING ── */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-4 py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: PURPLE }} />
              <p className="text-sm" style={{ color: MUTED }}>{t("guestBattle.loading")}</p>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <AlertCircle className="w-10 h-10" style={{ color: PINK }} />
              <div>
                <p className="text-base font-semibold mb-1">
                  {errorCode === "RATE_LIMIT" ? t("guestBattle.rateLimited")
                   : errorCode === "BUDGET_EXHAUSTED" ? t("guestBattle.budgetExhausted")
                   : t("guestBattle.genericError")}
                </p>
                {errorCode !== "RATE_LIMIT" && errorCode !== "BUDGET_EXHAUSTED" && (
                  <button
                    className="mt-3 text-sm underline"
                    style={{ color: PURPLE }}
                    onClick={() => window.location.reload()}
                  >
                    {t("guestBattle.retry")}
                  </button>
                )}
              </div>
              <Link href="/sign-up">
                <button className="text-xs px-4 py-2 rounded-lg" style={{ background: "rgba(124,107,255,0.15)", border: "1px solid rgba(124,107,255,0.4)", color: PURPLE }}>
                  {t("guestBattle.saveCTA")} <ChevronRight className="inline w-3 h-3" />
                </button>
              </Link>
            </div>
          )}

          {/* ── ACTIVE ── */}
          {(phase === "active" || phase === "completing") && (
            <>
              {/* Theme card */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(124,107,255,0.08)", border: "1px solid rgba(124,107,255,0.2)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,107,255,0.2)", color: PURPLE }}>
                    {t(`battles.categories.${category}`, { defaultValue: category })}
                  </span>
                  <span className="text-[10px]" style={{ color: MUTED }}>{t("guestBattle.theme")}</span>
                </div>
                <p className="text-sm leading-relaxed font-medium">{theme}</p>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between text-xs" style={{ color: MUTED }}>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span style={{ color: timeLeft < 60 ? PINK : "inherit" }}>{fmtTime(timeLeft)}</span>
                </span>
                <span>{t("guestBattle.turnN", { n: GUEST_MAX_TURNS - turnsLeft, max: GUEST_MAX_TURNS })}</span>
              </div>

              {/* Messages */}
              {messages.length > 0 && (
                <div data-clarity-mask="true" className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
                        {m.role === "user" ? t("guestBattle.youLabel") : t("guestBattle.sparringLabel")}
                      </span>
                      <div className="max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed" style={{
                        background: m.role === "user" ? "rgba(124,107,255,0.18)" : "rgba(255,255,255,0.05)",
                        border: m.role === "user" ? "1px solid rgba(124,107,255,0.3)" : "1px solid rgba(255,255,255,0.07)",
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {messages.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: MUTED }}>{t("guestBattle.firstMove")}</p>
              )}

              {/* Input area */}
              {phase === "active" && (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                  <textarea
                    data-clarity-mask="true"
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("guestBattle.placeholder")}
                    disabled={turnsLeft <= 0 || timeLeft <= 0 || sending}
                    rows={4}
                    className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm outline-none"
                    style={{ color: "#eeeeff" }}
                  />
                  <div className="flex items-center justify-between px-4 pb-3">
                    <span className="text-[11px]" style={{ color: charCount > 0 && charCount < MIN_CHARS ? PINK : MUTED }}>
                      {charCount > 0 && charCount < MIN_CHARS
                        ? t("guestBattle.minChars", { n: MIN_CHARS })
                        : turnsLeft <= 0 ? t("guestBattle.maxTurns")
                        : <>{charCount} {t("guestBattle.charUnit")}<span className="hidden md:inline"> · ⌘↵</span></>}
                    </span>
                    <button
                      onClick={() => void handleSend()}
                      disabled={!canSend}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
                      style={{
                        background: canSend ? `rgba(124,107,255,0.25)` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${canSend ? "rgba(124,107,255,0.5)" : "rgba(255,255,255,0.08)"}`,
                        color: canSend ? PURPLE : MUTED,
                        cursor: canSend ? "pointer" : "not-allowed",
                      }}
                    >
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {sending ? "…" : t("guestBattle.send")}
                    </button>
                  </div>
                </div>
              )}

              {/* Complete button */}
              {phase === "active" && canFinish && (
                <button
                  onClick={() => void handleComplete()}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all"
                  style={{ background: "rgba(6,214,160,0.12)", border: "1px solid rgba(6,214,160,0.35)", color: TEAL }}
                >
                  {t("guestBattle.finish")} <ChevronRight className="inline w-4 h-4 ml-1" />
                </button>
              )}

              {/* Completing spinner */}
              {phase === "completing" && (
                <div className="flex items-center justify-center gap-3 py-6">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: PURPLE }} />
                  <span className="text-sm" style={{ color: MUTED }}>{t("guestBattle.finishing")}</span>
                </div>
              )}
            </>
          )}

          {/* ── COMPLETED ── */}
          {phase === "completed" && result && (
            <div className="flex flex-col gap-5">
              {/* Outcome badge */}
              <div className="flex flex-col items-center py-8 gap-3">
                <Trophy className="w-10 h-10" style={{ color: outcomeColor }} />
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: outcomeColor }}>
                  {outcomeLabel}
                </h1>
              </div>

              {/* Score comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(124,107,255,0.1)", border: "1px solid rgba(124,107,255,0.25)" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>{t("guestBattle.yourScore")}</p>
                  <p className="text-4xl font-extrabold" style={{ color: PURPLE }}>{result.myRawScore}</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>{t("guestBattle.aiScore")}</p>
                  <p className="text-4xl font-extrabold" style={{ color: MUTED }}>{result.aiRawScore}</p>
                </div>
              </div>

              {/* Verdict */}
              {result.reasoning && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>{t("guestBattle.verdict")}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#cfcfe6" }}>{result.reasoning}</p>
                </div>
              )}

              {/* Sign-up CTA — shown ONLY post-score (zero-attrition approach) */}
              <div className="rounded-2xl p-6 text-center" style={{ background: "linear-gradient(135deg, rgba(124,107,255,0.15), rgba(247,37,133,0.1))", border: "1px solid rgba(124,107,255,0.3)" }}>
                <p className="text-base font-bold mb-1">{t("guestBattle.saveTitle")}</p>
                <p className="text-xs mb-4" style={{ color: MUTED }}>{t("guestBattle.saveSub")}</p>
                <Link href={`/sign-up?claimGuest=${guestId}`}>
                  <button className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, rgba(124,107,255,0.4), rgba(247,37,133,0.3))", border: "1px solid rgba(124,107,255,0.5)", color: "#eeeeff" }}>
                    {t("guestBattle.saveCTA")} <ChevronRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/guest-battle">
                  <button
                    className="mt-3 text-xs underline"
                    style={{ color: MUTED }}
                    onClick={() => window.location.reload()}
                  >
                    {t("guestBattle.tryAgain")}
                  </button>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

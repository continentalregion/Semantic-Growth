import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Swords, Brain, Trophy, ArrowLeft, Crown, Zap, Clock, Send,
  Loader2, Users, ChevronDown, Hourglass, Bot,
} from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";

const API_BASE = "/api";
const MIN_CHARS = 10;
const AI_OFFER_AFTER_MS = 25_000;
const AI_USERNAME = "Avversario AI";

type AiLevel = "sfidante" | "pensatore" | "maestro";

type Role = "user" | "assistant";
interface Msg { role: Role; content: string; timestamp?: string }

interface MatchResult {
  outcome: "win" | "loss" | "tie";
  myRawScore: number;
  opponentRawScore: number;
  reasoning: string;
  xpAwarded: number;
  opponentMessages: Msg[];
  opponentUsername: string;
}

interface MatchView {
  matchId: string;
  status: "waiting" | "active" | "scoring" | "completed" | "abandoned";
  theme: string;
  category: string;
  createdAt: string;
  waitingSince: string | null;
  vsAi: boolean;
  aiLevel: AiLevel | null;
  mySlot: 1 | 2;
  myEntryStatus: "matched" | "in_progress" | "completed" | "forfeit";
  startedAt: string | null;
  timeRemaining: number;
  turnWindowSeconds: number;
  myMessages: Msg[];
  opponentPresent: boolean;
  opponentUsername: string | null;
  opponentCompleted: boolean;
  result: MatchResult | null;
}

const PURPLE = "#7c6bff";
const TEAL = "#06d6a0";
const PINK = "#f72585";
const GOLD = "#ffd166";
const MUTED = "#9090b8";
const BG = "#08090f";

function fmt(s: number) {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function timerColor(s: number) {
  if (s > 120) return TEAL;
  if (s > 30) return GOLD;
  return PINK;
}

function Collapsible({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: accent }}>{title}</span>
        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: MUTED, transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Conversation({ messages, t }: { messages: Msg[]; t: (k: string) => string }) {
  if (messages.length === 0) {
    return <p className="text-xs" style={{ color: MUTED }}>—</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) => {
        const mine = m.role === "user";
        return (
          <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm"
              style={{
                background: mine ? "rgba(124,107,255,0.14)" : "rgba(247,37,133,0.10)",
                border: `1px solid ${mine ? "rgba(124,107,255,0.25)" : "rgba(247,37,133,0.2)"}`,
                color: "#eeeeff",
              }}
            >
              <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: mine ? "#a89fff" : "#f78fbf" }}>
                {mine ? t("battle.you") : t("battle.sparringName")}
              </div>
              <MarkdownMessage content={m.content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BattleSessionPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { t } = useTranslation();

  const [view, setView] = useState<MatchView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(390);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showAiOffer, setShowAiOffer] = useState(false);
  const [acceptingAi, setAcceptingAi] = useState(false);

  const arenaInit = useRef(false);
  const completing = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
        ...(init?.headers ?? {}),
      },
    });
  }, [getToken]);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const r = await authedFetch(`/battles/matches/${matchId}`);
      if (!r.ok) { setLoadError(true); return; }
      const data: MatchView = await r.json();
      setView(data);
      if (data.status === "active" && data.myEntryStatus === "in_progress" && !arenaInit.current) {
        arenaInit.current = true;
        setMessages(data.myMessages ?? []);
        setSecondsLeft(data.timeRemaining);
      }
    } catch {
      setLoadError(true);
    }
  }, [matchId, authedFetch]);

  const handleComplete = useCallback(async () => {
    if (completing.current) return;
    completing.current = true;
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/complete`, { method: "POST" });
      if (r.ok) { const data: MatchView = await r.json(); setView(data); }
      else { await load(); }
    } catch {
      await load();
    } finally {
      completing.current = false;
    }
  }, [authedFetch, matchId, load]);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/start`, { method: "POST" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "");
      }
      const data: MatchView = await r.json();
      arenaInit.current = true;
      setMessages(data.myMessages ?? []);
      setSecondsLeft(data.timeRemaining);
      setView(data);
    } catch (e: any) {
      toast.error(e.message || t("battle.startError"));
      await load();
    } finally {
      setStarting(false);
    }
  }, [authedFetch, matchId, starting, load, t]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (content.length < MIN_CHARS || sending || secondsLeft <= 0) return;
    setSending(true);
    const optimistic: Msg = { role: "user", content };
    setMessages(m => [...m, optimistic]);
    setInput("");
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/turn`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      if (r.status === 409) {
        const e = await r.json().catch(() => ({}));
        if (e.code === "TIME_UP") { toast.message(t("battle.timeUp")); await handleComplete(); return; }
        throw new Error(e.error ?? "");
      }
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? ""); }
      const data: { reply: string; messages: Msg[]; timeRemaining: number } = await r.json();
      setMessages(data.messages);
      setSecondsLeft(data.timeRemaining);
    } catch (e: any) {
      toast.error(e.message || t("battle.sendError"));
      setMessages(m => m.filter(x => x !== optimistic));
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, sending, secondsLeft, authedFetch, matchId, handleComplete, t]);

  const handleAiJoin = useCallback(async (level: AiLevel) => {
    if (acceptingAi || !matchId || !view) return;
    setAcceptingAi(true);
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/ai-join`, {
        method: "POST",
        body: JSON.stringify({ level, theme: view.theme }),
      });
      if (r.status === 409) {
        // A human joined while the user was deciding — dismiss offer and continue.
        setShowAiOffer(false);
        await load();
        return;
      }
      if (!r.ok) throw new Error("ai-join failed");
      const data: MatchView = await r.json();
      setShowAiOffer(false);
      setView(data);
    } catch {
      toast.error(t("battle.aiJoinError") ?? "Errore — riprova.");
    } finally {
      setAcceptingAi(false);
    }
  }, [acceptingAi, matchId, view, authedFetch, load, t]);

  // Show AI offer after AI_OFFER_AFTER_MS of waiting.
  useEffect(() => {
    if (!view?.waitingSince || view.status !== "waiting") return;
    const elapsed = Date.now() - new Date(view.waitingSince).getTime();
    const remaining = Math.max(0, AI_OFFER_AFTER_MS - elapsed);
    if (remaining === 0) { setShowAiOffer(true); return; }
    const t = setTimeout(() => setShowAiOffer(true), remaining);
    return () => clearTimeout(t);
  }, [view?.waitingSince, view?.status]);

  useEffect(() => { load(); }, [load]);

  const phase: "loading" | "error" | "waitingOpponent" | "abandoned" | "result" | "scoring" | "waitingResult" | "ready" | "arena" =
    !view
      ? (loadError ? "error" : "loading")
      : view.status === "waiting" ? "waitingOpponent"
      : view.status === "abandoned" ? "abandoned"
      : view.status === "completed" ? "result"
      : view.status === "scoring" ? "scoring"
      : (view.myEntryStatus === "completed" || view.myEntryStatus === "forfeit") ? "waitingResult"
      : view.myEntryStatus === "matched" ? "ready"
      : "arena";

  // Poll passive phases.
  useEffect(() => {
    if (phase !== "waitingOpponent" && phase !== "scoring" && phase !== "waitingResult") return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [phase, load]);

  // Local countdown for the active arena; auto-complete at zero.
  useEffect(() => {
    if (phase !== "arena") return;
    if (secondsLeft <= 0) { handleComplete(); return; }
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [phase, secondsLeft, handleComplete]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const backBtn = (
    <button
      onClick={() => setLocation("/battles")}
      className="flex items-center gap-2 text-sm mb-6"
      style={{ color: MUTED }}
    >
      <ArrowLeft className="w-4 h-4" /> {t("battle.back")}
    </button>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: PURPLE }} />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: BG }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          {backBtn}
          <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-sm" style={{ color: MUTED }}>{t("battle.notFound")}</p>
          </div>
        </div>
      </div>
    );
  }

  const v = view!;
  const themeBlock = (
    <div className="rounded-2xl p-6 mb-5" style={{ background: "rgba(124,107,255,0.07)", border: "1px solid rgba(124,107,255,0.2)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: PINK }}>{v.category}</span>
      <h2 className="text-xl font-bold font-display leading-snug mt-1" style={{ color: "#eeeeff" }}>{v.theme}</h2>
    </div>
  );

  // ── Waiting for an opponent ──────────────────────────────────────────────────
  if (phase === "waitingOpponent") {
    const AI_LEVELS: { level: AiLevel; label: string; desc: string; color: string }[] = [
      { level: "sfidante", label: "🟢 Sfidante", desc: "Argomento semplice, un punto principale", color: TEAL },
      { level: "pensatore", label: "🟡 Pensatore", desc: "Struttura discreta, due punti distinti", color: GOLD },
      { level: "maestro",   label: "🔴 Maestro",   desc: "Denso, multi-punto, altamente persuasivo", color: PINK },
    ];
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: BG }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          {backBtn}
          {themeBlock}
          <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Users className="w-10 h-10" style={{ color: PURPLE }} />
                <Loader2 className="w-5 h-5 animate-spin absolute -right-2 -bottom-1" style={{ color: TEAL }} />
              </div>
            </div>
            <h1 className="text-lg font-bold font-display mb-2" style={{ color: "#eeeeff" }}>{t("battle.waitingTitle")}</h1>
            <p className="text-sm max-w-md mx-auto" style={{ color: MUTED, lineHeight: 1.7 }}>{t("battle.waitingDesc")}</p>
          </div>

          {showAiOffer && (
            <div className="mt-4 rounded-2xl p-6" style={{ background: "rgba(255,209,102,0.06)", border: "1px solid rgba(255,209,102,0.25)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-5 h-5" style={{ color: GOLD }} />
                <h2 className="text-base font-bold font-display" style={{ color: "#eeeeff" }}>
                  Nessun avversario umano trovato
                </h2>
              </div>
              <p className="text-sm mb-5" style={{ color: MUTED }}>
                Sfida l'Avversario AI — scegli il livello di difficoltà:
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {AI_LEVELS.map(({ level, label, desc, color }) => (
                  <button
                    key={level}
                    onClick={() => handleAiJoin(level)}
                    disabled={acceptingAi}
                    className="flex-1 rounded-xl px-4 py-3 text-left transition-all"
                    style={{
                      background: `${color}10`,
                      border: `1px solid ${color}40`,
                      opacity: acceptingAi ? 0.6 : 1,
                    }}
                  >
                    <div className="font-bold text-sm mb-0.5" style={{ color }}>{label}</div>
                    <div className="text-[11px]" style={{ color: MUTED }}>{desc}</div>
                    {acceptingAi && <Loader2 className="w-3.5 h-3.5 animate-spin mt-1" style={{ color }} />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAiOffer(false)}
                className="text-xs w-full text-center py-1.5"
                style={{ color: MUTED }}
              >
                Continua ad aspettare un umano
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Abandoned ────────────────────────────────────────────────────────────────
  if (phase === "abandoned") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: BG }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          {backBtn}
          <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Hourglass className="w-9 h-9 mx-auto mb-4" style={{ color: MUTED }} />
            <h1 className="text-lg font-bold font-display mb-2" style={{ color: "#eeeeff" }}>{t("battle.abandonedTitle")}</h1>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: MUTED, lineHeight: 1.7 }}>{t("battle.abandonedDesc")}</p>
            <button
              onClick={() => setLocation("/battles")}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff" }}
            >
              {t("battle.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready (matched, not yet started) ─────────────────────────────────────────
  if (phase === "ready") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: BG }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          {backBtn}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(6,214,160,0.12)", border: "1px solid rgba(6,214,160,0.25)" }}>
              <Swords className="w-5 h-5" style={{ color: TEAL }} />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display" style={{ color: "#eeeeff" }}>{t("battle.readyTitle")}</h1>
              <p className="text-[11px]" style={{ color: MUTED }}>{t("battle.opponentLabel")}: {v.opponentUsername ?? t("battle.opponentLabel")}</p>
            </div>
          </div>
          {themeBlock}
          <div className="rounded-xl p-4 mb-5 flex gap-3" style={{ background: "rgba(6,214,160,0.05)", border: "1px solid rgba(6,214,160,0.15)" }}>
            <Brain className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: TEAL }} />
            <p className="text-xs" style={{ color: "#cfcfe6", lineHeight: 1.7 }}>{t("battle.readyDesc")}</p>
          </div>
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #f72585, #b5179e)", color: "#fff", opacity: starting ? 0.6 : 1 }}
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
            {t("battle.startBtn")}
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting for opponent's result (I finished) ───────────────────────────────
  if (phase === "waitingResult" || phase === "scoring") {
    const scoring = phase === "scoring";
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: BG }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          {backBtn}
          {themeBlock}
          <div className="rounded-2xl p-8 text-center mb-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Loader2 className="w-9 h-9 mx-auto mb-4 animate-spin" style={{ color: PURPLE }} />
            <h1 className="text-lg font-bold font-display mb-2" style={{ color: "#eeeeff" }}>
              {scoring ? t("battle.scoringTitle") : t("battle.completedTitle")}
            </h1>
            <p className="text-sm max-w-md mx-auto" style={{ color: MUTED, lineHeight: 1.7 }}>
              {scoring ? t("battle.scoringDesc") : t("battle.waitingResultDesc")}
            </p>
          </div>
          <Collapsible title={t("battle.yourConvo")} accent={PURPLE}>
            <Conversation messages={(v.myMessages ?? [])} t={t} />
          </Collapsible>
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  if (phase === "result" && v.result) {
    const res = v.result;
    const isWin = res.outcome === "win";
    const isTie = res.outcome === "tie";
    const color = isWin ? TEAL : isTie ? GOLD : PINK;
    const label = isWin ? t("battle.win") : isTie ? t("battle.tie") : t("battle.loss");
    const isAi = v.vsAi || res.opponentUsername === AI_USERNAME;
    const aiLevelLabel: Record<string, string> = {
      sfidante: "Sfidante", pensatore: "Pensatore", maestro: "Maestro",
    };
    const levelDisplay = v.aiLevel ? aiLevelLabel[v.aiLevel] ?? v.aiLevel : null;
    const sub = isWin
      ? (isAi && levelDisplay ? `Hai battuto l'AI — livello ${levelDisplay}` : t("battle.winSub"))
      : isTie
      ? t("battle.tieSub")
      : (isAi && levelDisplay ? `Sconfitta vs AI — livello ${levelDisplay}` : t("battle.lossSub"));
    const opponentColor = isAi ? GOLD : PINK;
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: BG }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          {backBtn}

          <div className="rounded-2xl p-6 mb-5 text-center" style={{ background: `${color}12`, border: `1px solid ${color}40` }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {isWin ? <Crown className="w-6 h-6" style={{ color }} /> : <Swords className="w-6 h-6" style={{ color }} />}
              <h1 className="text-2xl font-black font-display" style={{ color }}>{label}</h1>
            </div>
            {isAi && levelDisplay && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mt-2 mb-1"
                style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40` }}>
                <Bot className="w-3.5 h-3.5" style={{ color: GOLD }} />
                <span className="text-xs font-bold" style={{ color: GOLD }}>vs AI — {levelDisplay}</span>
              </div>
            )}
            {(!isAi || !levelDisplay) && <p className="text-sm" style={{ color: MUTED }}>{sub}</p>}
            {isAi && levelDisplay && <p className="text-sm mt-1" style={{ color: MUTED }}>{sub}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl p-5 text-center relative" style={{ background: isWin ? "rgba(6,214,160,0.08)" : "rgba(255,255,255,0.02)", border: isWin ? "1px solid rgba(6,214,160,0.3)" : "1px solid rgba(255,255,255,0.07)" }}>
              {isWin && <Crown className="w-4 h-4 absolute top-3 right-3" style={{ color: GOLD }} />}
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>{t("battle.you")}</p>
              <p className="text-4xl font-black font-display" style={{ color: isWin ? TEAL : "#eeeeff" }}>{res.myRawScore.toFixed(0)}</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>/100 SGI</p>
            </div>
            <div className="rounded-2xl p-5 text-center relative" style={{ background: res.outcome === "loss" ? `${opponentColor}14` : "rgba(255,255,255,0.02)", border: res.outcome === "loss" ? `1px solid ${opponentColor}40` : "1px solid rgba(255,255,255,0.07)" }}>
              {res.outcome === "loss" && <Crown className="w-4 h-4 absolute top-3 right-3" style={{ color: GOLD }} />}
              <div className="flex items-center justify-center gap-1 mb-1">
                {isAi && <Bot className="w-3 h-3 flex-shrink-0" style={{ color: opponentColor }} />}
                <p className="text-[10px] uppercase tracking-widest truncate" style={{ color: isAi ? opponentColor : MUTED }}>{res.opponentUsername}</p>
              </div>
              <p className="text-4xl font-black font-display" style={{ color: res.outcome === "loss" ? opponentColor : "#eeeeff" }}>{res.opponentRawScore.toFixed(0)}</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>/100 SGI</p>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-5 flex items-center gap-2" style={{ background: "rgba(124,107,255,0.08)", border: "1px solid rgba(124,107,255,0.2)" }}>
            <Zap className="w-5 h-5" style={{ color: GOLD }} />
            <span className="text-lg font-black" style={{ color: GOLD }}>+{res.xpAwarded} XP</span>
            <span className="text-xs ml-1" style={{ color: MUTED }}>{t("battle.xpEarned")}</span>
          </div>

          {res.reasoning && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4" style={{ color: GOLD }} />
                <h2 className="text-sm font-bold" style={{ color: "#eeeeff" }}>{t("battle.verdict")}</h2>
              </div>
              <p className="text-sm" style={{ color: "#cfcfe6", lineHeight: 1.7 }}>{res.reasoning}</p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <Collapsible title={t("battle.yourConvo")} accent={PURPLE}>
              <Conversation messages={v.myMessages ?? []} t={t} />
            </Collapsible>
            <Collapsible title={`${t("battle.opponentConvo")} · ${res.opponentUsername}`} accent={opponentColor}>
              <Conversation messages={res.opponentMessages ?? []} t={t} />
            </Collapsible>
          </div>

          <button
            onClick={() => setLocation("/battles")}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff" }}
          >
            {t("battle.back")}
          </button>
        </div>
      </div>
    );
  }

  // ── Arena (active turn-based conversation) ───────────────────────────────────
  const chars = input.trim().length;
  const timeUp = secondsLeft <= 0;
  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-[820px] mx-auto">
          <div className="flex items-center justify-between gap-3 mb-2">
            <button onClick={() => setLocation("/battles")} className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
              <ArrowLeft className="w-3.5 h-3.5" /> {t("battle.back")}
            </button>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold tabular-nums"
              style={{ background: `${timerColor(secondsLeft)}1a`, border: `1px solid ${timerColor(secondsLeft)}55`, color: timerColor(secondsLeft) }}
            >
              <Clock className="w-3.5 h-3.5" />
              {fmt(secondsLeft)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest flex-shrink-0" style={{ color: PINK }}>{v.category}</span>
            <p className="text-sm font-semibold truncate" style={{ color: "#eeeeff" }}>{v.theme}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-[820px] mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-3 text-center">
              <Brain className="w-9 h-9" style={{ color: PURPLE }} />
              <p className="text-sm max-w-sm" style={{ color: MUTED, lineHeight: 1.7 }}>{t("battle.firstMove")}</p>
            </div>
          ) : (
            <Conversation messages={messages} t={t} />
          )}
          {sending && (
            <div className="flex justify-start mt-3">
              <div className="rounded-2xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: "rgba(247,37,133,0.10)", border: "1px solid rgba(247,37,133,0.2)" }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: PINK }} />
                <span className="text-xs" style={{ color: MUTED }}>{t("battle.sparringName")}…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-[820px] mx-auto">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); } }}
              placeholder={t("battle.placeholder")}
              disabled={timeUp || sending}
              rows={2}
              className="flex-1 bg-transparent text-sm outline-none resize-none rounded-xl px-3 py-2.5"
              style={{ color: "#eeeeff", lineHeight: 1.6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", minHeight: 56, maxHeight: 160 }}
            />
            <button
              onClick={handleSend}
              disabled={chars < MIN_CHARS || sending || timeUp}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: chars >= MIN_CHARS && !sending && !timeUp ? "linear-gradient(135deg, #f72585, #b5179e)" : "rgba(255,255,255,0.06)", color: chars >= MIN_CHARS && !sending && !timeUp ? "#fff" : MUTED, opacity: chars >= MIN_CHARS && !sending && !timeUp ? 1 : 0.6 }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px]" style={{ color: chars > 0 && chars < MIN_CHARS ? PINK : MUTED }}>
              {chars > 0 && chars < MIN_CHARS ? t("battle.minChars") : ""}
            </span>
            <button
              onClick={handleComplete}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", color: MUTED, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {t("battle.finishBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

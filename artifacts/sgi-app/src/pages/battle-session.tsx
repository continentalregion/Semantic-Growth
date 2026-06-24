import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@clerk/react";
import { toast } from "sonner";
import { Swords, Brain, Sparkles, Trophy, ArrowLeft, ChevronDown, Crown, Zap } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";

const API_BASE = "/api";
const MIN_CHARS = 10;

interface MetricComparison {
  key: string;
  label: string;
  user: number;
  ai: number;
  diff: number;
  winner: "user" | "ai" | "tie";
}

interface AnswerScore {
  dimensions: Record<string, number>;
  macroDimensions: Record<string, number>;
  domains: string[];
  rawScore: number;
}

interface BattleResult {
  question: string;
  category: string;
  userAnswer: string;
  aiAnswer: string;
  user: AnswerScore;
  ai: AnswerScore;
  outcome: {
    winner: "user" | "ai" | "tie";
    userRawScore: number;
    aiRawScore: number;
    margin: number;
    metricComparison: MetricComparison[];
    aiAdvantages: MetricComparison[];
    userStrengths: MetricComparison[];
  };
  reward: { tier: "win" | "loss" | "tie"; xpAwarded: number; eligibleForWinBadge: boolean };
  battleId: string | null;
  xp: number | null;
  level: number | null;
  badgeAwarded: string | null;
}

const PURPLE = "#7c6bff";
const TEAL = "#06d6a0";
const PINK = "#f72585";
const GOLD = "#ffd166";
const MUTED = "#9090b8";

function MetricRow({ m }: { m: MetricComparison }) {
  const userColor = m.winner === "user" ? TEAL : PURPLE;
  return (
    <div className="py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: "#eeeeff" }}>{m.label}</span>
        {m.winner === "tie" ? (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: MUTED }}>pari</span>
        ) : (
          <span
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold flex items-center gap-1"
            style={{
              background: m.winner === "user" ? "rgba(6,214,160,0.14)" : "rgba(247,37,133,0.14)",
              color: m.winner === "user" ? TEAL : PINK,
            }}
          >
            {m.winner === "user" ? "Tu" : "AI"} +{Math.abs(m.diff).toFixed(1)}
          </span>
        )}
      </div>
      {/* User bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] w-7 flex-shrink-0" style={{ color: MUTED }}>Tu</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(m.user / 10) * 100}%`, background: userColor }} />
        </div>
        <span className="text-[10px] font-bold w-7 text-right flex-shrink-0" style={{ color: userColor }}>{m.user.toFixed(1)}</span>
      </div>
      {/* AI bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] w-7 flex-shrink-0" style={{ color: MUTED }}>AI</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(m.ai / 10) * 100}%`, background: "rgba(247,37,133,0.55)" }} />
        </div>
        <span className="text-[10px] font-bold w-7 text-right flex-shrink-0" style={{ color: "rgba(247,37,133,0.85)" }}>{m.ai.toFixed(1)}</span>
      </div>
    </div>
  );
}

function Collapsible({ title, children, accent }: { title: string; children: React.ReactNode; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <span className="text-sm font-semibold" style={{ color: accent }}>{title}</span>
        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: MUTED, transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm" style={{ color: "#cfcfe6", lineHeight: "1.7" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function BattleSessionPage() {
  const { id: threadId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"compose" | "evaluating" | "result">("compose");
  const [result, setResult] = useState<BattleResult | null>(null);

  useEffect(() => {
    getToken().then(token => {
      fetch(`${API_BASE}/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      })
        .then(r => r.json())
        .then(d => {
          setQuestion(d.question ?? "");
          setCategory(d.category ?? "");
        })
        .catch(() => {});
    });
  }, [threadId]);

  async function handleSubmit() {
    if (answer.trim().length < MIN_CHARS || phase === "evaluating") return;
    setPhase("evaluating");
    try {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/threads/${threadId}/battle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ userAnswer: answer.trim() }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Valutazione fallita");
      }
      const data: BattleResult = await r.json();
      setResult(data);
      setPhase("result");
    } catch (e: any) {
      toast.error(e.message ?? "Errore nella valutazione");
      setPhase("compose");
    }
  }

  function reset() {
    setAnswer("");
    setResult(null);
    setPhase("compose");
  }

  // ── Result phase ───────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const { outcome, reward } = result;
    const isWin = outcome.winner === "user";
    const isTie = outcome.winner === "tie";
    const bannerColor = isWin ? TEAL : isTie ? GOLD : PINK;
    const bannerLabel = isWin ? "Vittoria" : isTie ? "Pareggio" : "Sconfitta";
    const bannerSub = isWin
      ? "Hai battuto l'AI su questa domanda."
      : isTie
        ? "Testa a testa con l'AI."
        : "L'AI ha avuto la meglio — ma hai comunque guadagnato XP.";

    return (
      <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
        <div className="max-w-[760px] mx-auto px-6 py-8">
          <button
            onClick={() => setLocation(`/threads/${threadId}`)}
            className="flex items-center gap-2 text-sm mb-6"
            style={{ color: MUTED }}
          >
            <ArrowLeft className="w-4 h-4" /> Torna al Thread
          </button>

          {/* Winner banner */}
          <div
            className="rounded-2xl p-6 mb-5 text-center"
            style={{ background: `${bannerColor}12`, border: `1px solid ${bannerColor}40` }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              {isWin ? <Crown className="w-6 h-6" style={{ color: bannerColor }} /> : <Swords className="w-6 h-6" style={{ color: bannerColor }} />}
              <h1 className="text-2xl font-black font-display" style={{ color: bannerColor }}>{bannerLabel}</h1>
            </div>
            <p className="text-sm" style={{ color: MUTED }}>{bannerSub}</p>
          </div>

          {/* Score duel */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div
              className="rounded-2xl p-5 text-center relative"
              style={{
                background: isWin ? "rgba(6,214,160,0.08)" : "rgba(255,255,255,0.02)",
                border: isWin ? "1px solid rgba(6,214,160,0.3)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {isWin && <Crown className="w-4 h-4 absolute top-3 right-3" style={{ color: GOLD }} />}
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>Tu</p>
              <p className="text-4xl font-black font-display" style={{ color: isWin ? TEAL : "#eeeeff" }}>{outcome.userRawScore.toFixed(1)}</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>/100 SGI</p>
            </div>
            <div
              className="rounded-2xl p-5 text-center relative"
              style={{
                background: outcome.winner === "ai" ? "rgba(247,37,133,0.08)" : "rgba(255,255,255,0.02)",
                border: outcome.winner === "ai" ? "1px solid rgba(247,37,133,0.3)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {outcome.winner === "ai" && <Crown className="w-4 h-4 absolute top-3 right-3" style={{ color: GOLD }} />}
              <p className="text-[10px] uppercase tracking-widest mb-1 flex items-center justify-center gap-1" style={{ color: MUTED }}>
                <Sparkles className="w-3 h-3" /> SGI · AI
              </p>
              <p className="text-4xl font-black font-display" style={{ color: outcome.winner === "ai" ? PINK : "#eeeeff" }}>{outcome.aiRawScore.toFixed(1)}</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>/100 SGI</p>
            </div>
          </div>

          {/* Reward */}
          <div
            className="rounded-2xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3"
            style={{ background: "rgba(124,107,255,0.08)", border: "1px solid rgba(124,107,255,0.2)" }}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: GOLD }} />
              <div>
                <span className="text-lg font-black" style={{ color: GOLD }}>+{reward.xpAwarded} XP</span>
                {result.level != null && (
                  <span className="text-xs ml-2" style={{ color: MUTED }}>Livello {result.level}</span>
                )}
              </div>
            </div>
            {result.badgeAwarded === "battle_victor" && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,209,102,0.14)", border: "1px solid rgba(255,209,102,0.3)" }}>
                <Trophy className="w-4 h-4" style={{ color: GOLD }} />
                <span className="text-xs font-bold" style={{ color: GOLD }}>Nuovo badge: Battle Victor</span>
              </div>
            )}
          </div>

          {/* Per-metric breakdown */}
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4" style={{ color: PURPLE }} />
              <h2 className="text-sm font-bold" style={{ color: "#eeeeff" }}>Analisi per metrica</h2>
              <span className="text-[10px]" style={{ color: MUTED }}>— stesso motore SGI per entrambe le risposte</span>
            </div>
            <div>
              {outcome.metricComparison.map(m => <MetricRow key={m.key} m={m} />)}
            </div>
          </div>

          {/* Strengths / weaknesses */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl p-4" style={{ background: "rgba(6,214,160,0.06)", border: "1px solid rgba(6,214,160,0.18)" }}>
              <p className="text-xs font-bold mb-2" style={{ color: TEAL }}>I tuoi punti di forza</p>
              {outcome.userStrengths.length > 0 ? (
                <ul className="space-y-1">
                  {outcome.userStrengths.slice(0, 4).map(m => (
                    <li key={m.key} className="text-[11px] flex items-center justify-between" style={{ color: "#cfcfe6" }}>
                      <span>{m.label}</span>
                      <span className="font-bold" style={{ color: TEAL }}>+{Math.abs(m.diff).toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px]" style={{ color: MUTED }}>L'AI ti ha superato in tutte le metriche stavolta.</p>
              )}
            </div>
            <div className="rounded-2xl p-4" style={{ background: "rgba(247,37,133,0.06)", border: "1px solid rgba(247,37,133,0.18)" }}>
              <p className="text-xs font-bold mb-2" style={{ color: PINK }}>Dove migliorare</p>
              {outcome.aiAdvantages.length > 0 ? (
                <ul className="space-y-1">
                  {outcome.aiAdvantages.slice(0, 4).map(m => (
                    <li key={m.key} className="text-[11px] flex items-center justify-between" style={{ color: "#cfcfe6" }}>
                      <span>{m.label}</span>
                      <span className="font-bold" style={{ color: PINK }}>+{Math.abs(m.diff).toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px]" style={{ color: MUTED }}>Hai battuto l'AI ovunque. Notevole.</p>
              )}
            </div>
          </div>

          {/* Answers */}
          <div className="space-y-3 mb-6">
            <Collapsible title="Risposta dell'AI" accent={PINK}>
              <MarkdownMessage content={result.aiAnswer} />
            </Collapsible>
            <Collapsible title="La tua risposta" accent={PURPLE}>
              <MarkdownMessage content={result.userAnswer} />
            </Collapsible>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setLocation(`/threads/${threadId}`)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: MUTED, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Torna al Thread
            </button>
            {isWin && (
              <button
                onClick={() => setLocation("/battles")}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "rgba(255,209,102,0.14)", color: GOLD, border: "1px solid rgba(255,209,102,0.3)" }}
              >
                <Trophy className="w-4 h-4" /> Vedi nel Feed
              </button>
            )}
            <button
              onClick={reset}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff" }}
            >
              Nuova sfida
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Compose / evaluating phase ───────────────────────────────────────────────
  const evaluating = phase === "evaluating";
  const chars = answer.trim().length;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
      <div className="max-w-[760px] mx-auto px-6 py-8">
        <button
          onClick={() => setLocation(`/threads/${threadId}`)}
          className="flex items-center gap-2 text-sm mb-6"
          style={{ color: MUTED }}
          disabled={evaluating}
        >
          <ArrowLeft className="w-4 h-4" /> Torna al Thread
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f7258522, #b5179e22)", border: "1px solid rgba(247,37,133,0.25)" }}>
            <Swords className="w-5 h-5" style={{ color: PINK }} />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display" style={{ color: "#eeeeff" }}>Sfida l'AI</h1>
            <p className="text-[11px]" style={{ color: MUTED }}>Tu contro l'AI sulla stessa domanda · niente timer</p>
          </div>
        </div>

        {/* Question */}
        <div
          className="rounded-2xl p-6 mb-5"
          style={{ background: "rgba(124,107,255,0.07)", border: "1px solid rgba(124,107,255,0.2)" }}
        >
          {category && (
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: PINK }}>{category}</span>
          )}
          <h2 className="text-xl font-bold font-display leading-snug mt-1" style={{ color: "#eeeeff" }}>
            {question || "Caricamento…"}
          </h2>
        </div>

        {/* Calm instructions */}
        <div
          className="rounded-xl p-4 mb-4 flex gap-3"
          style={{ background: "rgba(6,214,160,0.05)", border: "1px solid rgba(6,214,160,0.15)" }}
        >
          <Brain className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: TEAL }} />
          <p className="text-xs" style={{ color: "#cfcfe6", lineHeight: "1.7" }}>
            Prenditi il tempo che ti serve — <strong style={{ color: TEAL }}>nessun cronometro</strong>. Scrivi la tua risposta più
            profonda e originale. L'AI risponderà alla stessa domanda e un <strong style={{ color: "#eeeeff" }}>unico motore SGI</strong> valuterà
            entrambe sulle stesse 11 metriche. Vinci e ottieni XP alti e un badge; anche perdendo guadagni XP.
          </p>
        </div>

        {/* Answer composer */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Sviluppa il tuo ragionamento: collega concetti tra domini diversi, vai in profondità, sii originale…"
            disabled={evaluating}
            className="w-full bg-transparent text-sm outline-none resize-none"
            style={{ color: "#eeeeff", minHeight: 220, lineHeight: "1.7" }}
          />
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[10px]" style={{ color: chars < MIN_CHARS ? PINK : MUTED }}>
              {chars < MIN_CHARS ? `Almeno ${MIN_CHARS} caratteri` : `${chars} caratteri`}
            </span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={chars < MIN_CHARS || evaluating}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: chars >= MIN_CHARS && !evaluating ? "linear-gradient(135deg, #f72585, #b5179e)" : "rgba(255,255,255,0.06)",
            color: chars >= MIN_CHARS && !evaluating ? "#fff" : MUTED,
            opacity: chars >= MIN_CHARS && !evaluating ? 1 : 0.6,
          }}
        >
          {evaluating ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              L'AI sta rispondendo e il motore SGI sta valutando…
            </>
          ) : (
            <>
              <Swords className="w-4 h-4" /> Invia e affronta l'AI
            </>
          )}
        </button>

        {evaluating && (
          <p className="text-center text-[11px] mt-3" style={{ color: MUTED }}>
            Può richiedere qualche secondo — l'AI genera una risposta forte e poi entrambe vengono valutate insieme.
          </p>
        )}
      </div>
    </div>
  );
}

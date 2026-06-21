import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@clerk/react";
import { toast } from "sonner";
import { Send, Clock, Zap, Brain, Network, Target, AlertTriangle } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";

const API_BASE = "/api";
const BATTLE_DURATION = 4 * 60; // 4 minutes in seconds
const WARNING_THRESHOLD = 60; // 1 minute left

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Score {
  density: number;
  connections: number;
  depth: number;
  total: number;
  explanation: string;
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(144,144,184,0.6)" }}>{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(value / max) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function BattleSessionPage() {
  const { id: threadId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [score, setScore] = useState<Score>({ density: 0, connections: 0, depth: 0, total: 0, explanation: "" });
  const [timeLeft, setTimeLeft] = useState(BATTLE_DURATION);
  const [timerActive, setTimerActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [threadQuestion, setThreadQuestion] = useState("");
  const [battleCardId, setBattleCardId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load thread info
  useEffect(() => {
    getToken().then(token => {
      fetch(`${API_BASE}/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      }).then(r => r.json()).then(d => {
        setThreadQuestion(d.question ?? "");
      });
    });
  }, [threadId]);

  // Timer
  useEffect(() => {
    if (!timerActive || completed) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, completed]);

  // Start timer on first message
  useEffect(() => {
    if (messages.length > 0 && !timerActive && !completed) {
      setTimerActive(true);
    }
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleComplete = useCallback(async () => {
    if (completed || completing) return;
    setCompleting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/threads/${threadId}/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await r.json();
      setCompleted(true);
      setScore({
        density: data.scoreDensity ?? 0,
        connections: data.scoreConnections ?? 0,
        depth: data.scoreDepth ?? 0,
        total: data.scoreTotal ?? 0,
        explanation: data.scoreExplanation ?? "",
      });
      if (data.battleCardId) setBattleCardId(data.battleCardId);
    } catch (e) {
      console.error("[battle] complete error", e);
    } finally {
      setCompleting(false);
    }
  }, [completed, completing, threadId, sessionId]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || completed) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const token = await Promise.race([
        getToken(),
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error("Token timeout")), 3000)),
      ]);

      const r = await fetch(`${API_BASE}/threads/${threadId}/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!r.ok || !r.body) throw new Error("Errore nella risposta");

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === "content") {
              fullResponse += parsed.text;
              setStreamingContent(fullResponse);
            } else if (parsed.type === "score") {
              setScore({
                density: parsed.density ?? 0,
                connections: parsed.connections ?? 0,
                depth: parsed.depth ?? 0,
                total: parsed.total ?? 0,
                explanation: parsed.explanation ?? "",
              });
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: fullResponse }]);
      setStreamingContent("");
    } catch (e: any) {
      toast.error(e.message ?? "Errore nella comunicazione");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const timePct = timeLeft / BATTLE_DURATION;
  const isWarning = timeLeft <= WARNING_THRESHOLD && timeLeft > 0;
  const timerColor = timeLeft === 0 ? "#f72585" : isWarning ? "#ffd166" : "#06d6a0";

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#08090f" }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: "rgba(10,11,24,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex-1 min-w-0 mr-4">
          <p className="text-[10px] uppercase tracking-widest mb-0.5 flex items-center gap-1" style={{ color: "#f72585" }}>
            <Zap className="w-3 h-3" /> Slot Battaglia
          </p>
          <p className="text-sm font-semibold truncate" style={{ color: "#eeeeff" }}>{threadQuestion}</p>
        </div>

        {/* Timer */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl flex-shrink-0"
          style={{
            background: `${timerColor}14`,
            border: `1px solid ${timerColor}44`,
          }}
        >
          <Clock className="w-3.5 h-3.5" style={{ color: timerColor }} />
          <span className="text-lg font-bold font-mono" style={{ color: timerColor }}>{timeStr}</span>
          {isWarning && <AlertTriangle className="w-3.5 h-3.5 animate-pulse" style={{ color: timerColor }} />}
        </div>

        {/* Score summary */}
        <div
          className="flex items-center gap-2 ml-4 px-4 py-2 rounded-xl flex-shrink-0"
          style={{ background: "rgba(124,107,255,0.1)", border: "1px solid rgba(124,107,255,0.2)" }}
        >
          <span className="text-[10px] uppercase tracking-widest" style={{ color: "#9090b8" }}>SGI</span>
          <span className="text-xl font-bold" style={{ color: "#a89fff" }}>{score.total}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {messages.length === 0 && !completed && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, #f7258522, #b5179e22)", border: "1px solid rgba(247,37,133,0.2)" }}
                >
                  <Zap className="w-7 h-7" style={{ color: "#f72585" }} />
                </div>
                <h3 className="text-base font-bold mb-2 font-display" style={{ color: "#eeeeff" }}>
                  Il timer parte al tuo primo messaggio
                </h3>
                <p className="text-sm max-w-sm" style={{ color: "#9090b8" }}>
                  Hai 4 minuti per esplorare la domanda con l'AI. L'obiettivo è attraversare il maggior numero di concetti, collegandoli in modo logicamente coerente.
                </p>
                <div className="flex gap-4 mt-5 text-xs" style={{ color: "#9090b8" }}>
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" style={{ color: "#7c6bff" }} />
                    Densità concettuale
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5" style={{ color: "#06d6a0" }} />
                    Qualità connessioni
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" style={{ color: "#a89fff" }} />
                    Profondità
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "linear-gradient(135deg, #f72585, #b5179e)" }}
                  >
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className="max-w-[76%] px-4 py-3 rounded-[14px] text-sm"
                  style={
                    msg.role === "user"
                      ? { background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff", lineHeight: "1.7" }
                      : { background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)", color: "#eeeeff" }
                  }
                >
                  <MarkdownMessage content={msg.content} isUser={msg.role === "user"} />
                </div>
              </div>
            ))}

            {isStreaming && streamingContent && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "linear-gradient(135deg, #f72585, #b5179e)" }}>
                  <Zap className="w-3.5 h-3.5 text-white animate-pulse" />
                </div>
                <div className="max-w-[76%] px-4 py-3 rounded-[14px] text-sm" style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <MarkdownMessage content={streamingContent} />
                  <span className="animate-pulse ml-0.5" style={{ color: "#f72585" }}>▍</span>
                </div>
              </div>
            )}

            {isStreaming && !streamingContent && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #f72585, #b5179e)" }}>
                  <Zap className="w-3.5 h-3.5 text-white animate-pulse" />
                </div>
                <div className="px-4 py-3 rounded-[14px] flex items-center gap-1.5" style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#f72585", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Completed overlay */}
          {completed && (
            <div
              className="mx-5 mb-4 p-5 rounded-2xl"
              style={{ background: "rgba(6,214,160,0.07)", border: "1px solid rgba(6,214,160,0.25)" }}
            >
              <h3 className="font-bold text-base mb-1" style={{ color: "#06d6a0" }}>⚔ Battaglia completata!</h3>
              <p className="text-sm mb-4" style={{ color: "#9090b8" }}>{score.explanation || "Sessione completata."}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setLocation(`/threads/${threadId}`)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#9090b8", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Torna al Thread
                </button>
                {battleCardId && (
                  <button
                    onClick={() => setLocation(`/battle-cards/${battleCardId}`)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: "linear-gradient(135deg, #ffd166, #f4a261)", color: "#0a0b18" }}
                  >
                    🏆 Vedi Battle Card
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          {!completed && (
            <div
              className="px-4 pb-4 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div
                className="flex items-end gap-3 p-3 rounded-xl mt-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder={timeLeft === 0 ? "Tempo scaduto…" : "Ragiona ad alta voce…"}
                  disabled={isStreaming || timeLeft === 0 || completing}
                  className="flex-1 bg-transparent text-sm outline-none resize-none"
                  style={{ color: "#eeeeff", maxHeight: 120, minHeight: 36 }}
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || timeLeft === 0 || completing}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: input.trim() && !isStreaming && timeLeft > 0 ? "linear-gradient(135deg, #f72585, #b5179e)" : "rgba(255,255,255,0.06)",
                    opacity: input.trim() && !isStreaming && timeLeft > 0 ? 1 : 0.4,
                  }}
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {!timerActive && (
                <p className="text-center text-[10px] mt-2" style={{ color: "#9090b8" }}>
                  Il timer parte automaticamente al tuo primo messaggio
                </p>
              )}
            </div>
          )}
        </div>

        {/* Score sidebar */}
        <div
          className="w-[200px] flex-shrink-0 flex flex-col p-4 gap-4"
          style={{ background: "rgba(10,11,24,0.8)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(144,144,184,0.5)" }}>
              SGI Score Live
            </p>
            <div className="text-center py-3 rounded-xl mb-4" style={{ background: "rgba(124,107,255,0.08)", border: "1px solid rgba(124,107,255,0.15)" }}>
              <span className="text-3xl font-bold font-display" style={{ color: "#a89fff" }}>{score.total}</span>
              <span className="text-xs block mt-0.5" style={{ color: "rgba(144,144,184,0.5)" }}>/99</span>
            </div>
            <div className="space-y-3">
              <ScoreBar label="Densità" value={score.density} max={33} color="#7c6bff" />
              <ScoreBar label="Connessioni" value={score.connections} max={33} color="#06d6a0" />
              <ScoreBar label="Profondità" value={score.depth} max={33} color="#f72585" />
            </div>
          </div>

          {score.explanation && (
            <div className="rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#9090b8" }}>
              {score.explanation}
            </div>
          )}

          {/* Timer arc */}
          <div className="mt-auto flex flex-col items-center gap-2">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke={timerColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - timePct)}`}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold font-mono" style={{ color: timerColor }}>{timeStr}</span>
              </div>
            </div>
            {!completed && messages.length > 0 && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="text-[10px] px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9090b8" }}
              >
                {completing ? "…" : "Termina"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

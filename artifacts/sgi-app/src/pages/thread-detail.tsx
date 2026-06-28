import { useLocation, useParams } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Swords, Trophy, Network, Flame, Brain } from "lucide-react";

const API_BASE = "/api";

interface ThreadDetail {
  id: string;
  question: string;
  description?: string;
  category: string;
  createdByUsername?: string;
  knowledgeBase: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
  totalSessions: number;
  sessions: Array<{
    id: string; username: string; scoreTotal: number; scoreDensity: number;
    scoreConnections: number; scoreDepth: number; durationSeconds: number;
    connectionsCount: number; endedAt: string;
  }>;
  mySession: { id: string; status: string; scoreTotal: number; startedAt: string } | null;
  battleCardId: string | null;
}

async function fetchThread(id: string, token: string): Promise<ThreadDetail> {
  const r = await fetch(`${API_BASE}/threads/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Thread non trovato");
  return r.json();
}

export default function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const { data: thread, isLoading } = useQuery({
    queryKey: ["thread", id],
    queryFn: async () => {
      const token = await getToken();
      return fetchThread(id!, token ?? "");
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#08090f" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7c6bff", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
      <div className="max-w-[820px] mx-auto px-6 py-8">

        {/* Back */}
        <button
          onClick={() => setLocation("/threads")}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: "#9090b8" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#eeeeff"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9090b8"}
        >
          <ArrowLeft className="w-4 h-4" />
          Thread Aperti
        </button>

        {/* Thread question */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "rgba(124,107,255,0.07)", border: "1px solid rgba(124,107,255,0.2)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4" style={{ color: "#f72585" }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f72585" }}>
                  Thread Aperto
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#9090b8" }}>
                  {thread.category}
                </span>
              </div>
              <h1 className="text-xl font-bold font-display leading-snug mb-2" style={{ color: "#eeeeff" }}>
                {thread.question}
              </h1>
              {thread.description && (
                <p className="text-sm" style={{ color: "#9090b8" }}>{thread.description}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold" style={{ color: "#7c6bff" }}>{thread.totalSessions}</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "#9090b8" }}>sessioni</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Battle CTA → PvP */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4" style={{ color: "#f72585" }} />
              <span className="text-sm font-semibold" style={{ color: "#eeeeff" }}>Battaglie 1-contro-1</span>
            </div>
            <p className="text-xs mb-4" style={{ color: "#9090b8" }}>
              Le battaglie ora sono tra utenti reali: vieni abbinato automaticamente a un altro pensatore e avete 6:30 ciascuno per costruire la conversazione più densa e convincente.
            </p>

            <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: "#9090b8" }}>
              <Brain className="w-3.5 h-3.5" />
              Matchmaking automatico · 6:30 a testa · XP e badge
            </div>

            <button
              onClick={() => setLocation("/battles")}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #f72585, #b5179e)", color: "#fff" }}
            >
              ⚔ Vai alle Battaglie
            </button>
          </div>

          {/* Battle card / knowledge base */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(21,23,40,1)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {thread.battleCardId ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4" style={{ color: "#ffd166" }} />
                  <span className="text-sm font-semibold" style={{ color: "#eeeeff" }}>Battle Card disponibile</span>
                </div>
                <p className="text-xs mb-4" style={{ color: "#9090b8" }}>
                  Due giocatori si sono sfidati su questa domanda. Scopri chi ha vinto.
                </p>
                <button
                  onClick={() => setLocation(`/battle-cards/${thread.battleCardId}`)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: "rgba(255,209,102,0.12)",
                    border: "1px solid rgba(255,209,102,0.3)",
                    color: "#ffd166",
                  }}
                >
                  <Trophy className="w-4 h-4" />
                  Vedi Battle Card
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Network className="w-4 h-4" style={{ color: "#06d6a0" }} />
                  <span className="text-sm font-semibold" style={{ color: "#eeeeff" }}>Knowledge Base</span>
                </div>
                {thread.knowledgeBase?.length > 0 ? (
                  <div className="space-y-2">
                    {thread.knowledgeBase.slice(0, 3).map((conn, i) => (
                      <div key={i} className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(6,214,160,0.07)", border: "1px solid rgba(6,214,160,0.12)" }}>
                        <span style={{ color: "#a89fff" }}>{conn.concept1}</span>
                        <span style={{ color: "#9090b8" }}> ↔ </span>
                        <span style={{ color: "#06d6a0" }}>{conn.concept2}</span>
                      </div>
                    ))}
                    {thread.knowledgeBase.length > 3 && (
                      <p className="text-[10px] pl-1" style={{ color: "#9090b8" }}>+{thread.knowledgeBase.length - 3} altre connessioni</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "#9090b8" }}>
                    Le connessioni concettuali emerse durante le sessioni appaiono qui, arricchendo il thread nel tempo.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sessions leaderboard */}
        {thread.sessions.length > 0 && (
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#eeeeff" }}>
              <Trophy className="w-4 h-4" style={{ color: "#ffd166" }} />
              Classifiche Sessioni
            </h2>
            <div className="space-y-2">
              {thread.sessions.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{
                    background: i === 0 ? "rgba(255,209,102,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${i === 0 ? "rgba(255,209,102,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: i === 0 ? "rgba(255,209,102,0.2)" : "rgba(255,255,255,0.06)",
                      color: i === 0 ? "#ffd166" : "#9090b8",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <span className="text-sm font-semibold" style={{ color: "#eeeeff" }}>@{s.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: "#9090b8" }}>
                    <span>⬡ {s.scoreDensity}</span>
                    <span>⟳ {s.scoreConnections}</span>
                    <span>◉ {s.scoreDepth}</span>
                    <span className="font-bold text-sm" style={{ color: i === 0 ? "#ffd166" : "#a89fff" }}>
                      {s.scoreTotal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Flame, Brain, Network, BookOpen, Atom, Scale, Cpu, Globe, ChevronRight, Lock } from "lucide-react";

const API_BASE = "/api";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  philosophy:   { label: "Filosofia",  icon: <Brain className="w-3.5 h-3.5" />,   color: "#7c6bff" },
  science:      { label: "Scienza",    icon: <Atom className="w-3.5 h-3.5" />,    color: "#06d6a0" },
  ethics:       { label: "Etica",      icon: <Scale className="w-3.5 h-3.5" />,   color: "#f72585" },
  technology:   { label: "Tecnologia", icon: <Cpu className="w-3.5 h-3.5" />,     color: "#a89fff" },
  society:      { label: "Società",    icon: <Globe className="w-3.5 h-3.5" />,   color: "#ffd166" },
  knowledge:    { label: "Conoscenza", icon: <BookOpen className="w-3.5 h-3.5" />,color: "#06d6a0" },
  consciousness:{ label: "Coscienza",  icon: <Network className="w-3.5 h-3.5" />, color: "#7c6bff" },
};

interface ThreadSummary {
  id: string;
  question: string;
  description?: string;
  category: string;
  createdBy: string;
  createdByUsername?: string;
  totalSessions: number;
  knowledgeBaseSize: number;
  createdAt: string;
}

async function fetchThreads(token: string): Promise<ThreadSummary[]> {
  const r = await fetch(`${API_BASE}/threads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Errore nel caricamento dei thread");
  return r.json();
}

async function createThread(token: string, data: { question: string; description: string; category: string }) {
  const r = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Errore" }));
    throw new Error(err.error ?? "Errore nella creazione");
  }
  return r.json();
}

export default function ThreadsPage() {
  const { getToken } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("philosophy");
  const [filter, setFilter] = useState<string | null>(null);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const token = await getToken();
      return fetchThreads(token ?? "");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { question: string; description: string; category: string }) => {
      const token = await getToken();
      return createThread(token ?? "", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setShowCreate(false);
      setNewQ(""); setNewDesc(""); setNewCat("philosophy");
      toast.success("Thread creato!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = filter ? threads.filter(t => t.category === filter) : threads;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
      <div className="max-w-[880px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7c6bff22, #f7258522)" }}
              >
                <Flame className="w-4 h-4" style={{ color: "#f72585" }} />
              </div>
              <h1 className="text-xl font-bold font-display" style={{ color: "#eeeeff" }}>
                Thread Aperti
              </h1>
            </div>
            <p className="text-sm" style={{ color: "#9090b8" }}>
              Domande intellettuali irrisolte. Sfida un altro utente in 4 minuti di ragionamento con l'AI.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #7c6bff, #5b4de0)",
              color: "#fff",
              border: "none",
            }}
          >
            <Plus className="w-4 h-4" />
            Nuovo Thread
          </button>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter(null)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: !filter ? "rgba(124,107,255,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${!filter ? "rgba(124,107,255,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: !filter ? "#a89fff" : "#9090b8",
            }}
          >
            Tutti
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? null : key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: filter === key ? `${meta.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${filter === key ? `${meta.color}55` : "rgba(255,255,255,0.08)"}`,
                color: filter === key ? meta.color : "#9090b8",
              }}
            >
              {meta.icon}
              {meta.label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[88px] rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-3">💭</div>
            <p className="font-semibold mb-1" style={{ color: "#eeeeff" }}>Nessun thread ancora</p>
            <p className="text-sm" style={{ color: "#9090b8" }}>Crea il primo thread aperto per iniziare una battaglia intellettuale.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((thread) => {
              const cat = CATEGORY_META[thread.category] ?? CATEGORY_META.philosophy;
              return (
                <button
                  key={thread.id}
                  onClick={() => setLocation(`/threads/${thread.id}`)}
                  className="w-full text-left px-5 py-4 rounded-xl transition-all group"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(124,107,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,107,255,0.2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${cat.color}18`, color: cat.color }}
                        >
                          {cat.icon}
                          {cat.label}
                        </span>
                        {thread.knowledgeBaseSize > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(6,214,160,0.1)", color: "#06d6a0" }}>
                            {thread.knowledgeBaseSize} connessioni
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold leading-snug mb-1" style={{ color: "#eeeeff" }}>
                        {thread.question}
                      </p>
                      {thread.description && (
                        <p className="text-xs line-clamp-1" style={{ color: "#9090b8" }}>{thread.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold" style={{ color: "#eeeeff" }}>{thread.totalSessions}</div>
                        <div className="text-[10px]" style={{ color: "#9090b8" }}>sessioni</div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#7c6bff" }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create thread modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div
            className="w-full max-w-[520px] rounded-2xl p-6"
            style={{ background: "#10111e", border: "1px solid rgba(124,107,255,0.25)" }}
          >
            <h2 className="text-lg font-bold mb-1 font-display" style={{ color: "#eeeeff" }}>
              Crea un Thread Aperto
            </h2>
            <p className="text-xs mb-5" style={{ color: "#9090b8" }}>
              Una domanda senza risposta definitiva che accumula contributi nel tempo.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#a89fff" }}>
                  DOMANDA *
                </label>
                <textarea
                  value={newQ}
                  onChange={e => setNewQ(e.target.value)}
                  placeholder="Es: Esiste una forma di libertà che non dipenda dall'ignoranza?"
                  className="w-full px-3 py-2.5 rounded-lg text-sm resize-none outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#eeeeff",
                    minHeight: 80,
                  }}
                  maxLength={200}
                />
                <div className="text-right text-[10px] mt-1" style={{ color: "#9090b8" }}>{newQ.length}/200</div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#a89fff" }}>
                  DESCRIZIONE (opzionale)
                </label>
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Contesto o angolazione di partenza..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#eeeeff",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#a89fff" }}>CATEGORIA</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setNewCat(key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: newCat === key ? `${meta.color}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${newCat === key ? `${meta.color}55` : "rgba(255,255,255,0.08)"}`,
                        color: newCat === key ? meta.color : "#9090b8",
                      }}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "#9090b8", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Annulla
              </button>
              <button
                onClick={() => createMutation.mutate({ question: newQ, description: newDesc, category: newCat })}
                disabled={newQ.trim().length < 10 || createMutation.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: newQ.trim().length >= 10 ? "linear-gradient(135deg, #7c6bff, #5b4de0)" : "rgba(124,107,255,0.2)",
                  color: newQ.trim().length >= 10 ? "#fff" : "#9090b8",
                  opacity: createMutation.isPending ? 0.7 : 1,
                }}
              >
                {createMutation.isPending ? "Creazione…" : "Crea Thread"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

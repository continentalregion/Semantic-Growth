import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Flame, Brain, Network, BookOpen, Atom, Scale, Cpu, Globe, ChevronRight, Lock, Trophy, Share2 } from "lucide-react";

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

function threadTitle(t: { aiTitle?: string | null; question: string }): string {
  if (t.aiTitle && t.aiTitle.trim().length > 0) return t.aiTitle;
  return t.question.length > 80 ? `${t.question.slice(0, 80).trim()}…` : t.question;
}

interface ThreadSummary {
  id: string;
  question: string;
  aiTitle?: string | null;
  description?: string;
  category: string;
  createdBy: string;
  createdByUsername?: string;
  totalSessions: number;
  knowledgeBaseSize: number;
  createdAt: string;
  battleCardId: string | null;
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
  const { t } = useTranslation();
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
      toast.success(t("threads.successCreate"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = filter ? threads.filter(th => th.category === filter) : threads;
  const openThreads = filtered.filter(th => !th.battleCardId);
  const completedThreads = filtered.filter(th => !!th.battleCardId);

  function handleShare(battleCardId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/battle-cards/${battleCardId}`;
    navigator.clipboard.writeText(url).then(() => toast.success(t("threads.linkCopied"))).catch(() => {});
  }

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
                {t("threads.title")}
              </h1>
            </div>
            <p className="text-sm" style={{ color: "#9090b8" }}>
              {t("threads.subtitle")}
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
            {t("threads.createBtn")}
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
            {t("threads.filterAll")}
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
            <p className="text-sm" style={{ color: "#9090b8" }}>{t("threads.noThreads")}</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── Aperti ── */}
            {openThreads.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-3.5 h-3.5" style={{ color: "#f72585" }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f72585" }}>
                    {t("threads.openThreads")}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(247,37,133,0.12)", color: "#f72585" }}>
                    {openThreads.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {openThreads.map((thread) => {
                    const cat = CATEGORY_META[thread.category] ?? CATEGORY_META.philosophy!;
                    return (
                      <button
                        key={thread.id}
                        onClick={() => setLocation(`/threads/${thread.id}`)}
                        className="w-full text-left px-5 py-4 rounded-xl transition-all group"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(124,107,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,107,255,0.2)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cat.color}18`, color: cat.color }}>
                                {cat.icon}{cat.label}
                              </span>
                              {thread.createdByUsername?.startsWith("🤖") && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(247,37,133,0.1)", color: "#f72585", border: "1px solid rgba(247,37,133,0.2)" }}>
                                  🤖 {t("threads.aiGenerated")}
                                </span>
                              )}
                              {thread.knowledgeBaseSize > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(6,214,160,0.1)", color: "#06d6a0" }}>
                                  {thread.knowledgeBaseSize} {t("threads.connections")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold leading-snug mb-1" style={{ color: "#eeeeff" }}>{threadTitle(thread)}</p>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-xs font-bold" style={{ color: "#eeeeff" }}>{thread.totalSessions}</div>
                              <div className="text-[10px]" style={{ color: "#9090b8" }}>{t("threads.sessions")}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#7c6bff" }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Completati (con battle card) ── */}
            {completedThreads.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-3.5 h-3.5" style={{ color: "#f0c040" }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f0c040" }}>
                    {t("threads.completedBattles")}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(240,192,64,0.12)", color: "#f0c040" }}>
                    {completedThreads.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {completedThreads.map((thread) => {
                    const cat = CATEGORY_META[thread.category] ?? CATEGORY_META.philosophy!;
                    return (
                      <div
                        key={thread.id}
                        className="px-5 py-4 rounded-xl"
                        style={{ background: "rgba(240,192,64,0.03)", border: "1px solid rgba(240,192,64,0.12)" }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cat.color}18`, color: cat.color }}>
                                {cat.icon}{cat.label}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(240,192,64,0.12)", color: "#f0c040" }}>
                                <Trophy className="w-3 h-3" /> {t("threads.completedBadge")}
                              </span>
                            </div>
                            <p className="text-sm font-semibold leading-snug mb-1" style={{ color: "#c8c8dd" }}>{threadTitle(thread)}</p>
                            <p className="text-xs" style={{ color: "#9090b8" }}>{thread.totalSessions} {t("threads.participants")}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setLocation(`/battle-cards/${thread.battleCardId}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{ background: "rgba(240,192,64,0.12)", color: "#f0c040", border: "1px solid rgba(240,192,64,0.25)" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(240,192,64,0.22)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(240,192,64,0.12)"; }}
                            >
                              {t("threads.viewChallenge")}
                            </button>
                            <button
                              onClick={(e) => handleShare(thread.battleCardId!, e)}
                              className="p-1.5 rounded-lg transition-all"
                              title={t("threads.copyLink")}
                              style={{ background: "rgba(255,255,255,0.04)", color: "#9090b8", border: "1px solid rgba(255,255,255,0.08)" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#eeeeff"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#9090b8"; }}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
              {t("threads.createTitle")}
            </h2>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wider" style={{ color: "#a89fff" }}>
                  {t("threads.questionLabel")} *
                </label>
                <textarea
                  value={newQ}
                  onChange={e => setNewQ(e.target.value)}
                  placeholder={t("threads.questionPlaceholder")}
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
                <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wider" style={{ color: "#a89fff" }}>
                  {t("threads.descLabel")}
                </label>
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder={t("threads.descPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#eeeeff",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wider" style={{ color: "#a89fff" }}>{t("threads.categoryLabel")}</label>
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
                {t("threads.cancelBtn")}
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
                {createMutation.isPending ? "…" : t("threads.createSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Swords, Trophy, Crown, Clock, Loader2, ChevronRight, Hourglass, Zap, Users, Bot,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = "/api";

const PURPLE = "#7c6bff";
const TEAL = "#06d6a0";
const PINK = "#f72585";
const GOLD = "#ffd166";
const MUTED = "#9090b8";

const CATEGORY_COLOR: Record<string, string> = {
  philosophy: "#7c6bff",
  science: "#06d6a0",
  ethics: "#f72585",
  technology: "#a89fff",
  society: "#ffd166",
  economics: "#ffd166",
  art: "#f72585",
  history: "#a89fff",
  politics: "#06d6a0",
  knowledge: "#06d6a0",
  consciousness: "#7c6bff",
};

interface MyMatch {
  matchId: string;
  status: "waiting" | "active" | "scoring" | "completed" | "abandoned";
  theme: string;
  category: string;
  createdAt: string;
  myEntryStatus: "matched" | "in_progress" | "completed" | "forfeit";
  timeRemaining: number;
  result: "win" | "loss" | "tie" | null;
  myRawScore: number | null;
  vsAi: boolean;
  aiLevel: "sfidante" | "pensatore" | "maestro" | null;
}

interface PublicPlayer { username: string; rawScore: number; isWinner: boolean }
interface PublicMatch {
  id: string;
  createdAt: string;
  isVsAi: boolean;
  theme: string;
  category: string;
  player1: PublicPlayer;
  player2: PublicPlayer;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}g`;
}

function myStatusMeta(m: MyMatch, t: (k: string) => string): { label: string; color: string } {
  if (m.status === "waiting") return { label: t("battles.statusWaiting"), color: GOLD };
  if (m.status === "abandoned") return { label: t("battles.statusAbandoned"), color: MUTED };
  if (m.status === "scoring") return { label: t("battles.statusScoring"), color: PURPLE };
  if (m.status === "completed") {
    if (m.result === "win") return { label: t("battles.statusWin"), color: TEAL };
    if (m.result === "loss") return { label: t("battles.statusLoss"), color: PINK };
    return { label: t("battles.statusTie"), color: GOLD };
  }
  // active
  if (m.myEntryStatus === "completed" || m.myEntryStatus === "forfeit") return { label: t("battles.statusWaitingResult"), color: PURPLE };
  if (m.myEntryStatus === "in_progress") return { label: t("battles.statusInProgress"), color: TEAL };
  return { label: t("battles.statusReady"), color: TEAL };
}

export default function BattlesPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [matchmaking, setMatchmaking] = useState(false);

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

  const { data: myMatches = [], isLoading: loadingMine, refetch: refetchMine } = useQuery<MyMatch[]>({
    queryKey: ["battles-me"],
    queryFn: async () => {
      const r = await authedFetch("/battles/matches/me");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15000,
  });

  const { data: feed = [], isLoading: loadingFeed } = useQuery<PublicMatch[]>({
    queryKey: ["battles-public"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/battles/public`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const handleMatchmake = useCallback(async () => {
    if (matchmaking) return;
    setMatchmaking(true);
    try {
      const r = await authedFetch("/battles/matchmake", { method: "POST" });
      if (!r.ok) throw new Error();
      const view = await r.json();
      await refetchMine();
      setLocation(`/battles/${view.matchId}`);
    } catch {
      toast.error(t("battles.matchmakeError"));
      setMatchmaking(false);
    }
  }, [matchmaking, authedFetch, refetchMine, setLocation, t]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Swords className="w-5 h-5" style={{ color: PINK }} />
            <h1 className="text-lg font-bold" style={{ color: "#eeeeff" }}>{t("battles.title")}</h1>
          </div>
          <p className="text-xs opacity-40">{t("battles.pvpSubtitle")}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-[820px] mx-auto flex flex-col gap-7">

          {/* Matchmaking CTA */}
          <button
            onClick={handleMatchmake}
            disabled={matchmaking}
            className="w-full rounded-2xl px-6 py-5 flex items-center justify-between gap-4 transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(247,37,133,0.18), rgba(124,107,255,0.18))",
              border: "1px solid rgba(247,37,133,0.3)",
              opacity: matchmaking ? 0.7 : 1,
            }}
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(247,37,133,0.2)" }}>
                {matchmaking ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: PINK }} /> : <Users className="w-5 h-5" style={{ color: PINK }} />}
              </div>
              <div>
                <div className="text-base font-bold" style={{ color: "#eeeeff" }}>
                  {matchmaking ? t("battles.matchmaking") : t("battles.findOpponent")}
                </div>
                <div className="text-[11px] opacity-50" style={{ color: "#eeeeff" }}>{t("battles.pvpSubtitle")}</div>
              </div>
            </div>
            {!matchmaking && <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: PINK }} />}
          </button>

          {/* My battles */}
          <section>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#eeeeff" }}>
              <Clock className="w-4 h-4" style={{ color: PURPLE }} /> {t("battles.myBattles")}
            </h2>
            {loadingMine ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
              </div>
            ) : myMatches.length === 0 ? (
              <div className="rounded-xl px-4 py-6 text-center text-sm opacity-40" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {t("battles.noMyBattles")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myMatches.map(m => {
                  const meta = myStatusMeta(m, t);
                  const catColor = CATEGORY_COLOR[m.category] ?? MUTED;
                  const actionable = m.status === "active" && (m.myEntryStatus === "matched" || m.myEntryStatus === "in_progress");
                  return (
                    <button
                      key={m.matchId}
                      onClick={() => setLocation(`/battles/${m.matchId}`)}
                      className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all hover:opacity-90"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: catColor }}>{m.category}</span>
                          <span className="text-[9px] opacity-30">{timeAgo(m.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium truncate" style={{ color: "#eeeeff" }}>{m.theme}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}1a`, color: meta.color }}>
                          {meta.label}
                        </span>
                        {m.vsAi && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: `${GOLD}1a`, color: GOLD }}>
                            <Bot className="w-2.5 h-2.5" />
                            {m.aiLevel ? m.aiLevel.charAt(0).toUpperCase() + m.aiLevel.slice(1) : "AI"}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: actionable ? PINK : MUTED }}>
                          {actionable ? t("battles.resume") : t("battles.view")} <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Public feed */}
          <section>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#eeeeff" }}>
              <Trophy className="w-4 h-4" style={{ color: GOLD }} /> {t("battles.publicFeed")}
            </h2>
            {loadingFeed ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
              </div>
            ) : feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
                <Hourglass className="w-9 h-9" />
                <p className="text-sm">{t("battles.empty")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {feed.map(card => {
                  const catColor = CATEGORY_COLOR[card.category] ?? MUTED;
                  const delta = Math.abs(card.player1.rawScore - card.player2.rawScore);
                  return (
                    <div key={card.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: catColor }}>{card.category}</span>
                          <span className="text-[10px] opacity-30">{timeAgo(card.createdAt)}</span>
                        </div>
                        <p className="text-sm font-semibold leading-snug" style={{ color: "#eeeeff" }}>{card.theme}</p>
                      </div>
                      <div className="p-3 flex flex-col sm:flex-row items-stretch gap-2">
                        <PlayerColumn p={card.player1} side="left" t={t} />
                        <div className="flex flex-row sm:flex-col items-center justify-center gap-2 flex-shrink-0 py-1 sm:py-0 sm:px-1">
                          <div className="flex-1 h-px sm:h-auto sm:w-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                          <div className="text-xs font-black px-2 py-1 rounded" style={{ background: "rgba(247,37,133,0.1)", color: PINK, border: "1px solid rgba(247,37,133,0.2)" }}>VS</div>
                          <div className="flex-1 h-px sm:h-auto sm:w-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                        </div>
                        <PlayerColumn p={card.player2} side="right" t={t} />
                      </div>
                      <div className="px-4 py-2 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <Zap className="w-3 h-3 opacity-40" />
                        <span className="text-[10px] opacity-40">{t("battles.scoreDelta")}: {delta} pt</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PlayerColumn({ p, side, t }: { p: PublicPlayer; side: "left" | "right"; t: (k: string) => string }) {
  const isLeft = side === "left";
  return (
    <div
      className={`flex-1 flex flex-col gap-2 p-4 rounded-xl relative overflow-hidden items-start ${!isLeft ? "sm:items-end" : ""}`}
      style={{
        background: p.isWinner ? "linear-gradient(135deg, rgba(124,107,255,0.12), rgba(6,214,160,0.06))" : "rgba(255,255,255,0.02)",
        border: p.isWinner ? "1px solid rgba(124,107,255,0.25)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {p.isWinner && (
        <div className={`absolute top-2 right-2 ${!isLeft ? "sm:left-2 sm:right-auto" : ""} flex items-center gap-1`} style={{ color: GOLD }}>
          <Crown className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold">{t("battles.winner")}</span>
        </div>
      )}
      <div className={`flex flex-col items-start ${!isLeft ? "sm:items-end" : ""} gap-0.5 mt-3`}>
        <span className="text-sm font-bold truncate max-w-full" style={{ color: p.isWinner ? "#a89fff" : "#eeeeff" }}>@{p.username}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-black" style={{ color: p.isWinner ? PURPLE : "#888" }}>{p.rawScore}</span>
          <span className="text-xs opacity-40 font-medium">{t("battles.pts")}</span>
        </div>
      </div>
    </div>
  );
}

import { useGetLeaderboardSummary, useGetMyProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, Activity, TrendingUp, Lock, Star, Zap, RefreshCw, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

function RankOrb({ rank, total, t }: { rank: number | null | undefined; total: number; t: (k: string, opts?: object) => string }) {
  const percentile = rank && total > 0 ? ((total - rank) / total) * 100 : null;
  const pct = percentile ?? 0;

  const orbitColor =
    pct >= 99 ? "#f0c040" :
    pct >= 90 ? "#a89fff" :
    pct >= 75 ? "#06d6a0" :
    "#7c6bff";

  const textColor =
    pct >= 99 ? "#8c6300" :
    pct >= 90 ? "#3930a8" :
    pct >= 75 ? "#0d7a5e" :
    "#3930a8";

  const orbitLabel =
    pct >= 99 ? t("leaderboard.top1") :
    pct >= 90 ? t("leaderboard.top10") :
    pct >= 75 ? t("leaderboard.top25") :
    pct >= 50 ? t("leaderboard.top50") :
    t("leaderboard.growing");

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="110" cy="110" r={radius}
            fill="none"
            stroke={orbitColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={rank ? dashOffset : circumference}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${orbitColor}88)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          {rank ? (
            <>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4a4a6a" }}>{t("leaderboard.position")}</span>
              <span className="text-5xl font-black font-mono leading-none" style={{ color: textColor, filter: `drop-shadow(0 0 12px ${orbitColor}66)` }}>
                #{rank}
              </span>
              {percentile !== null && (
                <span className="text-xs font-semibold mt-1" style={{ color: textColor }}>{orbitLabel}</span>
              )}
            </>
          ) : (
            <>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4a4a6a" }}>{t("leaderboard.position")}</span>
              <span className="text-4xl font-black font-mono leading-none text-muted-foreground">—</span>
              <span className="text-xs text-muted-foreground mt-1">{t("leaderboard.notRanked")}</span>
            </>
          )}
        </div>
      </div>
      {percentile !== null && rank && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("leaderboard.surpassed", { pct: percentile.toFixed(1) })}
          </p>
        </div>
      )}
    </div>
  );
}

function ThresholdBar({
  label, threshold, userSgi, color, t,
}: {
  label: string; threshold: number; userSgi: number; color: string;
  t: (k: string, opts?: object) => string;
}) {
  const reached = userSgi >= threshold;
  const progress = reached ? 100 : Math.min(99, (userSgi / threshold) * 100);
  const gap = threshold - userSgi;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {reached ? <Star className="w-3.5 h-3.5" style={{ color }} /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className={reached ? "font-semibold" : "text-muted-foreground"} style={reached ? { color } : {}}>
            {label}
          </span>
        </div>
        <span className="font-mono text-muted-foreground">
          {reached
            ? t("leaderboard.reached")
            : t("leaderboard.lacking", { threshold: threshold.toFixed(1), gap: gap.toFixed(1) })}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: reached ? `linear-gradient(90deg, ${color}99, ${color})` : "rgba(255,255,255,0.15)",
          }}
        />
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading, isError: profileError } = useGetMyProfile();
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useGetLeaderboardSummary();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isLoading = profileLoading || summaryLoading;
  const isError = profileError || summaryError;

  const handleRetry = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await qc.invalidateQueries();
    } catch {
      toast.error(t("common.errorTitle"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const userSgi    = profile?.sgiScore ?? 0;
  const userRank   = profile?.globalRank ?? null;
  const totalUsers = summary?.totalUsers ?? 0;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 max-w-sm mx-auto text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(168,0,63,0.08)", border: "1px solid rgba(168,0,63,0.18)" }}>
          <Trophy className="w-8 h-8" style={{ color: "#a8003f" }} />
        </div>
        <div>
          <p className="text-base font-bold mb-1" style={{ color: "#1a1b2e" }}>{t("common.errorTitle")}</p>
          <p className="text-sm" style={{ color: "#4a4a6a" }}>{t("common.errorDesc")}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            disabled={isRefreshing}
            data-testid="button-leaderboard-retry"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-60"
            style={{ background: "rgba(57,48,168,0.12)", color: "#3930a8", border: "1px solid rgba(57,48,168,0.25)" }}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? t("common.loading") : t("common.retryBtn")}
          </button>
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.06)", color: "#4a4a6a", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Home className="w-4 h-4" />
            {t("common.homeBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("leaderboard.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("leaderboard.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Skeleton className="w-[220px] h-[220px] rounded-full" />
        </div>
      ) : (
        <div className="flex justify-center py-4">
          <RankOrb rank={userRank} total={totalUsers} t={t as (k: string, opts?: object) => string} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "rgba(57,48,168,0.08)", border: "1px solid rgba(57,48,168,0.2)" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#3930a8" }}>
              <Zap className="w-3.5 h-3.5" /> {t("leaderboard.yourSgi")}
            </div>
            <div className="text-4xl font-black font-mono mt-1" style={{ color: "#3930a8" }}>
              {userSgi > 0 ? userSgi.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">{t("leaderboard.sgiDesc")}</div>
          </div>

          <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="w-3.5 h-3.5" /> {t("leaderboard.communityAvg")}
            </div>
            <div className="text-4xl font-black font-mono mt-1 text-foreground">
              {summary?.averageSgi.toFixed(1) ?? "—"}
            </div>
            {userSgi > 0 && summary?.averageSgi && (
              <div className="text-xs" style={{ color: userSgi >= summary.averageSgi ? "#0d7a5e" : "#a8003f" }}>
                {userSgi >= summary.averageSgi
                  ? t("leaderboard.aboveAvg", { n: (userSgi - summary.averageSgi).toFixed(1) })
                  : t("leaderboard.belowAvg", { n: (userSgi - summary.averageSgi).toFixed(1) })}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="w-3.5 h-3.5" /> {t("leaderboard.totalTracked")}
            </div>
            <div className="text-4xl font-black font-mono mt-1 text-foreground">
              {totalUsers > 0 ? totalUsers.toLocaleString() : "—"}
            </div>
            <div className="text-xs text-muted-foreground">{t("leaderboard.inNetwork")}</div>
          </div>

          <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "rgba(140,99,0,0.06)", border: "1px solid rgba(140,99,0,0.2)" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#8c6300" }}>
              <Trophy className="w-3.5 h-3.5" /> {t("leaderboard.peakSgi")}
            </div>
            <div className="text-4xl font-black font-mono mt-1" style={{ color: "#8c6300" }}>
              {summary?.topSgi.toFixed(1) ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">{t("leaderboard.peakDesc")}</div>
          </div>
        </div>
      )}

      {!isLoading && summary && (
        <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{t("leaderboard.thresholds")}</span>
          </div>
          <ThresholdBar label={t("leaderboard.top10")} threshold={summary.top10PercentThreshold} userSgi={userSgi} color="#3930a8" t={t as (k: string, opts?: object) => string} />
          <ThresholdBar label={t("leaderboard.top1")} threshold={summary.top1PercentThreshold} userSgi={userSgi} color="#8c6300" t={t as (k: string, opts?: object) => string} />
          <ThresholdBar label={t("leaderboard.peakSgi")} threshold={summary.topSgi} userSgi={userSgi} color="#0d7a5e" t={t as (k: string, opts?: object) => string} />
        </div>
      )}

      <div className="rounded-2xl p-5 flex items-start gap-3" style={{ background: "rgba(57,48,168,0.05)", border: "1px solid rgba(57,48,168,0.15)" }}>
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#3930a8" }} />
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: "#3930a8" }}>{t("leaderboard.privacyTitle")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("leaderboard.privacyDesc")}</p>
        </div>
      </div>

      {!isLoading && !userRank && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">{t("leaderboard.noRankYet")}</p>
        </div>
      )}
    </div>
  );
}

import { useGetMyGamification, useGetMyProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

const BADGE_META: Record<string, { emoji: string; color: string }> = {
  semantic_explorer:      { emoji: "🧭", color: "rgba(0,150,255,0.12)" },
  systems_thinker:        { emoji: "🧠", color: "rgba(124,107,255,0.15)" },
  cross_domain_architect: { emoji: "🔗", color: "rgba(255,153,0,0.12)" },
  abstract_reasoner:      { emoji: "♾️",  color: "rgba(6,214,160,0.12)" },
  high_growth_user:       { emoji: "🚀", color: "rgba(247,37,133,0.12)" },
};

const ALL_BADGES = [
  { id: "semantic_explorer",      name: "Explorer" },
  { id: "systems_thinker",        name: "Systems Thinker" },
  { id: "cross_domain_architect", name: "Cross-Domain" },
  { id: "abstract_reasoner",      name: "Abstract" },
  { id: "high_growth_user",       name: "High Growth" },
];

export default function Gamification() {
  const { t } = useTranslation();
  const { data: gam, isLoading: gamLoading } = useGetMyGamification();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const isLoading = gamLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const level = gam?.level ?? 1;
  const xp = gam?.xp ?? 0;
  const streak = gam?.streak ?? 0;
  const xpProgress = Math.round((gam?.levelProgress ?? 0) * 100);
  const xpToNext = Math.round((1 - (gam?.levelProgress ?? 0)) * 500);
  const earnedBadgeIds = new Set((gam?.badges ?? []).map((b) => String(b.id)));
  const missions = gam?.missions ?? [];

  const streakDays = Array.from({ length: 21 }, (_, i) => i < streak);

  const rankChange = profile?.rankChange30d ?? 0;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2
          className="text-[26px] font-bold tracking-tight font-display"
          style={{
            background: "linear-gradient(135deg, #7c6bff, #06d6a0)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {t("gamification.title")}
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgba(144,144,184,1)" }}>
          {t("gamification.subtitle")}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t("gamification.level"), value: level, color: "#7c6bff", sub: t("gamification.semanticLevel") },
          { label: t("gamification.totalXp"), value: xp.toLocaleString(), color: "#06d6a0" },
          { label: t("gamification.badges"), value: `${earnedBadgeIds.size}/${ALL_BADGES.length}`, color: "#ffbb55" },
          { label: t("gamification.rankDelta"), value: rankChange > 0 ? `+${rankChange}` : rankChange === 0 ? "—" : `${rankChange}`, color: rankChange > 0 ? "#06d6a0" : rankChange < 0 ? "#f72585" : "#9090b8" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[14px] p-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="text-[9px] uppercase tracking-[0.8px] mb-3" style={{ color: "rgba(74,74,106,1)" }}>
              {stat.label}
            </div>
            <div className="font-display text-[28px] font-bold tracking-tight leading-none" style={{ color: stat.color }}>
              {stat.value}
            </div>
            {stat.sub && (
              <div className="text-[11px] mt-1" style={{ color: "rgba(144,144,184,1)" }}>{stat.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* XP Progress bar */}
      <div className="rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="text-[10px] uppercase tracking-[0.8px] mb-3" style={{ color: "rgba(74,74,106,1)" }}>
          {t("gamification.xpToward", { n: level + 1 })}
        </div>
        <div className="flex justify-between text-[11px] mb-2" style={{ color: "rgba(144,144,184,1)" }}>
          <span>{xp.toLocaleString()} XP</span>
          <span style={{ color: "#7c6bff", fontWeight: 600 }}>{xpProgress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${xpProgress}%`, background: "linear-gradient(90deg, #7c6bff, #06d6a0)" }}
          />
        </div>
        <div className="text-[11px] mt-2" style={{ color: "rgba(74,74,106,1)" }}>
          {t("gamification.xpToNext", { n: xpToNext })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Badges */}
        <div className="rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-[10px] uppercase tracking-[0.8px] mb-4" style={{ color: "rgba(74,74,106,1)" }}>
            {t("gamification.badgesSection")}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ALL_BADGES.map((badge) => {
              const earned = earnedBadgeIds.has(badge.id);
              const meta = BADGE_META[badge.id] ?? { emoji: "🏅", color: "rgba(255,255,255,0.05)" };
              return (
                <div
                  key={badge.id}
                  className="flex flex-col items-center text-center py-3 px-2 rounded-xl transition-opacity"
                  style={{
                    background: earned ? meta.color : "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    opacity: earned ? 1 : 0.28,
                  }}
                  title={earned ? `${badge.name} — ${t("gamification.earned")}` : `${badge.name} — ${t("gamification.locked")}`}
                >
                  <div className="text-[22px] mb-1.5">{meta.emoji}</div>
                  <div className="text-[10px] font-semibold leading-tight" style={{ color: "#eeeeff" }}>
                    {badge.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Missions + Streak */}
        <div className="space-y-4">
          <div className="rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-[10px] uppercase tracking-[0.8px] mb-3" style={{ color: "rgba(74,74,106,1)" }}>
              {t("gamification.weeklyMissions")}
            </div>
            <div className="space-y-0">
              {missions.length === 0 ? (
                <p className="text-xs" style={{ color: "rgba(144,144,184,1)" }}>{t("gamification.noMissions")}</p>
              ) : (
                missions.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-[9px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        border: m.completed ? "none" : "1.5px solid rgba(255,255,255,0.13)",
                        background: m.completed ? "#06d6a0" : "transparent",
                      }}
                    >
                      {m.completed && <span className="text-[9px] font-bold text-black">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] leading-snug truncate" style={{ color: "#eeeeff" }}>{m.title}</div>
                      {!m.completed && (m.target ?? 0) > 1 && (
                        <div className="text-[10px]" style={{ color: "rgba(144,144,184,0.7)" }}>{m.progress ?? 0}/{m.target ?? 1}</div>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold flex-shrink-0" style={{ color: "#7c6bff" }}>XP ✦</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Streak */}
          <div className="rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.8px]" style={{ color: "rgba(74,74,106,1)" }}>
                {t("gamification.streak")}
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4" style={{ color: "#ff9900" }} />
                <span className="font-display text-[18px] font-bold leading-none" style={{ color: "#ff9900" }}>{streak}</span>
                <span className="text-[10px]" style={{ color: "rgba(144,144,184,1)" }}>{t("gamification.days")}</span>
              </div>
            </div>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(21, 1fr)" }}>
              {streakDays.map((active, i) => (
                <div
                  key={i}
                  className="streak-cell"
                  style={{ background: active ? `rgba(124,107,255,${0.4 + (i / 21) * 0.6})` : "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
            <div className="text-[10px] mt-2" style={{ color: "rgba(74,74,106,1)" }}>{t("gamification.last21")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useGetMyGamification, useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, CheckCircle2, Clock, Shield } from "lucide-react";

const BADGE_COLORS: Record<string, string> = {
  semantic_explorer: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
  systems_thinker: "from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-400",
  cross_domain_architect: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
  abstract_reasoner: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
  high_growth_user: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400",
};

export default function Profile() {
  const { data: gam, isLoading: gamLoading } = useGetMyGamification();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();

  const isLoading = gamLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const xpProgressPct = Math.round((gam?.levelProgress ?? 0) * 100);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Growth Profile</h2>
        <p className="text-muted-foreground mt-1">Milestones, streaks, and mission progress</p>
      </div>

      {/* XP / Level Card */}
      <Card className="bg-card/50 backdrop-blur border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Semantic Level</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold font-mono text-primary" data-testid="text-level">{gam?.level ?? 1}</span>
                <span className="text-muted-foreground text-sm font-mono">{gam?.xp?.toLocaleString() ?? 0} XP</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-xl font-bold font-mono text-orange-400" data-testid="text-streak">{gam?.streak ?? 0}</span>
                <span className="text-xs text-orange-400">day streak</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {gam?.lastActiveDate ? `Last active: ${gam.lastActiveDate}` : "No activity yet"}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>Level {gam?.level ?? 1}</span>
              <span>{gam?.xpToNextLevel?.toLocaleString() ?? "--"} XP to Level {(gam?.level ?? 1) + 1}</span>
            </div>
            <Progress value={xpProgressPct} className="h-2" data-testid="progress-level" />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SGI Score</p>
            <p className="text-3xl font-bold font-mono" data-testid="text-sgi-score">{profile?.sgiScore?.toFixed(1) ?? "--"}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Global Rank</p>
            <p className="text-3xl font-bold font-mono" data-testid="text-global-rank">#{profile?.globalRank?.toLocaleString() ?? "--"}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Percentile</p>
            <p className="text-3xl font-bold font-mono" data-testid="text-percentile">Top {profile?.percentile?.toFixed(1) ?? "--"}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Badges Earned</p>
            <p className="text-3xl font-bold font-mono" data-testid="text-badge-count">{gam?.badges?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card className="bg-card/30 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Earned Badges</CardTitle>
        </CardHeader>
        <CardContent>
          {!gam?.badges || gam.badges.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No badges earned yet. Keep exploring to unlock milestones.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gam.badges.map(badge => (
                <div
                  key={badge.id}
                  data-testid={`badge-${badge.badgeKey}`}
                  className={`p-4 rounded-xl border bg-gradient-to-br ${BADGE_COLORS[badge.badgeKey] ?? "from-muted/20 to-transparent border-border text-foreground"}`}
                >
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{badge.name}</p>
                      <p className="text-xs opacity-80 mt-0.5">{badge.description}</p>
                      <p className="text-xs opacity-60 mt-1 font-mono">{new Date(badge.earnedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Missions */}
      <Card className="bg-card/30 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Active Missions</CardTitle>
        </CardHeader>
        <CardContent>
          {!gam?.missions || gam.missions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No active missions. Stay engaged to receive new missions.</p>
          ) : (
            <div className="space-y-4">
              {gam.missions.map(mission => (
                <div key={mission.id} data-testid={`mission-${mission.id}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {mission.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={`text-sm font-medium ${mission.completed ? "line-through text-muted-foreground" : ""}`}>
                        {mission.title}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {mission.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {mission.progress}/{mission.target}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{mission.description}</p>
                  <Progress value={Math.min(100, (mission.progress / mission.target) * 100)} className="h-1.5 ml-6" />
                  <p className="text-xs text-muted-foreground pl-6 font-mono">
                    Expires: {new Date(mission.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

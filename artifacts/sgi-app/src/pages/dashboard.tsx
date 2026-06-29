import { useGetMyProfile, useGetSgiHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, TrendingDown, Minus, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface MacroDim {
  key: "profondita" | "connettivita" | "precisione" | "revisione";
  labelKey: string;
  descKey: string;
  color: string;
  icon: string;
}

const MACRO_DIMS: MacroDim[] = [
  { key: "profondita",   labelKey: "dashboard.dimProfondita",   descKey: "dashboard.dimProfonditaDesc",   color: "#7c6bff", icon: "🧠" },
  { key: "connettivita", labelKey: "dashboard.dimConnettivita", descKey: "dashboard.dimConnettivitaDesc", color: "#06b6d4", icon: "🔗" },
  { key: "precisione",   labelKey: "dashboard.dimPrecisione",   descKey: "dashboard.dimPrecizioneDesc",   color: "#a855f7", icon: "🎯" },
  { key: "revisione",    labelKey: "dashboard.dimRevisione",    descKey: "dashboard.dimRevisioneDesc",    color: "#10b981", icon: "🔄" },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const { data: history, isLoading: historyLoading } = useGetSgiHistory({ days: 30 });

  if (profileLoading || historyLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>;
  }

  const sgi = profile?.sgiScore ?? 0;
  const macro = (profile as any)?.macroDimensions as { profondita: number; connettivita: number; precisione: number; revisione: number } | undefined;
  const dailyDelta = profile?.sgiDailyDelta ?? 0;
  const weeklyDelta = profile?.sgiWeeklyDelta ?? 0;
  const monthlyDelta = profile?.sgiMonthlyDelta ?? 0;
  const rankChange = profile?.rankChange30d ?? 0;
  const isPositiveDaily = dailyDelta >= 0;
  const isPositiveWeekly = weeklyDelta >= 0;

  const historyArr = Array.isArray(history) ? history : [];

  const chartData = [...historyArr]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(h => ({
      date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: Math.round(h.score * 10) / 10,
      complexity: Math.round((h.conceptualComplexity ?? 0) * 10) / 10,
    }));

  const startScore = chartData[0]?.score;

  const handleShare = async () => {
    const text = `Il mio SGI è ${sgi.toFixed(1)} — misuro l'evoluzione della mia mente su sgindex.work`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Semantic Growth Index", text, url: "https://sgindex.work" });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copiato negli appunti!");
      }
    } catch {
      // user cancelled share
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h2>
          <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-primary font-mono text-sm">
          <Activity className="w-4 h-4 animate-pulse" />
          {t("dashboard.systemNominal")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-primary/30 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t("dashboard.currentSgi")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 144 144">
                  <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle cx="72" cy="72" r="60" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (1 - sgi / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 72 72)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="text-4xl font-bold font-mono tracking-tighter text-white z-10">
                  {sgi.toFixed(1)}
                </div>
              </div>
              <div className={`mt-4 flex items-center gap-1 font-mono text-sm ${isPositiveDaily ? 'text-green-500' : 'text-red-500'}`}>
                {isPositiveDaily ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {dailyDelta >= 0 ? '+' : ''}{dailyDelta.toFixed(2)} (24h)
              </div>
              <button
                onClick={handleShare}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Condividi punteggio
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t("dashboard.globalRank")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-1">#{profile?.globalRank?.toLocaleString() ?? '--'}</div>
              <div className="text-xs text-muted-foreground mb-2">{t("dashboard.of")} {profile?.totalUsers?.toLocaleString()} {t("dashboard.tracked")}</div>
              {rankChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-mono ${rankChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {rankChange < 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {rankChange < 0
                    ? t("dashboard.places30d", { dir: "↑", n: Math.abs(rankChange) })
                    : t("dashboard.places30d", { dir: "↓", n: rankChange })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t("dashboard.weeklyGrowth")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold font-mono mb-1 ${isPositiveWeekly ? 'text-green-400' : 'text-red-400'}`}>
                {weeklyDelta >= 0 ? '+' : ''}{weeklyDelta.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mb-2">{t("dashboard.sgiPoints7")}</div>
              <div className={`flex items-center gap-1 text-xs font-mono ${isPositiveWeekly ? 'text-green-500' : 'text-red-500'}`}>
                {isPositiveWeekly ? <TrendingUp className="w-3 h-3" /> : weeklyDelta === 0 ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositiveWeekly ? t("dashboard.growing") : t("dashboard.needsAttention")}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t("dashboard.monthlyGrowth")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-1">
                {monthlyDelta >= 0 ? '+' : ''}{monthlyDelta.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mb-2">{t("dashboard.sgiPoints30")}</div>
              <div className="text-xs text-muted-foreground">
                {t("dashboard.topGlobally", { val: profile?.percentile?.toFixed(1) ?? '--' })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Breakdown SGI ─────────────────────────────────────────── */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>{t("dashboard.breakdown")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t("dashboard.breakdownSub")}</p>
        </CardHeader>
        <CardContent>
          {!macro || (macro.profondita === 0 && macro.connettivita === 0 && macro.precisione === 0 && macro.revisione === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noBreakdown")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {MACRO_DIMS.map(dim => {
                const val: number = macro?.[dim.key] ?? 0;
                const pct = Math.round((val / 10) * 100);
                return (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{dim.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: "#eeeeff" }}>{t(dim.labelKey)}</span>
                      </div>
                      <span className="font-mono text-sm font-bold" style={{ color: dim.color }}>{val.toFixed(1)}<span className="text-[10px] text-muted-foreground">/10</span></span>
                    </div>
                    {/* bar */}
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: dim.color, opacity: 0.85 }}
                      />
                    </div>
                    <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "#7070a0" }}>{t(dim.descKey)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Trajectory ────────────────────────────────────────────── */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{t("dashboard.trajectory")}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {chartData.length > 0
                  ? t("dashboard.dataPoints", { n: chartData.length, start: startScore?.toFixed(1) ?? '--' })
                  : t("dashboard.noHistory")}
              </p>
            </div>
            {weeklyDelta !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-mono px-2 py-1 rounded ${isPositiveWeekly ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {isPositiveWeekly ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {weeklyDelta >= 0 ? '+' : ''}{weeklyDelta.toFixed(1)} {t("dashboard.thisWeek")}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] sm:h-[300px] md:h-[380px] w-full">
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {t("dashboard.chatMore")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  {startScore !== undefined && (
                    <ReferenceLine y={startScore} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: t("dashboard.start"), fill: 'rgba(255,255,255,0.3)', fontSize: 10, position: 'right' }} />
                  )}
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="score" name="SGI Score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "white", strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="complexity" name="Complexity" stroke="rgba(168,85,247,0.6)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

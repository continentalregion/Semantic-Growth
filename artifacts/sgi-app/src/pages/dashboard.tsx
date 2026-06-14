import { useGetMyProfile, useGetSgiHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function Dashboard() {
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Telemetry Hub</h2>
          <p className="text-muted-foreground mt-1">Real-time cognitive growth tracking</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-primary font-mono text-sm">
          <Activity className="w-4 h-4 animate-pulse" />
          SYSTEM NOMINAL
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-primary/30 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Current SGI Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="absolute inset-0" width="144" height="144" viewBox="0 0 144 144">
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
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Global Rank</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-1">#{profile?.globalRank?.toLocaleString() ?? '--'}</div>
              <div className="text-xs text-muted-foreground mb-2">of {profile?.totalUsers?.toLocaleString()} tracked</div>
              {rankChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-mono ${rankChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {rankChange < 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {rankChange < 0 ? `↑ ${Math.abs(rankChange)} places (30d)` : `↓ ${rankChange} places (30d)`}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Weekly Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold font-mono mb-1 ${isPositiveWeekly ? 'text-green-400' : 'text-red-400'}`}>
                {weeklyDelta >= 0 ? '+' : ''}{weeklyDelta.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mb-2">SGI points (7 days)</div>
              <div className={`flex items-center gap-1 text-xs font-mono ${isPositiveWeekly ? 'text-green-500' : 'text-red-500'}`}>
                {isPositiveWeekly ? <TrendingUp className="w-3 h-3" /> : weeklyDelta === 0 ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositiveWeekly ? 'Growing' : 'Needs attention'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Monthly Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-1">
                {monthlyDelta >= 0 ? '+' : ''}{monthlyDelta.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mb-2">SGI points (30 days)</div>
              <div className="text-xs text-muted-foreground">
                Top {profile?.percentile?.toFixed(1) ?? '--'}% globally
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>SGI Trajectory (30 Days)</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {chartData.length > 0
                  ? `${chartData.length} data points · Started at ${startScore?.toFixed(1) ?? '--'}`
                  : 'No history yet — start a conversation to begin tracking'}
              </p>
            </div>
            {weeklyDelta !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-mono px-2 py-1 rounded ${isPositiveWeekly ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {isPositiveWeekly ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {weeklyDelta >= 0 ? '+' : ''}{weeklyDelta.toFixed(1)} this week
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] w-full">
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Chat more to populate your trajectory chart
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  {startScore !== undefined && (
                    <ReferenceLine y={startScore} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: 'Start', fill: 'rgba(255,255,255,0.3)', fontSize: 10, position: 'right' }} />
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

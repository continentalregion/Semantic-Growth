import { useGetMyProfile, useGetSgiHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export default function Dashboard() {
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const { data: history, isLoading: historyLoading } = useGetSgiHistory({ days: 30 });

  if (profileLoading || historyLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>;
  }

  const sgi = profile?.sgiScore ?? 0;
  const delta = profile?.sgiDailyDelta ?? 0;
  const isPositive = delta >= 0;

  // Format history for recharts
  const chartData = history?.map(h => ({
    date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: h.score,
    complexity: h.conceptualComplexity
  })).reverse() || [];

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
        {/* Main Score Gauge/Card */}
        <Card className="lg:col-span-1 border-primary/30 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Current SGI Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6">
              {/* Fake circular gauge */}
              <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-4 border-muted">
                <div className="absolute inset-0 rounded-full border-4 border-primary" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`, opacity: 0.8 }} />
                <div className="text-5xl font-bold font-mono tracking-tighter text-white">
                  {sgi.toFixed(1)}
                </div>
              </div>
              
              <div className={`mt-6 flex items-center gap-1 font-mono text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                {Math.abs(delta).toFixed(2)} (24h)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Global Rank</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-2">#{profile?.globalRank?.toLocaleString() ?? '--'}</div>
              <div className="text-sm text-muted-foreground">of {profile?.totalUsers?.toLocaleString()} tracked</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Percentile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-2">Top {profile?.percentile?.toFixed(1) ?? '--'}%</div>
              <div className="text-sm text-primary flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4" /> Moving towards higher bracket
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Monthly Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-white mb-2">+{profile?.sgiMonthlyDelta?.toFixed(1) ?? '0'}</div>
              <div className="text-sm text-muted-foreground">Points in last 30 days</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>SGI Trajectory (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "white" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

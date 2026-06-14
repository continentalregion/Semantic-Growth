import { useGetPredictions, useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type ScenarioKey = "conservative" | "realistic" | "optimistic";

const SCENARIO_STYLES: Record<ScenarioKey, { label: string; color: string; bg: string; border: string; desc: string }> = {
  conservative: {
    label: "Conservative",
    color: "#6366f1",
    bg: "from-indigo-500/10 to-transparent",
    border: "border-indigo-500/20",
    desc: "50% of current growth rate maintained",
  },
  realistic: {
    label: "Realistic",
    color: "hsl(var(--primary))",
    bg: "from-primary/10 to-transparent",
    border: "border-primary/20",
    desc: "Current trajectory maintained",
  },
  optimistic: {
    label: "Optimistic",
    color: "#22c55e",
    bg: "from-green-500/10 to-transparent",
    border: "border-green-500/20",
    desc: "2× current growth rate",
  },
};

export default function Predictions() {
  const { data: predictions, isLoading } = useGetPredictions();
  const { data: profile } = useGetMyProfile();

  const isPremium = profile?.plan === "premium";

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Predictive Simulation</h2>
          <p className="text-muted-foreground max-w-md">
            Project your semantic growth trajectory up to 180 days with conservative, realistic, and optimistic scenarios. Available on the Premium plan.
          </p>
        </div>
        <Button size="lg" className="gap-2" data-testid="button-upgrade-premium">
          <TrendingUp className="w-5 h-5" />
          Upgrade to Premium
        </Button>
        <p className="text-xs text-muted-foreground">Unlock predictions, advanced maps, and priority scoring</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!predictions) return null;

  const chartData = [
    { day: "Now", conservative: profile?.sgiScore, realistic: profile?.sgiScore, optimistic: profile?.sgiScore },
    { day: "30d", conservative: predictions.conservative.sgi30d, realistic: predictions.realistic.sgi30d, optimistic: predictions.optimistic.sgi30d },
    { day: "90d", conservative: predictions.conservative.sgi90d, realistic: predictions.realistic.sgi90d, optimistic: predictions.optimistic.sgi90d },
    { day: "180d", conservative: predictions.conservative.sgi180d, realistic: predictions.realistic.sgi180d, optimistic: predictions.optimistic.sgi180d },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Growth Simulation</h2>
        <p className="text-muted-foreground mt-1">Projected SGI trajectory based on your current engagement patterns</p>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["conservative", "realistic", "optimistic"] as ScenarioKey[]).map(key => {
          const s = SCENARIO_STYLES[key];
          const d = predictions[key];
          return (
            <Card key={key} data-testid={`card-scenario-${key}`} className={`bg-gradient-to-br ${s.bg} ${s.border} border backdrop-blur`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-widest" style={{ color: s.color }}>
                  {s.label}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[{ label: "30d", sgi: d.sgi30d, rank: d.rank30d }, { label: "90d", sgi: d.sgi90d, rank: d.rank90d }, { label: "180d", sgi: d.sgi180d, rank: d.rank180d }].map(p => (
                    <div key={p.label} className="flex justify-between items-center py-1 border-b border-border/50">
                      <span className="text-xs text-muted-foreground font-mono">{p.label}</span>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm" style={{ color: s.color }}>{p.sgi.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground font-mono">#{p.rank.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card className="bg-card/30 backdrop-blur border-border">
        <CardHeader>
          <CardTitle>Trajectory Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" tick={{ fill: "rgba(255,255,255,0.5)" }} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fill: "rgba(255,255,255,0.5)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", borderColor: "rgba(255,255,255,0.1)" }} itemStyle={{ color: "#fff" }} />
                <Legend />
                <Line type="monotone" dataKey="conservative" name="Conservative" stroke={SCENARIO_STYLES.conservative.color} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 5 }} />
                <Line type="monotone" dataKey="realistic" name="Realistic" stroke={SCENARIO_STYLES.realistic.color} strokeWidth={3} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="optimistic" name="Optimistic" stroke={SCENARIO_STYLES.optimistic.color} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Projections are based on exponential smoothing of your recent activity. Consistent engagement accelerates growth.
      </p>
    </div>
  );
}

import { useGetSemanticMap } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Lock } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

function buildNetworkLayout(nodes: { id: string; explorationScore: number; messageCount: number }[], edges: { source: string; target: string; strength: number }[]): { nodePositions: Record<string, { x: number; y: number }>; edges: typeof edges } {
  const W = 600, H = 450, CX = W / 2, CY = H / 2;
  const count = nodes.length;
  if (count === 0) return { nodePositions: {} as Record<string, { x: number; y: number }>, edges };
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const R = Math.min(CX, CY) * 0.72;
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    nodePositions[n.id] = { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });
  return { nodePositions, edges };
}

export default function MapPage() {
  const { t } = useTranslation();
  const { data: mapData, isLoading, error } = useGetSemanticMap();

  const isPremiumLocked = (error as { status?: number } | null)?.status === 403 || (error as { response?: { status: number } } | null)?.response?.status === 403;

  const nodePositions = useMemo((): Record<string, { x: number; y: number }> => {
    if (!mapData?.nodes) return {};
    return buildNetworkLayout(mapData.nodes, mapData.edges ?? []).nodePositions;
  }, [mapData]);

  const radarData = mapData?.nodes.map(n => ({
    subject: n.domain.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    A: Math.round(n.explorationScore * 10) / 10,
    fullMark: 10,
  })) || [];

  if (isLoading) return <Skeleton className="w-full h-[600px]" />;

  if (isPremiumLocked) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("map.title")}</h2>
          <p className="text-muted-foreground mt-1">{t("map.subtitle")}</p>
        </div>
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Lock className="w-12 h-12 text-primary/50" />
            <h3 className="text-xl font-semibold">{t("map.premiumFeature")}</h3>
            <p className="text-muted-foreground max-w-md">{t("map.premiumDesc")}</p>
            <a href="/settings" className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              {t("map.upgradePremium")}
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nodes = mapData?.nodes ?? [];
  const edges = mapData?.edges ?? [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("map.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("map.subtitle")}</p>
      </div>

      {nodes.length === 0 ? (
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <p className="text-muted-foreground">{t("map.noMap")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>{t("map.domainNetwork")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("map.domainNetworkDesc")}</p>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-hidden rounded-xl bg-slate-950/50" style={{ height: 450 }}>
                <svg width="100%" height="450" viewBox="0 0 600 450" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <radialGradient id="nodeGrad" cx="50%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="hsl(199,89%,70%)" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="hsl(199,89%,35%)" stopOpacity="0.7" />
                    </radialGradient>
                  </defs>
                  {edges.map((e, i) => {
                    const s = nodePositions[e.source];
                    const tgt = nodePositions[e.target];
                    if (!s || !tgt) return null;
                    return (
                      <line key={i} x1={s.x} y1={s.y} x2={tgt.x} y2={tgt.y}
                        stroke="hsl(199,89%,48%)"
                        strokeOpacity={Math.max(0.08, e.strength * 0.5)}
                        strokeWidth={Math.max(0.5, e.strength * 3)}
                      />
                    );
                  })}
                  {nodes.map((n) => {
                    const pos = nodePositions[n.id];
                    if (!pos) return null;
                    const r = Math.max(16, Math.min(40, 12 + n.explorationScore * 2.8));
                    const label = n.domain.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <g key={n.id}>
                        <circle cx={pos.x} cy={pos.y} r={r + 4} fill="hsl(199,89%,48%)" fillOpacity={0.1} />
                        <circle cx={pos.x} cy={pos.y} r={r} fill="url(#nodeGrad)" stroke="hsl(199,89%,60%)" strokeWidth={1.5} />
                        <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} fontWeight={600}>
                          {n.explorationScore.toFixed(1)}
                        </text>
                        <text x={pos.x} y={pos.y + r + 12} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>{t("map.radarTitle")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("map.radarDesc")}</p>
            </CardHeader>
            <CardContent>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} tickCount={3} />
                    <Radar name="Expertise" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur lg:col-span-2">
            <CardHeader><CardTitle>{t("map.domainBreakdown")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {nodes.map(n => (
                  <div key={n.id} className="rounded-lg bg-slate-900/60 border border-white/5 p-3 flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground capitalize">{n.domain.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-bold font-mono text-primary">{n.explorationScore.toFixed(1)}</div>
                    <div className="w-full bg-muted rounded-full h-1">
                      <div className="bg-primary h-1 rounded-full" style={{ width: `${(n.explorationScore / 10) * 100}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">{n.messageCount} {t("map.msgs")}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useGetSemanticMap } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export default function MapPage() {
  const { data: mapData, isLoading } = useGetSemanticMap();

  if (isLoading) {
    return <Skeleton className="w-full h-[600px]" />;
  }

  // Format data for Radar Chart
  const radarData = mapData?.nodes.map(n => ({
    subject: n.domain,
    A: n.explorationScore * 100, // normalize to 100 for better display
    fullMark: 100
  })) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Semantic Map</h2>
        <p className="text-muted-foreground mt-1">Interdisciplinary exploration and domain strengths</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card/50 backdrop-blur col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Domain Expertise Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] w-full bg-slate-950/50 rounded-xl flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Expertise" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

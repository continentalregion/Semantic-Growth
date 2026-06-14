import { useGetMyRecommendations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Brain, Share2, BookOpen, Cpu, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORY_META: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  reasoning: { label: "Reasoning", icon: Brain, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  interdisciplinary: { label: "Interdisciplinary", icon: Share2, color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  abstraction: { label: "Abstraction", icon: TrendingUp, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  domain: { label: "Domain", icon: BookOpen, color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  conceptual: { label: "Conceptual", icon: Cpu, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
};

export default function Recommendations() {
  const { data: recs, isLoading, error } = useGetMyRecommendations();

  const isPremiumLocked = (error as { status?: number } | null)?.status === 403 ||
    (error as { response?: { status: number } } | null)?.response?.status === 403;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Growth Path</h2>
        <p className="text-muted-foreground mt-1">Personalized exploration vectors based on your semantic profile</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : isPremiumLocked ? (
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Lock className="w-12 h-12 text-primary/50" />
            <h3 className="text-xl font-semibold">Premium Feature</h3>
            <p className="text-muted-foreground max-w-md">
              Growth Path gives you AI-generated, personalized recommendations targeting your weakest semantic dimensions.
              Upgrade to Premium to unlock your full growth roadmap.
            </p>
            <a href="/settings" className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              Upgrade to Premium
            </a>
          </CardContent>
        </Card>
      ) : !recs || recs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Start conversations to generate personalized growth recommendations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recs.map((rec, idx) => {
            const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.domain!;
            const Icon = meta.icon;
            return (
              <Card
                key={rec.id}
                data-testid={`card-recommendation-${rec.id}`}
                className="bg-card/40 backdrop-blur border-border hover:border-primary/30 transition-colors group"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${meta.color}`}>
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(rec.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90">{rec.content}</p>
                    </div>
                    {rec.estimatedSgiGain !== null && rec.estimatedSgiGain !== undefined && (
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                          <div className="text-xs text-green-400 font-mono font-bold">+{rec.estimatedSgiGain.toFixed(1)}</div>
                          <div className="text-xs text-green-400/70">SGI est.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

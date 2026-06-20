import { useGetMyRecommendations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Brain, Share2, BookOpen, Cpu, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const CATEGORY_ICONS: Record<string, typeof Brain> = {
  reasoning: Brain,
  interdisciplinary: Share2,
  abstraction: TrendingUp,
  domain: BookOpen,
  conceptual: Cpu,
};

const CATEGORY_COLORS: Record<string, string> = {
  reasoning: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  interdisciplinary: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  abstraction: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  domain: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  conceptual: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export default function Recommendations() {
  const { t } = useTranslation();
  const { data: recs, isLoading, error } = useGetMyRecommendations();

  const isPremiumLocked = (error as { status?: number } | null)?.status === 403 ||
    (error as { response?: { status: number } } | null)?.response?.status === 403;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("recommendations.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("recommendations.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : isPremiumLocked ? (
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Lock className="w-12 h-12 text-primary/50" />
            <h3 className="text-xl font-semibold">{t("recommendations.premiumFeature")}</h3>
            <p className="text-muted-foreground max-w-md">{t("recommendations.premiumDesc")}</p>
            <a href="/settings" className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              {t("recommendations.upgradePremium")}
            </a>
          </CardContent>
        </Card>
      ) : !recs || recs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{t("recommendations.noRecs")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recs.map((rec, idx) => {
            const Icon = CATEGORY_ICONS[rec.category] ?? BookOpen;
            const colorClass = CATEGORY_COLORS[rec.category] ?? CATEGORY_COLORS.domain!;
            const catLabel = t(`recommendations.categories.${rec.category}`, { defaultValue: rec.category });
            return (
              <Card
                key={rec.id}
                data-testid={`card-recommendation-${rec.id}`}
                className="bg-card/40 backdrop-blur border-border hover:border-primary/30 transition-colors group"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${colorClass}`}>{catLabel}</Badge>
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
                          <div className="text-xs text-green-400/70">{t("recommendations.sgiEst")}</div>
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

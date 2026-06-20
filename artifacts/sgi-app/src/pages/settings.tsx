import { useState } from "react";
import { useUser } from "@clerk/react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Crown, User, Shield, CheckCircle2, Zap, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { data: profile, isLoading } = useGetMyProfile();
  const [showUpgradeModal, setShowUpgradeModal] = useState<"premium" | "pro" | null>(null);

  const plan = profile?.plan ?? "free";
  const isPremium = plan === "premium";
  const isPro     = plan === "pro";

  const PLANS = [
    {
      id: "premium",
      name: t("common.premium"),
      price: "€9.99",
      period: `/${t("settings.perMonth")}`,
      icon: Star,
      color: "#a89fff",
      borderColor: "rgba(168,159,255,0.3)",
      bgColor: "rgba(124,107,255,0.06)",
      gradient: "linear-gradient(135deg, #7c6bff, #5b4de0)",
      features: t("settings.planFeatures.premium", { returnObjects: true }) as string[],
    },
    {
      id: "pro",
      name: t("common.pro"),
      price: "€19.99",
      period: `/${t("settings.perMonth")}`,
      icon: Crown,
      color: "#f0c040",
      borderColor: "rgba(240,192,64,0.4)",
      bgColor: "rgba(240,192,64,0.06)",
      gradient: "linear-gradient(135deg, #f0c040, #e08020)",
      badge: t("settings.planBadge"),
      features: t("settings.planFeatures.pro", { returnObjects: true }) as string[],
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      {/* Account Card */}
      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5 text-primary" /> {t("settings.account")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("settings.email")}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-account-email">
                {user?.primaryEmailAddress?.emailAddress ?? profile?.email ?? "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("settings.currentPlan")}</p>
              <p className="text-sm text-muted-foreground">{t("settings.planDesc")}</p>
            </div>
            <Badge
              variant="outline"
              data-testid="badge-plan"
              style={
                isPro
                  ? { borderColor: "rgba(240,192,64,0.5)", color: "#f0c040", background: "rgba(240,192,64,0.1)" }
                  : isPremium
                  ? { borderColor: "rgba(168,159,255,0.5)", color: "#a89fff", background: "rgba(124,107,255,0.1)" }
                  : {}
              }
            >
              {isPro ? (
                <><Crown className="w-3 h-3 mr-1" /> {t("common.pro")}</>
              ) : isPremium ? (
                <><Star className="w-3 h-3 mr-1" /> {t("common.premium")}</>
              ) : t("common.free")}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("settings.memberSince")}</p>
              <p className="text-sm text-muted-foreground font-mono">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("settings.sgiScore")}</p>
              <p className="text-sm text-muted-foreground font-mono">{t("settings.sgiScoreDesc")}</p>
            </div>
            <span className="text-2xl font-bold font-mono text-primary" data-testid="text-settings-sgi">
              {profile?.sgiScore?.toFixed(1) ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      {!isPro && (
        <div>
          <p className="text-sm font-medium mb-4 text-muted-foreground uppercase tracking-wider">{t("settings.upgrade")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PLANS.filter(p => !(isPremium && p.id === "premium")).map(p => {
              const Icon = p.icon;
              const isCurrent = plan === p.id;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl p-5 flex flex-col gap-4 relative"
                  style={{ background: p.bgColor, border: `1px solid ${p.borderColor}` }}
                >
                  {p.badge && (
                    <div className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: p.gradient, color: "#fff" }}>
                      {p.badge}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" style={{ color: p.color }} />
                    <span className="font-bold text-base" style={{ color: p.color }}>{p.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.period}</span>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: p.color }} />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2 mt-1 font-semibold"
                    data-testid={`button-upgrade-${p.id}`}
                    style={isCurrent ? {} : { background: p.gradient, color: "#fff" }}
                    variant={isCurrent ? "outline" : "default"}
                    onClick={() => setShowUpgradeModal(p.id as "premium" | "pro")}
                  >
                    <Icon className="w-4 h-4" />
                    {isCurrent ? t("settings.currentPlanBtn") : t("settings.activateBtn", { name: p.name })}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pro attivo */}
      {isPro && (
        <Card className="bg-card/40 backdrop-blur" style={{ border: "1px solid rgba(240,192,64,0.3)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: "#f0c040" }}>
              <Crown className="w-5 h-5" /> {t("settings.proActive")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("settings.proActiveDesc")}</p>
          </CardContent>
        </Card>
      )}

      {/* Premium attivo */}
      {isPremium && (
        <Card className="bg-card/40 backdrop-blur" style={{ border: "1px solid rgba(168,159,255,0.3)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: "#a89fff" }}>
              <Star className="w-5 h-5" /> {t("settings.premiumActive")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("settings.premiumActiveDesc")}</p>
          </CardContent>
        </Card>
      )}

      {/* Privacy */}
      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" /> {t("settings.privacy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("settings.publicRank")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.publicRankDesc")}</p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">{t("settings.anonymous")}</Badge>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.privacyNotice")}</p>
        </CardContent>
      </Card>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card" style={{ border: "1px solid rgba(124,107,255,0.3)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                {showUpgradeModal === "pro" ? <Crown className="w-5 h-5" /> : <Star className="w-5 h-5" />}
                {t("settings.modalTitle", { name: showUpgradeModal === "pro" ? t("common.pro") : t("common.premium") })}
              </CardTitle>
              <CardDescription>{t("settings.modalDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(124,107,255,0.06)", border: "1px solid rgba(124,107,255,0.2)" }}>
                <p className="text-2xl font-bold">{showUpgradeModal === "pro" ? "€19.99" : "€9.99"}</p>
                <p className="text-sm text-muted-foreground">{t("settings.perMonth")}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t("settings.stripeNotice")}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowUpgradeModal(null);
                  toast.info(t("settings.notifyToast"));
                }}
                data-testid="button-close-upgrade-modal"
              >
                {t("settings.closeBtn")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

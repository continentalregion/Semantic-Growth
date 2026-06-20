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

const PLANS = [
  {
    id: "premium",
    name: "Premium",
    price: "€9.99",
    period: "/mese",
    icon: Star,
    color: "#a89fff",
    borderColor: "rgba(168,159,255,0.3)",
    bgColor: "rgba(124,107,255,0.06)",
    gradient: "linear-gradient(135deg, #7c6bff, #5b4de0)",
    features: [
      "600 messaggi al mese",
      "Claude Haiku + Sonnet",
      "Predizioni di crescita (30/90/180 giorni)",
      "Mappa domini semantici avanzata",
      "Storico SGI 90 giorni",
      "Report mensile dettagliato",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€19.99",
    period: "/mese",
    icon: Crown,
    color: "#f0c040",
    borderColor: "rgba(240,192,64,0.4)",
    bgColor: "rgba(240,192,64,0.06)",
    gradient: "linear-gradient(135deg, #f0c040, #e08020)",
    badge: "Più potente",
    features: [
      "2.000 messaggi al mese",
      "Tutti i modelli: Haiku, Sonnet, Opus, GPT-4o",
      "Accesso prioritario all'AI",
      "Predizioni avanzate illimitate",
      "Storico SGI completo",
      "Export dati e analisi personalizzata",
    ],
  },
];

export default function Settings() {
  const { user } = useUser();
  const { data: profile, isLoading } = useGetMyProfile();
  const [showUpgradeModal, setShowUpgradeModal] = useState<"premium" | "pro" | null>(null);

  const plan = profile?.plan ?? "free";
  const isPremium = plan === "premium";
  const isPro     = plan === "pro";
  const isPaid    = isPremium || isPro;

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
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Account configuration and subscription management</p>
      </div>

      {/* Account Card */}
      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground" data-testid="text-account-email">
                {user?.primaryEmailAddress?.emailAddress ?? profile?.email ?? "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Piano attuale</p>
              <p className="text-sm text-muted-foreground">Il tuo tier di abbonamento</p>
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
                <><Crown className="w-3 h-3 mr-1" /> Pro</>
              ) : isPremium ? (
                <><Star className="w-3 h-3 mr-1" /> Premium</>
              ) : "Free"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Membro dal</p>
              <p className="text-sm text-muted-foreground font-mono">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("it-IT") : "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">SGI Score</p>
              <p className="text-sm text-muted-foreground font-mono">Indice di crescita semantica</p>
            </div>
            <span className="text-2xl font-bold font-mono text-primary" data-testid="text-settings-sgi">
              {profile?.sgiScore?.toFixed(1) ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards — mostrate solo se non è pro */}
      {!isPro && (
        <div>
          <p className="text-sm font-medium mb-4 text-muted-foreground uppercase tracking-wider">Upgrade</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PLANS.filter(p => !(isPremium && p.id === "premium")).map(p => {
              const Icon = p.icon;
              const isCurrent = plan === p.id;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl p-5 flex flex-col gap-4 relative"
                  style={{
                    background: p.bgColor,
                    border: `1px solid ${p.borderColor}`,
                  }}
                >
                  {p.badge && (
                    <div
                      className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: p.gradient, color: "#fff" }}
                    >
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
                    {isCurrent ? "Piano attuale" : `Attiva ${p.name}`}
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
              <Crown className="w-5 h-5" /> Pro Attivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Hai accesso completo a tutti i modelli AI, 2.000 messaggi al mese, predizioni avanzate e analisi personalizzata.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Premium attivo (mostra comunque l'opzione di upgrade a Pro) */}
      {isPremium && (
        <Card className="bg-card/40 backdrop-blur" style={{ border: "1px solid rgba(168,159,255,0.3)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: "#a89fff" }}>
              <Star className="w-5 h-5" /> Premium Attivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Hai 600 messaggi al mese con accesso a Haiku e Sonnet. Passa a Pro per Opus, GPT-4o e 2.000 messaggi.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Privacy */}
      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" /> Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Classifica pubblica</p>
              <p className="text-xs text-muted-foreground">Il tuo nome è anonimizzato sulla leaderboard</p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">Anonimo</Badge>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground leading-relaxed">
            SGI traccia i pattern semantici e linguistici delle tue conversazioni. Nessun contenuto personalmente identificabile viene conservato. Il testo viene processato esclusivamente per generare il tuo indice di crescita.
          </p>
        </CardContent>
      </Card>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card" style={{ border: "1px solid rgba(124,107,255,0.3)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                {showUpgradeModal === "pro" ? <Crown className="w-5 h-5" /> : <Star className="w-5 h-5" />}
                Attiva {showUpgradeModal === "pro" ? "Pro" : "Premium"}
              </CardTitle>
              <CardDescription>
                Il pagamento è in sviluppo. I piani saranno disponibili appena il checkout Stripe sarà attivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(124,107,255,0.06)", border: "1px solid rgba(124,107,255,0.2)" }}>
                <p className="text-2xl font-bold">{showUpgradeModal === "pro" ? "€19.99" : "€9.99"}</p>
                <p className="text-sm text-muted-foreground">al mese</p>
              </div>
              <p className="text-sm text-muted-foreground">
                L'integrazione Stripe è in fase di sviluppo. Sarai notificato non appena il checkout sarà disponibile.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowUpgradeModal(null);
                  toast.info("Ti notificheremo quando il pagamento sarà disponibile!");
                }}
                data-testid="button-close-upgrade-modal"
              >
                Chiudi
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

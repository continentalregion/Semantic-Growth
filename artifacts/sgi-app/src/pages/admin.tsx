import { useEffect, useState, useCallback } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, MessageSquare, AlertTriangle, TrendingUp, RefreshCw, Zap, DollarSign } from "lucide-react";

const ADMIN_EMAILS = ["francescoullo1@gmail.com"];
const API_BASE = "/api";

interface AdminStats {
  users: { total: number; byPlan: Record<string, number> };
  messages: { last24h: number; last7d: number };
  errors: { last24h: number; rate24hPct: number };
  cost: { last24hCents: number; last24hEur: number };
  models: Array<{ model: string; conversations: number }>;
  revenue: {
    stripe: { activeCount: number; totalMonthlyEur: number; error: string | null };
    db: { premiumCount: number; proCount: number; estimatedMonthlyEur: number };
  };
  generatedAt: string;
}

function StatCard({
  icon: Icon, label, value, sub, color, warn,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string | number; sub?: string;
  color?: string; warn?: boolean;
}) {
  return (
    <Card className="bg-card/50 backdrop-blur" style={{ border: warn ? "1px solid rgba(168,0,63,0.4)" : undefined }}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "#4a4a6a" }}>{label}</p>
            <p className="text-3xl font-bold font-mono" style={{ color: warn ? "#a8003f" : (color ?? "#1a1b2e") }}>{value}</p>
            {sub && <p className="text-xs mt-1" style={{ color: "#4a4a6a" }}>{sub}</p>}
          </div>
          <div className="p-2 rounded-lg" style={{ background: warn ? "rgba(168,0,63,0.1)" : "rgba(57,48,168,0.1)" }}>
            <Icon className="w-5 h-5" style={{ color: warn ? "#a8003f" : (color ?? "#3930a8") }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/admin/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("Not authorized");
      setStats(await r.json());
      setLastRefresh(new Date());
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  if (!isLoaded) return null;
  if (!isAdmin) return <Redirect to="/dashboard" />;

  const byPlan = stats?.users.byPlan ?? {};

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display" style={{ color: "#1a1b2e" }}>
            Admin Monitor
          </h2>
          <p className="text-sm mt-1" style={{ color: "#4a4a6a" }}>
            Live stats · auto-refresh 30s
            {lastRefresh && (
              <span className="ml-2 font-mono text-xs" style={{ color: "#4a4a6a" }}>
                · aggiornato {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: "rgba(124,107,255,0.15)",
            border: "1px solid rgba(124,107,255,0.3)",
            color: "#3930a8",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Ricarica
        </button>
      </div>

      {/* Users */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#4a4a6a" }}>Utenti</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Totale" value={stats?.users.total ?? "—"} color="#3930a8" />
          <StatCard icon={Users} label="Free" value={byPlan["free"] ?? 0} sub="piano gratuito" />
          <StatCard icon={Zap} label="Premium" value={byPlan["premium"] ?? 0} sub="€14.99/mese" color="#7e22ce" />
          <StatCard icon={Zap} label="Pro" value={byPlan["pro"] ?? 0} sub="€29.99/mese" color="#0d7a5e" />
        </div>
      </div>

      {/* Revenue — Stripe (source of truth) */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#4a4a6a" }}>
          Abbonati Stripe attivi
          <span className="ml-2 normal-case" style={{ color: "#4a4a6a" }}>· fonte di verità</span>
        </h3>
        {stats?.revenue.stripe.error ? (
          <Card className="bg-card/50 backdrop-blur" style={{ border: "1px solid rgba(247,37,133,0.4)" }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "#a8003f" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#a8003f" }}>Stripe non raggiungibile</p>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "#4a4a6a" }}>{stats.revenue.stripe.error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              icon={Users}
              label="Abbonati attivi"
              value={stats?.revenue.stripe.activeCount ?? "—"}
              sub="subscription active / trialing"
              color="#0d7a5e"
            />
            <StatCard
              icon={TrendingUp}
              label="MRR reale"
              value={`€${stats?.revenue.stripe.totalMonthlyEur.toFixed(2) ?? "—"}`}
              sub="da Stripe — fonte di verità"
              color="#a8003f"
            />
          </div>
        )}
      </div>

      {/* Revenue — DB plan counts (reference / debug) */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#4a4a6a" }}>
          Utenti DB per piano
          <span className="ml-2 normal-case" style={{ color: "#4a4a6a" }}>· riferimento debug</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={Zap} label="Premium (DB)" value={stats?.revenue.db.premiumCount ?? "—"} sub="conteggio nel DB" color="#7e22ce" />
          <StatCard icon={Zap} label="Pro (DB)" value={stats?.revenue.db.proCount ?? "—"} sub="conteggio nel DB" color="#0d7a5e" />
          <StatCard
            icon={DollarSign}
            label="Stimato (DB)"
            value={`€${stats?.revenue.db.estimatedMonthlyEur.toFixed(2) ?? "—"}`}
            sub="se tutti i piani DB fossero reali"
            color="#4a4a6a"
          />
        </div>
      </div>

      {/* Messages & Errors */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#4a4a6a" }}>Messaggi & Errori</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="Msg 24h" value={stats?.messages.last24h ?? "—"} color="#3930a8" />
          <StatCard icon={MessageSquare} label="Msg 7 giorni" value={stats?.messages.last7d ?? "—"} color="#0e7490" />
          <StatCard
            icon={AlertTriangle}
            label="Errori 24h"
            value={stats?.errors.last24h ?? "—"}
            sub={stats ? `${stats.errors.rate24hPct}% del totale` : undefined}
            warn={(stats?.errors.rate24hPct ?? 0) > 5}
          />
          <StatCard
            icon={Activity}
            label="Costo AI 24h"
            value={`€${stats?.cost.last24hEur.toFixed(3) ?? "—"}`}
            sub={`${stats?.cost.last24hCents ?? "—"} centesimi`}
            color="#b45309"
          />
        </div>
      </div>

      {/* Error rate bar */}
      {stats && (
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tasso di errore 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(stats.errors.rate24hPct, 100)}%`,
                    background: stats.errors.rate24hPct > 10 ? "#f72585" : stats.errors.rate24hPct > 3 ? "#f59e0b" : "#10b981",
                  }}
                />
              </div>
              <span className="font-mono text-sm font-bold" style={{
                color: stats.errors.rate24hPct > 10 ? "#a8003f" : stats.errors.rate24hPct > 3 ? "#b45309" : "#15803d",
              }}>
                {stats.errors.rate24hPct}%
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: "#4a4a6a" }}>
              {stats.errors.rate24hPct < 1
                ? "✅ Ottimo — nessun problema significativo"
                : stats.errors.rate24hPct < 5
                ? "⚠️ Attenzione — tasso di errore moderato"
                : "🔴 Critico — indagare immediatamente"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Model breakdown */}
      {stats && stats.models.length > 0 && (
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Modelli usati (ultimi 7 giorni)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.models
                .sort((a, b) => b.conversations - a.conversations)
                .map(m => {
                  const total = stats.models.reduce((s, x) => s + x.conversations, 0);
                  const pct = total > 0 ? Math.round((m.conversations / total) * 100) : 0;
                  const isAnthropic = m.model.startsWith("claude");
                  return (
                    <div key={m.model}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "#1a1b2e" }}>
                          {isAnthropic ? "⚡ " : "🤖 "}{m.model}
                        </span>
                        <span className="font-mono" style={{ color: "#4a4a6a" }}>
                          {m.conversations} conv · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: isAnthropic ? "#f59e0b" : "#3930a8",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-center" style={{ color: "#4a4a6a" }}>
        Generato: {stats?.generatedAt ? new Date(stats.generatedAt).toLocaleString() : "—"} · Accesso riservato all'admin
      </p>
    </div>
  );
}

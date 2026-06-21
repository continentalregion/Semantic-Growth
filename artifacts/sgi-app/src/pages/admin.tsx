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
  revenue: { premiumMonthly: number; proMonthly: number; totalMonthly: number };
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
    <Card className="bg-card/50 backdrop-blur" style={{ border: warn ? "1px solid rgba(247,37,133,0.4)" : undefined }}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "#7070a0" }}>{label}</p>
            <p className="text-3xl font-bold font-mono" style={{ color: warn ? "#f72585" : (color ?? "#eeeeff") }}>{value}</p>
            {sub && <p className="text-xs mt-1" style={{ color: "#9090b8" }}>{sub}</p>}
          </div>
          <div className="p-2 rounded-lg" style={{ background: warn ? "rgba(247,37,133,0.1)" : "rgba(124,107,255,0.1)" }}>
            <Icon className="w-5 h-5" style={{ color: warn ? "#f72585" : (color ?? "#7c6bff") }} />
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
          <h2 className="text-3xl font-bold tracking-tight font-display" style={{ color: "#eeeeff" }}>
            Admin Monitor
          </h2>
          <p className="text-sm mt-1" style={{ color: "#9090b8" }}>
            Live stats · auto-refresh 30s
            {lastRefresh && (
              <span className="ml-2 font-mono text-xs" style={{ color: "#7070a0" }}>
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
            color: "#a89fff",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Ricarica
        </button>
      </div>

      {/* Users */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#7070a0" }}>Utenti</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Totale" value={stats?.users.total ?? "—"} color="#7c6bff" />
          <StatCard icon={Users} label="Free" value={byPlan["free"] ?? 0} sub="piano gratuito" />
          <StatCard icon={Zap} label="Premium" value={byPlan["premium"] ?? 0} sub="€9.99/mese" color="#a855f7" />
          <StatCard icon={Zap} label="Pro" value={byPlan["pro"] ?? 0} sub="€19.99/mese" color="#06d6a0" />
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#7070a0" }}>Revenue stimato</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={DollarSign} label="Da Premium" value={`€${stats?.revenue.premiumMonthly.toFixed(2) ?? "—"}`} sub="al mese" color="#a855f7" />
          <StatCard icon={DollarSign} label="Da Pro" value={`€${stats?.revenue.proMonthly.toFixed(2) ?? "—"}`} sub="al mese" color="#06d6a0" />
          <StatCard icon={TrendingUp} label="Totale MRR" value={`€${stats?.revenue.totalMonthly.toFixed(2) ?? "—"}`} sub="mensile ricorrente" color="#f72585" />
        </div>
      </div>

      {/* Messages & Errors */}
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#7070a0" }}>Messaggi & Errori</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="Msg 24h" value={stats?.messages.last24h ?? "—"} color="#7c6bff" />
          <StatCard icon={MessageSquare} label="Msg 7 giorni" value={stats?.messages.last7d ?? "—"} color="#06b6d4" />
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
            color="#f59e0b"
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
                color: stats.errors.rate24hPct > 10 ? "#f72585" : stats.errors.rate24hPct > 3 ? "#f59e0b" : "#10b981",
              }}>
                {stats.errors.rate24hPct}%
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: "#9090b8" }}>
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
                        <span style={{ color: "#eeeeff" }}>
                          {isAnthropic ? "⚡ " : "🤖 "}{m.model}
                        </span>
                        <span className="font-mono" style={{ color: "#9090b8" }}>
                          {m.conversations} conv · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: isAnthropic ? "#f59e0b" : "#7c6bff",
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

      <p className="text-xs text-center" style={{ color: "#7070a0" }}>
        Generato: {stats?.generatedAt ? new Date(stats.generatedAt).toLocaleString() : "—"} · Accesso riservato all'admin
      </p>
    </div>
  );
}

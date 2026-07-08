import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const REFRESH_MS = 30_000;

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
  label,
  value,
  sub,
  color,
  warn,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  warn?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const colors = useColors();
  const accent = warn ? palette.pink : (color ?? colors.primary);
  return (
    <View
      style={[
        statStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: warn ? palette.pink + "55" : colors.border,
        },
      ]}
    >
      <View style={statStyles.row}>
        <View style={statStyles.texts}>
          <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
          <Text style={[statStyles.value, { color: accent }]}>{value}</Text>
          {sub ? (
            <Text style={[statStyles.sub, { color: colors.mutedForeground }]}>{sub}</Text>
          ) : null}
        </View>
        {icon ? (
          <View
            style={[
              statStyles.iconBox,
              { backgroundColor: accent + "18", borderColor: accent + "30" },
            ]}
          >
            <Ionicons name={icon} size={18} color={accent} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10, marginTop: 4 }}>
      <Text style={[secStyles.title, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      {subtitle ? (
        <Text style={[secStyles.sub, { color: colors.mutedForeground + "80" }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function BarRow({
  label,
  pct,
  value,
  color,
}: {
  label: string;
  pct: number;
  value: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
          {label}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
          {value}
        </Text>
      </View>
      <View style={[barStyles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            barStyles.fill,
            { width: `${Math.min(Math.max(pct, 0), 100)}%` as `${number}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

export default function AdminMonitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/admin/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401 || res.status === 403) {
        setError("Accesso negato. Solo l'admin può visualizzare questa schermata.");
        setStats(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json() as AdminStats);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di rete");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(fetchStats, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchStats]);

  const errorRate = stats?.errors.rate24hPct ?? 0;
  const errorBarColor =
    errorRate > 10 ? palette.pink : errorRate > 3 ? palette.warning : palette.teal;

  const byPlan = stats?.users.byPlan ?? {};
  const totalConvs = (stats?.models ?? []).reduce((s, m) => s + m.conversations, 0);

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Admin Monitor</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {lastRefresh
              ? `Aggiornato ${lastRefresh.toLocaleTimeString()} · auto 30s`
              : "Live stats · auto-refresh 30s"}
          </Text>
        </View>
        <Pressable
          onPress={fetchStats}
          disabled={loading}
          style={({ pressed }) => [
            styles.refreshBtn,
            {
              backgroundColor: colors.primary + "18",
              borderColor: colors.primary + "44",
              opacity: loading || pressed ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={colors.primary}
            style={loading ? { opacity: 0.5 } : undefined}
          />
          <Text style={[styles.refreshLabel, { color: colors.primary }]}>Ricarica</Text>
        </Pressable>
      </View>

      {/* Error state */}
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: palette.pink + "44" }]}>
          <Ionicons name="lock-closed-outline" size={32} color={palette.pink} />
          <Text style={[styles.errorText, { color: palette.pink }]}>{error}</Text>
        </View>
      ) : loading && !stats ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: (Platform.OS === "web" ? 34 : tabBarHeight) + 24,
            gap: 8,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Utenti ── */}
          <SectionTitle title="Utenti" />
          <View style={styles.grid2}>
            <StatCard label="Totale" value={stats?.users.total ?? "—"} icon="people-outline" color={colors.primary} />
            <StatCard label="Free" value={byPlan["free"] ?? 0} icon="person-outline" sub="piano gratuito" />
          </View>
          <View style={styles.grid2}>
            <StatCard label="Premium" value={byPlan["premium"] ?? 0} icon="flash-outline" sub="€9.99/mese" color={palette.primary} />
            <StatCard label="Pro" value={byPlan["pro"] ?? 0} icon="rocket-outline" sub="€19.99/mese" color={palette.teal} />
          </View>

          {/* ── Revenue Stripe ── */}
          <SectionTitle title="Abbonati Stripe" subtitle="· fonte di verità" />
          {stats?.revenue.stripe.error ? (
            <View style={[styles.errorInline, { backgroundColor: colors.card, borderColor: palette.pink + "44" }]}>
              <Ionicons name="warning-outline" size={16} color={palette.pink} />
              <Text style={[styles.errorInlineText, { color: palette.pink }]}>
                Stripe non raggiungibile — {stats.revenue.stripe.error}
              </Text>
            </View>
          ) : (
            <View style={styles.grid2}>
              <StatCard
                label="Abbonati attivi"
                value={stats?.revenue.stripe.activeCount ?? "—"}
                icon="people-circle-outline"
                sub="active / trialing"
                color={palette.teal}
              />
              <StatCard
                label="MRR reale"
                value={`€${(stats?.revenue.stripe.totalMonthlyEur ?? 0).toFixed(2)}`}
                icon="trending-up-outline"
                sub="da Stripe"
                color={palette.pink}
              />
            </View>
          )}

          {/* ── Revenue DB (debug) ── */}
          <SectionTitle title="Utenti DB per piano" subtitle="· riferimento debug" />
          <View style={styles.grid2}>
            <StatCard label="Premium (DB)" value={stats?.revenue.db.premiumCount ?? "—"} color={palette.primary} />
            <StatCard label="Pro (DB)" value={stats?.revenue.db.proCount ?? "—"} color={palette.teal} />
          </View>
          <StatCard
            label="Stimato (DB)"
            value={`€${(stats?.revenue.db.estimatedMonthlyEur ?? 0).toFixed(2)}`}
            sub="se tutti i piani DB fossero reali"
            color={colors.mutedForeground}
          />

          {/* ── Messaggi ── */}
          <SectionTitle title="Messaggi" />
          <View style={styles.grid2}>
            <StatCard label="Msg 24h" value={stats?.messages.last24h ?? "—"} icon="chatbubble-outline" color={colors.primary} />
            <StatCard label="Msg 7 giorni" value={stats?.messages.last7d ?? "—"} icon="calendar-outline" color={palette.teal} />
          </View>

          {/* ── Errori ── */}
          <SectionTitle title="Errori" />
          <View style={styles.grid2}>
            <StatCard
              label="Errori 24h"
              value={stats?.errors.last24h ?? "—"}
              icon="alert-circle-outline"
              warn={(errorRate) > 5}
            />
            <StatCard
              label="Rate 24h"
              value={`${errorRate}%`}
              sub={
                errorRate < 1
                  ? "✅ Ottimo"
                  : errorRate < 5
                  ? "⚠️ Moderato"
                  : "🔴 Critico"
              }
              warn={errorRate > 5}
            />
          </View>

          {/* Error rate bar */}
          {stats ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tasso di errore 24h</Text>
              <View style={[barStyles.track, { backgroundColor: colors.border, marginTop: 8 }]}>
                <View
                  style={[
                    barStyles.fill,
                    {
                      width: `${Math.min(errorRate, 100)}%` as `${number}%`,
                      backgroundColor: errorBarColor,
                    },
                  ]}
                />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {errorRate < 1
                    ? "Nessun problema significativo"
                    : errorRate < 5
                    ? "Tasso di errore moderato"
                    : "Indagare immediatamente"}
                </Text>
                <Text style={{ color: errorBarColor, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {errorRate}%
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── Costo AI ── */}
          <SectionTitle title="Costo AI" />
          <StatCard
            label="Costo 24h"
            value={`€${(stats?.cost.last24hEur ?? 0).toFixed(3)}`}
            sub={`${stats?.cost.last24hCents ?? "—"} centesimi`}
            icon="cash-outline"
            color={palette.warning}
          />

          {/* ── Modelli ── */}
          {stats && stats.models.length > 0 ? (
            <>
              <SectionTitle title="Modelli usati" subtitle="· ultimi 7 giorni" />
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {stats.models
                  .slice()
                  .sort((a, b) => b.conversations - a.conversations)
                  .map((m) => {
                    const pct = totalConvs > 0 ? Math.round((m.conversations / totalConvs) * 100) : 0;
                    const isClaude = m.model.startsWith("claude");
                    return (
                      <BarRow
                        key={m.model}
                        label={`${isClaude ? "⚡ " : "🤖 "}${m.model}`}
                        pct={pct}
                        value={`${m.conversations} conv · ${pct}%`}
                        color={isClaude ? palette.warning : colors.primary}
                      />
                    );
                  })}
              </View>
            </>
          ) : null}

          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            Generato: {stats?.generatedAt ? new Date(stats.generatedAt).toLocaleString() : "—"}
            {"\n"}Accesso riservato all'admin
          </Text>
        </ScrollView>
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorBox: {
    flex: 1,
    margin: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grid2: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  errorInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  errorInlineText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  footer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  texts: { flex: 1, gap: 3 },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    flexShrink: 0,
  },
});

const secStyles = StyleSheet.create({
  title: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});

const barStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});

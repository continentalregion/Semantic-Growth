import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { fetch } from "expo/fetch";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { usePurchase } from "@/hooks/usePurchase";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeclaredFact {
  id: number;
  fact: string;
  declaredAt: string;
}

interface PublicSummary {
  sgiScore: number | null;
  sgiTrend: { daily: number | null; weekly: number | null; monthly: number | null };
  globalRank: number | null;
  totalUsers: number;
  percentile: number | null;
  rankChange30d: number | null;
  macroDimensions: Record<string, number>;
  topDimension: string | null;
  level: number;
  xp: number;
  streakDays: number;
}

interface DomainDominant {
  domain: string;
  pct: number;
  window_days: number;
  threshold: number;
}

interface DomainsData {
  lavoro: DomainDominant | null;
  studio: DomainDominant | null;
  hobby: DomainDominant | null;
}

interface InferredFact {
  id: number;
  fact: string;
  persistenceLevel: string;
  status: string;
  lastReinforcedAt: string;
}

interface NarrativeData {
  narrative: string;
  cached: boolean;
  generatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "appena aggiornata";
  if (diffMin === 1) return "1 minuto fa";
  if (diffMin < 60) return `${diffMin} minuti fa`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH} ${diffH === 1 ? "ora" : "ore"} fa`;
}

function persistenceLabel(level: string): string {
  if (level === "alta") return "alta";
  if (level === "media") return "media";
  return "bassa";
}

function persistenceColor(level: string, primary: string): string {
  if (level === "alta") return primary;
  if (level === "media") return primary + "bb";
  return primary + "77";
}

// ─── Pro Gate ─────────────────────────────────────────────────────────────────

function ProGate({
  colors,
  onUpgrade,
}: {
  colors: ReturnType<typeof useColors>;
  onUpgrade: () => void;
}) {
  return (
    <View style={st.gateContainer}>
      <View style={[st.gateLockCircle, { backgroundColor: palette.primary + "18", borderColor: palette.primary + "33" }]}>
        <Ionicons name="lock-closed" size={30} color={palette.primary} />
      </View>
      <Text style={[st.gateTitle, { color: colors.foreground }]}>
        Context File Pro
      </Text>
      <Text style={[st.gateDesc, { color: colors.mutedForeground }]}>
        Il tuo ritratto intellettuale generato dall'AI — narrativa personalizzata, aree di dominanza e fatti dedotti dalle tue conversazioni.
      </Text>
      <Pressable
        style={({ pressed }) => [st.gateBtn, { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 }]}
        onPress={onUpgrade}
      >
        <Ionicons name="sparkles" size={18} color="#fff" />
        <Text style={st.gateBtnText}>Passa a Pro</Text>
      </Pressable>
      <Text style={[st.gateUnlock, { color: colors.mutedForeground }]}>
        Disponibile esclusivamente nel piano Pro
      </Text>
    </View>
  );
}

// ─── Section: Narrative ───────────────────────────────────────────────────────

function NarrativeSection({
  data,
  isLoading,
  isError,
  refetch,
  colors,
}: {
  data: NarrativeData | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.sectionHeader}>
        <Ionicons name="sparkles" size={16} color={palette.primary} />
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Narrativa AI</Text>
      </View>

      {isLoading && !data && (
        <View style={{ gap: 8 }}>
          <SkeletonBox style={{ height: 16, borderRadius: 6 }} />
          <SkeletonBox style={{ height: 16, borderRadius: 6, width: "90%" }} />
          <SkeletonBox style={{ height: 16, borderRadius: 6, width: "80%" }} />
          <SkeletonBox style={{ height: 16, borderRadius: 6 }} />
        </View>
      )}

      {isError && !data && (
        <View style={[st.errorBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[st.errorText, { color: colors.mutedForeground }]}>
            Narrativa non disponibile, riprova
          </Text>
          <Pressable onPress={refetch} hitSlop={8}>
            <Ionicons name="refresh-outline" size={16} color={palette.primary} />
          </Pressable>
        </View>
      )}

      {data && (
        <>
          <Text style={[st.narrativeText, { color: colors.foreground }]}>{data.narrative}</Text>
          <Text style={[st.narrativeMeta, { color: colors.mutedForeground }]}>
            {data.cached ? "Dal cache · " : ""}Aggiornata {formatRelativeTime(data.generatedAt)}
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Section: Public Summary (B) ─────────────────────────────────────────────

function PublicSummarySection({
  data,
  isLoading,
  colors,
}: {
  data: PublicSummary | undefined;
  isLoading: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.sectionHeader}>
        <Ionicons name="bar-chart-outline" size={16} color={palette.primary} />
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Profilo SGI</Text>
      </View>

      {isLoading && !data ? (
        <View style={{ gap: 10 }}>
          <SkeletonBox style={{ height: 44, borderRadius: 10 }} />
          <SkeletonBox style={{ height: 44, borderRadius: 10 }} />
        </View>
      ) : data ? (
        <View style={{ gap: 12 }}>
          <View style={st.statRow}>
            <View style={[st.statBox, { backgroundColor: palette.primary + "0f", borderColor: palette.primary + "22" }]}>
              <Text style={[st.statValue, { color: palette.primary }]}>
                {data.sgiScore != null ? data.sgiScore.toFixed(1) : "—"}
              </Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>SGI Score</Text>
            </View>
            <View style={[st.statBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[st.statValue, { color: colors.foreground }]}>Lv.{data.level}</Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>{data.xp} XP</Text>
            </View>
          </View>

          <View style={st.statRow}>
            <View style={[st.statBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[st.statValue, { color: colors.foreground }]}>
                {data.globalRank != null ? `#${data.globalRank}` : "—"}
              </Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>Posizione globale</Text>
            </View>
            <View style={[st.statBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[st.statValue, { color: colors.foreground }]}>
                {data.streakDays > 0 ? `${data.streakDays}gg` : "—"}
              </Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>Streak</Text>
            </View>
          </View>

          {data.topDimension && (
            <View style={[st.topDimRow, { backgroundColor: palette.primary + "0a", borderColor: palette.primary + "22" }]}>
              <Ionicons name="star-outline" size={14} color={palette.primary} />
              <Text style={[st.topDimText, { color: palette.primary }]}>
                Punto di forza: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{data.topDimension}</Text>
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ─── Section: Domain Dominance (C) ───────────────────────────────────────────

const DOMAIN_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  lavoro: "briefcase-outline",
  studio: "book-outline",
  hobby: "game-controller-outline",
};

function DomainsSection({
  data,
  isLoading,
  colors,
}: {
  data: DomainsData | undefined;
  isLoading: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const activeAreas = data
    ? (["lavoro", "studio", "hobby"] as const).filter(k => data[k] != null)
    : [];

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.sectionHeader}>
        <Ionicons name="layers-outline" size={16} color={palette.primary} />
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Aree di interesse</Text>
      </View>

      {isLoading && !data ? (
        <View style={{ gap: 8 }}>
          <SkeletonBox style={{ height: 40, borderRadius: 10 }} />
          <SkeletonBox style={{ height: 40, borderRadius: 10 }} />
        </View>
      ) : activeAreas.length === 0 ? (
        <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
          Nessuna area dominante rilevata ancora. Continua a conversare.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {activeAreas.map(key => {
            const d = data![key]!;
            return (
              <View key={key} style={[st.domainRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name={DOMAIN_ICONS[key] ?? "ellipse-outline"} size={18} color={palette.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.domainName, { color: colors.foreground }]}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{d.domain}</Text>
                  </Text>
                  <Text style={[st.domainMeta, { color: colors.mutedForeground }]}>
                    {d.pct}% delle ultime {d.window_days === 42 ? "6 settimane" : d.window_days === 21 ? "3 settimane" : "2 settimane"}
                  </Text>
                </View>
                <View style={[st.domainPct, { backgroundColor: palette.primary + "18", borderColor: palette.primary + "33" }]}>
                  <Text style={{ color: palette.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{d.pct}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Section: Declared Facts (A) — read-only in Step 1 ───────────────────────

function DeclaredFactsSection({
  data,
  isLoading,
  colors,
}: {
  data: DeclaredFact[] | undefined;
  isLoading: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.sectionHeader}>
        <Ionicons name="person-outline" size={16} color={palette.primary} />
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Fatti dichiarati</Text>
        {data && (
          <Text style={[st.sectionCount, { color: colors.mutedForeground }]}>{data.length}/10</Text>
        )}
      </View>

      {isLoading && !data ? (
        <View style={{ gap: 6 }}>
          <SkeletonBox style={{ height: 32, borderRadius: 8 }} />
          <SkeletonBox style={{ height: 32, borderRadius: 8 }} />
          <SkeletonBox style={{ height: 32, borderRadius: 8 }} />
        </View>
      ) : !data || data.length === 0 ? (
        <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
          Nessun fatto dichiarato. Aggiungi informazioni su di te per personalizzare il Context File.
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {data.map(fact => (
            <View key={fact.id} style={[st.factRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle-outline" size={15} color={palette.primary} style={{ marginTop: 1 }} />
              <Text style={[st.factText, { color: colors.foreground }]}>{fact.fact}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Section: Inferred Facts (D) ─────────────────────────────────────────────

function InferredFactsSection({
  data,
  isLoading,
  colors,
}: {
  data: InferredFact[] | undefined;
  isLoading: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const active = data?.filter(f => f.status === "active") ?? [];
  const stale = data?.filter(f => f.status === "stale") ?? [];

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.sectionHeader}>
        <Ionicons name="bulb-outline" size={16} color={palette.primary} />
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Fatti dedotti dall'AI</Text>
      </View>
      <Text style={[st.sectionSubtitle, { color: colors.mutedForeground }]}>
        Rilevati automaticamente dalle tue conversazioni
      </Text>

      {isLoading && !data ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          <SkeletonBox style={{ height: 32, borderRadius: 8 }} />
          <SkeletonBox style={{ height: 32, borderRadius: 8 }} />
          <SkeletonBox style={{ height: 32, borderRadius: 8 }} />
        </View>
      ) : !data || data.length === 0 ? (
        <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
          Nessun fatto dedotto ancora. Continua a conversare con SGI.
        </Text>
      ) : (
        <View style={{ gap: 6, marginTop: 8 }}>
          {active.map(fact => (
            <View key={fact.id} style={[st.inferredRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.factText, { color: colors.foreground }]}>{fact.fact}</Text>
              </View>
              <View style={[st.persistenceBadge, { backgroundColor: persistenceColor(fact.persistenceLevel, palette.primary) + "22", borderColor: persistenceColor(fact.persistenceLevel, palette.primary) + "44" }]}>
                <Text style={{ color: persistenceColor(fact.persistenceLevel, palette.primary), fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                  {persistenceLabel(fact.persistenceLevel)}
                </Text>
              </View>
            </View>
          ))}
          {stale.length > 0 && (
            <>
              <Text style={[st.staleLabel, { color: colors.mutedForeground }]}>Meno recenti</Text>
              {stale.map(fact => (
                <View key={fact.id} style={[st.inferredRow, { backgroundColor: colors.muted, borderColor: colors.border, opacity: 0.6 }]}>
                  <Text style={[st.factText, { color: colors.mutedForeground }]}>{fact.fact}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ContextFileScreen() {
  const { getToken } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { triggerPurchase } = usePurchase();

  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const isPro = profile?.plan === "pro";

  async function authFetch<T>(path: string): Promise<T> {
    const token = await getToken();
    const r = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json() as Promise<T>;
  }

  const { data: facts, isLoading: factsLoading } = useQuery({
    queryKey: ["context-file-facts"],
    queryFn: () => authFetch<DeclaredFact[]>("/api/users/me/context-file/facts"),
    enabled: isPro,
    staleTime: 5 * 60 * 1000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["context-file-summary"],
    queryFn: () => authFetch<PublicSummary>("/api/users/me/context-file/public-summary"),
    enabled: isPro,
    staleTime: 5 * 60 * 1000,
  });

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["context-file-domains"],
    queryFn: () => authFetch<DomainsData>("/api/users/me/context-file/domains"),
    enabled: isPro,
    staleTime: 5 * 60 * 1000,
  });

  const { data: inferredFacts, isLoading: inferredLoading } = useQuery({
    queryKey: ["context-file-inferred"],
    queryFn: () => authFetch<InferredFact[]>("/api/users/me/context-file/inferred-facts"),
    enabled: isPro,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: narrative,
    isLoading: narrativeLoading,
    isError: narrativeError,
    refetch: refetchNarrative,
  } = useQuery({
    queryKey: ["context-file-narrative"],
    queryFn: () => authFetch<NarrativeData>("/api/users/me/context-file/narrative"),
    enabled: isPro,
    staleTime: 0,
    retry: 1,
  });

  const header = (
    <View style={[st.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
      <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.foreground} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>Context File</Text>
        <Text style={[st.headerSubtitle, { color: colors.mutedForeground }]}>Il tuo ritratto intellettuale</Text>
      </View>
    </View>
  );

  if (profileLoading) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <SkeletonBox style={{ height: 130, borderRadius: 16 }} />
          <SkeletonBox style={{ height: 110, borderRadius: 16 }} />
          <SkeletonBox style={{ height: 130, borderRadius: 16 }} />
        </ScrollView>
      </AnimatedScreen>
    );
  }

  if (!isPro) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <ProGate colors={colors} onUpgrade={() => triggerPurchase("pro")} />
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: tabBarHeight + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <NarrativeSection
          data={narrative}
          isLoading={narrativeLoading}
          isError={narrativeError}
          refetch={refetchNarrative}
          colors={colors}
        />
        <PublicSummarySection
          data={summary}
          isLoading={summaryLoading}
          colors={colors}
        />
        <DomainsSection
          data={domains}
          isLoading={domainsLoading}
          colors={colors}
        />
        <DeclaredFactsSection
          data={facts}
          isLoading={factsLoading}
          colors={colors}
        />
        <InferredFactsSection
          data={inferredFacts}
          isLoading={inferredLoading}
          colors={colors}
        />
      </ScrollView>
    </AnimatedScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  backBtn: { padding: 4 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  sectionCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -4 },

  narrativeText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  narrativeMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  statRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

  topDimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topDimText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  domainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  domainName: { fontSize: 13, fontFamily: "Inter_400Regular" },
  domainMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  domainPct: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  factText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  inferredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  persistenceBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  staleLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginLeft: 2,
  },

  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  gateLockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  gateTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  gateDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 6,
  },
  gateBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  gateUnlock: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});

import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useGetMyProfile, useGetSgiHistory } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";

const MACRO_DIMS = [
  { key: "profondita",   label: "Profondità",   icon: "🧠", color: palette.primary },
  { key: "connettivita", label: "Connettività",  icon: "🔗", color: palette.cyan },
  { key: "precisione",   label: "Precisione",    icon: "🎯", color: palette.violet },
  { key: "revisione",    label: "Revisione",     icon: "🔄", color: palette.teal },
] as const;

function DeltaChip({
  label, value, colors,
}: {
  label: string;
  value: number | null | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  const v = value ?? 0;
  const up = v >= 0;
  const c = up ? colors.teal : colors.destructive;
  return (
    <View style={[chipStyles.root, { backgroundColor: c + "18", borderColor: c + "33" }]}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={11} color={c} />
      <Text style={[chipStyles.val, { color: c }]}>{up ? "+" : ""}{v.toFixed(2)}</Text>
      <Text style={[chipStyles.lbl, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  val: { fontSize: 12, fontFamily: "Inter_700Bold" },
  lbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

function ProgressBar({ value, color, bg }: { value: number; color: string; bg: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: bg, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
    isRefetching: refetchingProfile,
  } = useGetMyProfile();

  const {
    data: history,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useGetSgiHistory({ days: 30 });

  const isLoading = profileLoading || historyLoading;
  const isRefreshing = refetchingProfile;

  const macro = (profile as unknown as {
    macroDimensions?: {
      profondita?: number;
      connettivita?: number;
      precisione?: number;
      revisione?: number;
    };
  })?.macroDimensions;

  const histArr = Array.isArray(history) ? history : [];
  const sorted = [...histArr]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-14);
  const scores = sorted.map(h => h.score);

  const planLabel = { free: "Free", premium: "Premium ⚡", pro: "Pro 🚀" }[profile?.plan ?? "free"] ?? "Free";
  const planColor = { free: colors.mutedForeground, premium: colors.gold, pro: colors.teal }[profile?.plan ?? "free"] ?? colors.mutedForeground;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[
        styles.header,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          borderBottomColor: colors.border,
        },
      ]}>
        <Ionicons name="analytics" size={20} color={colors.primary} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Dashboard</Text>
        <View style={[styles.planChip, { borderColor: planColor + "44", backgroundColor: planColor + "18" }]}>
          <Text style={{ color: planColor, fontSize: colors.font.size.xs, fontFamily: colors.font.family.semibold }}>{planLabel}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: colors.spacing.lg,
            paddingTop: colors.spacing.lg,
            paddingBottom: tabBarHeight + colors.spacing.lg,
            gap: colors.spacing.lg,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { refetchProfile(); refetchHistory(); }}
              tintColor={colors.primary}
            />
          }
        >
          {/* SGI Score card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary + "33" }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>SGI SCORE</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: colors.spacing.md, marginTop: colors.spacing.xs }}>
              <Text style={[styles.bigScore, { color: colors.primary }]}>
                {(profile?.sgiScore ?? 0).toFixed(1)}
              </Text>
              <View style={{ gap: colors.spacing.xs, paddingBottom: colors.spacing.sm, flexDirection: "row", flexWrap: "wrap", flex: 1 }}>
                <DeltaChip label="oggi" value={profile?.sgiDailyDelta} colors={colors} />
                <DeltaChip label="settimana" value={profile?.sgiWeeklyDelta} colors={colors} />
                <DeltaChip label="mese" value={profile?.sgiMonthlyDelta} colors={colors} />
              </View>
            </View>
            {scores.length >= 2 && (
              <View style={{ marginTop: colors.spacing.md }}>
                <Text style={{ color: colors.mutedForeground, fontSize: colors.font.size.xs, fontFamily: colors.font.family.regular, marginBottom: colors.spacing.sm }}>
                  Ultimi 14 giorni
                </Text>
                <View style={{ flexDirection: "row", gap: colors.spacing.xs, alignItems: "flex-end", height: 40 }}>
                  {scores.map((s, i) => {
                    const min = Math.min(...scores);
                    const max = Math.max(...scores);
                    const range = max - min || 1;
                    const pct = (s - min) / range;
                    const h = Math.max(4, Math.round(pct * 36));
                    return (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          height: h,
                          borderRadius: colors.radii.xs,
                          backgroundColor: i === scores.length - 1 ? colors.primary : colors.primary + "44",
                          alignSelf: "flex-end",
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Rank row */}
          {(profile?.globalRank != null || profile?.percentile != null) && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", gap: 0 }]}>
              {profile?.globalRank != null && (
                <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Ionicons name="trophy" size={18} color={colors.gold} />
                  <Text style={[styles.statNum, { color: colors.foreground }]}>#{profile.globalRank}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Posizione globale</Text>
                </View>
              )}
              {profile?.percentile != null && (
                <View style={styles.statCell}>
                  <Ionicons name="stats-chart" size={18} color={colors.teal} />
                  <Text style={[styles.statNum, { color: colors.foreground }]}>Top {(100 - profile.percentile).toFixed(0)}%</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Percentile</Text>
                </View>
              )}
              {profile?.totalUsers != null && (
                <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                  <Ionicons name="people" size={18} color={colors.primary} />
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{profile.totalUsers}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Utenti totali</Text>
                </View>
              )}
            </View>
          )}

          {/* Macro dimensions */}
          {macro && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: colors.spacing.md }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Dimensioni semantiche</Text>
              {MACRO_DIMS.map(dim => {
                const val = (macro[dim.key] ?? 0) * 100;
                return (
                  <View key={dim.key} style={{ gap: colors.spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: colors.spacing.sm }}>
                        <Text style={{ fontSize: 14 }}>{dim.icon}</Text>
                        <Text style={{ color: colors.foreground, fontFamily: colors.font.family.medium, fontSize: colors.font.size.md }}>{dim.label}</Text>
                      </View>
                      <Text style={{ color: dim.color, fontFamily: colors.font.family.bold, fontSize: colors.font.size.md }}>
                        {val.toFixed(0)}%
                      </Text>
                    </View>
                    <ProgressBar value={val} color={dim.color} bg={colors.muted} />
                  </View>
                );
              })}
            </View>
          )}

          {/* Rank change 30d */}
          {(profile as unknown as { rankChange30d?: number })?.rankChange30d != null && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: colors.spacing.md }]}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={(profile as unknown as { rankChange30d?: number })!.rankChange30d! >= 0 ? "trending-up" : "trending-down"}
                  size={20}
                  color={(profile as unknown as { rankChange30d?: number })!.rankChange30d! >= 0 ? colors.teal : colors.destructive}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: colors.font.family.semibold, fontSize: colors.font.size.base }}>
                  Variazione rank (30gg)
                </Text>
                <Text style={{
                  color: (profile as unknown as { rankChange30d?: number })!.rankChange30d! >= 0 ? colors.teal : colors.destructive,
                  fontFamily: colors.font.family.bold,
                  fontSize: 20,
                  marginTop: 2,
                }}>
                  {(profile as unknown as { rankChange30d?: number })!.rankChange30d! >= 0 ? "+" : ""}
                  {(profile as unknown as { rankChange30d?: number })!.rankChange30d} posizioni
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  planChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  bigScore: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    lineHeight: 62,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  statNum: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  statLbl: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});

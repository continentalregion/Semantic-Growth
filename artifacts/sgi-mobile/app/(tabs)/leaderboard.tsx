import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const MEDAL = ["🥇", "🥈", "🥉"];

function RankBadge({ rank, colors }: { rank: number; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  if (rank <= 3) {
    return (
      <View style={[badgeStyles.root, badgeStyles[`r${rank}` as "r1" | "r2" | "r3"]]}>
        <Text style={{ fontSize: 13 }}>{MEDAL[rank - 1]}</Text>
      </View>
    );
  }
  return (
    <View style={[badgeStyles.root, { backgroundColor: colors.muted }]}>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
        #{rank}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  root: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  r1: { backgroundColor: "#ffd70022" },
  r2: { backgroundColor: "#c0c0c022" },
  r3: { backgroundColor: "#cd7f3222" },
});

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { data, isLoading, refetch, isRefetching } = useGetLeaderboard({ limit: 100, offset: 0 });

  const entries = data?.entries ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <Ionicons name="trophy" size={20} color="#ffd700" />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Classifica</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e, i) => (e.userId ? String(e.userId) : `rank-${e.rank ?? i}`)}
          scrollEnabled={entries.length > 0}
          contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 34 : tabBarHeight) + 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            entries.length > 0 ? (
              <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  {data?.total ?? entries.length} utenti in classifica
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 }}>
              <Ionicons name="trophy-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                Nessun dato disponibile
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                {
                  borderBottomColor: colors.border + "44",
                  backgroundColor: item.isCurrentUser ? colors.primary + "10" : "transparent",
                },
              ]}
            >
              <RankBadge rank={item.rank} colors={colors} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={[
                      styles.name,
                      { color: item.isCurrentUser ? colors.primary : colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {item.displayName}
                  </Text>
                  {item.isCurrentUser && (
                    <View style={[styles.youBadge, { backgroundColor: colors.primary + "25", borderColor: colors.primary + "40" }]}>
                      <Text style={{ color: colors.primary, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>TU</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.percentile, { color: colors.mutedForeground }]}>
                  Top {(100 - item.percentile).toFixed(0)}%
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.score, { color: colors.teal }]}>
                  {item.sgiScore.toFixed(1)}
                </Text>
                {item.rankChange30d !== null && item.rankChange30d !== 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Ionicons
                      name={item.rankChange30d > 0 ? "trending-up" : "trending-down"}
                      size={11}
                      color={item.rankChange30d > 0 ? colors.teal : colors.destructive}
                    />
                    <Text style={{ fontSize: 10, color: item.rankChange30d > 0 ? colors.teal : colors.destructive, fontFamily: "Inter_500Medium" }}>
                      {Math.abs(item.rankChange30d)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
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
    borderBottomColor: "#1a1e3a",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  summaryRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  youBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  percentile: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  score: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});

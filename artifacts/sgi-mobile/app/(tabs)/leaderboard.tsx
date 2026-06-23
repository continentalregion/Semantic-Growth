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

function RankBadge({ rank, colors }: { rank: number; colors: ReturnType<typeof useColors> }) {
  if (rank <= 3) {
    const bg = [colors.gold, colors.silver, colors.bronze][rank - 1]! + "22";
    return (
      <View style={[styles.badgeRoot, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 13 }}>{MEDAL[rank - 1]}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badgeRoot, { backgroundColor: colors.muted }]}>
      <Text style={{ color: colors.mutedForeground, fontFamily: colors.font.family.semibold, fontSize: colors.font.size.sm }}>
        #{rank}
      </Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { data, isLoading, refetch, isRefetching } = useGetLeaderboard({ limit: 100, offset: 0 });

  const entries = data?.entries ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[
        styles.header,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          borderBottomColor: colors.border,
        },
      ]}>
        <Ionicons name="trophy" size={20} color={colors.gold} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Classifica</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(_e, i) => String(i)}
          scrollEnabled={entries.length > 0}
          contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 34 : tabBarHeight) + colors.spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
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
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: colors.spacing.md }}>
              <Ionicons name="trophy-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, fontFamily: colors.font.family.regular }}>
                Nessun dato disponibile
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[
              styles.row,
              {
                borderBottomColor: colors.border + "44",
                backgroundColor: item.isCurrentUser ? colors.primary + "10" : colors.transparent,
              },
            ]}>
              <RankBadge rank={item.rank} colors={colors} />
              <View style={{ flex: 1, marginLeft: colors.spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: colors.spacing.xs }}>
                  <Text
                    style={[styles.name, { color: item.isCurrentUser ? colors.primary : colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.displayName}
                  </Text>
                  {item.isCurrentUser && (
                    <View style={[styles.youBadge, { backgroundColor: colors.primary + "25", borderColor: colors.primary + "40" }]}>
                      <Text style={{ color: colors.primary, fontSize: colors.font.size.xs, fontFamily: colors.font.family.semibold }}>TU</Text>
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
                    <Text style={{
                      fontSize: colors.font.size.xs,
                      color: item.rankChange30d > 0 ? colors.teal : colors.destructive,
                      fontFamily: colors.font.family.medium,
                    }}>
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
  badgeRoot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGetLeaderboardSummary, useGetMyProfile } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ScreenErrorState } from "@/components/ui/ScreenErrorState";

function ThresholdBar({
  label, threshold, userSgi, accent, colors, t,
}: {
  label: string;
  threshold: number;
  userSgi: number;
  accent: string;
  colors: ReturnType<typeof useColors>;
  t: (k: string, opts?: object) => string;
}) {
  const reached = userSgi >= threshold;
  const progress = reached ? 100 : Math.min(99, (userSgi / threshold) * 100);
  const gap = (threshold - userSgi).toFixed(1);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons
            name={reached ? "star" : "lock-closed-outline"}
            size={12}
            color={reached ? accent : colors.mutedForeground}
          />
          <Text style={{
            fontSize: 12, fontFamily: reached ? colors.font.family.semibold : colors.font.family.regular,
            color: reached ? accent : colors.mutedForeground,
          }}>
            {label}
          </Text>
        </View>
        <Text style={{ fontSize: 11, fontFamily: colors.font.family.regular, color: colors.mutedForeground }}>
          {reached
            ? t("leaderboard.reached")
            : t("leaderboard.lacking", { threshold: threshold.toFixed(1), gap })}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
        <View style={{
          height: 6, borderRadius: 3,
          width: `${progress}%`,
          backgroundColor: reached ? accent : colors.muted,
        }} />
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile, isRefetching: profileRefetching } = useGetMyProfile();
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary, isRefetching: summaryRefetching } = useGetLeaderboardSummary();

  const isLoading = profileLoading || summaryLoading;
  const isRefetching = profileRefetching || summaryRefetching;

  const hasData = profile !== undefined || summary !== undefined;
  const isError = profileError || summaryError;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (hasData || isError) { setTimedOut(false); return; }
    const timer = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [hasData, isError]);
  const isCriticalError = !hasData && (isError || timedOut);
  function handleRetry() {
    setTimedOut(false);
    void refetchProfile();
    void refetchSummary();
  }

  const userSgi   = profile?.sgiScore ?? 0;
  const userRank  = profile?.globalRank ?? null;
  const totalUsers = summary?.totalUsers ?? 0;
  const percentile = userRank && totalUsers > 0
    ? ((totalUsers - userRank) / totalUsers) * 100
    : null;

  const rankAccent =
    percentile !== null && percentile >= 99 ? colors.gold :
    percentile !== null && percentile >= 90 ? colors.primary :
    percentile !== null && percentile >= 75 ? colors.teal :
    colors.primary;

  const rankLabel =
    percentile !== null && percentile >= 99 ? t("leaderboard.top1") :
    percentile !== null && percentile >= 90 ? t("leaderboard.top10") :
    percentile !== null && percentile >= 75 ? t("leaderboard.top25") :
    percentile !== null && percentile >= 50 ? t("leaderboard.top50") :
    t("leaderboard.growing");

  const onRefresh = () => { void refetchProfile(); void refetchSummary(); };

  const bottomPad = Platform.OS === "web" ? 34 : tabBarHeight;

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: Platform.OS === "web" ? 67 : insets.top,
        borderBottomColor: colors.border,
      }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Ionicons name="trophy" size={20} color={colors.gold} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("leaderboard.title")}</Text>
      </View>

      {isCriticalError ? (
        <ScreenErrorState onRetry={handleRetry} />
      ) : null}

      {!isCriticalError && <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: bottomPad + 20 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Rank card */}
        {isLoading ? (
          <SkeletonBox style={{ height: 140, borderRadius: 20 }} />
        ) : (
          <View style={[styles.card, {
            backgroundColor: colors.card, borderColor: rankAccent + "44",
            alignItems: "center", paddingVertical: 28,
          }]}>
            <Text style={{ fontSize: 11, fontFamily: colors.font.family.semibold, color: colors.mutedForeground, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
              {t("leaderboard.position")}
            </Text>
            {userRank ? (
              <>
                <Text style={{ fontSize: 52, fontFamily: "Inter_700Bold", color: rankAccent, lineHeight: 58 }}>
                  #{userRank}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: colors.font.family.semibold, color: rankAccent, marginTop: 4 }}>
                  {rankLabel}
                </Text>
                {percentile !== null && (
                  <Text style={{ fontSize: 12, fontFamily: colors.font.family.regular, color: colors.mutedForeground, marginTop: 6, textAlign: "center" }}>
                    {t("leaderboard.surpassed", { pct: percentile.toFixed(1) })}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40, fontFamily: "Inter_700Bold", color: colors.mutedForeground }}>—</Text>
                <Text style={{ fontSize: 12, fontFamily: colors.font.family.regular, color: colors.mutedForeground, marginTop: 4 }}>
                  {t("leaderboard.notRanked")}
                </Text>
              </>
            )}
          </View>
        )}

        {/* 4 stat cards (2×2 grid) */}
        {isLoading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBox key={i} style={{ flex: 1, minWidth: "45%", height: 90, borderRadius: 16 }} />
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {/* Your SGI */}
            <View style={[styles.statCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Ionicons name="flash" size={11} color={colors.primary} />
                <Text style={[styles.statLabel, { color: colors.primary }]}>{t("leaderboard.yourSgi")}</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {userSgi > 0 ? userSgi.toFixed(1) : "—"}
              </Text>
              <Text style={[styles.statDesc, { color: colors.mutedForeground }]}>{t("leaderboard.sgiDesc")}</Text>
            </View>

            {/* Community avg */}
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Ionicons name="pulse" size={11} color={colors.mutedForeground} />
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("leaderboard.communityAvg")}</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {summary?.averageSgi.toFixed(1) ?? "—"}
              </Text>
              {userSgi > 0 && summary?.averageSgi ? (
                <Text style={[styles.statDesc, { color: userSgi >= summary.averageSgi ? colors.teal : colors.pink }]}>
                  {userSgi >= summary.averageSgi
                    ? t("leaderboard.aboveAvg", { n: (userSgi - summary.averageSgi).toFixed(1) })
                    : t("leaderboard.belowAvg", { n: Math.abs(userSgi - summary.averageSgi).toFixed(1) })}
                </Text>
              ) : null}
            </View>

            {/* Total tracked */}
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Ionicons name="people-outline" size={11} color={colors.mutedForeground} />
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("leaderboard.totalTracked")}</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {totalUsers > 0 ? totalUsers.toLocaleString() : "—"}
              </Text>
              <Text style={[styles.statDesc, { color: colors.mutedForeground }]}>{t("leaderboard.inNetwork")}</Text>
            </View>

            {/* All-time peak */}
            <View style={[styles.statCard, { backgroundColor: colors.gold + "0a", borderColor: colors.gold + "30" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Ionicons name="trophy-outline" size={11} color={colors.gold} />
                <Text style={[styles.statLabel, { color: colors.gold }]}>{t("leaderboard.peakSgi")}</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.gold }]}>
                {summary?.topSgi.toFixed(1) ?? "—"}
              </Text>
              <Text style={[styles.statDesc, { color: colors.mutedForeground }]}>{t("leaderboard.peakDesc")}</Text>
            </View>
          </View>
        )}

        {/* Thresholds */}
        {!isLoading && summary && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="trending-up" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: colors.font.family.semibold, color: colors.foreground }}>
                {t("leaderboard.thresholds")}
              </Text>
            </View>
            <ThresholdBar
              label={t("leaderboard.top10")}
              threshold={summary.top10PercentThreshold}
              userSgi={userSgi}
              accent={colors.primary}
              colors={colors}
              t={t as (k: string, opts?: object) => string}
            />
            <ThresholdBar
              label={t("leaderboard.top1")}
              threshold={summary.top1PercentThreshold}
              userSgi={userSgi}
              accent={colors.gold}
              colors={colors}
              t={t as (k: string, opts?: object) => string}
            />
            <ThresholdBar
              label={t("leaderboard.peakSgi")}
              threshold={summary.topSgi}
              userSgi={userSgi}
              accent={colors.teal}
              colors={colors}
              t={t as (k: string, opts?: object) => string}
            />
          </View>
        )}

        {/* Privacy notice */}
        <View style={[styles.card, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "22", flexDirection: "row", gap: 10 }]}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 13, fontFamily: colors.font.family.semibold, color: colors.primary }}>
              {t("leaderboard.privacyTitle")}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: colors.font.family.regular, color: colors.mutedForeground, lineHeight: 17 }}>
              {t("leaderboard.privacyDesc")}
            </Text>
          </View>
        </View>

        {/* No rank hint */}
        {!isLoading && !userRank && (
          <Text style={{ fontSize: 12, fontFamily: colors.font.family.regular, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 }}>
            {t("leaderboard.noRankYet")}
          </Text>
        )}
      </ScrollView>}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingTop: 2, paddingRight: 4 },
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
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
  },
  statDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});

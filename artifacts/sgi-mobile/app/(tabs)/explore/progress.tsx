import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
  FadeInDown,
} from "react-native-reanimated";
import { useStagedReveal } from "@/hooks/useStagedReveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import {
  useGetMyGamification,
  useGetMyProfile,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { usePurchase } from "@/hooks/usePurchase";

const LEVEL_COLOR = palette.primary;
const XP_COLOR = palette.teal;
const BADGE_COLOR = palette.gold;
const STREAK_COLOR = palette.warning;

const BADGE_META: Record<string, { emoji: string }> = {
  semantic_explorer:      { emoji: "🧭" },
  systems_thinker:        { emoji: "🧠" },
  cross_domain_architect: { emoji: "🔗" },
  abstract_reasoner:      { emoji: "♾️" },
  high_growth_user:       { emoji: "🚀" },
  mind_changer:           { emoji: "💡" },
  battle_victor:          { emoji: "🏆" },
};

const ALL_BADGES = [
  { id: "semantic_explorer",      name: "Explorer" },
  { id: "systems_thinker",        name: "Systems" },
  { id: "cross_domain_architect", name: "Cross-D." },
  { id: "abstract_reasoner",      name: "Abstract" },
  { id: "high_growth_user",       name: "High Growth" },
  { id: "mind_changer",           name: "Mind Changer" },
  { id: "battle_victor",          name: "Battle Victor" },
];

function XpBar({
  xpProgress,
  colors,
}: {
  xpProgress: number;
  colors: ReturnType<typeof useColors>;
}) {
  const pct = useSharedValue(0);
  useEffect(() => {
    pct.value = withTiming(xpProgress / 100, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [xpProgress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${pct.value * 100}%` as any,
  }));

  return (
    <View
      style={[
        st.xpTrack,
        { backgroundColor: colors.muted },
      ]}
    >
      <Animated.View
        style={[st.xpFill, barStyle]}
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  colors,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        st.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[st.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[st.statValue, { color }]}>{value}</Text>
      {sub ? (
        <Text style={[st.statSub, { color: colors.mutedForeground }]}>{sub}</Text>
      ) : null}
    </View>
  );
}

function SkeletonProgress() {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} style={{ flex: 1, height: 80, borderRadius: 12 }} />
        ))}
      </View>
      <SkeletonBox style={{ height: 80, borderRadius: 14 }} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SkeletonBox style={{ flex: 1, height: 180, borderRadius: 14 }} />
        <SkeletonBox style={{ flex: 1, height: 180, borderRadius: 14 }} />
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth } = useWindowDimensions();

  const { data: profile } = useGetMyProfile();
  const { data: gam, isLoading } = useGetMyGamification();

  const level = gam?.level ?? 1;
  const xp = gam?.xp ?? 0;
  const streak = gam?.streak ?? 0;
  const xpProgress = Math.round((gam?.levelProgress ?? 0) * 100);
  const xpToNext = Math.round((1 - (gam?.levelProgress ?? 0)) * 500);
  const earnedBadgeIds = new Set((gam?.badges ?? []).map((b) => String(b.badgeKey)));
  const missions = gam?.missions ?? [];
  const missionsLocked = profile?.plan === "free";
  const rankChange = profile?.rankChange30d ?? 0;
  const { triggerPurchase } = usePurchase();

  const { phase } = useStagedReveal(!isLoading, { steps: 3, minWaitMs: 1200, stepDelayMs: 600 });
  const showSkeleton = isLoading || phase === 0;

  const shareCardRef = useRef<View>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShareProgress = async () => {
    if (!shareCardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {
      Alert.alert(t("share.captureError"), "");
    } finally {
      setSharing(false);
      setShareVisible(false);
    }
  };

  const streakDays = Array.from({ length: 21 }, (_, i) => i < streak);
  const STREAK_COLS = 7;
  const cellSize = Math.floor((screenWidth - 72) / 21);

  return (
    <AnimatedScreen>
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            st.header,
            { paddingTop: insets.top + 8, borderBottomColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [st.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[st.headerTitle, { color: colors.foreground }]}>
              {t("gamification.title")}
            </Text>
            <Text style={[st.headerSubtitle, { color: colors.mutedForeground }]}>
              {t("gamification.subtitle")}
            </Text>
          </View>
          <Pressable
            onPress={() => setShareVisible(true)}
            style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="share-outline" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        {showSkeleton ? (
          <ScrollView
            contentContainerStyle={[
              st.scrollContent,
              { paddingBottom: tabBarHeight + 24 },
            ]}
          >
            <SkeletonProgress />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={[
              st.scrollContent,
              { paddingBottom: tabBarHeight + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* 4 stat cards */}
            {phase >= 1 && <Animated.View entering={FadeInDown.duration(400)} style={st.statsRow}>
              <StatCard
                label={t("gamification.level")}
                value={level}
                sub={t("gamification.semanticLevel")}
                color={LEVEL_COLOR}
                colors={colors}
              />
              <StatCard
                label={t("gamification.totalXp")}
                value={xp.toLocaleString()}
                color={XP_COLOR}
                colors={colors}
              />
              <StatCard
                label={t("gamification.badges")}
                value={`${earnedBadgeIds.size}/${ALL_BADGES.length}`}
                color={BADGE_COLOR}
                colors={colors}
              />
              <StatCard
                label={t("gamification.rankDelta")}
                value={
                  rankChange > 0
                    ? `+${rankChange}`
                    : rankChange === 0
                    ? "—"
                    : `${rankChange}`
                }
                color={
                  rankChange > 0
                    ? XP_COLOR
                    : rankChange < 0
                    ? palette.pink
                    : colors.mutedForeground
                }
                colors={colors}
              />
            </Animated.View>}

            {/* XP Progress bar */}
            {phase >= 2 && <Animated.View
              entering={FadeInDown.duration(400)}
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[st.cardLabel, { color: colors.mutedForeground }]}>
                {t("gamification.xpToward", { n: level + 1 })}
              </Text>
              <View style={st.xpRow}>
                <Text style={[st.xpCurrent, { color: colors.foreground }]}>
                  {xp.toLocaleString()} XP
                </Text>
                <Text style={[st.xpPct, { color: LEVEL_COLOR }]}>
                  {xpProgress}%
                </Text>
              </View>
              <XpBar xpProgress={xpProgress} colors={colors} />
              <Text style={[st.xpToNext, { color: colors.mutedForeground }]}>
                {t("gamification.xpToNext", { n: xpToNext })}
              </Text>
            </Animated.View>}

            {/* Badges + Missions/Streak side by side */}
            {phase >= 3 && <Animated.View
              entering={FadeInDown.duration(400)}
              style={st.twoCol}
            >
              {/* Badges */}
              <View
                style={[
                  st.card,
                  st.colCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[st.cardLabel, { color: colors.mutedForeground }]}>
                  {t("gamification.badgesSection")}
                </Text>
                <View style={st.badgeGrid}>
                  {ALL_BADGES.map((badge) => {
                    const earned = earnedBadgeIds.has(badge.id);
                    const meta = BADGE_META[badge.id] ?? { emoji: "🏅" };
                    return (
                      <View
                        key={badge.id}
                        style={[
                          st.badgeCell,
                          {
                            backgroundColor: earned
                              ? colors.muted
                              : "transparent",
                            borderColor: colors.border,
                            opacity: earned ? 1 : 0.28,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 20, marginBottom: 3 }}>
                          {meta.emoji}
                        </Text>
                        <Text
                          style={[
                            st.badgeName,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {badge.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Right column: Missions + Streak */}
              <View style={[st.colCard, { gap: 10 }]}>
                {/* Missions */}
                <View
                  style={[
                    st.card,
                    { backgroundColor: colors.card, borderColor: colors.border, flex: 1 },
                  ]}
                >
                  <Text style={[st.cardLabel, { color: colors.mutedForeground }]}>
                    {t("gamification.weeklyMissions")}
                  </Text>
                  {missionsLocked ? (
                    <Pressable
                      style={({ pressed }) => [st.missionsLocked, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => triggerPurchase("premium")}
                    >
                      <Ionicons name="lock-closed" size={14} color={palette.primary} />
                      <Text style={[st.missionsLockedText, { color: colors.mutedForeground }]}>
                        Sblocca le missioni
                      </Text>
                      <Text style={[st.missionsLockedText, { color: palette.primary, fontFamily: "Inter_600SemiBold" }]}>
                        · Premium
                      </Text>
                    </Pressable>
                  ) : missions.length === 0 ? (
                    <Text style={[st.noMissions, { color: colors.mutedForeground }]}>
                      {t("gamification.noMissions")}
                    </Text>
                  ) : (
                    missions.slice(0, 4).map((m, idx) => (
                      <View
                        key={m.id}
                        style={[
                          st.missionRow,
                          {
                            borderTopColor: colors.border,
                            borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                          },
                        ]}
                      >
                        <View
                          style={[
                            st.missionDot,
                            {
                              backgroundColor: m.completed
                                ? XP_COLOR
                                : "transparent",
                              borderColor: m.completed
                                ? XP_COLOR
                                : colors.border,
                            },
                          ]}
                        >
                          {m.completed && (
                            <Text style={st.missionCheck}>✓</Text>
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              st.missionTitle,
                              { color: colors.foreground },
                            ]}
                            numberOfLines={2}
                          >
                            {m.title}
                          </Text>
                          {!m.completed && (m.target ?? 0) > 1 && (
                            <Text
                              style={[
                                st.missionProgress,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              {m.progress ?? 0}/{m.target ?? 1}
                            </Text>
                          )}
                        </View>
                        <Text style={[st.missionXp, { color: LEVEL_COLOR }]}>
                          XP ✦
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Streak */}
                <View
                  style={[
                    st.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={st.streakHeader}>
                    <Text style={[st.cardLabel, { color: colors.mutedForeground }]}>
                      {t("gamification.streak")}
                    </Text>
                    <View style={st.streakCount}>
                      <Ionicons name="flame" size={16} color={STREAK_COLOR} />
                      <Text style={[st.streakNum, { color: STREAK_COLOR }]}>
                        {streak}
                      </Text>
                      <Text
                        style={[st.streakDays, { color: colors.mutedForeground }]}
                      >
                        {t("gamification.days")}
                      </Text>
                    </View>
                  </View>
                  <View style={st.streakGrid}>
                    {streakDays.map((active, i) => (
                      <View
                        key={i}
                        style={[
                          st.streakCell,
                          {
                            width: cellSize,
                            height: cellSize,
                            borderRadius: 2,
                            backgroundColor: active
                              ? `rgba(124,107,255,${0.35 + (i / 21) * 0.65})`
                              : colors.muted,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text
                    style={[st.streakLast, { color: colors.mutedForeground }]}
                  >
                    {t("gamification.last21")}
                  </Text>
                </View>
              </View>
            </Animated.View>}
          </ScrollView>
        )}

        {/* ── Share Progress Modal ── */}
        <Modal visible={shareVisible} transparent animationType="slide" onRequestClose={() => setShareVisible(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
            <View style={{
              backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
              padding: 20, gap: 14, paddingBottom: Math.max(insets.bottom, 16) + 8,
            }}>
              {/* Capture target */}
              <View ref={shareCardRef} style={{
                backgroundColor: colors.background, borderRadius: 16, padding: 20,
                borderWidth: 1, borderColor: colors.border, gap: 14,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="trending-up" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase" }}>
                    SGI Progress
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.primary + "12", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.primary + "30" }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("gamification.level")}</Text>
                    <Text style={{ color: colors.primary, fontSize: 24, fontFamily: "Inter_700Bold" }}>{level}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.teal + "12", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.teal + "30" }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("gamification.totalXp")}</Text>
                    <Text style={{ color: colors.teal, fontSize: 24, fontFamily: "Inter_700Bold" }}>{xp.toLocaleString()}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center", backgroundColor: palette.warning + "12", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: palette.warning + "30" }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("gamification.streak")}</Text>
                    <Text style={{ color: palette.warning, fontSize: 22, fontFamily: "Inter_700Bold" }}>🔥{streak}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: BADGE_COLOR, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                      {earnedBadgeIds.size}/{ALL_BADGES.length}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                      {t("gamification.badges")}
                    </Text>
                  </View>
                  {rankChange !== 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons
                        name={rankChange > 0 ? "trending-up" : "trending-down"}
                        size={14}
                        color={rankChange > 0 ? colors.teal : colors.pink}
                      />
                      <Text style={{ color: rankChange > 0 ? colors.teal : colors.pink, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                        {rankChange > 0 ? "+" : ""}{rankChange}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                        {t("gamification.rankDelta")}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "right" }}>
                  sgindex.work
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [{
                  backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
                  alignItems: "center", opacity: pressed || sharing ? 0.7 : 1,
                }]}
                onPress={handleShareProgress}
                disabled={sharing}
              >
                {sharing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>{t("share.shareCard")}</Text>}
              </Pressable>
              <Pressable
                style={({ pressed }) => [{ alignItems: "center", paddingVertical: 10, opacity: pressed ? 0.6 : 1 }]}
                onPress={() => setShareVisible(false)}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{t("share.close")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { paddingTop: 2, paddingRight: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 17,
  },

  scrollContent: {
    padding: 16,
    gap: 12,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  statSub: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  xpCurrent: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  xpPct: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  xpTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 4,
    background: `linear-gradient(90deg, ${palette.primary}, ${palette.teal})`,
    backgroundColor: LEVEL_COLOR,
  },
  xpToNext: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },

  twoCol: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  colCard: {
    flex: 1,
  },

  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badgeCell: {
    width: "30%",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeName: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },

  missionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 7,
  },
  missionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  missionCheck: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  missionTitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  missionProgress: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  missionXp: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 0,
  },
  missionsLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
  },
  missionsLockedText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  noMissions: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },

  streakHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  streakCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  streakNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  streakDays: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  streakGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  streakCell: {},
  streakLast: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
});

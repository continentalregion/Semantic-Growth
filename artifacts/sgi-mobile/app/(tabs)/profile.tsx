import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useGetMyProfile, useGetMyGamification } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { PressableScale } from "@/components/ui/PressableScale";
import { SkeletonBox, SkeletonCard } from "@/components/ui/SkeletonBox";

function DeltaBadge({ value, colors }: { value: number | null; colors: ReturnType<typeof useColors> }) {
  if (value === null) return null;
  const up = value >= 0;
  const c = up ? colors.teal : colors.destructive;
  return (
    <View style={[styles.deltaBadge, { backgroundColor: c + "20" }]}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={12} color={c} />
      <Text style={{ color: c, fontSize: colors.font.size.sm, fontFamily: colors.font.family.semibold }}>
        {up ? "+" : ""}{value.toFixed(2)}
      </Text>
    </View>
  );
}

function GamStat({ icon, label, value, colors }: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: colors.spacing.xs }}>
      <Ionicons name={icon as "flash"} size={18} color={colors.primary} />
      <Text style={{ color: colors.foreground, fontFamily: colors.font.family.bold, fontSize: colors.font.size.lg }}>{value}</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: colors.font.family.regular, fontSize: colors.font.size.xs }}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { signOut } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile, isError: profileError } = useGetMyProfile();
  const { data: gamification, isLoading: gamLoading, refetch: refetchGam, isError: gamError } = useGetMyGamification();

  const planLabel = { free: "Free", premium: "Premium", pro: "Pro" }[profile?.plan ?? "free"] ?? "Free";
  const planColor = { free: colors.mutedForeground, premium: colors.gold, pro: colors.teal }[profile?.plan ?? "free"] ?? colors.mutedForeground;

  async function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
  }

  const hasData = profile !== undefined || gamification !== undefined;
  const isCriticalError = !hasData && (profileError || gamError);

  function handleRetry() {
    if (profileError) refetchProfile();
    if (gamError) refetchGam();
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View style={[
        styles.header,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          borderBottomColor: colors.border,
        },
      ]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("nav.profile")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[styles.planBadge, { borderColor: planColor + "44", backgroundColor: planColor + "18" }]}>
            <Text style={{ color: planColor, fontSize: colors.font.size.xs, fontFamily: colors.font.family.semibold }}>
              {planLabel}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {isCriticalError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: colors.spacing.lg, gap: colors.spacing.md }}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: colors.font.family.semibold, fontSize: colors.font.size.md, textAlign: "center" }}>
            {t("progress.errorTitle")}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: colors.font.family.regular, fontSize: colors.font.size.sm, textAlign: "center" }}>
            {t("progress.errorDesc")}
          </Text>
          <PressableScale
            style={{ marginTop: colors.spacing.sm, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44", borderRadius: 10, paddingHorizontal: colors.spacing.lg, paddingVertical: colors.spacing.sm }}
            onPress={handleRetry}
          >
            <Text style={{ color: colors.primary, fontFamily: colors.font.family.semibold, fontSize: colors.font.size.sm }}>
              {t("progress.retryBtn")}
            </Text>
          </PressableScale>
        </View>
      ) : !hasData ? (
        <View style={{ flex: 1, paddingHorizontal: colors.spacing.lg, paddingTop: colors.spacing.lg, gap: colors.spacing.lg }}>
          <SkeletonCard style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }} />
          <SkeletonCard style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: (Platform.OS === "web" ? 34 : tabBarHeight) + colors.spacing.xl,
            paddingHorizontal: colors.spacing.lg,
            gap: colors.spacing.lg,
            paddingTop: colors.spacing.lg,
          }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => { refetchProfile(); refetchGam(); }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Score card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sgiLabel, { color: colors.mutedForeground }]}>{t("profile.sgiScore")}</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: colors.spacing.md }}>
              <Text style={[styles.sgiScore, { color: colors.primary }]}>
                {(profile?.sgiScore ?? 0).toFixed(1)}
              </Text>
              <View style={{ gap: colors.spacing.xs, paddingBottom: colors.spacing.sm }}>
                <DeltaBadge value={profile?.sgiDailyDelta ?? null} colors={colors} />
              </View>
            </View>
            <View style={styles.rankRow}>
              {profile?.globalRank != null && (
                <View style={styles.rankItem}>
                  <Ionicons name="trophy-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.rankText, { color: colors.foreground }]}>#{profile.globalRank}</Text>
                  <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>{t("profile.rank")}</Text>
                </View>
              )}
              {profile?.percentile != null && (
                <View style={styles.rankItem}>
                  <Ionicons name="stats-chart-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.rankText, { color: colors.foreground }]}>Top {(100 - profile.percentile).toFixed(0)}%</Text>
                  <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>{t("profile.percentile")}</Text>
                </View>
              )}
              {profile?.totalUsers != null && (
                <View style={styles.rankItem}>
                  <Ionicons name="people-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.rankText, { color: colors.foreground }]}>{profile.totalUsers}</Text>
                  <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>{t("profile.users")}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Gamification */}
          {gamification && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: colors.spacing.md }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("profile.progress")}</Text>
              <View style={styles.gamRow}>
                <GamStat icon="flash" label="XP" value={`${gamification.xp}`} colors={colors} />
                <GamStat icon="star" label={t("gamification.level")} value={`${gamification.level}`} colors={colors} />
                <GamStat icon="flame" label={t("gamification.streak")} value={`${gamification.streak}d`} colors={colors} />
              </View>
              <View style={[styles.xpBar, { backgroundColor: colors.muted }]}>
                <View style={[styles.xpFill, { width: `${Math.round(gamification.levelProgress * 100)}%` as `${number}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.xpHint, { color: colors.mutedForeground }]}>
                {t("profile.xpProgress", { xp: gamification.xp, total: gamification.xp + gamification.xpToNextLevel, next: gamification.level + 1 })}
              </Text>
            </View>
          )}

          {/* Badges */}
          {gamification && gamification.badges.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: colors.spacing.md }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("profile.badges")}</Text>
              <View style={styles.badgesWrap}>
                {gamification.badges.map(b => (
                  <View key={b.id} style={[styles.badge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
                    <Ionicons name="medal-outline" size={16} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.foreground }]} numberOfLines={1}>{b.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Account */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("profile.account")}</Text>
            <Text style={[styles.emailText, { color: colors.mutedForeground }]}>{profile?.email}</Text>
          </View>

          {/* Sign out */}
          <PressableScale
            style={[styles.signOutBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}
            onPress={handleSignOut}
            haptic={false}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>{t("profile.signOut")}</Text>
          </PressableScale>
        </ScrollView>
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  planBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  sgiLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
  sgiScore: { fontSize: 56, fontFamily: "Inter_700Bold", lineHeight: 62 },
  rankRow: { flexDirection: "row", gap: 20, marginTop: 8 },
  rankItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  rankText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rankLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  gamRow: { flexDirection: "row", gap: 8 },
  xpBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 3 },
  xpHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badgesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: 100 },
  emailText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

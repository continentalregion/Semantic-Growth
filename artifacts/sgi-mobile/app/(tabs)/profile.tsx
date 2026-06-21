import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useGetMyProfile, useGetMyGamification } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

function DeltaBadge({ value, colors }: { value: number | null; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <View style={[s2.deltaBadge, { backgroundColor: (up ? colors.teal : colors.destructive) + "20" }]}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={12} color={up ? colors.teal : colors.destructive} />
      <Text style={{ color: up ? colors.teal : colors.destructive, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
        {up ? "+" : ""}{value.toFixed(2)}
      </Text>
    </View>
  );
}

const s2 = StyleSheet.create({
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useGetMyProfile();
  const { data: gamification, isLoading: gamLoading, refetch: refetchGam } = useGetMyGamification();

  const planLabel = { free: "Free", premium: "Premium", pro: "Pro" }[profile?.plan ?? "free"] ?? "Free";
  const planColor = { free: colors.mutedForeground, premium: "#ffd700", pro: colors.teal }[profile?.plan ?? "free"] ?? colors.mutedForeground;

  async function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
  }

  const isLoading = profileLoading || gamLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profilo</Text>
        <View style={[styles.planBadge, { borderColor: planColor + "44", backgroundColor: planColor + "18" }]}>
          <Text style={{ color: planColor, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
            {planLabel}
          </Text>
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
            paddingBottom: Platform.OS === "web" ? 34 + 24 : insets.bottom + 24,
            paddingHorizontal: 20,
            gap: 16,
            paddingTop: 20,
          }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => { refetchProfile(); refetchGam(); }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sgiLabel, { color: colors.mutedForeground }]}>SGI Score</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <Text style={[styles.sgiScore, { color: colors.primary }]}>
                {(profile?.sgiScore ?? 0).toFixed(1)}
              </Text>
              <View style={{ gap: 4, paddingBottom: 6 }}>
                <DeltaBadge value={profile?.sgiDailyDelta ?? null} colors={colors} />
              </View>
            </View>
            <View style={styles.rankRow}>
              {profile?.globalRank != null && (
                <View style={styles.rankItem}>
                  <Ionicons name="trophy-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.rankText, { color: colors.foreground }]}>
                    #{profile.globalRank}
                  </Text>
                  <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>rank</Text>
                </View>
              )}
              {profile?.percentile != null && (
                <View style={styles.rankItem}>
                  <Ionicons name="stats-chart-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.rankText, { color: colors.foreground }]}>
                    Top {(100 - profile.percentile).toFixed(0)}%
                  </Text>
                  <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>percentile</Text>
                </View>
              )}
              {profile?.totalUsers != null && (
                <View style={styles.rankItem}>
                  <Ionicons name="people-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.rankText, { color: colors.foreground }]}>
                    {profile.totalUsers}
                  </Text>
                  <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>utenti</Text>
                </View>
              )}
            </View>
          </View>

          {gamification && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Progressi</Text>
              <View style={styles.gamRow}>
                <GamStat icon="flash" label="XP" value={`${gamification.xp}`} colors={colors} />
                <GamStat icon="star" label="Livello" value={`${gamification.level}`} colors={colors} />
                <GamStat icon="flame" label="Streak" value={`${gamification.streak}d`} colors={colors} />
              </View>
              <View style={[styles.xpBar, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${Math.round(gamification.levelProgress * 100)}%` as `${number}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.xpHint, { color: colors.mutedForeground }]}>
                {gamification.xp} / {gamification.xp + gamification.xpToNextLevel} XP per il livello {gamification.level + 1}
              </Text>
            </View>
          )}

          {gamification && gamification.badges.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Badge</Text>
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

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
            <Text style={[styles.emailText, { color: colors.mutedForeground }]}>{profile?.email}</Text>
          </View>

          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>Esci</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function GamStat({ icon, label, value, colors }: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Ionicons name={icon as "flash"} size={18} color={colors.primary} />
      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>{label}</Text>
    </View>
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
    borderBottomColor: "#1a1e3a",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  planBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
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

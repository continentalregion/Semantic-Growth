import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface ThreadSession {
  id: string;
  username: string;
  scoreTotal: number;
  scoreDensity: number;
  scoreConnections: number;
  scoreDepth: number;
  durationSeconds: number;
  connectionsCount: number;
  endedAt: string;
}

interface ThreadDetail {
  id: string;
  question: string;
  description?: string;
  category: string;
  createdByUsername?: string;
  knowledgeBase: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
  totalSessions: number;
  sessions: ThreadSession[];
  mySession: { id: string; status: string; scoreTotal: number; startedAt: string } | null;
  battleCardId: string | null;
}

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: thread, isLoading, isError, refetch } = useQuery({
    queryKey: ["thread", id],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${BASE}/api/threads/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("Thread non trovato");
      return r.json() as Promise<ThreadDetail>;
    },
    enabled: !!id,
  });

  const hasData = !!thread;
  const isCriticalError = !hasData && isError;

  const header = (
    <View style={[st.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
      <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={[st.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
        {thread?.question ?? t("thread.title")}
      </Text>
    </View>
  );

  if (isCriticalError) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <Ionicons name="wifi-outline" size={44} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>
            {t("common.errorTitle")}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            {t("common.errorDesc")}
          </Text>
          <Pressable
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => refetch()}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>{t("common.retryBtn")}</Text>
          </Pressable>
        </View>
      </AnimatedScreen>
    );
  }

  if (isLoading && !hasData) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <SkeletonBox style={{ height: 130, borderRadius: 16 }} />
          <SkeletonBox style={{ height: 60, borderRadius: 14 }} />
          <SkeletonBox style={{ height: 200, borderRadius: 14 }} />
        </ScrollView>
      </AnimatedScreen>
    );
  }

  if (!id || id === "[id]" || !thread) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <Ionicons name="document-outline" size={44} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>
            Thread non trovato
          </Text>
          <Pressable
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>Torna indietro</Text>
          </Pressable>
        </View>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Thread header card */}
        <View style={[st.card, { backgroundColor: colors.primary + "0a", borderColor: colors.primary + "33" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Ionicons name="flame" size={13} color={colors.pink} />
            <Text style={{ color: colors.pink, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" }}>
              {t("thread.openThread")}
            </Text>
            <View style={{ backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" }}>
                {thread.category}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 24, marginBottom: 6 }}>
            {thread.question}
          </Text>
          {!!thread.description && (
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 6 }}>
              {thread.description}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 22, fontFamily: "Inter_700Bold" }}>
              {thread.totalSessions}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", marginLeft: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("thread.sessions")}
            </Text>
          </View>
        </View>

        {/* Battle Card CTA */}
        {!!thread.battleCardId && (
          <Pressable
            style={({ pressed }) => [
              st.card,
              { flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: colors.gold + "12", borderColor: colors.gold + "40",
                opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => router.push(`/battle-card/${thread.battleCardId}` as any)}
          >
            <Ionicons name="trophy" size={20} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.gold, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {t("thread.battleCardAvailable")}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                {t("thread.battleCardDesc")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.gold} />
          </Pressable>
        )}

        {/* Knowledge Base */}
        {(thread.knowledgeBase?.length ?? 0) > 0 && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Ionicons name="git-network-outline" size={15} color={colors.teal} />
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {t("thread.knowledgeBase")}
              </Text>
            </View>
            {thread.knowledgeBase.slice(0, 5).map((conn, i) => (
              <View key={i} style={[st.connRow, { backgroundColor: colors.teal + "0a", borderColor: colors.teal + "22" }]}>
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_500Medium", flexShrink: 1 }}>
                  {conn.concept1}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginHorizontal: 4 }}>↔</Text>
                <Text style={{ color: colors.teal, fontSize: 12, fontFamily: "Inter_500Medium", flexShrink: 1 }}>
                  {conn.concept2}
                </Text>
              </View>
            ))}
            {thread.knowledgeBase.length > 5 && (
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 }}>
                +{thread.knowledgeBase.length - 5} {t("thread.moreConnections")}
              </Text>
            )}
          </View>
        )}

        {/* Sessions Leaderboard */}
        {(thread.sessions?.length ?? 0) > 0 && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Ionicons name="trophy-outline" size={15} color={colors.gold} />
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {t("thread.leaderboard")}
              </Text>
            </View>
            {thread.sessions.map((s, i) => (
              <View
                key={s.id}
                style={[
                  st.sessionRow,
                  {
                    backgroundColor: i === 0 ? colors.gold + "08" : "transparent",
                    borderColor: i === 0 ? colors.gold + "30" : colors.border,
                  },
                ]}
              >
                <View style={[st.rank, { backgroundColor: i === 0 ? colors.gold + "28" : colors.muted }]}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: i === 0 ? colors.gold : colors.mutedForeground }}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                  @{s.username}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>⬡{s.scoreDensity}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>⟳{s.scoreConnections}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>◉{s.scoreDepth}</Text>
                  <Text style={{ color: i === 0 ? colors.gold : colors.primary, fontSize: 14, fontFamily: "Inter_700Bold" }}>
                    {s.scoreTotal}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* My Session */}
        {!!thread.mySession && (
          <View style={[st.card, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Ionicons name="person-circle-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {t("thread.mySession")}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {thread.mySession.status === "completed" ? t("thread.completed") : t("thread.inProgress")}
              </Text>
              {(thread.mySession.scoreTotal ?? 0) > 0 && (
                <Text style={{ color: colors.primary, fontSize: 18, fontFamily: "Inter_700Bold" }}>
                  {thread.mySession.scoreTotal} SGI
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  connRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
    borderWidth: 1,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    gap: 8,
  },
  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});

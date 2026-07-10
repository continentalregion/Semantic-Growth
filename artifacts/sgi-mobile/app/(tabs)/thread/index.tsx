import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { fetch } from "expo/fetch";
import * as Clipboard from "expo-clipboard";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function threadTitle(t: { aiTitle?: string | null; question: string }): string {
  if (t.aiTitle && t.aiTitle.trim().length > 0) return t.aiTitle;
  return t.question.length > 80 ? `${t.question.slice(0, 80).trim()}…` : t.question;
}

interface ThreadSummary {
  id: string;
  question: string;
  aiTitle?: string | null;
  description?: string;
  category: string;
  createdBy: string;
  createdByUsername?: string;
  totalSessions: number;
  knowledgeBaseSize: number;
  createdAt: string;
  battleCardId: string | null;
}

const CATEGORY_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }> = {
  philosophy: { icon: "book-outline", color: "#7c6bff" },
  science: { icon: "flask-outline", color: "#06d6a0" },
  ethics: { icon: "scale-outline", color: "#f72585" },
  technology: { icon: "hardware-chip-outline", color: "#a89fff" },
  society: { icon: "globe-outline", color: "#ffd166" },
  knowledge: { icon: "library-outline", color: "#06d6a0" },
  consciousness: { icon: "git-network-outline", color: "#7c6bff" },
};

const CATEGORIES = Object.keys(CATEGORY_META);

export default function ThreadsListScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("philosophy");

  const { data: threads = [], isLoading, refetch } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${BASE}/api/threads`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(t("threads.errorLoad"));
      return r.json() as Promise<ThreadSummary[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { question: string; description: string; category: string }) => {
      const token = await getToken();
      const r = await fetch(`${BASE}/api/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(t("threads.errorLoad"));
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setShowCreate(false);
      setNewQ(""); setNewDesc(""); setNewCat("philosophy");
    },
  });

  const filtered = filter ? threads.filter(th => th.category === filter) : threads;
  const openThreads = filtered.filter(th => !th.battleCardId);
  const completedThreads = filtered.filter(th => !!th.battleCardId);

  async function handleShare(battleCardId: string) {
    const url = `${BASE}/battle-cards/${battleCardId}`;
    await Clipboard.setStringAsync(url);
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          st.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[st.headerTitle, { color: colors.foreground }]}>{t("threads.title")}</Text>
          <Text style={[st.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
            {t("threads.subtitle")}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={[st.createBtn, { backgroundColor: colors.primary }]}
          testID="threads-create-btn"
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <Pressable
          onPress={() => setFilter(null)}
          style={[
            st.filterChip,
            {
              backgroundColor: !filter ? colors.primary + "22" : colors.card,
              borderColor: !filter ? colors.primary + "55" : colors.border,
            },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: !filter ? colors.primary : colors.mutedForeground }}>
            {t("threads.filterAll")}
          </Text>
        </Pressable>
        {CATEGORIES.map((key) => {
          const meta = CATEGORY_META[key]!;
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(active ? null : key)}
              style={[
                st.filterChip,
                {
                  backgroundColor: active ? meta.color + "22" : colors.card,
                  borderColor: active ? meta.color + "55" : colors.border,
                },
              ]}
            >
              <Ionicons name={meta.icon} size={13} color={active ? meta.color : colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: active ? meta.color : colors.mutedForeground }}>
                {key}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <SkeletonBox key={i} height={88} borderRadius={14} />
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 20,
            paddingBottom: (Platform.OS === "web" ? 34 : tabBarHeight) + 24,
          }}
          refreshControl={undefined}
        >
          {filtered.length === 0 ? (
            <View style={st.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[st.emptyDesc, { color: colors.mutedForeground }]}>{t("threads.noThreads")}</Text>
            </View>
          ) : (
            <>
              {openThreads.length > 0 && (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="flame" size={13} color={colors.pink} />
                    <Text style={[st.sectionTitle, { color: colors.pink }]}>{t("threads.openThreads")}</Text>
                    <View style={[st.countBadge, { backgroundColor: colors.pink + "20" }]}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.pink }}>{openThreads.length}</Text>
                    </View>
                  </View>
                  {openThreads.map((thread) => {
                    const cat = CATEGORY_META[thread.category] ?? CATEGORY_META.philosophy!;
                    const isAiGenerated = thread.createdByUsername?.startsWith("🤖");
                    return (
                      <Pressable
                        key={thread.id}
                        onPress={() => router.push(`/(tabs)/thread/${thread.id}` as never)}
                        style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <View style={{ flexDirection: "row", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                          <View style={[st.tag, { backgroundColor: cat.color + "18" }]}>
                            <Ionicons name={cat.icon} size={11} color={cat.color} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: cat.color }}>{thread.category}</Text>
                          </View>
                          {isAiGenerated && (
                            <View style={[st.tag, { backgroundColor: colors.pink + "18" }]}>
                              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.pink }}>
                                🤖 {t("threads.aiGenerated")}
                              </Text>
                            </View>
                          )}
                          {thread.knowledgeBaseSize > 0 && (
                            <View style={[st.tag, { backgroundColor: colors.teal + "18" }]}>
                              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.teal }}>
                                {thread.knowledgeBaseSize} {t("threads.connections")}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[st.question, { color: colors.foreground }]} numberOfLines={2}>
                          {threadTitle(thread)}
                        </Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                            {thread.totalSessions} {t("threads.sessions")}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {completedThreads.length > 0 && (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="trophy" size={13} color={colors.gold} />
                    <Text style={[st.sectionTitle, { color: colors.gold }]}>{t("threads.completedBattles")}</Text>
                    <View style={[st.countBadge, { backgroundColor: colors.gold + "20" }]}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>{completedThreads.length}</Text>
                    </View>
                  </View>
                  {completedThreads.map((thread) => {
                    const cat = CATEGORY_META[thread.category] ?? CATEGORY_META.philosophy!;
                    return (
                      <View
                        key={thread.id}
                        style={[st.card, { backgroundColor: colors.gold + "08", borderColor: colors.gold + "30" }]}
                      >
                        <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                          <View style={[st.tag, { backgroundColor: cat.color + "18" }]}>
                            <Ionicons name={cat.icon} size={11} color={cat.color} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: cat.color }}>{thread.category}</Text>
                          </View>
                          <View style={[st.tag, { backgroundColor: colors.gold + "20" }]}>
                            <Ionicons name="trophy" size={10} color={colors.gold} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: colors.gold }}>
                              {t("threads.completedBadge")}
                            </Text>
                          </View>
                        </View>
                        <Text style={[st.question, { color: colors.foreground }]} numberOfLines={2}>
                          {threadTitle(thread)}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                          {thread.totalSessions} {t("threads.participants")}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                          <Pressable
                            onPress={() => router.push(`/battle-cards/${thread.battleCardId}` as never)}
                            style={[st.smallBtn, { backgroundColor: colors.gold + "20", flex: 1 }]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.gold }}>
                              {t("threads.viewChallenge")}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleShare(thread.battleCardId!)}
                            style={[st.smallBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                          >
                            <Ionicons name="share-outline" size={14} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={st.modalOverlay}>
          <View style={[st.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.modalTitle, { color: colors.foreground }]}>{t("threads.createTitle")}</Text>

            <Text style={[st.modalLabel, { color: colors.mutedForeground }]}>{t("threads.questionLabel")} *</Text>
            <TextInput
              value={newQ}
              onChangeText={setNewQ}
              placeholder={t("threads.questionPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={200}
              style={[st.modalInput, { color: colors.foreground, borderColor: colors.border, minHeight: 70 }]}
            />

            <Text style={[st.modalLabel, { color: colors.mutedForeground }]}>{t("threads.descLabel")}</Text>
            <TextInput
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder={t("threads.descPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              style={[st.modalInput, { color: colors.foreground, borderColor: colors.border }]}
            />

            <Text style={[st.modalLabel, { color: colors.mutedForeground }]}>{t("threads.categoryLabel")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CATEGORIES.map((key) => {
                  const meta = CATEGORY_META[key]!;
                  const active = newCat === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setNewCat(key)}
                      style={[
                        st.filterChip,
                        { backgroundColor: active ? meta.color + "22" : colors.background, borderColor: active ? meta.color + "55" : colors.border },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? meta.color : colors.mutedForeground }}>
                        {key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setShowCreate(false)}
                style={[st.smallBtn, { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>{t("threads.cancelBtn")}</Text>
              </Pressable>
              <Pressable
                disabled={newQ.trim().length < 10 || createMutation.isPending}
                onPress={() => createMutation.mutate({ question: newQ, description: newDesc, category: newCat })}
                style={[
                  st.smallBtn,
                  { flex: 1, backgroundColor: newQ.trim().length >= 10 ? colors.primary : colors.primary + "40" },
                ]}
              >
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                  {createMutation.isPending ? "…" : t("threads.createSubmit")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  createBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  countBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  question: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  desc: { fontSize: 12, marginTop: 3 },
  smallBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  modalLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    marginBottom: 12,
  },
});

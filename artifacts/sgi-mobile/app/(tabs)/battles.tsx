import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl,
  Modal,
  Alert,
  Share,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareableBattleCard, type ShareCardData } from "@/components/ui/ShareableBattleCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { PressableScale } from "@/components/ui/PressableScale";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const BATTLE_DURATION = 4 * 60;

const CATEGORY_META: Record<string, { labelKey: string; color: string; icon: string }> = {
  philosophy:    { labelKey: "battles.categoryPhilosophy",    color: palette.primary,      icon: "telescope-outline" },
  science:       { labelKey: "battles.categoryScience",       color: palette.teal,         icon: "flask-outline" },
  ethics:        { labelKey: "battles.categoryEthics",        color: palette.pink,         icon: "heart-outline" },
  technology:    { labelKey: "battles.categoryTechnology",    color: palette.primaryLight, icon: "hardware-chip-outline" },
  society:       { labelKey: "battles.categorySociety",       color: palette.warning,      icon: "people-outline" },
  knowledge:     { labelKey: "battles.categoryKnowledge",     color: palette.teal,         icon: "library-outline" },
  consciousness: { labelKey: "battles.categoryConsciousness", color: palette.primary,      icon: "infinite-outline" },
};

interface Thread {
  id: string;
  question: string;
  description: string;
  category: string;
  totalSessions: number;
  knowledgeBaseSize: number;
  battleCardId: string | null;
}

interface BattleCard {
  id: string;
  createdAt: string;
  thread: { id: string; question: string; category: string };
  player1: {
    username: string; scoreTotal: number; scoreDensity: number;
    scoreConnections: number; scoreDepth: number; durationSeconds: number; isWinner: boolean;
  };
  player2: {
    username: string; scoreTotal: number; scoreDensity: number;
    scoreConnections: number; scoreDepth: number; durationSeconds: number; isWinner: boolean;
  };
}

interface Message { role: "user" | "assistant"; content: string }

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function timeAgo(dateStr: string, t: (key: string, opts?: object) => string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return t("battles.timeAgoSec", { n: diff });
  if (diff < 3600) return t("battles.timeAgoMin", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("battles.timeAgoHour", { n: Math.floor(diff / 3600) });
  return t("battles.timeAgoDays", { n: Math.floor(diff / 86400) });
}

// ─── Battle Session Modal ─────────────────────────────────────────────────────
function BattleSessionModal({
  visible, thread, sessionId, onClose, colors, getToken,
}: {
  visible: boolean; thread: Thread | null; sessionId: string | null;
  onClose: (battleCardId?: string) => void;
  colors: ReturnType<typeof useColors>;
  getToken: () => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(BATTLE_DURATION);
  const [timerActive, setTimerActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [score, setScore] = useState<{ density: number; connections: number; depth: number; total: number; explanation: string } | null>(null);
  const [battleCardId, setBattleCardId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMessages([]);
      setInput("");
      setSending(false);
      setTimeLeft(BATTLE_DURATION);
      setTimerActive(false);
      setCompleted(false);
      setCompleting(false);
      setScore(null);
      setBattleCardId(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    if (!timerActive || completed) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, completed]);

  async function sendMessage() {
    if (!input.trim() || sending || completed || !thread || !sessionId) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    if (!timerActive) setTimerActive(true);

    const token = await getToken();
    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);

    try {
      const r = await fetch(`${BASE}/api/threads/${thread.id}/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await r.json() as { content?: string };
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content! }]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: t("battles.connError") }]);
    } finally {
      setSending(false);
    }
  }

  async function handleComplete() {
    if (completing || completed || !thread || !sessionId) return;
    if (messages.filter(m => m.role === "user").length === 0) {
      Alert.alert(t("battles.noMsgTitle"), t("battles.noMsgBody"));
      return;
    }
    setCompleting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const token = await getToken();
    try {
      const r = await fetch(`${BASE}/api/threads/${thread.id}/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      });
      const data = await r.json() as {
        score?: { density: number; connections: number; depth: number; total: number; explanation: string };
        battleCardId?: string;
      };
      if (data.score) setScore(data.score);
      if (data.battleCardId) setBattleCardId(data.battleCardId);
      setCompleted(true);
    } catch {
      Alert.alert(t("battles.errorTitle"), t("battles.errorComplete"));
    } finally {
      setCompleting(false);
    }
  }

  async function handleShare() {
    if (!score) return;
    setSharing(true);
    try {
      await new Promise(r => setTimeout(r, 200));
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1.0, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("battles.shareDialogTitle") });
      } else {
        const url = battleCardId ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/battle-cards/${battleCardId}` : "";
        await Share.share({
          message: t("battles.shareSessionMsg", { total: score.total, density: score.density, connections: score.connections, depth: score.depth }) + (url ? `\n${url}` : ""),
        });
      }
    } catch {
      /* user cancelled or error — silent fallback */
    } finally {
      setSharing(false);
    }
  }

  const timerColor = timeLeft > 60 ? colors.primary : colors.pink;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !timerActive && onClose()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Off-screen shareable card — catturata da captureRef */}
        {completed && score && (
          <View
            ref={shareCardRef}
            collapsable={false}
            style={{ position: "absolute", left: -Dimensions.get("window").width * 2, top: 0 }}
            pointerEvents="none"
          >
            <ShareableBattleCard
              data={{
                total: score.total,
                density: score.density,
                connections: score.connections,
                depth: score.depth,
                question: thread?.question ?? "",
              }}
            />
          </View>
        )}
        {/* Header */}
        <View style={[styles.sessionHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => {
            if (!timerActive || completed) { onClose(battleCardId ?? undefined); return; }
            Alert.alert(t("battles.leaveTitle"), t("battles.leaveMsg"), [
              { text: t("battles.leaveCancel") },
              { text: t("battles.leaveConfirm"), style: "destructive", onPress: () => { if (timerRef.current) clearInterval(timerRef.current); onClose(); } },
            ]);
          }}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={2}>
            {thread?.question ?? ""}
          </Text>
          {!completed ? (
            <View style={[styles.timerBadge, { backgroundColor: timerColor + "18", borderColor: timerColor + "40" }]}>
              <Ionicons name="timer-outline" size={14} color={timerColor} />
              <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
            </View>
          ) : (
            <Ionicons name="checkmark-circle" size={22} color={colors.teal} />
          )}
        </View>

        {/* Completed state */}
        {completed && score ? (
          <ScrollView contentContainerStyle={styles.completedContainer}>
            <View style={[styles.scoreCircle, { borderColor: colors.primary + "40", backgroundColor: colors.primary + "10" }]}>
              <Text style={[styles.scoreCircleNum, { color: colors.primary }]}>{score.total}</Text>
              <Text style={[styles.scoreCircleLabel, { color: colors.mutedForeground }]}>{t("battles.sessionPoints")}</Text>
            </View>

            <View style={styles.scoreGrid}>
              {[
                { label: t("battles.sessionDensity"), value: score.density, color: colors.teal, icon: "layers-outline" },
                { label: t("battles.sessionConnections"), value: score.connections, color: colors.primary, icon: "git-network-outline" },
                { label: t("battles.sessionDepth"), value: score.depth, color: colors.pink, icon: "telescope-outline" },
              ].map(item => (
                <View key={item.label} style={[styles.scoreCard, { backgroundColor: item.color + "10", borderColor: item.color + "25" }]}>
                  <Ionicons name={item.icon as never} size={18} color={item.color} />
                  <Text style={[styles.scoreCardNum, { color: item.color }]}>{item.value}</Text>
                  <Text style={[styles.scoreCardLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.scoreExplanation, { color: colors.mutedForeground }]}>{score.explanation}</Text>

            {score && (
              <Pressable
                style={[styles.shareBtn, { backgroundColor: colors.primary, opacity: sharing ? 0.6 : 1 }]}
                onPress={handleShare}
                disabled={sharing}
              >
                <Ionicons name={sharing ? "hourglass-outline" : "share-outline"} size={18} color={palette.white} />
                <Text style={styles.shareBtnText}>{sharing ? t("battles.preparing") : t("battles.shareResult")}</Text>
              </Pressable>
            )}

            <Pressable style={[styles.closeBtn, { borderColor: colors.border }]} onPress={() => onClose(battleCardId ?? undefined)}>
              <Text style={[styles.closeBtnText, { color: colors.mutedForeground }]}>{t("battles.sessionClose")}</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <>
            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={{ padding: colors.spacing.lg, gap: colors.spacing.md }}
              ListEmptyComponent={
                <View style={styles.emptySession}>
                  <Ionicons name="flash-outline" size={40} color={colors.primary} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptySessionText, { color: colors.mutedForeground }]}>
                    {t("battles.sessionEmptyMsg")}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[
                  styles.msgBubble,
                  item.role === "user"
                    ? { alignSelf: "flex-end", backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }
                    : { alignSelf: "flex-start", backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                  <Text style={[styles.msgText, { color: colors.foreground }]}>{item.content}</Text>
                </View>
              )}
            />

            {/* Input */}
            <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={input}
                onChangeText={setInput}
                placeholder={t("battles.sessionPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={600}
                editable={!sending && !completed}
              />
              {!completed && (
                <Pressable
                  style={[styles.completeBtn, { backgroundColor: colors.pink + "18" }]}
                  onPress={handleComplete}
                  disabled={completing}
                >
                  <Ionicons name="flag-outline" size={18} color={colors.pink} />
                </Pressable>
              )}
              <Pressable
                style={[styles.sendBtn, { backgroundColor: input.trim() && !sending ? colors.primary : colors.primary + "40" }]}
                onPress={sendMessage}
                disabled={!input.trim() || sending || completed}
              >
                {sending ? <ActivityIndicator size="small" color={colors.palette.white} /> : <Ionicons name="send" size={16} color={colors.palette.white} />}
              </Pressable>
            </View>
          </>
        )}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BattlesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [publicCards, setPublicCards] = useState<BattleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"arena" | "risultati" | "threads">("arena");

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionVisible, setSessionVisible] = useState(false);
  const [startingThreadId, setStartingThreadId] = useState<string | null>(null);
  const [pendingShareCard, setPendingShareCard] = useState<ShareCardData | null>(null);
  const [historySharing, setHistorySharing] = useState(false);
  const historyCardRef = useRef<View>(null);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    const token = await getToken();
    const h = { Authorization: `Bearer ${token ?? ""}` };
    try {
      const [threadsRes, cardsRes] = await Promise.all([
        fetch(`${BASE}/api/threads`, { headers: h }),
        fetch(`${BASE}/api/battles/public`),
      ]);
      if (threadsRes.ok) setThreads(await threadsRes.json() as Thread[]);
      if (cardsRes.ok) setPublicCards(await cardsRes.json() as BattleCard[]);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, []);

  async function startBattle(thread: Thread) {
    setStartingThreadId(thread.id);
    const token = await getToken();
    try {
      const r = await fetch(`${BASE}/api/threads/${thread.id}/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username: t("battles.myUsername") }),
      });
      if (!r.ok) throw new Error("start failed");
      const data = await r.json() as { sessionId: string };
      setActiveThread(thread);
      setActiveSessionId(data.sessionId);
      setSessionVisible(true);
    } catch {
      Alert.alert(t("battles.errorTitle"), t("battles.errorStart"));
    }
    setStartingThreadId(null);
  }

  function onSessionClose(battleCardId?: string) {
    setSessionVisible(false);
    setActiveThread(null);
    setActiveSessionId(null);
    if (battleCardId) {
      setTab("risultati");
      loadData(true);
    }
  }

  const bottomPad = Platform.OS === "web" ? 34 : tabBarHeight;

  if (loading) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        <LinearGradient
          colors={[colors.primary + "18", colors.transparent]}
          style={[styles.header, { paddingTop: insets.top + colors.spacing.sm }]}
        >
          <View style={styles.headerRow}>
            <View style={{ gap: 8 }}>
              <SkeletonBox width={140} height={22} borderRadius={8} />
              <SkeletonBox width={200} height={13} borderRadius={6} />
            </View>
          </View>
          <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SkeletonBox width="45%" height={32} borderRadius={8} />
            <SkeletonBox width="45%" height={32} borderRadius={8} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, padding: colors.spacing.lg, gap: colors.spacing.md }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ borderRadius: 14, padding: 16, gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <SkeletonBox width="40%" height={11} borderRadius={5} />
              <SkeletonBox width="90%" height={16} borderRadius={6} />
              <SkeletonBox width="70%" height={16} borderRadius={6} />
              <SkeletonBox width={90} height={32} borderRadius={8} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary + "18", colors.transparent]}
        style={[styles.header, { paddingTop: insets.top + colors.spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("battles.screenTitle")}</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{t("battles.screenSubtitle")}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["arena", "risultati", "threads"] as const).map(tabKey => (
            <Pressable
              key={tabKey}
              style={[styles.tabBtn, tab === tabKey && { backgroundColor: colors.primary }]}
              onPress={() => setTab(tabKey)}
            >
              <Text style={[styles.tabBtnText, { color: tab === tabKey ? colors.palette.white : colors.mutedForeground }]}>
                {tabKey === "arena" ? t("battles.tabArena") : tabKey === "risultati" ? t("battles.tabResults") : t("nav.threads")}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {tab === "arena" ? (
        <FlatList
          data={threads}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: colors.spacing.lg, paddingBottom: bottomPad + colors.spacing.lg, gap: colors.spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flash-outline" size={48} color={colors.primary} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("battles.noArena")}</Text>
            </View>
          }
          renderItem={({ item: thread, index }) => {
            const meta = CATEGORY_META[thread.category] ?? { labelKey: thread.category, color: colors.mutedForeground, icon: "help-outline" };
            const isStarting = startingThreadId === thread.id;
            return (
              <PressableScale
                style={[styles.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => startBattle(thread)}
                disabled={isStarting}
                scaleTarget={0.97}
              >
                <View style={styles.threadTop}>
                  <View style={[styles.catBadge, { backgroundColor: meta.color + "18", borderColor: meta.color + "30" }]}>
                    <Ionicons name={meta.icon as never} size={12} color={meta.color} />
                    <Text style={[styles.catLabel, { color: meta.color }]}>{t(meta.labelKey)}</Text>
                  </View>
                  <View style={styles.threadStats}>
                    <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{thread.totalSessions}</Text>
                    <Ionicons name="git-network-outline" size={12} color={colors.mutedForeground} style={{ marginLeft: colors.spacing.sm }} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{thread.knowledgeBaseSize}</Text>
                  </View>
                </View>

                <Text style={[styles.threadQ, { color: colors.foreground }]}>{thread.question}</Text>
                {thread.description ? (
                  <Text style={[styles.threadDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {thread.description}
                  </Text>
                ) : null}

                <View style={[styles.startBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
                  {isStarting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="flash" size={15} color={colors.primary} />
                      <Text style={[styles.startBtnText, { color: colors.primary }]}>{t("battles.startBattle")}</Text>
                    </>
                  )}
                </View>
              </PressableScale>
            );
          }}
        />
      ) : tab === "risultati" ? (
        <FlatList
          data={publicCards}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: colors.spacing.lg, paddingBottom: bottomPad + colors.spacing.lg, gap: colors.spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={colors.primary} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t("battles.noResults")}
              </Text>
            </View>
          }
          renderItem={({ item: card }) => {
            const meta = CATEGORY_META[card.thread.category] ?? { labelKey: card.thread.category, color: colors.mutedForeground };
            const winner = card.player1.isWinner ? card.player1 : card.player2;
            const loser = card.player1.isWinner ? card.player2 : card.player1;

            async function shareCard() {
              const data: ShareCardData = {
                total: winner.scoreTotal,
                density: winner.scoreDensity,
                connections: winner.scoreConnections,
                depth: winner.scoreDepth,
                question: card.thread.question,
                username: winner.username,
              };
              setPendingShareCard(data);
              setHistorySharing(true);
              await new Promise(r => setTimeout(r, 200));
              try {
                const uri = await captureRef(historyCardRef, { format: "png", quality: 1.0, result: "tmpfile" });
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("battles.shareHistoryDialogTitle") });
                } else {
                  await Share.share({
                    message: t("battles.shareCardMsg", { username: winner.username, total: winner.scoreTotal, density: winner.scoreDensity, connections: winner.scoreConnections, depth: winner.scoreDepth }),
                  });
                }
              } catch { /* cancelled or error */ } finally {
                setPendingShareCard(null);
                setHistorySharing(false);
              }
            }

            return (
              <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  <View style={[styles.catBadge, { backgroundColor: (meta.color ?? colors.mutedForeground) + "18", borderColor: (meta.color ?? colors.mutedForeground) + "30" }]}>
                    <Text style={[styles.catLabel, { color: meta.color ?? colors.mutedForeground }]}>{t(meta.labelKey)}</Text>
                  </View>
                  <Text style={[styles.timeAgoText, { color: colors.mutedForeground }]}>{timeAgo(card.createdAt, t)}</Text>
                </View>

                <Text style={[styles.resultQ, { color: colors.foreground }]} numberOfLines={2}>{card.thread.question}</Text>

                <View style={styles.vsRow}>
                  {/* Winner */}
                  <View style={[styles.playerCol, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
                    <View style={styles.winnerBadge}>
                      <Ionicons name="trophy" size={12} color={colors.gold} />
                      <Text style={[styles.winnerText, { color: colors.gold }]}>{t("battles.winnerLabel")}</Text>
                    </View>
                    <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{winner.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.primary }]}>{winner.scoreTotal}</Text>
                    <View style={styles.miniPips}>
                      <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>D:{winner.scoreDensity}</Text>
                      <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>C:{winner.scoreConnections}</Text>
                      <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>P:{winner.scoreDepth}</Text>
                    </View>
                    <Text style={[styles.duration, { color: colors.mutedForeground }]}>{formatDuration(winner.durationSeconds)}</Text>
                  </View>

                  <Text style={[styles.vsText, { color: colors.mutedForeground }]}>VS</Text>

                  {/* Loser */}
                  <View style={[styles.playerCol, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{loser.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.mutedForeground }]}>{loser.scoreTotal}</Text>
                    <View style={styles.miniPips}>
                      <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>D:{loser.scoreDensity}</Text>
                      <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>C:{loser.scoreConnections}</Text>
                      <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>P:{loser.scoreDepth}</Text>
                    </View>
                    <Text style={[styles.duration, { color: colors.mutedForeground }]}>{formatDuration(loser.durationSeconds)}</Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.shareCardBtn, { borderColor: colors.border, opacity: historySharing ? 0.5 : 1 }]}
                  onPress={shareCard}
                  disabled={historySharing}
                >
                  <Ionicons
                    name={historySharing ? "hourglass-outline" : "share-outline"}
                    size={14}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.shareCardText, { color: colors.mutedForeground }]}>
                    {historySharing ? t("battles.preparing") : t("battles.share")}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: colors.spacing.lg }}>
          <Ionicons name="chatbubble-ellipses-outline" size={52} color={colors.primary} style={{ opacity: 0.25 }} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>{t("nav.threads")}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>{t("explore.comingSoon")}</Text>
        </View>
      )}

      {/* Off-screen card per condivisione storico */}
      {pendingShareCard && (
        <View
          ref={historyCardRef}
          collapsable={false}
          style={{ position: "absolute", left: -Dimensions.get("window").width * 2, top: 0 }}
          pointerEvents="none"
        >
          <ShareableBattleCard data={pendingShareCard} />
        </View>
      )}

      <BattleSessionModal
        visible={sessionVisible}
        thread={activeThread}
        sessionId={activeSessionId}
        onClose={onSessionClose}
        colors={colors}
        getToken={getToken}
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { marginBottom: 14 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  threadCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  threadTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  catLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  threadStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  threadQ: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  threadDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10 },
  startBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  resultCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultQ: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  vsText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  playerCol: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, gap: 4, alignItems: "center" },
  winnerBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  winnerText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  playerName: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  playerScore: { fontSize: 20, fontFamily: "Inter_700Bold" },
  miniPips: { flexDirection: "row", gap: 6 },
  miniPip: { fontSize: 10, fontFamily: "Inter_400Regular" },
  duration: { fontSize: 10, fontFamily: "Inter_400Regular" },
  shareCardBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingVertical: 8 },
  shareCardText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  timeAgoText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  sessionTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  timerText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  completedContainer: { alignItems: "center", padding: 24, gap: 20 },
  scoreCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  scoreCircleNum: { fontSize: 40, fontFamily: "Inter_700Bold" },
  scoreCircleLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  scoreGrid: { flexDirection: "row", gap: 12, width: "100%" },
  scoreCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center", gap: 6 },
  scoreCardNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
  scoreCardLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  scoreExplanation: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  shareBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  closeBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  emptySession: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptySessionText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 100 },
  completeBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  msgBubble: { maxWidth: "80%", borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  msgText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
});

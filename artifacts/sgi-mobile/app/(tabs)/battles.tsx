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
  Keyboard,
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
const MIN_CHARS = 10;

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
  isVsAi?: boolean;
}

interface MetricComparison {
  key: string; label: string; user: number; ai: number; diff: number;
  winner: "user" | "ai" | "tie";
}

interface BattleResult {
  question: string;
  category: string;
  userAnswer: string;
  aiAnswer: string;
  user: { rawScore: number };
  ai: { rawScore: number };
  outcome: {
    winner: "user" | "ai" | "tie";
    userRawScore: number;
    aiRawScore: number;
    margin: number;
    metricComparison: MetricComparison[];
    aiAdvantages: MetricComparison[];
    userStrengths: MetricComparison[];
  };
  reward: { tier: string; xpAwarded: number; eligibleForWinBadge: boolean };
  battleId: string | null;
  xp: number | null;
  level: number | null;
  badgeAwarded: string | null;
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

// ─── Per-metric comparison row ────────────────────────────────────────────────
function MetricRow({ m, colors }: { m: MetricComparison; colors: ReturnType<typeof useColors> }) {
  const userColor = m.winner === "user" ? colors.teal : colors.primary;
  const aiColor = colors.pink;
  return (
    <View style={[styles.metricRow, { borderBottomColor: colors.border }]}>
      <View style={styles.metricHead}>
        <Text style={[styles.metricLabel, { color: colors.foreground }]}>{m.label}</Text>
        {m.winner === "tie" ? (
          <Text style={[styles.metricChip, { backgroundColor: colors.muted, color: colors.mutedForeground }]}>pari</Text>
        ) : (
          <Text
            style={[styles.metricChip, {
              backgroundColor: (m.winner === "user" ? colors.teal : colors.pink) + "22",
              color: m.winner === "user" ? colors.teal : colors.pink,
            }]}
          >
            {m.winner === "user" ? "Tu" : "AI"} +{Math.abs(m.diff).toFixed(1)}
          </Text>
        )}
      </View>
      <View style={styles.barRow}>
        <Text style={[styles.barTag, { color: colors.mutedForeground }]}>Tu</Text>
        <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.barFill, { width: `${(m.user / 10) * 100}%`, backgroundColor: userColor }]} />
        </View>
        <Text style={[styles.barVal, { color: userColor }]}>{m.user.toFixed(1)}</Text>
      </View>
      <View style={styles.barRow}>
        <Text style={[styles.barTag, { color: colors.mutedForeground }]}>AI</Text>
        <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.barFill, { width: `${(m.ai / 10) * 100}%`, backgroundColor: aiColor + "99" }]} />
        </View>
        <Text style={[styles.barVal, { color: aiColor }]}>{m.ai.toFixed(1)}</Text>
      </View>
    </View>
  );
}

// ─── Battle Session Modal (USER vs AI, single answer, no timer) ───────────────
function BattleSessionModal({
  visible, thread, onClose, colors, getToken,
}: {
  visible: boolean; thread: Thread | null;
  onClose: (didWin?: boolean) => void;
  colors: ReturnType<typeof useColors>;
  getToken: () => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"compose" | "evaluating" | "result">("compose");
  const [result, setResult] = useState<BattleResult | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setAnswer("");
      setPhase("compose");
      setResult(null);
      setShowAi(false);
      setShowMine(false);
      setKeyboardHeight(0);
    }
  }, [visible]);

  // iOS pageSheet modals don't lay out like a root view, so KeyboardAvoidingView
  // mis-computes the offset and hides the input. Track the keyboard manually and
  // shrink the content with paddingBottom. Android's adjustResize handles itself.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  async function submit() {
    if (answer.trim().length < MIN_CHARS || phase === "evaluating" || !thread) return;
    Keyboard.dismiss();
    setPhase("evaluating");
    try {
      const token = await getToken();
      const r = await fetch(`${BASE}/api/threads/${thread.id}/battle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userAnswer: answer.trim() }),
      });
      if (!r.ok) throw new Error("eval failed");
      const data = await r.json() as BattleResult;
      setResult(data);
      setPhase("result");
    } catch {
      Alert.alert(t("battles.errorTitle"), t("battles.errorComplete"));
      setPhase("compose");
    }
  }

  const meta = thread ? (CATEGORY_META[thread.category] ?? null) : null;
  const chars = answer.trim().length;
  const isResult = phase === "result" && result != null;
  const win = isResult && result!.outcome.winner === "user";

  function requestClose() {
    if (phase === "evaluating") return;
    onClose(phase === "result" ? result?.outcome.winner === "user" : false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: keyboardHeight }}>
        {/* Header */}
        <View style={[styles.sessionHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={requestClose} disabled={phase === "evaluating"}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={2}>
            {isResult ? t("battles.vsAiResultTitle", "Risultato · Tu vs AI") : t("battles.vsAiTitle", "Sfida l'AI")}
          </Text>
          <View style={[styles.vsAiPill, { backgroundColor: colors.pink + "18", borderColor: colors.pink + "40" }]}>
            <Ionicons name="sparkles-outline" size={12} color={colors.pink} />
            <Text style={[styles.vsAiPillText, { color: colors.pink }]}>vs AI</Text>
          </View>
        </View>

        {/* ── Result phase ── */}
        {isResult ? (
          <ScrollView contentContainerStyle={{ padding: colors.spacing.lg, paddingBottom: insets.bottom + 32, gap: 14 }}>
            {/* Banner */}
            <View style={[styles.banner, {
              backgroundColor: (win ? colors.teal : result!.outcome.winner === "tie" ? colors.gold : colors.pink) + "14",
              borderColor: (win ? colors.teal : result!.outcome.winner === "tie" ? colors.gold : colors.pink) + "40",
            }]}>
              <Ionicons
                name={win ? "trophy" : result!.outcome.winner === "tie" ? "swap-horizontal" : "flash"}
                size={26}
                color={win ? colors.teal : result!.outcome.winner === "tie" ? colors.gold : colors.pink}
              />
              <Text style={[styles.bannerTitle, { color: win ? colors.teal : result!.outcome.winner === "tie" ? colors.gold : colors.pink }]}>
                {win ? "Vittoria" : result!.outcome.winner === "tie" ? "Pareggio" : "Sconfitta"}
              </Text>
              <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>
                {win ? "Hai battuto l'AI su questa domanda." : result!.outcome.winner === "tie" ? "Testa a testa con l'AI." : "L'AI ha avuto la meglio — ma hai guadagnato XP."}
              </Text>
            </View>

            {/* Score duel */}
            <View style={styles.scoreRow}>
              <View style={[styles.scoreCol, {
                backgroundColor: win ? colors.teal + "12" : colors.card,
                borderColor: win ? colors.teal + "40" : colors.border,
              }]}>
                <Text style={[styles.scoreColLabel, { color: colors.mutedForeground }]}>Tu</Text>
                <Text style={[styles.scoreColNum, { color: win ? colors.teal : colors.foreground }]}>{result!.outcome.userRawScore.toFixed(1)}</Text>
                <Text style={[styles.scoreColUnit, { color: colors.mutedForeground }]}>/100 SGI</Text>
              </View>
              <View style={[styles.scoreCol, {
                backgroundColor: result!.outcome.winner === "ai" ? colors.pink + "12" : colors.card,
                borderColor: result!.outcome.winner === "ai" ? colors.pink + "40" : colors.border,
              }]}>
                <Text style={[styles.scoreColLabel, { color: colors.mutedForeground }]}>SGI · AI</Text>
                <Text style={[styles.scoreColNum, { color: result!.outcome.winner === "ai" ? colors.pink : colors.foreground }]}>{result!.outcome.aiRawScore.toFixed(1)}</Text>
                <Text style={[styles.scoreColUnit, { color: colors.mutedForeground }]}>/100 SGI</Text>
              </View>
            </View>

            {/* Reward */}
            <View style={[styles.rewardBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="flash" size={20} color={colors.gold} />
                <Text style={[styles.rewardXp, { color: colors.gold }]}>+{result!.reward.xpAwarded} XP</Text>
                {result!.level != null && (
                  <Text style={[styles.rewardLevel, { color: colors.mutedForeground }]}>Livello {result!.level}</Text>
                )}
              </View>
              {result!.badgeAwarded === "battle_victor" && (
                <View style={[styles.badgePill, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "40" }]}>
                  <Ionicons name="ribbon" size={14} color={colors.gold} />
                  <Text style={[styles.badgeText, { color: colors.gold }]}>Battle Victor</Text>
                </View>
              )}
            </View>

            {/* Per-metric breakdown */}
            <View style={[styles.metricsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.metricsTitle, { color: colors.foreground }]}>Analisi per metrica</Text>
              <Text style={[styles.metricsSub, { color: colors.mutedForeground }]}>Stesso motore SGI per entrambe le risposte</Text>
              {result!.outcome.metricComparison.map(m => <MetricRow key={m.key} m={m} colors={colors} />)}
            </View>

            {/* Strengths / weaknesses */}
            <View style={styles.strengthsRow}>
              <View style={[styles.strengthCol, { backgroundColor: colors.teal + "0d", borderColor: colors.teal + "22" }]}>
                <Text style={[styles.strengthTitle, { color: colors.teal }]}>Punti di forza</Text>
                {result!.outcome.userStrengths.length > 0 ? (
                  result!.outcome.userStrengths.slice(0, 4).map(m => (
                    <View key={m.key} style={styles.strengthItem}>
                      <Text style={[styles.strengthItemLabel, { color: colors.foreground }]} numberOfLines={1}>{m.label}</Text>
                      <Text style={[styles.strengthItemVal, { color: colors.teal }]}>+{Math.abs(m.diff).toFixed(1)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.strengthEmpty, { color: colors.mutedForeground }]}>L'AI ti ha superato ovunque stavolta.</Text>
                )}
              </View>
              <View style={[styles.strengthCol, { backgroundColor: colors.pink + "0d", borderColor: colors.pink + "22" }]}>
                <Text style={[styles.strengthTitle, { color: colors.pink }]}>Dove migliorare</Text>
                {result!.outcome.aiAdvantages.length > 0 ? (
                  result!.outcome.aiAdvantages.slice(0, 4).map(m => (
                    <View key={m.key} style={styles.strengthItem}>
                      <Text style={[styles.strengthItemLabel, { color: colors.foreground }]} numberOfLines={1}>{m.label}</Text>
                      <Text style={[styles.strengthItemVal, { color: colors.pink }]}>+{Math.abs(m.diff).toFixed(1)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.strengthEmpty, { color: colors.mutedForeground }]}>Hai battuto l'AI ovunque. Notevole.</Text>
                )}
              </View>
            </View>

            {/* Answers (collapsible) */}
            <Pressable style={[styles.collapBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowAi(s => !s)}>
              <Text style={[styles.collapTitle, { color: colors.pink }]}>Risposta dell'AI</Text>
              <Ionicons name={showAi ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </Pressable>
            {showAi && <Text style={[styles.answerText, { color: colors.foreground, borderColor: colors.border }]}>{result!.aiAnswer}</Text>}

            <Pressable style={[styles.collapBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowMine(s => !s)}>
              <Text style={[styles.collapTitle, { color: colors.primary }]}>La tua risposta</Text>
              <Ionicons name={showMine ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </Pressable>
            {showMine && <Text style={[styles.answerText, { color: colors.foreground, borderColor: colors.border }]}>{result!.userAnswer}</Text>}

            {/* Actions */}
            <Pressable style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => onClose(win)}>
              <Text style={styles.primaryActionText}>{win ? "Vedi nel Feed" : "Torna ai Thread"}</Text>
            </Pressable>
          </ScrollView>
        ) : (
          /* ── Compose / evaluating phase ── */
          <ScrollView
            contentContainerStyle={{ padding: colors.spacing.lg, paddingBottom: insets.bottom + 32, gap: 14 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Question */}
            <View style={[styles.qCard, { backgroundColor: colors.primary + "0d", borderColor: colors.primary + "30" }]}>
              {meta && <Text style={[styles.qCat, { color: colors.pink }]}>{t(meta.labelKey)}</Text>}
              <Text style={[styles.qText, { color: colors.foreground }]}>{thread?.question ?? ""}</Text>
            </View>

            {/* Calm instructions */}
            <View style={[styles.instrBox, { backgroundColor: colors.teal + "0d", borderColor: colors.teal + "22" }]}>
              <Ionicons name="bulb-outline" size={18} color={colors.teal} />
              <Text style={[styles.instrText, { color: colors.foreground }]}>
                Nessun cronometro: prenditi il tempo per la risposta più profonda e originale. L'AI risponde alla stessa domanda e un unico motore SGI valuta entrambe sulle 11 metriche. Vinci → XP alti + badge; anche perdendo guadagni XP.
              </Text>
            </View>

            {/* Composer */}
            <View style={[styles.composeWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.composeInput, { color: colors.foreground }]}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Sviluppa il tuo ragionamento: collega concetti tra domini diversi, vai in profondità, sii originale…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                editable={phase !== "evaluating"}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: chars < MIN_CHARS ? colors.pink : colors.mutedForeground, borderTopColor: colors.border }]}>
                {chars < MIN_CHARS ? `Almeno ${MIN_CHARS} caratteri` : `${chars} caratteri`}
              </Text>
            </View>

            <Pressable
              style={[styles.submitBtn, {
                backgroundColor: chars >= MIN_CHARS && phase !== "evaluating" ? colors.pink : colors.muted,
                opacity: chars >= MIN_CHARS && phase !== "evaluating" ? 1 : 0.7,
              }]}
              onPress={submit}
              disabled={chars < MIN_CHARS || phase === "evaluating"}
            >
              {phase === "evaluating" ? (
                <>
                  <ActivityIndicator size="small" color={palette.white} />
                  <Text style={styles.submitBtnText}>L'AI risponde e il motore valuta…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="flash" size={16} color={palette.white} />
                  <Text style={styles.submitBtnText}>Invia e affronta l'AI</Text>
                </>
              )}
            </Pressable>

            {phase === "evaluating" && (
              <Text style={[styles.evalHint, { color: colors.mutedForeground }]}>
                Può richiedere qualche secondo — l'AI genera una risposta forte, poi entrambe vengono valutate insieme.
              </Text>
            )}
          </ScrollView>
        )}
      </View>
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
  const [sessionVisible, setSessionVisible] = useState(false);
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

  function startBattle(thread: Thread) {
    setActiveThread(thread);
    setSessionVisible(true);
  }

  function onSessionClose(didWin?: boolean) {
    setSessionVisible(false);
    setActiveThread(null);
    if (didWin) setTab("risultati");
    // Always refresh threads + feed so a completed battle is reflected immediately.
    loadData(true);
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
          renderItem={({ item: thread }) => {
            const meta = CATEGORY_META[thread.category] ?? { labelKey: thread.category, color: colors.mutedForeground, icon: "help-outline" };
            return (
              <PressableScale
                style={[styles.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => startBattle(thread)}
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

                <View style={[styles.startBtn, { backgroundColor: colors.pink + "15", borderColor: colors.pink + "30" }]}>
                  <Ionicons name="flash" size={15} color={colors.pink} />
                  <Text style={[styles.startBtnText, { color: colors.pink }]}>Sfida l'AI</Text>
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
            const isVsAi = !!card.isVsAi;

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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.catBadge, { backgroundColor: (meta.color ?? colors.mutedForeground) + "18", borderColor: (meta.color ?? colors.mutedForeground) + "30" }]}>
                      <Text style={[styles.catLabel, { color: meta.color ?? colors.mutedForeground }]}>{t(meta.labelKey)}</Text>
                    </View>
                    {isVsAi && (
                      <View style={[styles.vsAiTag, { backgroundColor: colors.pink + "18", borderColor: colors.pink + "30" }]}>
                        <Text style={[styles.vsAiTagText, { color: colors.pink }]}>vs AI</Text>
                      </View>
                    )}
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
                    {!isVsAi && (
                      <>
                        <View style={styles.miniPips}>
                          <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>D:{winner.scoreDensity}</Text>
                          <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>C:{winner.scoreConnections}</Text>
                          <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>P:{winner.scoreDepth}</Text>
                        </View>
                        <Text style={[styles.duration, { color: colors.mutedForeground }]}>{formatDuration(winner.durationSeconds)}</Text>
                      </>
                    )}
                  </View>

                  <Text style={[styles.vsText, { color: colors.mutedForeground }]}>VS</Text>

                  {/* Loser */}
                  <View style={[styles.playerCol, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{loser.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.mutedForeground }]}>{loser.scoreTotal}</Text>
                    {!isVsAi && (
                      <>
                        <View style={styles.miniPips}>
                          <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>D:{loser.scoreDensity}</Text>
                          <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>C:{loser.scoreConnections}</Text>
                          <Text style={[styles.miniPip, { color: colors.mutedForeground }]}>P:{loser.scoreDepth}</Text>
                        </View>
                        <Text style={[styles.duration, { color: colors.mutedForeground }]}>{formatDuration(loser.durationSeconds)}</Text>
                      </>
                    )}
                  </View>
                </View>

                {!isVsAi && (
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
                )}
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
  vsAiTag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  vsAiTagText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  // Session modal — header
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  sessionTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 20 },
  vsAiPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  vsAiPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Compose
  qCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 6 },
  qCat: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1 },
  qText: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26 },
  instrBox: { flexDirection: "row", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  instrText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },
  composeWrap: { borderRadius: 14, borderWidth: 1, padding: 12 },
  composeInput: { minHeight: 200, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15 },
  submitBtnText: { color: palette.white, fontSize: 14, fontFamily: "Inter_700Bold" },
  evalHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 17 },

  // Result
  banner: { alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 20, gap: 6 },
  bannerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  bannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  scoreRow: { flexDirection: "row", gap: 10 },
  scoreCol: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center", gap: 2 },
  scoreColLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1 },
  scoreColNum: { fontSize: 34, fontFamily: "Inter_700Bold" },
  scoreColUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  rewardBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderRadius: 14, borderWidth: 1, padding: 14 },
  rewardXp: { fontSize: 18, fontFamily: "Inter_700Bold" },
  rewardLevel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badgePill: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  metricsBox: { borderRadius: 14, borderWidth: 1, padding: 14 },
  metricsTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  metricsSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 6 },
  metricRow: { paddingVertical: 9, borderBottomWidth: 1, gap: 5 },
  metricHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricLabel: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  metricChip: { fontSize: 10, fontFamily: "Inter_700Bold", overflow: "hidden", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barTag: { width: 20, fontSize: 10, fontFamily: "Inter_400Regular" },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  barVal: { width: 28, textAlign: "right", fontSize: 11, fontFamily: "Inter_700Bold" },
  strengthsRow: { flexDirection: "row", gap: 10 },
  strengthCol: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  strengthTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  strengthItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  strengthItemLabel: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  strengthItemVal: { fontSize: 11, fontFamily: "Inter_700Bold" },
  strengthEmpty: { fontSize: 11, fontFamily: "Inter_400Regular" },
  collapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14 },
  collapTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  answerText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 21, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: -6 },
  primaryAction: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  primaryActionText: { color: palette.white, fontSize: 15, fontFamily: "Inter_700Bold" },
});

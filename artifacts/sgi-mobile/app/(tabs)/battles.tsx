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
  Platform,
  Keyboard,
  ActivityIndicator,
} from "react-native";
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
  philosophy: { labelKey: "battles.categoryPhilosophy", color: palette.primary,      icon: "telescope-outline" },
  science:    { labelKey: "battles.categoryScience",    color: palette.teal,         icon: "flask-outline" },
  technology: { labelKey: "battles.categoryTechnology", color: palette.primaryLight, icon: "hardware-chip-outline" },
  art:        { labelKey: "battles.categoryArt",        color: palette.pink,         icon: "color-palette-outline" },
  history:    { labelKey: "battles.categoryHistory",    color: palette.warning,      icon: "book-outline" },
  economics:  { labelKey: "battles.categoryEconomics",  color: palette.teal,         icon: "bar-chart-outline" },
  politics:   { labelKey: "battles.categoryPolitics",   color: palette.primary,      icon: "flag-outline" },
};

type Role = "user" | "assistant";
interface Msg { role: Role; content: string; timestamp?: string }

interface MatchResult {
  outcome: "win" | "loss" | "tie";
  myRawScore: number;
  opponentRawScore: number;
  reasoning: string;
  xpAwarded: number;
  opponentMessages: Msg[];
  opponentUsername: string;
}

interface MatchView {
  matchId: string;
  status: "waiting" | "active" | "scoring" | "completed" | "abandoned";
  theme: string;
  category: string;
  createdAt: string;
  mySlot: 1 | 2;
  myEntryStatus: "matched" | "in_progress" | "completed" | "forfeit";
  startedAt: string | null;
  timeRemaining: number;
  turnWindowSeconds: number;
  myMessages: Msg[];
  opponentPresent: boolean;
  opponentUsername: string | null;
  opponentCompleted: boolean;
  result: MatchResult | null;
}

interface MyMatch {
  matchId: string;
  status: MatchView["status"];
  theme: string;
  category: string;
  createdAt: string;
  myEntryStatus: MatchView["myEntryStatus"];
  timeRemaining: number;
  result: "win" | "loss" | "tie" | null;
  myRawScore: number | null;
}

interface PublicPlayer {
  username: string;
  rawScore: number;
  isWinner: boolean;
}
interface PublicMatch {
  id: string;
  createdAt: string;
  isVsAi: boolean;
  theme: string;
  category: string;
  player1: PublicPlayer;
  player2: PublicPlayer;
}

function fmt(s: number) {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function timerColor(s: number, colors: ReturnType<typeof useColors>) {
  if (s > 120) return colors.teal;
  if (s > 30) return colors.gold;
  return colors.pink;
}

function timeAgo(dateStr: string, t: ReturnType<typeof useTranslation>["t"]) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return t("battles.timeAgoSec", { n: diff });
  if (diff < 3600) return t("battles.timeAgoMin", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("battles.timeAgoHour", { n: Math.floor(diff / 3600) });
  return t("battles.timeAgoDays", { n: Math.floor(diff / 86400) });
}

// ─── Conversation bubble ─────────────────────────────────────────────────────
function Bubble({ m, colors, t }: { m: Msg; colors: ReturnType<typeof useColors>; t: (k: string) => string }) {
  const mine = m.role === "user";
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <View
        style={{
          maxWidth: "86%",
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: mine ? colors.primary + "22" : colors.pink + "1a",
          borderWidth: 1,
          borderColor: mine ? colors.primary + "40" : colors.pink + "33",
        }}
      >
        <Text style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, color: mine ? colors.primary : colors.pink, fontFamily: "Inter_600SemiBold" }}>
          {mine ? t("battles.myUsername") : t("battles.sparringAi")}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: colors.foreground, fontFamily: "Inter_400Regular" }}>{m.content}</Text>
      </View>
    </View>
  );
}

// ─── Collapsible conversation ────────────────────────────────────────────────
function Collapsible({ title, accent, messages, colors, t }: {
  title: string; accent: string; messages: Msg[]; colors: ReturnType<typeof useColors>; t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.collapWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Pressable style={styles.collapBtn} onPress={() => setOpen(o => !o)}>
        <Text style={[styles.collapTitle, { color: accent }]} numberOfLines={1}>{title}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {messages.length === 0
            ? <Text style={{ fontSize: 12, color: colors.mutedForeground }}>—</Text>
            : messages.map((m, i) => <Bubble key={i} m={m} colors={colors} t={t} />)}
        </View>
      )}
    </View>
  );
}

// ─── PvP Battle Modal (matchmaking → arena → result) ─────────────────────────
function BattlePvpModal({
  visible, matchId, onClose, colors, getToken,
}: {
  visible: boolean;
  matchId: string | null;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  getToken: () => Promise<string | null>;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<MatchView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(390);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const arenaInit = useRef(false);
  const completing = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const authedFetch = useCallback(async (path: string, init?: Parameters<typeof fetch>[1]) => {
    const token = await getToken();
    return fetch(`${BASE}/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
        ...(init?.headers ?? {}),
      },
    });
  }, [getToken]);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const r = await authedFetch(`/battles/matches/${matchId}`);
      if (!r.ok) { setLoadError(true); return; }
      const data = await r.json() as MatchView;
      setView(data);
      if (data.status === "active" && data.myEntryStatus === "in_progress" && !arenaInit.current) {
        arenaInit.current = true;
        setMessages(data.myMessages ?? []);
        setSecondsLeft(data.timeRemaining);
      }
    } catch {
      setLoadError(true);
    }
  }, [matchId, authedFetch]);

  const handleComplete = useCallback(async () => {
    if (completing.current) return;
    completing.current = true;
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/complete`, { method: "POST" });
      if (r.ok) { const data = await r.json() as MatchView; setView(data); }
      else { await load(); }
    } catch {
      await load();
    } finally {
      completing.current = false;
    }
  }, [authedFetch, matchId, load]);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/start`, { method: "POST" });
      if (!r.ok) throw new Error();
      const data = await r.json() as MatchView;
      arenaInit.current = true;
      setMessages(data.myMessages ?? []);
      setSecondsLeft(data.timeRemaining);
      setView(data);
    } catch {
      Alert.alert(t("battles.errorTitle"), t("battles.errorStart"));
      await load();
    } finally {
      setStarting(false);
    }
  }, [authedFetch, matchId, starting, load, t]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (content.length < MIN_CHARS || sending || secondsLeft <= 0) return;
    Keyboard.dismiss();
    setSending(true);
    const optimistic: Msg = { role: "user", content };
    setMessages(m => [...m, optimistic]);
    setInput("");
    try {
      const r = await authedFetch(`/battles/matches/${matchId}/turn`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      if (r.status === 409) {
        const e = await r.json().catch(() => ({})) as { code?: string };
        if (e.code === "TIME_UP") { await handleComplete(); return; }
        throw new Error();
      }
      if (!r.ok) throw new Error();
      const data = await r.json() as { reply: string; messages: Msg[]; timeRemaining: number };
      setMessages(data.messages);
      setSecondsLeft(data.timeRemaining);
    } catch {
      Alert.alert(t("battles.errorTitle"), t("battles.connError"));
      setMessages(m => m.filter(x => x !== optimistic));
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, sending, secondsLeft, authedFetch, matchId, handleComplete, t]);

  // Reset + initial load when opened.
  useEffect(() => {
    if (!visible || !matchId) return;
    arenaInit.current = false;
    completing.current = false;
    setView(null);
    setLoadError(false);
    setMessages([]);
    setInput("");
    setSecondsLeft(390);
    setKeyboardHeight(0);
    load();
  }, [visible, matchId, load]);

  // Track keyboard on iOS (pageSheet modals mis-handle KeyboardAvoidingView).
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const phase: "loading" | "error" | "waitingOpponent" | "abandoned" | "result" | "scoring" | "waitingResult" | "ready" | "arena" =
    !view
      ? (loadError ? "error" : "loading")
      : view.status === "waiting" ? "waitingOpponent"
      : view.status === "abandoned" ? "abandoned"
      : view.status === "completed" ? "result"
      : view.status === "scoring" ? "scoring"
      : (view.myEntryStatus === "completed" || view.myEntryStatus === "forfeit") ? "waitingResult"
      : view.myEntryStatus === "matched" ? "ready"
      : "arena";

  // Poll passive phases.
  useEffect(() => {
    if (!visible) return;
    if (phase !== "waitingOpponent" && phase !== "scoring" && phase !== "waitingResult") return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [visible, phase, load]);

  // Local countdown for the active arena; auto-complete at zero.
  useEffect(() => {
    if (!visible || phase !== "arena") return;
    if (secondsLeft <= 0) { handleComplete(); return; }
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [visible, phase, secondsLeft, handleComplete]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const themeBlock = view && (
    <View style={[styles.themeCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
      <Text style={[styles.themeCat, { color: colors.pink }]}>
        {CATEGORY_META[view.category] ? t(CATEGORY_META[view.category].labelKey) : view.category}
      </Text>
      <Text style={[styles.themeText, { color: colors.foreground }]}>{view.theme}</Text>
    </View>
  );

  function renderBody() {
    if (phase === "loading") {
      return (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (phase === "error") {
      return (
        <View style={styles.centerBody}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{t("battles.openError")}</Text>
        </View>
      );
    }
    const v = view!;

    if (phase === "waitingOpponent") {
      return (
        <ScrollView contentContainerStyle={{ padding: colors.spacing.lg, gap: 14 }}>
          {themeBlock}
          <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>{t("battles.stSearching")}</Text>
            <Text style={[styles.stateDesc, { color: colors.mutedForeground }]}>{t("battles.stWaiting")}</Text>
          </View>
        </ScrollView>
      );
    }

    if (phase === "abandoned") {
      return (
        <ScrollView contentContainerStyle={{ padding: colors.spacing.lg, gap: 14 }}>
          <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="hourglass-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>{t("battles.stAbandoned")}</Text>
            <Text style={[styles.stateDesc, { color: colors.mutedForeground }]}>{t("battles.matchmakeError")}</Text>
            <Pressable style={[styles.primaryAction, { backgroundColor: colors.primary, marginTop: 8 }]} onPress={onClose}>
              <Text style={styles.primaryActionText}>{t("battles.sessionClose")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (phase === "ready") {
      return (
        <ScrollView contentContainerStyle={{ padding: colors.spacing.lg, gap: 14, paddingBottom: insets.bottom + 24 }}>
          <View style={[styles.matchedRow, { backgroundColor: colors.teal + "12", borderColor: colors.teal + "30" }]}>
            <Ionicons name="people" size={20} color={colors.teal} />
            <Text style={[styles.matchedText, { color: colors.foreground }]} numberOfLines={1}>
              {t("battles.stReady")} · {v.opponentUsername ?? "?"}
            </Text>
          </View>
          {themeBlock}
          <View style={[styles.instrBox, { backgroundColor: colors.teal + "0d", borderColor: colors.teal + "22" }]}>
            <Ionicons name="bulb-outline" size={18} color={colors.teal} />
            <Text style={[styles.instrText, { color: colors.foreground }]}>
              {t("battles.arenaInstructions")}
            </Text>
          </View>
          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.pink, opacity: starting ? 0.6 : 1 }]}
            onPress={handleStart}
            disabled={starting}
          >
            {starting
              ? <ActivityIndicator size="small" color={palette.white} />
              : <Ionicons name="time-outline" size={16} color={palette.white} />}
            <Text style={styles.submitBtnText}>{t("battles.arenaStart")}</Text>
          </Pressable>
        </ScrollView>
      );
    }

    if (phase === "waitingResult" || phase === "scoring") {
      const scoring = phase === "scoring";
      return (
        <ScrollView contentContainerStyle={{ padding: colors.spacing.lg, gap: 14, paddingBottom: insets.bottom + 24 }}>
          {themeBlock}
          <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>
              {scoring ? t("battles.stScoring") : t("battles.stCompleted")}
            </Text>
            <Text style={[styles.stateDesc, { color: colors.mutedForeground }]}>
              {scoring ? t("battles.stScoringDesc") : t("battles.stWaitingResult")}
            </Text>
          </View>
          <Collapsible title={t("battles.myConversation")} accent={colors.primary} messages={v.myMessages ?? []} colors={colors} t={t} />
        </ScrollView>
      );
    }

    if (phase === "result" && v.result) {
      const res = v.result;
      const isWin = res.outcome === "win";
      const isTie = res.outcome === "tie";
      const color = isWin ? colors.teal : isTie ? colors.gold : colors.pink;
      const label = isWin ? t("battles.stWin") : isTie ? t("battles.stTie") : t("battles.stLoss");
      const sub = isWin
        ? t("battles.resultWinSub")
        : isTie
          ? t("battles.resultTieSub")
          : t("battles.resultLossSub");
      return (
        <ScrollView contentContainerStyle={{ padding: colors.spacing.lg, gap: 14, paddingBottom: insets.bottom + 24 }}>
          <View style={[styles.banner, { backgroundColor: color + "14", borderColor: color + "40" }]}>
            <Ionicons name={isWin ? "trophy" : isTie ? "swap-horizontal" : "flash"} size={26} color={color} />
            <Text style={[styles.bannerTitle, { color }]}>{label}</Text>
            <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>{sub}</Text>
          </View>

          <View style={styles.scoreRow}>
            <View style={[styles.scoreCol, { backgroundColor: isWin ? colors.teal + "12" : colors.card, borderColor: isWin ? colors.teal + "40" : colors.border }]}>
              <Text style={[styles.scoreColLabel, { color: colors.mutedForeground }]}>{t("battles.myUsername")}</Text>
              <Text style={[styles.scoreColNum, { color: isWin ? colors.teal : colors.foreground }]}>{res.myRawScore.toFixed(0)}</Text>
              <Text style={[styles.scoreColUnit, { color: colors.mutedForeground }]}>/100 SGI</Text>
            </View>
            <View style={[styles.scoreCol, { backgroundColor: res.outcome === "loss" ? colors.pink + "12" : colors.card, borderColor: res.outcome === "loss" ? colors.pink + "40" : colors.border }]}>
              <Text style={[styles.scoreColLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{res.opponentUsername}</Text>
              <Text style={[styles.scoreColNum, { color: res.outcome === "loss" ? colors.pink : colors.foreground }]}>{res.opponentRawScore.toFixed(0)}</Text>
              <Text style={[styles.scoreColUnit, { color: colors.mutedForeground }]}>/100 SGI</Text>
            </View>
          </View>

          <View style={[styles.rewardBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
            <Ionicons name="flash" size={20} color={colors.gold} />
            <Text style={[styles.rewardXp, { color: colors.gold }]}>+{res.xpAwarded} XP</Text>
          </View>

          {!!res.reasoning && (
            <View style={[styles.verdictBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Ionicons name="ribbon-outline" size={16} color={colors.gold} />
                <Text style={[styles.verdictTitle, { color: colors.foreground }]}>{t("battles.verdictTitle")}</Text>
              </View>
              <Text style={[styles.verdictText, { color: colors.mutedForeground }]}>{res.reasoning}</Text>
            </View>
          )}

          <Collapsible title={t("battles.myConversation")} accent={colors.primary} messages={v.myMessages ?? []} colors={colors} t={t} />
          <Collapsible title={`${t("battles.opponentLabel")} · ${res.opponentUsername}`} accent={colors.pink} messages={res.opponentMessages ?? []} colors={colors} t={t} />

          <Pressable style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.primaryActionText}>{t("battles.sessionClose")}</Text>
          </Pressable>
        </ScrollView>
      );
    }

    // ── Arena (active turn-based chat) ──
    const chars = input.trim().length;
    const timeUp = secondsLeft <= 0;
    return (
      <View style={{ flex: 1 }}>
        {/* Theme + timer strip */}
        <View style={[styles.arenaStrip, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.arenaCat, { color: colors.pink }]} numberOfLines={1}>{v.category}</Text>
            <Text style={[styles.arenaTheme, { color: colors.foreground }]} numberOfLines={1}>{v.theme}</Text>
          </View>
          <View style={[styles.timerPill, { backgroundColor: timerColor(secondsLeft, colors) + "1a", borderColor: timerColor(secondsLeft, colors) + "55" }]}>
            <Ionicons name="time-outline" size={14} color={timerColor(secondsLeft, colors)} />
            <Text style={[styles.timerText, { color: timerColor(secondsLeft, colors) }]}>{fmt(secondsLeft)}</Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: colors.spacing.lg }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.firstMove}>
              <Ionicons name="bulb-outline" size={32} color={colors.primary} />
              <Text style={[styles.firstMoveText, { color: colors.mutedForeground }]}>
                {t("battles.arenaFirstMsg")}
              </Text>
            </View>
          ) : (
            messages.map((m, i) => <Bubble key={i} m={m} colors={colors} t={t} />)
          )}
          {sending && (
            <View style={{ alignItems: "flex-start", marginTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.pink + "1a", borderWidth: 1, borderColor: colors.pink + "33" }}>
                <ActivityIndicator size="small" color={colors.pink} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("battles.sparringAiTyping")}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.composerRow}>
            <TextInput
              style={[styles.composerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={input}
              onChangeText={setInput}
              placeholder="Sviluppa la tua tesi, vai in profondità…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              editable={!timeUp && !sending}
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: chars >= MIN_CHARS && !sending && !timeUp ? colors.pink : colors.muted, opacity: chars >= MIN_CHARS && !sending && !timeUp ? 1 : 0.6 }]}
              onPress={handleSend}
              disabled={chars < MIN_CHARS || sending || timeUp}
            >
              {sending ? <ActivityIndicator size="small" color={palette.white} /> : <Ionicons name="send" size={16} color={palette.white} />}
            </Pressable>
          </View>
          <View style={styles.composerFoot}>
            <Text style={{ fontSize: 11, color: chars > 0 && chars < MIN_CHARS ? colors.pink : colors.mutedForeground }}>
              {chars > 0 && chars < MIN_CHARS ? `Almeno ${MIN_CHARS} caratteri` : timeUp ? "Tempo scaduto" : ""}
            </Text>
            <Pressable style={[styles.finishBtn, { borderColor: colors.border }]} onPress={handleComplete}>
              <Text style={[styles.finishBtnText, { color: colors.mutedForeground }]}>Concludi ora</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: keyboardHeight }}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>{t("battles.screenTitle")}</Text>
          <View style={[styles.vsPill, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
            <Ionicons name="people-outline" size={12} color={colors.primary} />
            <Text style={[styles.vsPillText, { color: colors.primary }]}>1v1</Text>
          </View>
        </View>
        {renderBody()}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BattlesScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();

  const [myMatches, setMyMatches] = useState<MyMatch[]>([]);
  const [publicMatches, setPublicMatches] = useState<PublicMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [listError, setListError] = useState(false);

  const [modalMatchId, setModalMatchId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setListError(false);
    try {
      const token = await getToken();
      const h = { Authorization: `Bearer ${token ?? ""}` };
      const [mineRes, pubRes] = await Promise.all([
        fetch(`${BASE}/api/battles/matches/me`, { headers: h }),
        fetch(`${BASE}/api/battles/public`, { headers: h }),
      ]);
      if (mineRes.ok) setMyMatches(await mineRes.json() as MyMatch[]);
      if (pubRes.ok) setPublicMatches(await pubRes.json() as PublicMatch[]);
    } catch {
      setListError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, [loadData]);

  async function doMatchmake() {
    if (matchmaking) return;
    setMatchmaking(true);
    try {
      const token = await getToken();
      const r = await fetch(`${BASE}/api/battles/matchmake`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lang: i18n.language }),
      });
      if (!r.ok) throw new Error();
      const view = await r.json() as MatchView;
      setModalMatchId(view.matchId);
      setModalVisible(true);
    } catch {
      Alert.alert(t("battles.errorTitle"), t("battles.matchmakeError"));
    } finally {
      setMatchmaking(false);
    }
  }

  function openMatch(id: string) {
    setModalMatchId(id);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setModalMatchId(null);
    loadData(true);
  }

  function myStatusLabel(m: MyMatch): { label: string; color: string } {
    if (m.status === "completed" || m.result) {
      if (m.result === "win") return { label: t("battles.stWin"), color: colors.teal };
      if (m.result === "loss") return { label: t("battles.stLoss"), color: colors.pink };
      return { label: t("battles.stTie"), color: colors.gold };
    }
    if (m.status === "abandoned") return { label: t("battles.stAbandoned"), color: colors.mutedForeground };
    if (m.status === "waiting") return { label: t("battles.stWaiting"), color: colors.primary };
    if (m.status === "scoring") return { label: t("battles.stScoring"), color: colors.primary };
    // active
    if (m.myEntryStatus === "completed" || m.myEntryStatus === "forfeit") return { label: t("battles.stWaitingResult"), color: colors.primary };
    if (m.myEntryStatus === "matched") return { label: t("battles.stReady"), color: colors.teal };
    return { label: t("battles.stInProgress"), color: colors.gold };
  }

  const bottomPad = Platform.OS === "web" ? 34 : tabBarHeight;

  const header = (
    <LinearGradient
      colors={[colors.primary + "18", colors.palette.transparent]}
      style={[styles.header, { paddingTop: insets.top + colors.spacing.sm }]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("battles.screenTitle")}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{t("battles.pvpSubtitle")}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.matchmakeBtn, { backgroundColor: colors.pink, opacity: matchmaking ? 0.7 : 1 }]}
        onPress={doMatchmake}
        disabled={matchmaking}
      >
        {matchmaking
          ? <ActivityIndicator size="small" color={palette.white} />
          : <Ionicons name="flash" size={16} color={palette.white} />}
        <Text style={styles.matchmakeText}>{matchmaking ? t("battles.matchmaking") : t("battles.findOpponent")}</Text>
      </Pressable>

      <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["mine", "public"] as const).map(tabKey => (
          <Pressable
            key={tabKey}
            style={[styles.tabBtn, tab === tabKey && { backgroundColor: colors.primary }]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[styles.tabBtnText, { color: tab === tabKey ? colors.palette.white : colors.mutedForeground }]}>
              {tabKey === "mine" ? t("battles.tabMine") : t("battles.tabPublic")}
            </Text>
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );

  if (listError && !loading) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <Ionicons name="wifi-outline" size={44} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            {t("common.errorDesc")}
          </Text>
          <Pressable
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => loadData()}
          >
            <Text style={{ color: palette.white, fontSize: 14, fontFamily: "Inter_700Bold" }}>{t("common.retryBtn")}</Text>
          </Pressable>
        </View>
      </AnimatedScreen>
    );
  }

  if (loading) {
    return (
      <AnimatedScreen style={{ backgroundColor: colors.background }}>
        {header}
        <View style={{ flex: 1, padding: colors.spacing.lg, gap: colors.spacing.md }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ borderRadius: 14, padding: 16, gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <SkeletonBox width="40%" height={11} borderRadius={5} />
              <SkeletonBox width="90%" height={16} borderRadius={6} />
              <SkeletonBox width="60%" height={16} borderRadius={6} />
            </View>
          ))}
        </View>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {header}

      {tab === "mine" ? (
        <FlatList
          data={myMatches}
          keyExtractor={(m) => m.matchId}
          contentContainerStyle={{ padding: colors.spacing.lg, paddingBottom: bottomPad + colors.spacing.lg, gap: colors.spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flash-outline" size={48} color={colors.primary} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("battles.noMine")}</Text>
            </View>
          }
          renderItem={({ item: m }) => {
            const meta = CATEGORY_META[m.category] ?? { labelKey: m.category, color: colors.mutedForeground, icon: "help-outline" };
            const st = myStatusLabel(m);
            const isDone = m.status === "completed" || m.status === "abandoned";
            return (
              <PressableScale
                style={[styles.matchCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openMatch(m.matchId)}
                scaleTarget={0.97}
              >
                <View style={styles.matchTop}>
                  <View style={[styles.catBadge, { backgroundColor: (meta.color ?? colors.mutedForeground) + "18", borderColor: (meta.color ?? colors.mutedForeground) + "30" }]}>
                    <Text style={[styles.catLabel, { color: meta.color ?? colors.mutedForeground }]}>{t(meta.labelKey)}</Text>
                  </View>
                  <Text style={[styles.timeAgoText, { color: colors.mutedForeground }]}>{timeAgo(m.createdAt, t)}</Text>
                </View>
                <Text style={[styles.matchTheme, { color: colors.foreground }]} numberOfLines={2}>{m.theme}</Text>
                <View style={styles.matchFoot}>
                  <View style={[styles.statusChip, { backgroundColor: st.color + "1a", borderColor: st.color + "33" }]}>
                    <Text style={[styles.statusChipText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <View style={styles.resumeRow}>
                    <Text style={[styles.resumeText, { color: colors.primary }]}>{isDone ? t("battles.view") : t("battles.resume")}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </View>
              </PressableScale>
            );
          }}
        />
      ) : (
        <FlatList
          data={publicMatches}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: colors.spacing.lg, paddingBottom: bottomPad + colors.spacing.lg, gap: colors.spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={colors.primary} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("battles.noPublic")}</Text>
            </View>
          }
          renderItem={({ item: card }) => {
            const meta = CATEGORY_META[card.category] ?? { labelKey: card.category, color: colors.mutedForeground, icon: "help-outline" };
            const winner = card.player1.isWinner ? card.player1 : card.player2;
            const loser = card.player1.isWinner ? card.player2 : card.player1;
            return (
              <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  <View style={[styles.catBadge, { backgroundColor: (meta.color ?? colors.mutedForeground) + "18", borderColor: (meta.color ?? colors.mutedForeground) + "30" }]}>
                    <Text style={[styles.catLabel, { color: meta.color ?? colors.mutedForeground }]}>{t(meta.labelKey)}</Text>
                  </View>
                  <Text style={[styles.timeAgoText, { color: colors.mutedForeground }]}>{timeAgo(card.createdAt, t)}</Text>
                </View>
                <Text style={[styles.resultQ, { color: colors.foreground }]} numberOfLines={2}>{card.theme}</Text>
                <View style={styles.vsRow}>
                  <View style={[styles.playerCol, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
                    <View style={styles.winnerBadge}>
                      <Ionicons name="trophy" size={12} color={colors.gold} />
                      <Text style={[styles.winnerText, { color: colors.gold }]}>{t("battles.winnerLabel")}</Text>
                    </View>
                    <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{winner.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.primary }]}>{winner.rawScore.toFixed(0)}</Text>
                  </View>
                  <Text style={[styles.vsText, { color: colors.mutedForeground }]}>VS</Text>
                  <View style={[styles.playerCol, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{loser.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.mutedForeground }]}>{loser.rawScore.toFixed(0)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <BattlePvpModal
        visible={modalVisible}
        matchId={modalMatchId}
        onClose={closeModal}
        colors={colors}
        getToken={getToken}
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { marginBottom: 12, flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  matchmakeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, marginBottom: 12 },
  matchmakeText: { color: palette.white, fontSize: 14, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 4, gap: 4 },
  tabBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  // My-battle card
  matchCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  matchTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matchTheme: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  matchFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  resumeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  resumeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  catBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  catLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  timeAgoText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Public result card
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

  // Modal header
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  modalTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold" },
  vsPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  vsPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  centerBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  themeCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 6 },
  themeCat: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1 },
  themeText: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26 },

  stateCard: { alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 24, gap: 10 },
  stateTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  stateDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  matchedRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  matchedText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },

  instrBox: { flexDirection: "row", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  instrText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15 },
  submitBtnText: { color: palette.white, fontSize: 14, fontFamily: "Inter_700Bold" },

  banner: { alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 20, gap: 6 },
  bannerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  bannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  scoreRow: { flexDirection: "row", gap: 10 },
  scoreCol: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center", gap: 2 },
  scoreColLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1 },
  scoreColNum: { fontSize: 34, fontFamily: "Inter_700Bold" },
  scoreColUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  rewardBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, padding: 14 },
  rewardXp: { fontSize: 18, fontFamily: "Inter_700Bold" },
  verdictBox: { borderRadius: 14, borderWidth: 1, padding: 14 },
  verdictTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  verdictText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 21 },

  collapWrap: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  collapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  collapTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },

  primaryAction: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryActionText: { color: palette.white, fontSize: 15, fontFamily: "Inter_700Bold" },

  // Arena
  arenaStrip: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  arenaCat: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1 },
  arenaTheme: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  timerText: { fontSize: 14, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] },
  firstMove: { alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60, paddingHorizontal: 24 },
  firstMoveText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  composer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerInput: { flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sendBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  composerFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  finishBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  finishBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  AppState,
  Alert,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector, Swipeable } from "react-native-gesture-handler";
import { LogoMark } from "@/components/ui/Logo";
import Markdown from "react-native-markdown-display";
import { router } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { fetch } from "expo/fetch";
import {
  useListOpenaiConversations,
  useGetOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
  getGetMyProfileQueryKey,
  getGetSgiHistoryQueryKey,
  useGetMyProfile,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/ui/PressableScale";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const MODELS_ALL = [
  { id: "claude-haiku-4-5",  label: "Haiku",      badgeKey: "chat.modelFast"     },
  { id: "claude-sonnet-4-6", label: "Sonnet",      badgeKey: "chat.modelBalanced" },
  { id: "claude-opus-4-8",   label: "Opus",        badgeKey: "chat.modelCapable"  },
  { id: "gpt-4o-mini",       label: "GPT-4o Mini", badgeKey: "chat.modelFast"     },
] as const;
type ModelId = (typeof MODELS_ALL)[number]["id"];

const ALLOWED_MODELS: Record<string, ModelId[]> = {
  free:    ["claude-haiku-4-5"],
  premium: ["claude-haiku-4-5", "claude-sonnet-4-6", "gpt-4o-mini"],
  pro:     ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8", "gpt-4o-mini"],
};
const PLAN_DEFAULT_MODEL: Record<string, ModelId> = {
  free:    "claude-haiku-4-5",
  premium: "claude-sonnet-4-6",
  pro:     "claude-opus-4-8",
};

type LocalMessage = { id: string; role: "user" | "assistant"; content: string; streaming?: boolean };

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: 380, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 380, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.primary, marginHorizontal: 2.5 }, animStyle]}
    />
  );
}

function TypingIndicator() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", padding: 14, alignSelf: "flex-start", marginBottom: 4 }}>
      <TypingDot delay={0} />
      <TypingDot delay={160} />
      <TypingDot delay={320} />
    </View>
  );
}


export default function ChatScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [convoModal, setConvoModal] = useState(false);
  const [modelModal, setModelModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("claude-haiku-4-5");
  const [sgiDelta, setSgiDelta] = useState<number | null>(null);
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList<LocalMessage>>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const shownShareMilestones = useRef<Set<number>>(new Set());
  const assistantTurnRef = useRef(0);
  const chatShareRef = useRef<View>(null);
  const [progressCardShare, setProgressCardShare] = useState<{
    id: string;
    deltaPct: number;
    isPositive: boolean;
    highlightMetric: string;
    highlightDeltaPct: number;
    insightText: string | null;
  } | null>(null);
  const [chatShareVisible, setChatShareVisible] = useState(false);
  const [chatSharing, setChatSharing] = useState(false);
  const [chatModalReady, setChatModalReady] = useState(false);
  const s = makeStyles(colors, insets);

  // ── Conversation drawer (replaces pageSheet Modal) ──────────────────────────
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.round(screenWidth * 0.82);
  const drawerX = useSharedValue(-drawerWidth);
  const backdropOp = useSharedValue(0);

  const closeDrawer = useCallback(() => {
    setConvoModal(false);
    drawerX.value = withTiming(-drawerWidth, { duration: 280, easing: Easing.in(Easing.cubic) });
    backdropOp.value = withTiming(0, { duration: 280 });
  }, [drawerX, backdropOp, drawerWidth]);

  const openDrawer = useCallback(() => {
    setConvoModal(true);
    drawerX.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    backdropOp.value = withTiming(0.5, { duration: 280 });
  }, [drawerX, backdropOp]);

  const drawerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerX.value }],
  }));
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  const edgeGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX > 0) {
        drawerX.value = Math.min(0, -drawerWidth + e.translationX);
        backdropOp.value = Math.min(0.5, (e.translationX / drawerWidth) * 0.5);
      }
    })
    .onEnd((e) => {
      if (e.translationX > drawerWidth * 0.3 || e.velocityX > 500) {
        drawerX.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
        backdropOp.value = withTiming(0.5, { duration: 240 });
        runOnJS(setConvoModal)(true);
      } else {
        drawerX.value = withTiming(-drawerWidth, { duration: 240, easing: Easing.in(Easing.cubic) });
        backdropOp.value = withTiming(0, { duration: 240 });
      }
    });

  const drawerPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX < 0) {
        drawerX.value = Math.max(-drawerWidth, e.translationX);
        backdropOp.value = Math.max(0, 0.5 * (1 + e.translationX / drawerWidth));
      }
    })
    .onEnd((e) => {
      if (e.translationX < -(drawerWidth * 0.3) || e.velocityX < -500) {
        drawerX.value = withTiming(-drawerWidth, { duration: 240, easing: Easing.in(Easing.cubic) });
        backdropOp.value = withTiming(0, { duration: 240 });
        runOnJS(setConvoModal)(false);
      } else {
        drawerX.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
        backdropOp.value = withTiming(0.5, { duration: 240 });
      }
    });
  // ── End drawer setup ────────────────────────────────────────────────────────

  const { data: profile } = useGetMyProfile();
  const { data: conversations, isLoading: convosLoading } = useListOpenaiConversations();

  // IDs that returned 404 this session — skip them when auto-selecting from the
  // list so a stale persisted cache entry doesn't trigger an infinite 404 loop.
  const invalidatedConvoIds = useRef<Set<number>>(new Set());
  // When true, the auto-select effect must skip re-selection (user explicitly
  // requested a blank new chat via newChat()). Reset to false after one skip.
  const skipAutoSelect = useRef(false);

  const { data: activeConvo, error: activeConvoError } = useGetOpenaiConversation(activeConvoId ?? 0, {
    query: {
      enabled: !!activeConvoId,
      queryKey: getGetOpenaiConversationQueryKey(activeConvoId ?? 0),
      // 404 = conversation genuinely doesn't exist; don't waste a retry.
      retry: (_count, err) => (err as { status?: number } | null)?.status !== 404,
    },
  });
  const deleteConvo = useDeleteOpenaiConversation();

  // When the currently active conversation is not found (stale persisted cache
  // from a previous session or deleted by the user), purge it and fall back to
  // the next valid conversation in the list.
  useEffect(() => {
    const status = (activeConvoError as { status?: number } | null)?.status;
    if (status === 404 && activeConvoId) {
      invalidatedConvoIds.current.add(activeConvoId);
      qc.removeQueries({ queryKey: getGetOpenaiConversationQueryKey(activeConvoId) });
      setActiveConvoId(null);
    }
  }, [activeConvoError, activeConvoId, qc]);

  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConvoId) {
      if (skipAutoSelect.current) {
        // User explicitly requested a new chat — don't re-select the previous
        // conversation. Consume the flag so future null transitions (404 recovery,
        // first load) still trigger auto-selection normally.
        skipAutoSelect.current = false;
        return;
      }
      const valid = conversations.find(c => !invalidatedConvoIds.current.has(c.id));
      if (valid) setActiveConvoId(valid.id);
    }
  }, [conversations, activeConvoId]);

  useEffect(() => {
    if (!activeConvo) return;
    const mapped: LocalMessage[] = activeConvo.messages.map(m => ({
      id: String(m.id),
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    setMessages([...mapped].reverse());
    // Initialize the assistant-turn counter from already-existing DB messages
    // so milestones count from the total conversation history, not just this session.
    assistantTurnRef.current = activeConvo.messages.filter(m => m.role === "assistant").length;
  }, [activeConvo?.id, activeConvo?.messages.length]);

  useEffect(() => {
    if (!profile?.plan) return;
    if (activeConvoId !== null) return;
    const d = (PLAN_DEFAULT_MODEL[profile.plan] ?? "claude-haiku-4-5") as ModelId;
    setSelectedModel(d);
  }, [profile?.plan, activeConvoId]);

  // AppState listener: on foreground return, safety-reset local streaming state
  // and invalidate conversation query so any server-completed reply (text + SGI score)
  // replaces the partial local buffer. Do NOT cancel the reader on background —
  // that also kills the TCP connection, aborting AI generation and SGI scoring.
  useEffect(() => {
    const sub = AppState.addEventListener("change", nextState => {
      if (nextState === "background" || nextState === "inactive") {
        // Do NOT cancel the reader — cancelling also kills the server-side
        // connection, which aborts AI generation mid-stream and skips SGI scoring.
        // Let the server finish; we recover the complete response on foreground return.
      }
      if (nextState === "active") {
        setIsStreaming(false);
        setShowTyping(false);
        if (activeConvoId) {
          qc.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(activeConvoId) });
        }
        qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        qc.invalidateQueries({ queryKey: ["threads"] });
      }
    });
    return () => sub.remove();
  }, [activeConvoId, qc]);

  const createConversation = useCallback(async (firstMsg: string): Promise<number | null> => {
    const token = await getToken();
    const r = await fetch(`${BASE}/api/openai/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title: firstMsg.slice(0, 50) }),
    });
    if (!r.ok) return null;
    const data = await r.json() as { id: number };
    qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    return data.id;
  }, [getToken, qc]);

  const sendMessage = useCallback(async (contentOverride?: string) => {
    const content = (contentOverride ?? input).trim();
    if (!content || isStreaming) return;
    Keyboard.dismiss();
    setInput("");
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: LocalMessage = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      role: "user",
      content,
    };
    setMessages(prev => [userMsg, ...prev]);

    let convoId = activeConvoId;
    if (!convoId) {
      convoId = await createConversation(content);
      if (!convoId) {
        setErrorMsg(t("chat.failedCreate"));
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }
      setActiveConvoId(convoId);
    }

    setShowTyping(true);
    setIsStreaming(true);

    const token = await getToken();
    let assistantId: string | null = null;
    let fullContent = "";

    // Timeout only guards the initial connection (response headers).
    // Once streaming begins we cancel it so background/foreground transitions
    // cannot accidentally fire it mid-stream.
    const abortController = new AbortController();
    const connectionTimeoutId = setTimeout(() => abortController.abort(), 45_000);

    try {
      const resp = await fetch(`${BASE}/api/openai/conversations/${convoId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content, model: selectedModel }),
        signal: abortController.signal,
      });
      // Server responded — clear the connection timeout so streaming is unaffected.
      clearTimeout(connectionTimeoutId);

      if (resp.status === 429) {
        const data = await resp.json() as { used?: number; limit?: number; plan?: string };
        setUsageRemaining(0);
        setErrorMsg(t("chat.limitMsg", { used: data.used ?? "?", limit: data.limit ?? "?" }));
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }

      if (!resp.ok || !resp.body) {
        setErrorMsg(t("chat.serverError"));
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }

      const reader = resp.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as {
              content?: string;
              done?: boolean;
              sgiDelta?: number;
              title?: string;
              usage?: { remaining: number };
              streamError?: boolean;
              message?: string;
              progressCard?: {
                id: string;
                deltaPct: number;
                isPositive: boolean;
                highlightMetric: string;
                highlightDeltaPct: number;
              };
            };
            if (parsed.content) {
              fullContent += parsed.content;
              if (!assistantId) {
                setShowTyping(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                assistantId = Date.now().toString() + Math.random().toString(36).slice(2);
                setMessages(prev => [
                  { id: assistantId!, role: "assistant", content: fullContent, streaming: true },
                  ...prev,
                ]);
              } else {
                const captured = fullContent;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: captured } : m)
                );
              }
            }
            if (parsed.done) {
              if (parsed.sgiDelta && parsed.sgiDelta > 0) {
                setSgiDelta(parsed.sgiDelta);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => setSgiDelta(null), 3500);
              }
              if (parsed.usage) setUsageRemaining(parsed.usage.remaining);
              if (assistantId) {
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m)
                );
              }
              qc.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convoId!) });
              qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
              qc.invalidateQueries({ queryKey: getGetSgiHistoryQueryKey() });
              // Milestone share trigger: fires only when the server sends a positive
              // progressCard AND the assistant-turn count hits a multiple of 5.
              // assistantTurnRef is initialized from the DB history on conversation load
              // so this counts across the full conversation, not just the current session.
              if (parsed.progressCard?.isPositive) {
                assistantTurnRef.current += 1;
                const turn = assistantTurnRef.current;
                if (turn % 5 === 0 && !shownShareMilestones.current.has(turn)) {
                  shownShareMilestones.current.add(turn);
                  setProgressCardShare(parsed.progressCard);
                  setChatShareVisible(true);
                }
              } else {
                assistantTurnRef.current += 1;
              }
            }
            if (parsed.streamError) {
              setErrorMsg(parsed.message ?? t("chat.serverError"));
            }
          } catch {}
        }
      }
    } catch (err) {
      const isTimeout = (err as Error)?.name === "AbortError";
      setErrorMsg(isTimeout ? t("chat.connWeak") : t("chat.connLost"));
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      if (isTimeout) setRetryContent(content);
    } finally {
      clearTimeout(connectionTimeoutId);
      readerRef.current = null;
      setIsStreaming(false);
      setShowTyping(false);
      inputRef.current?.focus();
    }
  }, [input, isStreaming, activeConvoId, selectedModel, getToken, qc, createConversation]);

  const newChat = useCallback(() => {
    skipAutoSelect.current = true;
    setActiveConvoId(null);
    setMessages([]);
    closeDrawer();
    setSgiDelta(null);
    setErrorMsg(null);
    setRetryContent(null);
    shownShareMilestones.current = new Set();
    assistantTurnRef.current = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [closeDrawer]);

  const handleRetry = useCallback(() => {
    if (!retryContent) return;
    const content = retryContent;
    setErrorMsg(null);
    setRetryContent(null);
    setInput("");
    sendMessage(content);
  }, [retryContent, sendMessage]);

  const selectConvo = useCallback((id: number) => {
    setActiveConvoId(id);
    setMessages([]);
    closeDrawer();
    shownShareMilestones.current = new Set();
    assistantTurnRef.current = 0;
    Haptics.selectionAsync();
  }, [closeDrawer]);

  const handleShareChat = useCallback(async () => {
    if (!chatShareRef.current) return;
    setChatSharing(true);
    try {
      const uri = await captureRef(chatShareRef, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {
      Alert.alert(t("share.captureError"), "");
    } finally {
      setChatSharing(false);
      setChatShareVisible(false);
      setChatModalReady(false);
    }
  }, [t]);

  const currentModel = MODELS_ALL.find(m => m.id === selectedModel) ?? MODELS_ALL[0];

  return (
    <View style={s.root}>
      <LinearGradient colors={[palette.bg, palette.bg]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <PressableScale
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDrawer(); }}
          style={s.headerBtn}
          haptic={false}
        >
          <Ionicons name="list" size={22} color={colors.foreground} />
        </PressableScale>
        <Text style={s.headerTitle}>{t("nav.chat")}</Text>
        <PressableScale
          onPress={() => { if (!activeConvoId) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setModelModal(true); } }}
          style={[s.modelBadge, activeConvoId ? { opacity: 0.75 } : undefined]}
          haptic={false}
        >
          <Ionicons name={activeConvoId ? "lock-closed" : "flash"} size={12} color={colors.teal} />
          <Text style={s.modelBadgeText}>{currentModel.label}</Text>
        </PressableScale>
      </View>

      {sgiDelta !== null && (
        <View style={s.sgiToast}>
          <Ionicons name="trending-up" size={14} color={colors.teal} />
          <Text style={s.sgiToastText}>SGI +{sgiDelta.toFixed(2)} pts</Text>
          <Pressable
            onPress={async () => {
              try {
                const token = await getToken();
                const r = await fetch(`${BASE}/api/threads`, {
                  headers: { Authorization: `Bearer ${token ?? ""}` },
                });
                if (r.ok) {
                  const list = await r.json() as Array<{ id: string }>;
                  if (list[0]) router.push(`/thread/${list[0].id}` as any);
                }
              } catch {}
            }}
            style={{ marginLeft: 6 }}
          >
            <Text style={s.sgiToastLink}>{t("thread.viewThread")}</Text>
          </Pressable>
        </View>
      )}

      {usageRemaining !== null && (
        <View style={s.usageBadge}>
          <Text style={s.usageText}>{t("chat.msgLeft", { n: usageRemaining })}</Text>
        </View>
      )}

      {(() => {
        const plan = profile?.plan ?? "free";
        const allowed = ALLOWED_MODELS[plan] ?? (["claude-haiku-4-5"] as ModelId[]);
        if (allowed.includes(selectedModel)) return null;
        const planModelLabel = (MODELS_ALL.find(m => m.id === PLAN_DEFAULT_MODEL[plan]) ?? MODELS_ALL[0]).label;
        return (
          <View style={s.outOfPlanBanner}>
            <Ionicons name="warning" size={13} color={colors.gold} />
            <Text style={s.outOfPlanText} numberOfLines={2}>
              {t("chat.modelOutOfPlan", { model: currentModel.label, plan, planModel: planModelLabel })}
            </Text>
          </View>
        );
      })()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          inverted={messages.length > 0}
          contentContainerStyle={s.listContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={messages.length > 0}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          initialNumToRender={10}
          windowSize={8}
          onContentSizeChange={() => {
            if (isStreaming) {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            }
          }}
          ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>{t("chat.startTitle")}</Text>
              <Text style={s.emptyHint}>{t("chat.startHint")}</Text>
            </View>
          }
          renderItem={({ item }) => <MessageBubble msg={item} colors={colors} />}
        />

        {errorMsg && (
          <View style={s.errorBar}>
            <Ionicons name="alert-circle" size={14} color={colors.destructive} />
            <Text style={s.errorText} numberOfLines={2}>{errorMsg}</Text>
            {retryContent ? (
              <PressableScale
                onPress={handleRetry}
                haptic={false}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={s.retryBtn}>{t("chat.retryLastMsg")}</Text>
              </PressableScale>
            ) : (
              <PressableScale
                onPress={() => setErrorMsg(null)}
                haptic={false}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </PressableScale>
            )}
          </View>
        )}

        <View style={[s.inputBar, { paddingBottom: (Platform.OS === "web" ? Math.max(insets.bottom, 34) : tabBarHeight) + 8 }]}>
          <TextInput
            ref={inputRef}
            style={s.textInput}
            placeholder={t("chat.inputPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
            blurOnSubmit={false}
            returnKeyType="default"
          />
          <SendButton
            onPress={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            streaming={isStreaming}
            colors={colors}
            style={s.sendBtn}
          />
        </View>
      </KeyboardAvoidingView>

      {/* convo drawer — mounted below, always in tree */}

      <Modal visible={modelModal} animationType="fade" transparent onRequestClose={() => setModelModal(false)}>
        <Pressable style={s.overlay} onPress={() => setModelModal(false)}>
          <View style={[s.modelSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.modelSheetTitle}>{t("chat.modelTitle")}</Text>
            {MODELS_ALL.filter(m => (ALLOWED_MODELS[profile?.plan ?? "free"] ?? (["claude-haiku-4-5"] as ModelId[])).includes(m.id)).map(m => (
              <PressableScale
                key={m.id}
                style={[s.modelRow, m.id === selectedModel && s.modelRowActive]}
                onPress={() => { setSelectedModel(m.id); setModelModal(false); }}
              >
                <View>
                  <Text style={s.modelRowLabel}>{m.label}</Text>
                  <Text style={s.modelRowBadge}>{t(m.badgeKey)}</Text>
                </View>
                {m.id === selectedModel && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </PressableScale>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Off-screen capture target for chat share ──────────────────────────
           Rendered OUTSIDE the Modal so react-native-view-shot resolves the
           correct native layer (transparent-Modal nesting confuses the layer
           resolver in Expo Go when multiple Modals exist in the same component).
           collapsable={false} required on Android for view-shot to work.       */}
      {progressCardShare && (
        <View
          ref={chatShareRef}
          collapsable={false}
          style={{
            position: "absolute",
            top: -9999,
            left: 0,
            width: 320,
            backgroundColor: colors.background,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="trending-up" size={14} color={colors.teal} />
            <Text style={{ color: colors.teal, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase" }}>
              SGI Progress
            </Text>
          </View>
          {activeConvo?.title ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
              {activeConvo.title}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={{ fontSize: 36, fontFamily: "Inter_700Bold", color: colors.teal }}>
              +{progressCardShare.deltaPct.toFixed(1)}%
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              {t("progressCard.growth")}
            </Text>
          </View>
          <View style={{
            backgroundColor: colors.teal + "12", borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: colors.teal + "30",
          }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
              {progressCardShare.highlightMetric}
            </Text>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.teal }}>
              +{progressCardShare.highlightDeltaPct.toFixed(1)}%
            </Text>
          </View>
          {progressCardShare.insightText ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 18 }}>
              {progressCardShare.insightText}
            </Text>
          ) : null}
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "right" }}>
            sgindex.work
          </Text>
        </View>
      )}

      {/* ── Drawer backdrop — always mounted, opacity animated ────────────────── */}
      <Animated.View
        pointerEvents={convoModal ? "auto" : "none"}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000" }, backdropAnimStyle]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeDrawer} />
      </Animated.View>

      {/* ── Conversation drawer — always mounted, translateX animated ─────────── */}
      <GestureDetector gesture={drawerPanGesture}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: drawerWidth,
              backgroundColor: colors.background,
              shadowColor: "#000",
              shadowOffset: { width: 4, height: 0 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
              elevation: 20,
            },
            drawerAnimStyle,
          ]}
        >
          <ChatDrawer
            conversations={conversations ?? []}
            loading={convosLoading}
            activeId={activeConvoId}
            onSelect={selectConvo}
            onNew={newChat}
            onDelete={async (id) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              try {
                await deleteConvo.mutateAsync({ id });
              } catch (err) {
                const status = (err as { status?: number } | null)?.status;
                if (status !== 404) throw err;
                invalidatedConvoIds.current.add(id);
                qc.removeQueries({ queryKey: getGetOpenaiConversationQueryKey(id) });
              }
              if (id === activeConvoId) newChat();
            }}
            onClose={closeDrawer}
            colors={colors}
            profile={profile}
          />
        </Animated.View>
      </GestureDetector>

      {/* ── Left-edge swipe zone (30px) to open drawer when closed ───────────── */}
      {!convoModal && (
        <GestureDetector gesture={edgeGesture}>
          <View style={{ position: "absolute", left: 0, top: 0, bottom: tabBarHeight, width: 30 }} />
        </GestureDetector>
      )}

      {/* ── Chat milestone share popup (visual UI only — no captureRef here) ── */}
      <Modal visible={chatShareVisible} transparent animationType="slide" onShow={() => setChatModalReady(true)} onRequestClose={() => { setChatShareVisible(false); setChatModalReady(false); }}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{
            backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
            padding: 20, gap: 14, paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}>
            <View style={{ alignItems: "flex-end" }}>
              <Pressable onPress={() => { setChatShareVisible(false); setChatModalReady(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {/* Visual preview of card — NOT the captureRef target */}
            <View style={{
              backgroundColor: colors.background, borderRadius: 16, padding: 20,
              borderWidth: 1, borderColor: colors.border, gap: 12,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="trending-up" size={14} color={colors.teal} />
                <Text style={{ color: colors.teal, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  SGI Progress
                </Text>
              </View>
              {activeConvo?.title ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                  {activeConvo.title}
                </Text>
              ) : null}
              {progressCardShare ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                    <Text style={{ fontSize: 36, fontFamily: "Inter_700Bold", color: colors.teal }}>
                      +{progressCardShare.deltaPct.toFixed(1)}%
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                      {t("progressCard.growth")}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: colors.teal + "12", borderRadius: 10, padding: 12,
                    borderWidth: 1, borderColor: colors.teal + "30",
                  }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                      {progressCardShare.highlightMetric}
                    </Text>
                    <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.teal }}>
                      +{progressCardShare.highlightDeltaPct.toFixed(1)}%
                    </Text>
                  </View>
                  {progressCardShare.insightText ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 18 }}>
                      {progressCardShare.insightText}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 }}>
                  SGI Progress
                </Text>
              )}
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "right" }}>
                sgindex.work
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [{
                backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
                alignItems: "center", opacity: pressed || chatSharing || !chatModalReady ? 0.7 : 1,
              }]}
              onPress={handleShareChat}
              disabled={chatSharing || !chatModalReady}
            >
              {chatSharing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>{t("share.shareResult")}</Text>}
            </Pressable>
            <Pressable
              style={({ pressed }) => [{ alignItems: "center", paddingVertical: 10, opacity: pressed ? 0.6 : 1 }]}
              onPress={() => { setChatShareVisible(false); setChatModalReady(false); }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{t("share.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SendButton({
  onPress,
  disabled,
  streaming,
  colors,
  style,
}: {
  onPress: () => void;
  disabled: boolean;
  streaming: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  style: object;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(disabled ? 0.45 : 1);

  useEffect(() => {
    opacity.value = withTiming(disabled ? 0.45 : 1, { duration: 150 });
  }, [disabled]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(0.85, { damping: 18, stiffness: 350 });
  }, [disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.8 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[style, animStyle]}>
        {streaming ? (
          <ActivityIndicator size="small" color={palette.white} />
        ) : (
          <Ionicons name="arrow-up" size={20} color={palette.white} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const MessageBubble = React.memo(function MessageBubble({
  msg,
  colors,
}: {
  msg: LocalMessage;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const isUser = msg.role === "user";
  const c = colors;

  const logoOpacity = useSharedValue(0.4);
  const logoAnimStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  useEffect(() => {
    if (!isUser) {
      logoOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.4, { duration: 600 }),
        ),
        -1,
        false,
      );
    }
  }, [isUser]);

  const markdownStyles = {
    body: {
      color: c.foreground,
      fontSize: c.font.size.base,
      fontFamily: c.font.family.regular,
      lineHeight: 23,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 6,
      color: c.foreground,
      fontSize: c.font.size.base,
      fontFamily: c.font.family.regular,
      lineHeight: 23,
    },
    strong: {
      fontFamily: c.font.family.semibold as never,
      color: c.foreground,
      fontWeight: "600" as const,
    },
    em: {
      fontStyle: "italic" as const,
      color: c.palette.textPrimary,
    },
    heading1: {
      fontSize: c.font.size.lg,
      fontFamily: c.font.family.heading,
      color: c.foreground,
      marginBottom: c.spacing.sm,
      marginTop: c.spacing.md,
    },
    heading2: {
      fontSize: c.font.size.md,
      fontFamily: c.font.family.heading,
      color: c.foreground,
      marginBottom: c.spacing.sm,
      marginTop: c.spacing.sm,
    },
    heading3: {
      fontSize: c.font.size.base,
      fontFamily: c.font.family.semibold as never,
      color: c.foreground,
      marginBottom: c.spacing.xs,
      marginTop: c.spacing.sm,
    },
    code_inline: {
      backgroundColor: c.primary + "2e",
      color: c.primaryLight,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: c.font.size.sm,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: c.radii.xs,
    },
    fence: {
      backgroundColor: c.background,
      borderRadius: c.radii.md,
      padding: c.spacing.md,
      marginVertical: c.spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    code_block: {
      backgroundColor: c.background,
      borderRadius: c.radii.md,
      padding: c.spacing.md,
      marginVertical: c.spacing.sm,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: c.font.size.sm,
      color: c.primaryLight,
    },
    bullet_list: { marginVertical: c.spacing.xs },
    ordered_list: { marginVertical: c.spacing.xs },
    list_item: { marginVertical: 2, flexDirection: "row" as const },
    bullet_list_icon: {
      color: c.primary,
      fontSize: c.font.size.base,
      marginRight: c.spacing.sm,
      marginTop: 1,
    },
    ordered_list_icon: {
      color: c.primary,
      fontSize: c.font.size.base,
      fontFamily: c.font.family.semibold as never,
      marginRight: c.spacing.sm,
    },
    blockquote: {
      backgroundColor: c.primary + "14",
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
      paddingLeft: c.spacing.md,
      paddingVertical: c.spacing.sm,
      borderRadius: c.radii.xs,
      marginVertical: c.spacing.sm,
    },
    hr: {
      backgroundColor: c.border,
      height: 1,
      marginVertical: c.spacing.md,
    },
    link: {
      color: c.primary,
      textDecorationLine: "underline" as const,
    },
    table: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: c.radii.sm,
      marginVertical: c.spacing.sm,
    },
    th: {
      backgroundColor: c.primary + "1f",
      padding: c.spacing.sm,
      color: c.primaryLight,
      fontFamily: c.font.family.semibold as never,
      fontSize: c.font.size.sm,
    },
    td: {
      padding: c.spacing.sm,
      color: c.foreground,
      fontSize: c.font.size.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
  };

  return (
    <Animated.View
      entering={isUser ? undefined : FadeIn.duration(180)}
      style={[bubbleStyles.row, isUser ? bubbleStyles.rowUser : bubbleStyles.rowAssistant]}
    >
      {!isUser && (
        <View style={[bubbleStyles.avatar, { backgroundColor: c.primary + "22", borderColor: c.primary + "33" }]}>
          <Animated.View style={logoAnimStyle}>
            <LogoMark size={16} />
          </Animated.View>
        </View>
      )}
      <View
        style={[
          bubbleStyles.bubble,
          isUser
            ? { backgroundColor: c.primary, borderBottomRightRadius: c.radii.xs }
            : { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderBottomLeftRadius: c.radii.xs },
        ]}
      >
        {isUser ? (
          <Text style={[bubbleStyles.userText, { color: c.palette.white }]}>{msg.content}</Text>
        ) : msg.streaming ? (
          <>
            <Text style={[bubbleStyles.streamingText, { color: c.foreground }]}>{msg.content}</Text>
            <Text style={[bubbleStyles.cursor, { color: c.primary }]}>▎</Text>
          </>
        ) : (
          <Markdown style={markdownStyles as never}>
            {msg.content || ""}
          </Markdown>
        )}
      </View>
    </Animated.View>
  );
});

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 12, alignItems: "flex-end" },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  streamingText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 23 },
  cursor: { fontSize: 16 },
});

function ChatDrawer({
  conversations,
  loading,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  colors,
  profile,
}: {
  conversations: { id: number; title: string; createdAt: string }[];
  loading: boolean;
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  profile?: { plan?: string | null } | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const plan = (profile?.plan ?? "free") as string;
  const planLabel = ({ free: "Free", premium: "Premium", pro: "Pro" } as Record<string, string>)[plan] ?? "Free";
  const planColor = plan === "pro" ? colors.teal : plan === "premium" ? colors.gold : colors.mutedForeground;
  const initial = plan[0]?.toUpperCase() ?? "F";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header: logo + close */}
      <View style={{
        paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 12,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LogoMark size={28} />
            <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 }}>
              SGI
            </Text>
          </View>
          <PressableScale onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} haptic={false}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </PressableScale>
        </View>
        {/* Section label */}
        <Text style={{
          fontSize: 10,
          fontFamily: "Inter_600SemiBold",
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 1.4,
        }}>
          {t("chat.recent")}
        </Text>
      </View>

      {/* Conversation list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>{t("chat.noConversations")}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ paddingVertical: 8 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          renderItem={({ item }) => (
            <ConvoRow
              item={item}
              isActive={item.id === activeId}
              onSelect={onSelect}
              onDelete={onDelete}
              colors={colors}
            />
          )}
        />
      )}

      {/* Footer — always visible */}
      <View style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        padding: 16,
        paddingBottom: Math.max(insets.bottom, 16),
        gap: 12,
      }}>
        {/* New chat — solid primary, high visual weight */}
        <PressableScale
          onPress={onNew}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.primary,
            paddingVertical: 13,
            borderRadius: 12,
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{t("chat.new")}</Text>
        </PressableScale>

        {/* User info row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.primary + "20",
            borderWidth: 1, borderColor: colors.primary + "33",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              {initial}
            </Text>
          </View>
          <Text style={{ color: planColor, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            {planLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ConvoRow({
  item,
  isActive,
  onSelect,
  onDelete,
  colors,
}: {
  item: { id: number; title: string; createdAt: string };
  isActive: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const renderRightActions = useCallback(() => (
    <View style={{ width: 70, justifyContent: "center", alignItems: "stretch" }}>
      <Pressable
        onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onDelete(item.id); }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.destructive + "22" }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
      </Pressable>
    </View>
  ), [item.id, onDelete, colors.destructive]);

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); onSelect(item.id); }}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 350 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
      >
        <Animated.View
          style={[
            animStyle,
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border + "44",
              backgroundColor: isActive ? colors.primary + "10" : colors.background,
            },
          ]}
        >
          <Ionicons
            name="chatbubble-outline"
            size={16}
            color={isActive ? colors.primary : colors.mutedForeground}
            style={{ marginRight: 12 }}
          />
          <Text
            style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </Animated.View>
      </Pressable>
    </Swipeable>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    headerBtn: { padding: 8 },
    headerTitle: {
      flex: 1,
      color: colors.foreground,
      fontSize: 17,
      fontFamily: "Inter_600SemiBold",
    },
    modelBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.teal + "18",
      borderWidth: 1,
      borderColor: colors.teal + "33",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    modelBadgeText: {
      color: colors.teal,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
    },
    sgiToast: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: 6,
      backgroundColor: colors.teal + "20",
      borderWidth: 1,
      borderColor: colors.teal + "40",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      marginTop: 8,
    },
    sgiToastText: { color: colors.teal, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    sgiToastLink: { color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    usageBadge: {
      alignSelf: "center",
      marginTop: 4,
    },
    usageText: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" },
    listContent: { paddingVertical: 16, flexGrow: 1 },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 80,
    },
    emptyTitle: {
      color: colors.foreground,
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
    },
    emptyHint: {
      color: colors.mutedForeground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      paddingHorizontal: 32,
    },
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.destructive + "18",
      borderTopWidth: 1,
      borderTopColor: colors.destructive + "33",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    errorText: {
      flex: 1,
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    retryBtn: {
      color: colors.primary,
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 56,
      maxHeight: 150,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modelSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 20,
      gap: 10,
    },
    modelSheetTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 8,
    },
    modelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.muted,
    },
    modelRowActive: { backgroundColor: colors.primary + "20", borderWidth: 1, borderColor: colors.primary + "40" },
    modelRowLabel: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 },
    modelRowBadge: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    outOfPlanBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: colors.gold + "14",
      borderWidth: 1,
      borderColor: colors.gold + "33",
      marginHorizontal: 16,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    outOfPlanText: {
      flex: 1,
      color: colors.gold,
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      lineHeight: 16,
    },
  });
}

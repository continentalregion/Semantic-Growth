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
} from "react-native";
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
} from "react-native-reanimated";
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
  const s = makeStyles(colors, insets);

  const { data: profile } = useGetMyProfile();
  const { data: conversations, isLoading: convosLoading } = useListOpenaiConversations();
  const { data: activeConvo } = useGetOpenaiConversation(activeConvoId ?? 0, {
    query: {
      enabled: !!activeConvoId,
      queryKey: getGetOpenaiConversationQueryKey(activeConvoId ?? 0),
    },
  });
  const deleteConvo = useDeleteOpenaiConversation();

  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConvoId) {
      setActiveConvoId(conversations[0].id);
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
              qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
              qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
              qc.invalidateQueries({ queryKey: getGetSgiHistoryQueryKey() });
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
    setActiveConvoId(null);
    setMessages([]);
    setConvoModal(false);
    setSgiDelta(null);
    setErrorMsg(null);
    setRetryContent(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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
    setConvoModal(false);
    Haptics.selectionAsync();
  }, []);

  const currentModel = MODELS_ALL.find(m => m.id === selectedModel) ?? MODELS_ALL[0];

  return (
    <View style={s.root}>
      <LinearGradient colors={[palette.bg, palette.bg]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <PressableScale
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setConvoModal(true); }}
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

      <Modal visible={convoModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConvoModal(false)}>
        <ConvoModal
          conversations={conversations ?? []}
          loading={convosLoading}
          activeId={activeConvoId}
          onSelect={selectConvo}
          onNew={newChat}
          onDelete={async (id) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteConvo.mutateAsync({ id });
            if (id === activeConvoId) newChat();
          }}
          onClose={() => setConvoModal(false)}
          colors={colors}
        />
      </Modal>

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
      color: c.palette.white,
      fontWeight: "600" as const,
    },
    em: {
      fontStyle: "italic" as const,
      color: c.palette.textPrimary,
    },
    heading1: {
      fontSize: c.font.size.lg,
      fontFamily: c.font.family.heading,
      color: c.palette.white,
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
          <Ionicons name="sparkles" size={14} color={c.primary} />
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

function ConvoModal({
  conversations,
  loading,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  colors,
}: {
  conversations: { id: number; title: string; createdAt: string }[];
  loading: boolean;
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_600SemiBold" }}>
          {t("chat.conversations")}
        </Text>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <PressableScale
            onPress={onNew}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>{t("chat.new")}</Text>
          </PressableScale>
          <PressableScale onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} haptic={false}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </PressableScale>
        </View>
      </View>
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

  return (
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
          },
          isActive && { backgroundColor: colors.primary + "10" },
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
        <PressableScale
          onPress={() => onDelete(item.id)}
          haptic={false}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.destructive + "88"} />
        </PressableScale>
      </Animated.View>
    </Pressable>
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
      paddingVertical: 10,
      maxHeight: 120,
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

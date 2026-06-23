import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
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
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku", badge: "Veloce" },
  { id: "claude-sonnet-4-6", label: "Sonnet", badge: "Bilanciato" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", badge: "Veloce" },
] as const;
type ModelId = (typeof MODELS)[number]["id"];

type LocalMessage = { id: string; role: "user" | "assistant"; content: string; streaming?: boolean };

function TypingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation;
    const t = setTimeout(() => {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.9, duration: 380, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 380, useNativeDriver: true }),
        ])
      );
      anim.start();
    }, delay);
    return () => { clearTimeout(t); anim?.stop(); };
  }, [delay, opacity]);
  return (
    <Animated.View
      style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#7c6bff", opacity, marginHorizontal: 2.5 }}
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

function PressableScale({
  onPress,
  style,
  children,
  disabled = false,
  haptic = true,
  hitSlop,
}: {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
  disabled?: boolean;
  haptic?: boolean;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 60, bounciness: 2 }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 10 }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    if (haptic && !disabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [haptic, disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function ChatScreen() {
  const colors = useColors();
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
  const inputRef = useRef<TextInput>(null);
  const s = makeStyles(colors, insets);

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
    setMessages(mapped);
  }, [activeConvo?.id, activeConvo?.messages.length]);

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

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput("");
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
        setErrorMsg("Impossibile creare la conversazione.");
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

    try {
      const resp = await fetch(`${BASE}/api/openai/conversations/${convoId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content, model: selectedModel }),
      });

      if (resp.status === 429) {
        const data = await resp.json() as { used?: number; limit?: number; plan?: string };
        setUsageRemaining(0);
        setErrorMsg(`Limite messaggi raggiunto (${data.used ?? "?"}/${data.limit ?? "?"}). Aggiorna il piano.`);
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }

      if (!resp.ok || !resp.body) {
        setErrorMsg("Errore del server. Riprova.");
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }

      const reader = resp.body.getReader();
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
              chunk?: string;
              done?: boolean;
              sgiDelta?: number;
              title?: string;
              usage?: { remaining: number };
              streamError?: boolean;
              message?: string;
            };
            if (parsed.chunk) {
              fullContent += parsed.chunk;
              setShowTyping(false);
              if (!assistantId) {
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
            }
            if (parsed.streamError) {
              setErrorMsg(parsed.message ?? "Errore streaming");
            }
          } catch {}
        }
      }
    } catch {
      setErrorMsg("Connessione persa. Riprova.");
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const selectConvo = useCallback((id: number) => {
    setActiveConvoId(id);
    setMessages([]);
    setConvoModal(false);
    Haptics.selectionAsync();
  }, []);

  const currentModel = MODELS.find(m => m.id === selectedModel) ?? MODELS[0];

  return (
    <View style={s.root}>
      <LinearGradient colors={["#08090f", "#08090f"]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <PressableScale
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setConvoModal(true); }}
          style={s.headerBtn}
          haptic={false}
        >
          <Ionicons name="list" size={22} color={colors.foreground} />
        </PressableScale>
        <Text style={s.headerTitle}>SGI Chat</Text>
        <PressableScale
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setModelModal(true); }}
          style={s.modelBadge}
          haptic={false}
        >
          <Ionicons name="flash" size={12} color={colors.teal} />
          <Text style={s.modelBadgeText}>{currentModel.label}</Text>
        </PressableScale>
      </View>

      {sgiDelta !== null && (
        <View style={s.sgiToast}>
          <Ionicons name="trending-up" size={14} color={colors.teal} />
          <Text style={s.sgiToastText}>SGI +{sgiDelta.toFixed(2)} pts</Text>
        </View>
      )}

      {usageRemaining !== null && (
        <View style={s.usageBadge}>
          <Text style={s.usageText}>{usageRemaining} msg rimasti</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
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
          ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>Inizia a chattare</Text>
              <Text style={s.emptyHint}>Il tuo punteggio SGI cresce ad ogni conversazione</Text>
            </View>
          }
          renderItem={({ item }) => <MessageBubble msg={item} colors={colors} />}
        />

        {errorMsg && (
          <View style={s.errorBar}>
            <Ionicons name="alert-circle" size={14} color={colors.destructive} />
            <Text style={s.errorText} numberOfLines={2}>{errorMsg}</Text>
            <PressableScale
              onPress={() => setErrorMsg(null)}
              haptic={false}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </PressableScale>
          </View>
        )}

        <View style={[s.inputBar, { paddingBottom: (Platform.OS === "web" ? Math.max(insets.bottom, 34) : tabBarHeight) + 8 }]}>
          <TextInput
            ref={inputRef}
            style={s.textInput}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
            blurOnSubmit={false}
            returnKeyType="default"
          />
          <SendButton
            onPress={sendMessage}
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
            <Text style={s.modelSheetTitle}>Modello AI</Text>
            {MODELS.map(m => (
              <PressableScale
                key={m.id}
                style={[s.modelRow, m.id === selectedModel && s.modelRowActive]}
                onPress={() => { setSelectedModel(m.id); setModelModal(false); }}
              >
                <View>
                  <Text style={s.modelRowLabel}>{m.label}</Text>
                  <Text style={s.modelRowBadge}>{m.badge}</Text>
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
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(disabled ? 0.45 : 1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: disabled ? 0.45 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [disabled, opacity]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 60, bounciness: 2 }).start();
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 12 }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {streaming ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="arrow-up" size={20} color="#fff" />
        )}
      </Animated.View>
    </Pressable>
  );
}

function MessageBubble({
  msg,
  colors,
}: {
  msg: LocalMessage;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const isUser = msg.role === "user";
  return (
    <View style={[bubbleStyles.row, isUser ? bubbleStyles.rowUser : bubbleStyles.rowAssistant]}>
      {!isUser && (
        <View style={[bubbleStyles.avatar, { backgroundColor: "#7c6bff22", borderColor: "#7c6bff33" }]}>
          <Ionicons name="sparkles" size={14} color="#7c6bff" />
        </View>
      )}
      <View
        style={[
          bubbleStyles.bubble,
          isUser
            ? { backgroundColor: "#7c6bff", borderBottomRightRadius: 4 }
            : { backgroundColor: "#0f1322", borderColor: "#1a1e3a", borderWidth: 1, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[bubbleStyles.text, { color: isUser ? "#fff" : "#f0f1fa" }]}>
          {msg.content}
          {msg.streaming && <Text style={{ color: "#7c6bff" }}>▎</Text>}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 3, paddingHorizontal: 12, alignItems: "flex-end" },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  text: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
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
          Conversazioni
        </Text>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <PressableScale
            onPress={onNew}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>Nuova</Text>
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
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Nessuna conversazione</Text>
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
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 2 }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onSelect(item.id); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border + "44",
            transform: [{ scale }],
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
  });
}

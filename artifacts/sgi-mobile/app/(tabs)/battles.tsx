import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Share,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const BATTLE_DURATION = 4 * 60;

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  philosophy:    { label: "Filosofia",   color: "#7c6bff", icon: "telescope-outline" },
  science:       { label: "Scienza",     color: "#06d6a0", icon: "flask-outline" },
  ethics:        { label: "Etica",       color: "#f72585", icon: "heart-outline" },
  technology:    { label: "Tecnologia",  color: "#a89fff", icon: "hardware-chip-outline" },
  society:       { label: "Società",     color: "#ffd166", icon: "people-outline" },
  knowledge:     { label: "Conoscenza",  color: "#06d6a0", icon: "library-outline" },
  consciousness: { label: "Coscienza",   color: "#7c6bff", icon: "infinite-outline" },
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

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s fa`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return `${Math.floor(diff / 86400)}g fa`;
}

// ─── Battle Session Modal ─────────────────────────────────────────────────────
function BattleSessionModal({
  visible, thread, sessionId, onClose, colors, getToken,
}: {
  visible: boolean; thread: Thread | null; sessionId: string | null;
  onClose: (battleCardId?: string) => void; colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  getToken: () => Promise<string | null>;
}) {
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
      setMessages(prev => [...prev, { role: "assistant", content: "Errore di connessione." }]);
    } finally {
      setSending(false);
    }
  }

  async function handleComplete() {
    if (completing || completed || !thread || !sessionId) return;
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
      Alert.alert("Errore", "Impossibile completare la battaglia.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleShare() {
    if (!battleCardId) return;
    const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/battle-cards/${battleCardId}`;
    const text = score
      ? `Ho completato una Battaglia AI SGI con ${score.total} punti!\n🧠 Densità: ${score.density} · 🔗 Connessioni: ${score.connections} · 📐 Profondità: ${score.depth}\n\n${url}`
      : url;
    try {
      await Share.share({ message: text, url });
    } catch { /* user cancelled */ }
  }

  const timerColor = timeLeft > 60 ? colors.primary : "#f72585";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !timerActive && onClose()}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[styles.sessionHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => {
            if (!timerActive || completed) { onClose(battleCardId ?? undefined); return; }
            Alert.alert("Uscire dalla battaglia?", "Il progresso andrà perso.", [
              { text: "Annulla" },
              { text: "Esci", style: "destructive", onPress: () => { if (timerRef.current) clearInterval(timerRef.current); onClose(); } },
            ]);
          }}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={2}>
            {thread?.question ?? ""}
          </Text>
          {!completed ? (
            <View style={[styles.timerBadge, { backgroundColor: `${timerColor}18`, borderColor: `${timerColor}40` }]}>
              <Ionicons name="timer-outline" size={14} color={timerColor} />
              <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
            </View>
          ) : (
            <Ionicons name="checkmark-circle" size={22} color="#06d6a0" />
          )}
        </View>

        {/* Completed state */}
        {completed && score ? (
          <ScrollView contentContainerStyle={styles.completedContainer}>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreCircleNum, { color: colors.primary }]}>{score.total}</Text>
              <Text style={[styles.scoreCircleLabel, { color: colors.mutedForeground }]}>punti</Text>
            </View>

            <View style={styles.scoreGrid}>
              {[
                { label: "Densità", value: score.density, color: "#06d6a0", icon: "layers-outline" },
                { label: "Connessioni", value: score.connections, color: "#7c6bff", icon: "git-network-outline" },
                { label: "Profondità", value: score.depth, color: "#f72585", icon: "telescope-outline" },
              ].map(item => (
                <View key={item.label} style={[styles.scoreCard, { backgroundColor: `${item.color}10`, borderColor: `${item.color}25` }]}>
                  <Ionicons name={item.icon as never} size={18} color={item.color} />
                  <Text style={[styles.scoreCardNum, { color: item.color }]}>{item.value}</Text>
                  <Text style={[styles.scoreCardLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.scoreExplanation, { color: colors.mutedForeground }]}>{score.explanation}</Text>

            {battleCardId && (
              <Pressable style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Condividi Risultato</Text>
              </Pressable>
            )}

            <Pressable style={[styles.closeBtn, { borderColor: colors.border }]} onPress={() => onClose(battleCardId ?? undefined)}>
              <Text style={[styles.closeBtnText, { color: colors.mutedForeground }]}>Chiudi</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <>
            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              ListEmptyComponent={
                <View style={styles.emptySession}>
                  <Ionicons name="flash-outline" size={40} color={colors.primary} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptySessionText, { color: colors.mutedForeground }]}>
                    Scrivi il tuo primo messaggio per iniziare la battaglia!{"\n"}Il timer partirà con il primo invio.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[
                  styles.msgBubble,
                  item.role === "user"
                    ? { alignSelf: "flex-end", backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }
                    : { alignSelf: "flex-start", backgroundColor: `${colors.card}`, borderColor: colors.border },
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
                placeholder="Scrivi il tuo argomento…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={600}
                editable={!sending && !completed}
              />
              {!completed && (
                <Pressable
                  style={[styles.completeBtn, { backgroundColor: "#f7258518" }]}
                  onPress={handleComplete}
                  disabled={completing}
                >
                  <Ionicons name="flag-outline" size={18} color="#f72585" />
                </Pressable>
              )}
              <Pressable
                style={[styles.sendBtn, { backgroundColor: input.trim() && !sending ? colors.primary : `${colors.primary}40` }]}
                onPress={sendMessage}
                disabled={!input.trim() || sending || completed}
              >
                {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BattlesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [publicCards, setPublicCards] = useState<BattleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"arena" | "risultati">("arena");

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionVisible, setSessionVisible] = useState(false);
  const [startingThreadId, setStartingThreadId] = useState<string | null>(null);

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
        body: JSON.stringify({ username: "Tu" }),
      });
      if (!r.ok) throw new Error("start failed");
      const data = await r.json() as { sessionId: string };
      setActiveThread(thread);
      setActiveSessionId(data.sessionId);
      setSessionVisible(true);
    } catch {
      Alert.alert("Errore", "Impossibile avviare la battaglia. Riprova.");
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
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={[`${colors.primary}18`, "transparent"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>⚔️ Battaglie AI</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>4 minuti · confronto semantico</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["arena", "risultati"] as const).map(t => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && { backgroundColor: colors.primary }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabBtnText, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
                {t === "arena" ? "🗡️ Arena" : "🏆 Risultati"}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {tab === "arena" ? (
        <FlatList
          data={threads}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flash-outline" size={48} color={colors.primary} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nessuna arena disponibile</Text>
            </View>
          }
          renderItem={({ item: thread }) => {
            const meta = CATEGORY_META[thread.category] ?? { label: thread.category, color: "#888", icon: "help-outline" };
            const isStarting = startingThreadId === thread.id;
            return (
              <Pressable
                style={[styles.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => startBattle(thread)}
                disabled={isStarting}
              >
                <View style={styles.threadTop}>
                  <View style={[styles.catBadge, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}30` }]}>
                    <Ionicons name={meta.icon as never} size={12} color={meta.color} />
                    <Text style={[styles.catLabel, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <View style={styles.threadStats}>
                    <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{thread.totalSessions}</Text>
                    <Ionicons name="git-network-outline" size={12} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{thread.knowledgeBaseSize}</Text>
                  </View>
                </View>

                <Text style={[styles.threadQ, { color: colors.foreground }]}>{thread.question}</Text>
                {thread.description ? (
                  <Text style={[styles.threadDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {thread.description}
                  </Text>
                ) : null}

                <View style={[styles.startBtn, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                  {isStarting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="flash" size={15} color={colors.primary} />
                      <Text style={[styles.startBtnText, { color: colors.primary }]}>Inizia Battaglia</Text>
                    </>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={publicCards}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={colors.primary} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nessun risultato ancora.{"\n"}Completa la tua prima battaglia!
              </Text>
            </View>
          }
          renderItem={({ item: card }) => {
            const meta = CATEGORY_META[card.thread.category] ?? { label: card.thread.category, color: "#888" };
            const winner = card.player1.isWinner ? card.player1 : card.player2;
            const loser = card.player1.isWinner ? card.player2 : card.player1;

            async function shareCard() {
              const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/battle-cards/${card.id}`;
              try {
                await Share.share({
                  message: `Battaglia AI SGI: ${winner.username} vince con ${winner.scoreTotal} pts su "${card.thread.question}"\n${url}`,
                  url,
                });
              } catch { /* cancelled */ }
            }

            return (
              <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  <View style={[styles.catBadge, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}30` }]}>
                    <Text style={[styles.catLabel, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={[styles.timeAgoText, { color: colors.mutedForeground }]}>{timeAgo(card.createdAt)}</Text>
                </View>

                <Text style={[styles.resultQ, { color: colors.foreground }]} numberOfLines={2}>{card.thread.question}</Text>

                <View style={styles.vsRow}>
                  {/* Winner */}
                  <View style={[styles.playerCol, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}25` }]}>
                    <View style={styles.winnerBadge}>
                      <Ionicons name="trophy" size={12} color="#ffd166" />
                      <Text style={styles.winnerText}>Vincitore</Text>
                    </View>
                    <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{winner.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.primary }]}>{winner.scoreTotal}</Text>
                    <View style={styles.miniPips}>
                      <Text style={[styles.miniPip, { color: "#06d6a0" }]}>D:{winner.scoreDensity}</Text>
                      <Text style={[styles.miniPip, { color: "#7c6bff" }]}>C:{winner.scoreConnections}</Text>
                      <Text style={[styles.miniPip, { color: "#f72585" }]}>P:{winner.scoreDepth}</Text>
                    </View>
                    <Text style={[styles.durationText, { color: colors.mutedForeground }]}>{formatDuration(winner.durationSeconds)}</Text>
                  </View>

                  <View style={styles.vsLabel}>
                    <Text style={[styles.vsText, { color: "#f72585" }]}>VS</Text>
                  </View>

                  {/* Loser */}
                  <View style={[styles.playerCol, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.playerName, { color: colors.mutedForeground }]} numberOfLines={1}>{loser.username}</Text>
                    <Text style={[styles.playerScore, { color: colors.mutedForeground }]}>{loser.scoreTotal}</Text>
                    <View style={styles.miniPips}>
                      <Text style={[styles.miniPip, { color: "#06d6a0" }]}>D:{loser.scoreDensity}</Text>
                      <Text style={[styles.miniPip, { color: "#7c6bff" }]}>C:{loser.scoreConnections}</Text>
                      <Text style={[styles.miniPip, { color: "#f72585" }]}>P:{loser.scoreDepth}</Text>
                    </View>
                    <Text style={[styles.durationText, { color: colors.mutedForeground }]}>{formatDuration(loser.durationSeconds)}</Text>
                  </View>
                </View>

                <Pressable style={[styles.shareResult, { borderColor: colors.border }]} onPress={shareCard}>
                  <Ionicons name="share-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.shareResultText, { color: colors.mutedForeground }]}>Condividi</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <BattleSessionModal
        visible={sessionVisible}
        thread={activeThread}
        sessionId={activeSessionId}
        onClose={onSessionClose}
        colors={colors}
        getToken={getToken}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
  headerSub: { fontSize: 12, marginTop: 2 },
  tabRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 3, gap: 2 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontWeight: "600" },

  threadCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  threadTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  catLabel: { fontSize: 11, fontWeight: "600" },
  threadStats: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11 },
  threadQ: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  threadDesc: { fontSize: 12, lineHeight: 18 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  startBtnText: { fontSize: 14, fontWeight: "700" },

  resultCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultQ: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  timeAgoText: { fontSize: 11 },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  playerCol: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, gap: 4, alignItems: "center" },
  winnerBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  winnerText: { fontSize: 10, color: "#ffd166", fontWeight: "700" },
  playerName: { fontSize: 12, fontWeight: "600" },
  playerScore: { fontSize: 22, fontWeight: "800" },
  miniPips: { flexDirection: "row", gap: 6 },
  miniPip: { fontSize: 10, fontWeight: "600" },
  durationText: { fontSize: 10 },
  vsLabel: { alignItems: "center" },
  vsText: { fontSize: 12, fontWeight: "800" },
  shareResult: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 2 },
  shareResultText: { fontSize: 12 },

  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderBottomWidth: 1 },
  sessionTitle: { flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  timerText: { fontSize: 13, fontWeight: "700" },

  msgBubble: { maxWidth: "85%", padding: 12, borderRadius: 14, borderWidth: 1 },
  msgText: { fontSize: 14, lineHeight: 21 },

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  completeBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  completedContainer: { padding: 24, alignItems: "center", gap: 20 },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(124,107,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(124,107,255,0.4)" },
  scoreCircleNum: { fontSize: 36, fontWeight: "800" },
  scoreCircleLabel: { fontSize: 12, marginTop: -2 },
  scoreGrid: { flexDirection: "row", gap: 10, width: "100%" },
  scoreCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center", gap: 4 },
  scoreCardNum: { fontSize: 22, fontWeight: "800" },
  scoreCardLabel: { fontSize: 10, textAlign: "center" },
  scoreExplanation: { fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 320 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, width: "100%", justifyContent: "center" },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  closeBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1, width: "100%", alignItems: "center" },
  closeBtnText: { fontSize: 14 },

  emptySession: { alignItems: "center", gap: 12, paddingTop: 60, paddingHorizontal: 30 },
  emptySessionText: { textAlign: "center", fontSize: 13, lineHeight: 20 },
});

import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";

// ─── Data ──────────────────────────────────────────────────────────────────────

const METRICS: { name: string; pct: number; desc: string }[] = [
  { name: "Profondità di ragionamento", pct: 15, desc: "Quanto articoli e argomenti le tue idee invece di restare in superficie." },
  { name: "Segnale di revisione",       pct: 15, desc: "Quanto correggi, affini o ribalti i tuoi ragionamenti durante la conversazione." },
  { name: "Complessità concettuale",    pct: 12, desc: "La densità di concetti astratti e stratificati rispetto a quelli semplici." },
  { name: "Interdisciplinarità",        pct: 12, desc: "Quanto colleghi ambiti di conoscenza diversi tra loro." },
  { name: "Varietà semantica",          pct: 10, desc: "La copertura di campi semantici diversi nel tuo modo di esplorare un tema." },
  { name: "Stabilità",                  pct:  8, desc: "La coerenza del tuo ragionamento nel tempo, sessione dopo sessione." },
  { name: "Livello di astrazione",      pct:  8, desc: "La capacità di muoverti tra esempi concreti e principi generali." },
  { name: "Continuità",                 pct:  7, desc: "Le tue conversazioni si costruiscono l'una sull'altra, non ripartono da zero." },
  { name: "Densità informativa",        pct:  7, desc: "Quante idee distinte per frase, senza riempitivi o ripetizioni." },
  { name: "Ricchezza lessicale",        pct:  3, desc: "La varietà del vocabolario che usi per esprimere concetti simili." },
  { name: "Originalità",                pct:  3, desc: "La distanza dalle formulazioni più comuni e attese." },
];

type AreaColor = "gold" | "primary" | "violet";
const AREAS: { name: string; color: AreaColor; icon: React.ComponentProps<typeof Ionicons>["name"]; items: string; desc: string }[] = [
  {
    name: "Arena",
    color: "gold",
    icon: "trophy-outline",
    items: "Rank · Battles · Leaderboard",
    desc: "Confronto con gli altri utenti. Sempre accessibile, anche nel piano Free.",
  },
  {
    name: "Insight",
    color: "primary",
    icon: "telescope-outline",
    items: "Predictions · Growth Path · Progress · Semantic Map",
    desc: "Cosa l'AI intuisce sul tuo modo di ragionare: previsioni, percorso di crescita, missioni e mappa semantica.",
  },
  {
    name: "Identità",
    color: "violet",
    icon: "person-circle-outline",
    items: "Context File",
    desc: "Il ritratto che si affina nel tempo: un profilo sintetico di come pensi, aggiornato automaticamente.",
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>
      {label.toUpperCase()}
    </Text>
  );
}

function IntroCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[st.introDot, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}>
        <Ionicons name="analytics-outline" size={26} color={colors.primary} />
      </View>
      <Text style={[st.introTitle, { color: colors.foreground }]}>
        Leggiamo come ragioni, non cosa dici.
      </Text>
      <Text style={[st.introBody, { color: colors.mutedForeground }]}>
        Il punteggio SGI analizza la struttura del tuo pensiero — come colleghi idee, quanto le rivedi, quanto vai in profondità. Non raccogliamo opinioni o dati personali: quello che conta è il <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>modo</Text> in cui esplori un argomento.
      </Text>
      <Text style={[st.introBody, { color: colors.mutedForeground, marginTop: 6 }]}>
        Il punteggio si aggiorna in tempo reale ad ogni messaggio, ponderando le ultime sessioni più di quelle vecchie.
      </Text>
    </View>
  );
}

function MetricRow({
  metric,
  colors,
  isLast,
}: {
  metric: typeof METRICS[number];
  colors: ReturnType<typeof useColors>;
  isLast: boolean;
}) {
  const barWidth = `${metric.pct * 5}%` as `${number}%`;
  return (
    <View style={[st.metricRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={st.metricHeader}>
        <Text style={[st.metricName, { color: colors.foreground }]}>{metric.name}</Text>
        <View style={[st.pctBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Text style={[st.pctText, { color: colors.primary }]}>{metric.pct}%</Text>
        </View>
      </View>
      <View style={[st.barTrack, { backgroundColor: colors.muted }]}>
        <View style={[st.barFill, { width: barWidth, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[st.metricDesc, { color: colors.mutedForeground }]}>{metric.desc}</Text>
    </View>
  );
}

function DimNote({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[st.noteBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <Text style={[st.noteText, { color: colors.mutedForeground }]}>
        Le <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>4 macro-dimensioni</Text> mostrate nella Dashboard (Profondità, Connettività, Precisione, Revisione) sono raggruppamenti visivi delle 11 metriche. Non hanno un peso proprio nel calcolo del punteggio.
      </Text>
    </View>
  );
}

function AreaCard({
  area,
  colors,
}: {
  area: typeof AREAS[number];
  colors: ReturnType<typeof useColors>;
}) {
  const areaColor: string = (colors as Record<string, unknown>)[area.color] as string ?? colors.primary;
  return (
    <View style={[st.areaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[st.areaIconBox, { backgroundColor: areaColor + "18", borderColor: areaColor + "30" }]}>
        <Ionicons name={area.icon} size={22} color={areaColor} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[st.areaName, { color: colors.foreground }]}>{area.name}</Text>
          <Text style={[st.areaItems, { color: areaColor }]}>{area.items}</Text>
        </View>
        <Text style={[st.areaDesc, { color: colors.mutedForeground }]}>{area.desc}</Text>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HowItWorksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          st.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>Come leggiamo i tuoi dati</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 24,
        }}
      >
        {/* Intro */}
        <IntroCard colors={colors} />

        {/* Le 11 metriche */}
        <View style={{ gap: 8 }}>
          <SectionLabel label="Le 11 metriche" colors={colors} />
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: "hidden" }]}>
            {METRICS.map((m, i) => (
              <MetricRow key={m.name} metric={m} colors={colors} isLast={i === METRICS.length - 1} />
            ))}
          </View>
        </View>

        {/* Nota macro-dimensioni */}
        <DimNote colors={colors} />

        {/* Le aree Explore */}
        <View style={{ gap: 8 }}>
          <SectionLabel label="Le aree Explore" colors={colors} />
          <View style={{ gap: 10 }}>
            {AREAS.map((a) => (
              <AreaCard key={a.name} area={a} colors={colors} />
            ))}
          </View>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", flex: 1 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },

  introDot: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    lineHeight: 24,
  },
  introBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },

  metricRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  pctBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pctText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  barTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2 },
  metricDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },

  noteBox: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },

  areaCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  areaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  areaName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  areaItems: { fontSize: 11, fontFamily: "Inter_500Medium" },
  areaDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

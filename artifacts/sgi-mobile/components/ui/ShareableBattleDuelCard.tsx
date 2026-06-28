import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";
import { LogoMark } from "@/components/ui/Logo";

export interface DuelMetric {
  label: string;
  user: number; // 0-10
  ai: number; // 0-10
  winner: "user" | "ai" | "tie";
}

export interface DuelCardData {
  question: string;
  categoryLabel: string;
  winner: "user" | "ai" | "tie";
  userScore: number; // /100
  aiScore: number; // /100
  xpAwarded: number;
  level: number | null;
  metrics: DuelMetric[];
}

// 9:16 — captured and scaled to 1080×1920 for IG/FB Stories.
export const DUEL_CARD_W = 620;
export const DUEL_CARD_H = 1102;

const C = {
  bg: palette.bg,
  surface: palette.surface1,
  border: palette.surface3,
  primary: palette.primary,
  primaryGlow: palette.primary + "1f",
  teal: palette.teal,
  pink: palette.pink,
  pinkGlow: palette.pink + "1f",
  gold: palette.gold,
  goldGlow: palette.gold + "1f",
  goldBorder: palette.gold + "55",
  text: palette.textPrimary,
  muted: palette.textSecondary,
  white: palette.white,
  track: "rgba(255,255,255,0.07)",
};

function verdictTheme(winner: DuelCardData["winner"]) {
  if (winner === "user") return { color: C.teal, label: "VITTORIA", sub: "Ho battuto l'AI su questa domanda." };
  if (winner === "tie") return { color: C.gold, label: "PAREGGIO", sub: "Testa a testa con l'AI." };
  return { color: C.pink, label: "SCONFITTA", sub: "L'AI ha avuto la meglio — round in arrivo." };
}

function MetricRow({ m }: { m: DuelMetric }) {
  const tuPct = Math.max(0, Math.min(1, m.user / 10)) * 100;
  const aiPct = Math.max(0, Math.min(1, m.ai / 10)) * 100;
  const tuColor = m.winner === "user" ? C.teal : C.primary;
  return (
    <View style={s.metric}>
      <View style={s.metricHead}>
        <Text style={s.metricLabel} numberOfLines={1}>{m.label}</Text>
        <View style={s.metricVals}>
          <Text style={[s.metricVal, { color: tuColor }]}>Tu {m.user.toFixed(1)}</Text>
          <Text style={[s.metricVal, { color: C.pink }]}>AI {m.ai.toFixed(1)}</Text>
        </View>
      </View>
      <View style={s.divTrack}>
        <View style={s.divLeft}>
          <View style={{ width: `${tuPct}%`, height: "100%", backgroundColor: tuColor, borderRadius: 4 }} />
        </View>
        <View style={s.divCenter} />
        <View style={s.divRight}>
          <View style={{ width: `${aiPct}%`, height: "100%", backgroundColor: C.pink + "cc", borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

export function ShareableBattleDuelCard({ data }: { data: DuelCardData }) {
  const v = verdictTheme(data.winner);
  const userColor = data.winner === "user" ? C.teal : C.primary;

  return (
    <View style={s.root}>
      {/* Brand header */}
      <View style={s.header}>
        <LogoMark size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>SGI</Text>
          <Text style={s.brandSub}>Semantic Growth Index</Text>
        </View>
        <View style={s.battleBadge}>
          <Ionicons name="sparkles" size={13} color={C.pink} />
          <Text style={s.battleBadgeText}>Battaglia AI</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* Category + question */}
      <View style={s.qWrap}>
        {!!data.categoryLabel && <Text style={s.category}>{data.categoryLabel.toUpperCase()}</Text>}
        <Text style={s.question} numberOfLines={3}>{`\u201c${data.question}\u201d`}</Text>
      </View>

      {/* Verdict banner */}
      <View style={[s.verdict, { backgroundColor: v.color + "1f", borderColor: v.color + "66" }]}>
        <Text style={[s.verdictLabel, { color: v.color }]}>{v.label}</Text>
        <Text style={s.verdictSub}>{v.sub}</Text>
      </View>

      {/* Duel */}
      <View style={s.duel}>
        <View style={[s.duelCol, { backgroundColor: userColor + "12", borderColor: userColor + (data.winner === "user" ? "88" : "30") }]}>
          {data.winner === "user" && <Ionicons name="trophy" size={18} color={C.gold} style={s.crown} />}
          <Text style={s.duelTag}>TU</Text>
          <Text style={[s.duelScore, { color: data.winner === "user" ? userColor : C.text }]}>{data.userScore.toFixed(1)}</Text>
          <Text style={s.duelUnit}>/ 100 SGI</Text>
        </View>
        <View style={s.vsBadge}>
          <Text style={s.vsText}>VS</Text>
        </View>
        <View style={[s.duelCol, { backgroundColor: C.pink + "12", borderColor: C.pink + (data.winner === "ai" ? "88" : "30") }]}>
          {data.winner === "ai" && <Ionicons name="trophy" size={18} color={C.gold} style={s.crown} />}
          <Text style={s.duelTag}>SGI · AI</Text>
          <Text style={[s.duelScore, { color: data.winner === "ai" ? C.pink : C.text }]}>{data.aiScore.toFixed(1)}</Text>
          <Text style={s.duelUnit}>/ 100 SGI</Text>
        </View>
      </View>

      {/* XP chip */}
      <View style={[s.xpChip, { backgroundColor: C.goldGlow, borderColor: C.goldBorder }]}>
        <Ionicons name="flash" size={18} color={C.gold} />
        <Text style={[s.xpText, { color: C.gold }]}>
          +{data.xpAwarded} XP{data.level != null ? `   ·   Livello ${data.level}` : ""}
        </Text>
      </View>

      {/* Metrics */}
      <Text style={s.metricsTitle}>ANALISI PER METRICA — STESSO MOTORE SGI</Text>
      <View style={{ gap: 8 }}>
        {data.metrics.slice(0, 11).map((m) => (
          <MetricRow key={m.label} m={m} />
        ))}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Ionicons name="globe-outline" size={13} color={C.muted} />
          <Text style={s.footerText}>semantic-growth.app</Text>
        </View>
        <Text style={s.footerText}>Sfida l'AI!</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    width: DUEL_CARD_W,
    height: DUEL_CARD_H,
    backgroundColor: C.bg,
    paddingHorizontal: 32,
    paddingTop: 26,
    paddingBottom: 18,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  brand: { color: C.white, fontFamily: "Inter_700Bold", fontSize: 24, lineHeight: 26 },
  brandSub: { color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16 },
  battleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.pinkGlow, borderWidth: 1, borderColor: C.pink + "44",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  battleBadgeText: { color: C.pink, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  qWrap: { alignItems: "center", gap: 10, marginBottom: 16 },
  category: {
    color: C.gold, fontFamily: "Inter_600SemiBold", fontSize: 13, letterSpacing: 1.5,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.gold + "44",
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5, overflow: "hidden",
  },
  question: { color: C.text, fontFamily: "Inter_500Medium", fontSize: 21, lineHeight: 28, textAlign: "center" },
  verdict: { borderWidth: 2, borderRadius: 20, paddingVertical: 16, alignItems: "center", marginBottom: 14 },
  verdictLabel: { fontFamily: "Inter_700Bold", fontSize: 34, letterSpacing: 1 },
  verdictSub: { color: "rgba(200,200,224,0.8)", fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 4 },
  duel: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  duelCol: { flex: 1, borderWidth: 1.5, borderRadius: 20, paddingVertical: 18, alignItems: "center" },
  crown: { position: "absolute", top: 12, right: 12 },
  duelTag: { color: "rgba(180,180,210,0.85)", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  duelScore: { fontFamily: "Inter_700Bold", fontSize: 56, lineHeight: 62, marginTop: 4 },
  duelUnit: { color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  vsBadge: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: C.pink + "55",
    backgroundColor: C.pinkGlow, alignItems: "center", justifyContent: "center",
  },
  vsText: { color: C.pink, fontFamily: "Inter_700Bold", fontSize: 22 },
  xpChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderWidth: 1, borderRadius: 16, paddingVertical: 13, marginBottom: 18,
  },
  xpText: { fontFamily: "Inter_700Bold", fontSize: 22 },
  metricsTitle: { color: "rgba(238,238,255,0.85)", fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "center", marginBottom: 12, letterSpacing: 0.5 },
  metric: { gap: 5 },
  metricHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricLabel: { color: "rgba(220,220,240,0.92)", fontFamily: "Inter_500Medium", fontSize: 14, flex: 1, marginRight: 8 },
  metricVals: { flexDirection: "row", gap: 12 },
  metricVal: { fontFamily: "Inter_700Bold", fontSize: 12 },
  divTrack: { flexDirection: "row", alignItems: "center", height: 8 },
  divLeft: { flex: 1, height: 8, backgroundColor: C.track, borderRadius: 4, flexDirection: "row", justifyContent: "flex-end", overflow: "hidden" },
  divCenter: { width: 1.5, height: 12, backgroundColor: "rgba(255,255,255,0.3)" },
  divRight: { flex: 1, height: 8, backgroundColor: C.track, borderRadius: 4, overflow: "hidden" },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginTop: "auto",
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerText: { color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13 },
});

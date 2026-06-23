import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface ShareCardData {
  total: number;
  density: number;
  connections: number;
  depth: number;
  question: string;
  username?: string;
}

const CARD_W = 340;

const C = {
  bg: "#0d0d1e",
  surface: "#161629",
  border: "#2a2a4a",
  primary: "#7c5cfc",
  primaryGlow: "#7c5cfc22",
  teal: "#2dd4bf",
  tealGlow: "#2dd4bf22",
  pink: "#ec4899",
  pinkGlow: "#ec489922",
  gold: "#f59e0b",
  text: "#f0f0f8",
  muted: "#7070a0",
  white: "#ffffff",
};

function MetricCell({
  value,
  label,
  icon,
  color,
  glow,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
  glow: string;
}) {
  return (
    <View style={[ms.cell, { backgroundColor: glow, borderColor: color + "44" }]}>
      <Ionicons name={icon as never} size={16} color={color} />
      <Text style={[ms.num, { color }]}>{value}</Text>
      <Text style={ms.label}>{label}</Text>
    </View>
  );
}

const ms = StyleSheet.create({
  cell: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  num: { fontSize: 22, fontFamily: "Inter_700Bold" },
  label: { fontSize: 10, fontFamily: "Inter_500Medium", color: C.muted, textAlign: "center" },
});

export function ShareableBattleCard({ data }: { data: ShareCardData }) {
  return (
    <View style={s.root}>
      {/* Header brand */}
      <View style={s.header}>
        <View style={s.logoRing}>
          <Ionicons name="analytics" size={16} color={C.primary} />
        </View>
        <View>
          <Text style={s.brand}>SGI</Text>
          <Text style={s.brandSub}>Semantic Growth Index</Text>
        </View>
        <View style={s.battleBadge}>
          <Ionicons name="flash" size={11} color={C.gold} />
          <Text style={s.battleBadgeText}>Battaglia AI</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Score hero */}
      <View style={s.heroWrap}>
        <View style={s.scoreRing}>
          <Text style={s.scoreNum}>{data.total}</Text>
          <Text style={s.scoreLabel}>punti</Text>
        </View>
        {data.username && (
          <Text style={s.username}>@{data.username}</Text>
        )}
      </View>

      {/* 3 metrics */}
      <View style={s.metricsRow}>
        <MetricCell value={data.density}     label="Densità"     icon="layers-outline"      color={C.teal}    glow={C.tealGlow} />
        <MetricCell value={data.connections} label="Connessioni" icon="git-network-outline"  color={C.primary} glow={C.primaryGlow} />
        <MetricCell value={data.depth}       label="Profondità"  icon="telescope-outline"    color={C.pink}    glow={C.pinkGlow} />
      </View>

      {/* Question */}
      <View style={s.questionWrap}>
        <Text style={s.questionLabel}>Tema della sfida</Text>
        <Text style={s.questionText} numberOfLines={3}>{data.question}</Text>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Ionicons name="globe-outline" size={11} color={C.muted} />
          <Text style={s.footerText}>sgi.app</Text>
        </View>
        <Text style={s.footerText}>Sfidami!</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    width: CARD_W,
    backgroundColor: C.bg,
    borderRadius: 20,
    overflow: "hidden",
    padding: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  logoRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.primary + "55",
    backgroundColor: C.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: C.white,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    lineHeight: 18,
  },
  brandSub: {
    color: C.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    lineHeight: 12,
  },
  battleBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.gold + "18",
    borderWidth: 1,
    borderColor: C.gold + "33",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  battleBadgeText: {
    color: C.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 0,
  },
  heroWrap: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
    gap: 8,
  },
  scoreRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: C.primary + "55",
    backgroundColor: C.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: {
    color: C.primary,
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    lineHeight: 44,
  },
  scoreLabel: {
    color: C.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  username: {
    color: C.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  questionWrap: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 6,
  },
  questionLabel: {
    color: C.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.0,
  },
  questionText: {
    color: C.text,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    color: C.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
});

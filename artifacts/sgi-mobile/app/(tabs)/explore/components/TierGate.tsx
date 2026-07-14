import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { usePurchase } from "@/hooks/usePurchase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = "free" | "premium" | "pro";

interface TierGateProps {
  requiredPlan: "premium" | "pro";
  currentPlan: string | undefined;
  featureName: string;
  fallbackRoute: string;
  children: React.ReactNode;
}

// ─── Gate check ───────────────────────────────────────────────────────────────

function isUnlocked(requiredPlan: "premium" | "pro", currentPlan: string | undefined): boolean {
  if (requiredPlan === "premium") {
    return currentPlan === "premium" || currentPlan === "pro";
  }
  return currentPlan === "pro";
}

// ─── Gate UI ──────────────────────────────────────────────────────────────────

function GateUI({
  requiredPlan,
  featureName,
  fallbackRoute,
}: {
  requiredPlan: "premium" | "pro";
  featureName: string;
  fallbackRoute: string;
}) {
  const colors = useColors();
  const { triggerPurchase } = usePurchase();

  const planLabel = requiredPlan === "pro" ? "Pro" : "Premium";
  const title = `${featureName} richiede ${planLabel}`;
  const desc =
    requiredPlan === "pro"
      ? `Passa al piano Pro per sbloccare ${featureName} e le funzionalità avanzate del Context File.`
      : `Passa al piano Premium per sbloccare ${featureName} e le proiezioni della tua crescita intellettuale.`;
  const ctaLabel = `Passa a ${planLabel}`;
  const unlockNote =
    requiredPlan === "pro"
      ? "Pro include tutto il piano Premium."
      : "Puoi disdire in qualsiasi momento.";

  return (
    <View style={st.gateContainer}>
      <View
        style={[
          st.gateLockCircle,
          {
            backgroundColor: palette.primary + "18",
            borderColor: palette.primary + "33",
          },
        ]}
      >
        <Ionicons name="lock-closed" size={30} color={palette.primary} />
      </View>

      <Text style={[st.gateTitle, { color: colors.foreground }]}>
        {title}
      </Text>

      <Text style={[st.gateDesc, { color: colors.mutedForeground }]}>
        {desc}
      </Text>

      <Pressable
        style={({ pressed }) => [
          st.gateBtn,
          { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => triggerPurchase(requiredPlan)}
      >
        <Ionicons name="trending-up" size={18} color="#fff" />
        <Text style={st.gateBtnText}>{ctaLabel}</Text>
      </Pressable>

      <Text style={[st.gateUnlock, { color: colors.mutedForeground }]}>
        {unlockNote}
      </Text>

      <Pressable
        onPress={() => router.push(fallbackRoute as never)}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={[st.backLink, { color: colors.mutedForeground }]}>
          ← Torna a Explore
        </Text>
      </Pressable>
    </View>
  );
}

// ─── TierGate ─────────────────────────────────────────────────────────────────

export function TierGate({
  requiredPlan,
  currentPlan,
  featureName,
  fallbackRoute,
  children,
}: TierGateProps) {
  if (!isUnlocked(requiredPlan, currentPlan)) {
    return (
      <GateUI
        requiredPlan={requiredPlan}
        featureName={featureName}
        fallbackRoute={fallbackRoute}
      />
    );
  }
  return <>{children}</>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    gap: 14,
  },
  gateLockCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  gateTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  gateDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
    marginTop: 4,
  },
  gateBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  gateUnlock: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  backLink: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});

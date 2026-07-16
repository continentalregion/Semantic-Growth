import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { fetch } from "expo/fetch";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { usePurchase } from "@/hooks/usePurchase";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface SupportingMetric {
  key: string;
  label: string;
  value: number;
  direction: "high" | "low";
}

interface VerdictResponse {
  verdict: string;
  archetype: string;
  supportingMetrics: {
    metric1: SupportingMetric;
    metric2: SupportingMetric;
  };
  lifestyleSuggestion: string;
  monthKey: string;
  cached: boolean;
}

function useVerdictQuery(lang: string) {
  const { getToken } = useAuth();
  return useQuery<VerdictResponse>({
    queryKey: ["verdict", lang],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/users/me/verdict?lang=${lang}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 403) {
        const err = new Error("gate") as Error & { code: string };
        err.code = "PREMIUM_REQUIRED";
        throw err;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<VerdictResponse>;
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}

function MetricBar({
  metric,
  colors,
  t,
}: {
  metric: SupportingMetric;
  colors: ReturnType<typeof useColors>;
  t: (key: string) => string;
}) {
  const pct = Math.max(0, Math.min(1, metric.value));
  const barColor = metric.direction === "high" ? palette.primary : palette.teal;
  const directionLabel = metric.direction === "high" ? `↑ ${t("verdict.high")}` : `↓ ${t("verdict.low")}`;

  return (
    <View style={mbStyles.row}>
      <View style={mbStyles.labelRow}>
        <Text style={[mbStyles.name, { color: colors.foreground }]}>{metric.label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[mbStyles.dir, { color: barColor }]}>{directionLabel}</Text>
          <Text style={[mbStyles.pct, { color: colors.mutedForeground }]}>{(pct * 100).toFixed(0)}%</Text>
        </View>
      </View>
      <View style={[mbStyles.barBg, { backgroundColor: colors.border }]}>
        <View
          style={[
            mbStyles.barFill,
            { width: `${Math.max(2, pct * 100).toFixed(1)}%` as `${number}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

export default function VerdictScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { triggerPurchase } = usePurchase();
  const lang = ((i18n.language ?? "it").split("-")[0]) ?? "it";

  const { data, isLoading, isError, error } = useVerdictQuery(lang);

  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const mountTime = useRef(Date.now());

  const verdictAnim = useRef(new Animated.Value(0)).current;
  const metricsAnim = useRef(new Animated.Value(0)).current;
  const archetypeAnim = useRef(new Animated.Value(0)).current;
  const lifestyleAnim = useRef(new Animated.Value(0)).current;

  const isPremiumGate =
    isError &&
    error instanceof Error &&
    (error as Error & { code?: string }).code === "PREMIUM_REQUIRED";

  useEffect(() => {
    if (!data) return;
    const elapsed = Date.now() - mountTime.current;
    const minWait = Math.max(0, 1200 - elapsed);

    const timers = [
      setTimeout(() => {
        setPhase(1);
        Animated.timing(verdictAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, minWait),
      setTimeout(() => {
        setPhase(2);
        Animated.timing(metricsAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }, minWait + 600),
      setTimeout(() => {
        setPhase(3);
        Animated.timing(archetypeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }, minWait + 1100),
      setTimeout(() => {
        setPhase(4);
        Animated.timing(lifestyleAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }, minWait + 1600),
    ];

    return () => timers.forEach(clearTimeout);
  }, [data]);

  const monthLabel = useMemo(() => {
    if (!data?.monthKey) return "";
    const [y, m] = data.monthKey.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    const raw = d.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [data?.monthKey, i18n.language]);

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          st.header,
          { paddingTop: insets.top, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>
          {t("verdict.title")}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {isPremiumGate && (
        <View style={st.centerWrap}>
          <Ionicons name="analytics" size={48} color={palette.primary} />
          <Text style={[st.gateTitle, { color: colors.foreground }]}>
            {t("verdict.premiumGate")}
          </Text>
          <Text style={[st.gateDesc, { color: colors.mutedForeground }]}>
            {t("verdict.premiumDesc")}
          </Text>
          <Pressable
            style={[st.gateBtn, { backgroundColor: palette.primary }]}
            onPress={() => triggerPurchase("premium")}
          >
            <Text style={st.gateBtnText}>{t("verdict.upgrade")}</Text>
          </Pressable>
        </View>
      )}

      {!isPremiumGate && (isLoading || (data && phase === 0)) && (
        <View style={st.centerWrap}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[st.loadingText, { color: colors.mutedForeground }]}>
            {t("verdict.loading")}
          </Text>
        </View>
      )}

      {!isPremiumGate && isError && !isLoading && phase === 0 && (
        <View style={st.centerWrap}>
          <Ionicons name="warning-outline" size={36} color={colors.mutedForeground} />
          <Text style={[st.loadingText, { color: colors.mutedForeground }]}>
            {t("common.error", "Errore. Riprova.")}
          </Text>
        </View>
      )}

      {data && phase >= 1 && (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: tabBarHeight + 40,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[st.monthChip, { color: colors.mutedForeground }]}>
            {monthLabel}
          </Text>

          <Animated.View
            style={[
              st.card,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: verdictAnim },
            ]}
          >
            <Text style={[st.verdictText, { color: colors.foreground }]}>
              {data.verdict}
            </Text>
          </Animated.View>

          {phase >= 2 && (
            <Animated.View
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: metricsAnim },
              ]}
            >
              <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>
                {t("verdict.metrics")}
              </Text>
              <MetricBar metric={data.supportingMetrics.metric1} colors={colors} t={t as (k: string) => string} />
              <MetricBar metric={data.supportingMetrics.metric2} colors={colors} t={t as (k: string) => string} />
            </Animated.View>
          )}

          {phase >= 3 && data.archetype !== "—" && (
            <Animated.View
              style={[
                st.archetypeCard,
                {
                  backgroundColor: palette.primary + "14",
                  borderColor: palette.primary + "40",
                  opacity: archetypeAnim,
                },
              ]}
            >
              <Text style={[st.archetypeLabel, { color: colors.mutedForeground }]}>
                {t("verdict.archetype")}
              </Text>
              <Text style={[st.archetypeName, { color: palette.primary }]}>
                {data.archetype}
              </Text>
            </Animated.View>
          )}

          {phase >= 4 && !!data.lifestyleSuggestion && (
            <Animated.View
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: lifestyleAnim },
              ]}
            >
              <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>
                {t("verdict.lifestyle")}
              </Text>
              <Text style={[st.lifestyleText, { color: colors.foreground }]}>
                {data.lifestyleSuggestion}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  gateTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 6,
  },
  gateDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  gateBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  gateBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  monthChip: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  card: {
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  archetypeCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  verdictText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 25,
  },
  archetypeLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  archetypeName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  lifestyleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
});

const mbStyles = StyleSheet.create({
  row: { gap: 6 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, marginRight: 8 },
  dir: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pct: { fontSize: 12, fontFamily: "Inter_400Regular" },
  barBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
});

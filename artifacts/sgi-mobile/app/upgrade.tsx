import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { usePurchase } from "@/hooks/usePurchase";
import { useOfferings } from "@/hooks/useOfferings";
import { useGetMyProfile } from "@workspace/api-client-react";

// ─── Plan data (values from artifacts/api-server/src/config/pricing.ts) ──────
// Premium: €14.99 / 600 msg / 80 battaglie / Haiku + Sonnet + GPT-4o-mini
// Pro:     €29.99 / 2000 msg / 250 battaglie / tutti i modelli incluso Opus
const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "€0",
    period: "/mese",
    color: palette.mutedForeground ?? "#888",
    features: [
      "20 messaggi/mese",
      "8 battaglie/mese",
      "Modello Claude Haiku",
      "Storico conversazioni",
    ],
    cta: null,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "€14.99",
    period: "/mese",
    color: palette.violet,
    features: [
      "600 messaggi/mese",
      "80 battaglie/mese",
      "Claude Haiku + Sonnet",
      "GPT-4o mini incluso",
      "Proiezioni SGI 30/90/180 gg",
      "Raccomandazioni personalizzate",
      "Mappa semantica",
    ],
    cta: "Upgrade a Premium — €14.99",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "€29.99",
    period: "/mese",
    color: palette.cyan,
    features: [
      "2.000 messaggi/mese",
      "250 battaglie/mese",
      "Tutti i modelli AI",
      "Claude Opus (150 msg/mese)",
      "GPT-4o incluso",
      "Tutte le funzioni Premium",
      "Priorità sui server",
    ],
    cta: "Upgrade a Pro — €29.99",
  },
] as const;

function CheckRow({ text, color }: { text: string; color: string }) {
  const colors = useColors();
  return (
    <View style={st.checkRow}>
      <Ionicons name="checkmark-circle" size={16} color={color} />
      <Text style={[st.checkText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

export default function UpgradeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { triggerPurchase, isPurchasing } = usePurchase();
  const { premiumPrice, proPrice } = useOfferings();
  const { data: profile } = useGetMyProfile();
  const currentPlan = profile?.plan ?? "free";

  const storePrices: Record<string, string | null> = {
    free: null,
    premium: premiumPrice,
    pro: proPrice,
  };

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
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>
          Piani SGI
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tagline */}
        <Text style={[st.tagline, { color: colors.mutedForeground }]}>
          Scegli il piano più adatto alla tua crescita semantica
        </Text>

        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isUpgrade =
            (currentPlan === "free" && (plan.id === "premium" || plan.id === "pro")) ||
            (currentPlan === "premium" && plan.id === "pro");

          return (
            <View
              key={plan.id}
              style={[
                st.card,
                {
                  backgroundColor: colors.card,
                  borderColor: isCurrentPlan ? plan.color : colors.border,
                  borderWidth: isCurrentPlan ? 2 : 1,
                },
              ]}
            >
              {/* Plan header */}
              <View style={st.cardHeader}>
                <View style={st.planNameRow}>
                  <Text style={[st.planName, { color: plan.color }]}>
                    {plan.name}
                  </Text>
                  {isCurrentPlan && (
                    <View
                      style={[
                        st.currentBadge,
                        { backgroundColor: plan.color + "22", borderColor: plan.color + "44" },
                      ]}
                    >
                      <Text style={[st.currentBadgeText, { color: plan.color }]}>
                        Piano attivo
                      </Text>
                    </View>
                  )}
                </View>
                <View style={st.priceRow}>
                  <Text style={[st.price, { color: colors.foreground }]}>
                    {storePrices[plan.id] ?? plan.price}
                  </Text>
                  <Text style={[st.period, { color: colors.mutedForeground }]}>
                    {plan.period}
                  </Text>
                </View>
              </View>

              {/* Features */}
              <View style={st.featureList}>
                {plan.features.map((feat) => (
                  <CheckRow key={feat} text={feat} color={plan.color} />
                ))}
              </View>

              {/* CTA */}
              {plan.cta && isUpgrade && (
                <Pressable
                  style={({ pressed }) => [
                    st.cta,
                    {
                      backgroundColor: plan.color,
                      opacity: pressed || isPurchasing ? 0.75 : 1,
                    },
                  ]}
                  onPress={() => triggerPurchase(plan.id as "premium" | "pro")}
                  disabled={isPurchasing}
                >
                  {isPurchasing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={st.ctaText}>
                      {`Upgrade a ${plan.name} — ${storePrices[plan.id] ?? plan.price}`}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Legal disclaimer */}
        <Text style={[st.disclaimer, { color: colors.mutedForeground }]}>
          Gli abbonamenti si rinnovano automaticamente. Puoi annullare in qualsiasi
          momento dalle impostazioni del tuo dispositivo (Impostazioni → Apple ID →
          Abbonamenti su iOS, Google Play → Abbonamenti su Android).
        </Text>
      </ScrollView>
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  scroll: { padding: 20, gap: 16 },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  cardHeader: { gap: 6 },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  planName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  currentBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  currentBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  price: { fontSize: 28, fontFamily: "Inter_700Bold" },
  period: { fontSize: 14, fontFamily: "Inter_400Regular" },
  featureList: { gap: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  cta: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  ctaText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});

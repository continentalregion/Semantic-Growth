import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Platform,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGetMyRecommendations, useGetMyProfile } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { TierGate } from "./explore/components/TierGate";
import ReanimatedAnimated, { FadeIn } from "react-native-reanimated";
import { useStagedReveal } from "@/hooks/useStagedReveal";
import { StaggeredItem } from "@/components/ui/StaggeredItem";
import { SkeletonListCard } from "@/components/ui/SkeletonBox";

type Category = "reasoning" | "interdisciplinary" | "abstraction" | "domain" | "conceptual";

const CATEGORY_CONFIG: Record<Category, { icon: string; label: string; color: string }> = {
  reasoning:        { icon: "🧠", label: "Ragionamento",     color: palette.violet },
  interdisciplinary:{ icon: "🔗", label: "Interdisciplinare",color: palette.cyan },
  abstraction:      { icon: "⬆️",  label: "Astrazione",       color: palette.primaryLight },
  domain:           { icon: "📚", label: "Dominio",           color: palette.warning },
  conceptual:       { icon: "💡", label: "Concettuale",       color: palette.teal },
};

const DEFAULT_CAT = { icon: "✦", label: "Crescita", color: palette.primary };

function getCat(cat: string) {
  return CATEGORY_CONFIG[cat as Category] ?? DEFAULT_CAT;
}

function RecCard({
  item,
  colors,
}: {
  item: { id: number; category: string; content: string; estimatedSgiGain?: number | null; createdAt: string };
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const { t } = useTranslation();
  const cat = getCat(item.category);
  const catLabel = CATEGORY_CONFIG[item.category as Category]
    ? t(`recommendations.categories.${item.category}`)
    : t("recommendations.defaultCat");
  return (
    <View style={[cardStyles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={cardStyles.top}>
        <View style={[cardStyles.iconBox, { backgroundColor: cat.color + "18", borderColor: cat.color + "33" }]}>
          <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <View style={[cardStyles.catBadge, { backgroundColor: cat.color + "18", borderColor: cat.color + "33" }]}>
              <Text style={[cardStyles.catText, { color: cat.color }]}>{catLabel}</Text>
            </View>
            {item.estimatedSgiGain != null && item.estimatedSgiGain >= 8 && (
              <View style={[cardStyles.catBadge, { backgroundColor: palette.pink + "18", borderColor: palette.pink + "33" }]}>
                <Text style={[cardStyles.catText, { color: palette.pink }]}>{t("recommendations.highPriority")}</Text>
              </View>
            )}
          </View>
          <Markdown style={{
              body: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20, color: colors.foreground },
              strong: { fontFamily: "Inter_700Bold", color: colors.foreground },
            }}>
              {item.content}
            </Markdown>
        </View>
      </View>
      <Text style={[cardStyles.date, { color: colors.mutedForeground + "88" }]}>
        {new Date(item.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  root: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  catBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function RecommendationsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { data: profile } = useGetMyProfile();
  const isPremiumOrPro = profile?.plan === "premium" || profile?.plan === "pro";

  const { data: recs, isLoading, refetch, isRefetching } = useGetMyRecommendations({
    query: { enabled: isPremiumOrPro },
  });

  const revealReady = !isLoading && isPremiumOrPro && !!recs;
  const { phase } = useStagedReveal(revealReady, { steps: 1, minWaitMs: 1000 });
  const showSkeleton = isLoading || (isPremiumOrPro && phase === 0 && profile !== undefined);

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Ionicons name="bulb" size={20} color={palette.warning} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("nav.growthPath")}</Text>
        {recs && recs.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {recs.length}
            </Text>
          </View>
        )}
      </View>

      <TierGate requiredPlan="premium" currentPlan={profile?.plan} featureName="Recommendations" fallbackRoute="/(tabs)/explore">
        {showSkeleton ? (
          <View style={{ flex: 1, paddingTop: 16, gap: 0 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonListCard key={i} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }} />
            ))}
          </View>
        ) : !recs || recs.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Ionicons name="bulb-outline" size={48} color={colors.border} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 18 }}>
            {t("recommendations.noRecsTitle")}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingHorizontal: 40 }}>
            {t("recommendations.noRecs")}
          </Text>
        </View>
      ) : (
          <ReanimatedAnimated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
          <FlatList
            data={recs}
            keyExtractor={r => String(r.id)}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: tabBarHeight + 16 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
                {t("recommendations.pathHeader", { count: recs.length })}
              </Text>
            }
            renderItem={({ item, index }) => (
              <StaggeredItem index={index} stepDelay={40}>
                <RecCard item={item} colors={colors} />
              </StaggeredItem>
            )}
          />
          </ReanimatedAnimated.View>
        )}
      </TierGate>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingTop: 2, paddingRight: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surface3,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  countBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  listHeader: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
});

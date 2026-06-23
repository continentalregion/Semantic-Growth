import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";

type TileColor = "gold" | "teal" | "primary" | "pink";

const TILES: {
  route: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titleKey: string;
  descKey: string;
  color: TileColor;
}[] = [
  {
    route: "/(tabs)/explore/rank",
    icon: "trophy-outline",
    titleKey: "nav.rank",
    descKey: "explore.rankDesc",
    color: "gold",
  },
  {
    route: "/(tabs)/explore/map",
    icon: "globe-outline",
    titleKey: "nav.map",
    descKey: "explore.mapDesc",
    color: "teal",
  },
  {
    route: "/(tabs)/explore/predictions",
    icon: "telescope-outline",
    titleKey: "nav.predictions",
    descKey: "explore.predictionsDesc",
    color: "primary",
  },
  {
    route: "/(tabs)/explore/growth",
    icon: "trending-up-outline",
    titleKey: "nav.growthPath",
    descKey: "explore.growthDesc",
    color: "pink",
  },
  {
    route: "/(tabs)/explore/progress",
    icon: "medal-outline",
    titleKey: "nav.progress",
    descKey: "explore.progressDesc",
    color: "teal",
  },
];

export default function ExploreHubScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("nav.explore")}
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {t("explore.hubSubtitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: colors.spacing.lg,
          paddingBottom:
            (Platform.OS === "web" ? 34 : tabBarHeight) + colors.spacing.xl,
          gap: colors.spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {TILES.map((tile) => {
          const tileColor: string =
            (colors as Record<string, unknown>)[tile.color] as string ??
            colors.primary;
          return (
            <Pressable
              key={tile.route}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
              onPress={() => router.push(tile.route as never)}
            >
              <View
                style={[
                  styles.tileIcon,
                  {
                    backgroundColor: tileColor + "18",
                    borderColor: tileColor + "30",
                  },
                ]}
              >
                <Ionicons name={tile.icon} size={24} color={tileColor} />
              </View>
              <View style={styles.tileText}>
                <Text style={[styles.tileTitle, { color: colors.foreground }]}>
                  {t(tile.titleKey)}
                </Text>
                <Text
                  style={[styles.tileDesc, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {t(tile.descKey)}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 2,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  tile: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { flex: 1, gap: 2 },
  tileTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tileDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

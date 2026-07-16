import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";

const ADMIN_EMAILS = ["francescoullo1@gmail.com"];

type TileColor = "gold" | "teal" | "primary" | "pink";
type TileSection = "arena" | "insight" | "identity";

const TILES: {
  route: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titleKey: string;
  descKey: string;
  color: TileColor;
  section: TileSection;
}[] = [
  {
    route: "/(tabs)/leaderboard",
    icon: "trophy-outline",
    titleKey: "nav.rank",
    descKey: "explore.rankDesc",
    color: "gold",
    section: "arena",
  },
  {
    route: "/(tabs)/explore/verdict",
    icon: "analytics-outline",
    titleKey: "nav.verdict",
    descKey: "explore.verdictDesc",
    color: "primary",
    section: "insight",
  },
  {
    route: "/(tabs)/explore/predictions",
    icon: "telescope-outline",
    titleKey: "nav.predictions",
    descKey: "explore.predictionsDesc",
    color: "primary",
    section: "insight",
  },
  {
    route: "/(tabs)/recommendations",
    icon: "trending-up-outline",
    titleKey: "nav.growthPath",
    descKey: "explore.growthDesc",
    color: "pink",
    section: "insight",
  },
  {
    route: "/(tabs)/explore/progress",
    icon: "medal-outline",
    titleKey: "nav.progress",
    descKey: "explore.progressDesc",
    color: "teal",
    section: "insight",
  },
  {
    route: "/(tabs)/explore/map",
    icon: "globe-outline",
    titleKey: "nav.map",
    descKey: "explore.mapDesc",
    color: "teal",
    section: "insight",
  },
  {
    route: "/(tabs)/explore/context-file",
    icon: "person-circle-outline",
    titleKey: "nav.contextFile",
    descKey: "explore.contextFileDesc",
    color: "primary",
    section: "identity",
  },
];

const SECTIONS: { key: TileSection; labelKey: string }[] = [
  { key: "arena", labelKey: "explore.sectionArena" },
  { key: "insight", labelKey: "explore.sectionInsight" },
  { key: "identity", labelKey: "explore.sectionIdentity" },
];

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

export default function ExploreHubScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

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
          gap: colors.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map(({ key, labelKey }) => {
          const sectionTiles = TILES.filter((tile) => tile.section === key);
          return (
            <View key={key} style={{ gap: colors.spacing.md }}>
              <SectionHeader title={t(labelKey)} />
              {sectionTiles.map((tile) => {
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
            </View>
          );
        })}

        {isAdmin && (
          <Pressable
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: colors.card,
                borderColor: colors.pink + "44",
                opacity: pressed ? 0.72 : 1,
              },
            ]}
            onPress={() => router.push("/(tabs)/explore/admin" as never)}
          >
            <View
              style={[
                styles.tileIcon,
                {
                  backgroundColor: colors.pink + "18",
                  borderColor: colors.pink + "30",
                },
              ]}
            >
              <Ionicons name="pulse-outline" size={24} color={colors.pink} />
            </View>
            <View style={styles.tileText}>
              <Text style={[styles.tileTitle, { color: colors.foreground }]}>
                Admin Monitor
              </Text>
              <Text
                style={[styles.tileDesc, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                Utenti, MRR, messaggi, errori e modelli in tempo reale
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        )}
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
  sectionHeader: { marginBottom: 2 },
  sectionHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
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

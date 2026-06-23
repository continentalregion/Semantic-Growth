import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";

export default function MapScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("nav.map")}
        </Text>
      </View>
      <View style={styles.center}>
        <Ionicons
          name="globe-outline"
          size={56}
          color={colors.primary}
          style={{ opacity: 0.3 }}
        />
        <Text style={[styles.soon, { color: colors.mutedForeground }]}>
          {t("explore.comingSoon")}
        </Text>
      </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  soon: { fontSize: 14, fontFamily: "Inter_500Medium" },
});

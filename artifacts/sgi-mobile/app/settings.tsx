import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { router } from "expo-router";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { setLanguage } from "@/i18n";

type LangCode = "it" | "en" | "es";

const LANGUAGES: { code: LangCode; label: string; flag: string }[] = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [changing, setChanging] = useState(false);
  const { data: profile } = useGetMyProfile();

  async function handleSetLanguage(code: LangCode) {
    if (changing || code === i18n.language) return;
    setChanging(true);
    await setLanguage(code);
    setChanging(false);
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("settings.title")}
        </Text>
      </View>

      {/* Content */}
      <View style={{ padding: 20, gap: 20 }}>
        {/* Language selector */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="language-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("settings.language")}
            </Text>
          </View>
          <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
            {t("settings.chooseLanguage")}
          </Text>

          <View style={styles.langList}>
            {LANGUAGES.map((lang) => {
              const active = i18n.language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  style={[
                    styles.langBtn,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active
                        ? colors.primary + "15"
                        : colors.background,
                      opacity: changing && !active ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => handleSetLanguage(lang.code)}
                  disabled={changing}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.langLabel,
                      {
                        color: active ? colors.primary : colors.foreground,
                        fontFamily: active
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                      },
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Plan / upgrade section */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Piano attivo
            </Text>
            <View
              style={{
                marginLeft: "auto",
                backgroundColor: colors.primary + "18",
                borderColor: colors.primary + "33",
                borderWidth: 1,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "capitalize" }}>
                {profile?.plan ?? "free"}
              </Text>
            </View>
          </View>
          {profile?.plan === "free" && (
            <Pressable
              style={({ pressed }) => [
                styles.legalRow,
                {
                  borderColor: colors.primary + "44",
                  backgroundColor: colors.primary + "0d",
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => router.push("/upgrade")}
            >
              <Ionicons name="trending-up" size={16} color={colors.primary} />
              <Text style={[styles.legalLabel, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                Upgrade a Premium o Pro
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          )}
          {(profile?.plan === "premium" || profile?.plan === "pro") &&
            (profile?.planSource === "manual" ? (
              <View
                style={[
                  styles.legalRow,
                  { borderColor: colors.border, opacity: 1 },
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[styles.legalLabel, { color: colors.foreground }]}>
                  Piano Pro
                </Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.legalRow,
                  { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => router.push("/upgrade")}
              >
                <Text style={[styles.legalLabel, { color: colors.foreground }]}>
                  Gestisci piano
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
        </View>

        {/* Legal section */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("settings.legalSection")}
            </Text>
          </View>

          <Pressable
            style={[styles.legalRow, { borderColor: colors.border }]}
            onPress={() => Linking.openURL("https://sgindex.work/privacy-policy")}
          >
            <Text style={[styles.legalLabel, { color: colors.foreground }]}>
              {t("settings.privacyPolicy")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            style={[styles.legalRow, { borderColor: colors.border }]}
            onPress={() => Linking.openURL("https://sgindex.work/terms")}
          >
            <Text style={[styles.legalLabel, { color: colors.foreground }]}>
              {t("settings.termsOfService")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  langList: { gap: 8 },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  flag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 14 },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  legalLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
});

import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";

export function ScreenErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 12 }}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16, textAlign: "center" }}>
        {t("common.errorTitle")}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
        {t("common.errorDesc")}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{ marginTop: 8, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 }}
      >
        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
          {t("common.retryBtn")}
        </Text>
      </Pressable>
    </View>
  );
}

import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useGetMyRecommendations } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { palette } from "@/constants/theme";

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
  item: { id: number; category: string; title: string; description: string; priority?: number; createdAt: string };
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const cat = getCat(item.category);
  return (
    <View style={[cardStyles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={cardStyles.top}>
        <View style={[cardStyles.iconBox, { backgroundColor: cat.color + "18", borderColor: cat.color + "33" }]}>
          <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <View style={[cardStyles.catBadge, { backgroundColor: cat.color + "18", borderColor: cat.color + "33" }]}>
              <Text style={[cardStyles.catText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            {item.priority != null && item.priority >= 8 && (
              <View style={[cardStyles.catBadge, { backgroundColor: palette.pink + "18", borderColor: palette.pink + "33" }]}>
                <Text style={[cardStyles.catText, { color: palette.pink }]}>Alta priorità</Text>
              </View>
            )}
          </View>
          <Text style={[cardStyles.title, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </View>
      {item.description ? (
        <Text style={[cardStyles.desc, { color: colors.mutedForeground }]} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}
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
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { data: recs, isLoading, error, refetch, isRefetching } = useGetMyRecommendations();

  const isPremiumLocked =
    (error as { status?: number } | null)?.status === 403 ||
    (error as { response?: { status: number } } | null)?.response?.status === 403;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <Ionicons name="bulb" size={20} color={palette.warning} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Raccomandazioni</Text>
        {recs && recs.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {recs.length}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isPremiumLocked ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="lock-closed" size={28} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" }}>
            Funzione Premium
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            Le raccomandazioni personalizzate per la crescita semantica sono disponibili con il piano Premium o Pro.
          </Text>
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 14,
              marginTop: 8,
            }}
          >
            <Text style={{ color: palette.primaryFg, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              Aggiorna il piano →
            </Text>
          </View>
        </View>
      ) : !recs || recs.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Ionicons name="bulb-outline" size={48} color={colors.border} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 18 }}>
            Nessuna raccomandazione
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingHorizontal: 40 }}>
            Chatta di più per ricevere suggerimenti personalizzati sulla tua crescita semantica
          </Text>
        </View>
      ) : (
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
              Percorso di crescita personalizzato · {recs.length} suggeriment{recs.length === 1 ? "o" : "i"}
            </Text>
          }
          renderItem={({ item }) => <RecCard item={item} colors={colors} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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

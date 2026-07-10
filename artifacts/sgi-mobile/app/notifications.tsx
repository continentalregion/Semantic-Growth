import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotifications,
  useMarkNotificationRead,
  getGetNotificationsQueryKey,
  getGetNotificationsUnreadCountQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  badge: "ribbon",
  battle_result: "flash",
  streak_risk: "flame",
  digest: "sparkles",
};

function timeAgo(iso: string, t: any): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

function NotificationRow({
  item, colors, t, onPress,
}: {
  item: Notification;
  colors: ReturnType<typeof useColors>;
  t: any;
  onPress: () => void;
}) {
  const title = t(item.titleKey, item.bodyParams ?? {});
  const body = t(item.bodyKey, item.bodyParams ?? {});
  const icon = TYPE_ICON[item.type] ?? "notifications";
  const accent = item.type === "streak_risk"
    ? colors.destructive
    : item.type === "battle_result"
      ? colors.pink
      : item.type === "badge"
        ? colors.gold
        : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        st.row,
        {
          backgroundColor: item.read ? colors.background : colors.card,
          borderColor: colors.border,
        },
      ]}
      testID={`notification-row-${item.id}`}
    >
      <View style={[st.iconWrap, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!item.read && <View style={[st.dot, { backgroundColor: colors.primary }]} />}
          <Text
            style={[st.title, { color: colors.foreground, fontFamily: colors.font.family.semibold }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <Text style={[st.body, { color: colors.mutedForeground }]} numberOfLines={2}>
          {body}
        </Text>
      </View>
      <Text style={[st.time, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt, t)}</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useGetNotifications({});
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetNotificationsUnreadCountQueryKey() });
      },
    },
  });

  const items = useMemo(() => data?.notifications ?? [], [data]);
  const hasUnread = items.some(n => !n.read);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function handlePress(item: Notification) {
    if (!item.read) markRead.mutate({ id: item.id });
    if (item.deepLink) {
      try {
        router.push(item.deepLink as never);
      } catch {
        // deep link may not resolve to a known route (e.g. old/removed match) — ignore
      }
    }
  }

  function handleMarkAllRead() {
    for (const item of items) {
      if (!item.read) markRead.mutate({ id: item.id });
    }
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          st.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={st.backBtn} testID="notifications-back-btn">
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>{t("notifications.title")}</Text>
        {hasUnread ? (
          <Pressable onPress={handleMarkAllRead} style={st.markAllBtn} testID="notifications-mark-all-read">
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: colors.font.family.medium }}>
              {t("notifications.markAllRead")}
            </Text>
          </Pressable>
        ) : (
          <View style={st.markAllBtn} />
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <SkeletonBox key={i} height={64} borderRadius={14} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={st.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.mutedForeground} />
          <Text style={[st.emptyTitle, { color: colors.foreground }]}>{t("notifications.empty")}</Text>
          <Text style={[st.emptyDesc, { color: colors.mutedForeground }]}>{t("notifications.emptyDesc")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <NotificationRow item={item} colors={colors} t={t} onPress={() => handlePress(item)} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  markAllBtn: { minWidth: 40, padding: 4, alignItems: "flex-end" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  title: { fontSize: 14 },
  body: { fontSize: 12.5, lineHeight: 17 },
  time: { fontSize: 11, alignSelf: "flex-start" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});

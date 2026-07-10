import { useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotifications,
  useMarkNotificationRead,
  getGetNotificationsQueryKey,
  getGetNotificationsUnreadCountQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, BellOff, Award, Swords, Flame, Sparkles, Bell, MessageCircleQuestion } from "lucide-react";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  badge: Award,
  battle_result: Swords,
  streak_risk: Flame,
  digest: Sparkles,
  thread_candidate: MessageCircleQuestion,
};

const TYPE_COLOR: Record<string, string> = {
  badge: "var(--sgi-gold, #b8860b)",
  battle_result: "var(--sgi-pink)",
  streak_risk: "var(--sgi-pink)",
  digest: "var(--sgi-purple)",
  thread_candidate: "var(--sgi-teal, #06d6a0)",
};

function timeAgo(iso: string, t: (k: string, opts?: any) => string): string {
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
  item, onPress, t,
}: {
  item: Notification;
  onPress: () => void;
  t: (k: string, opts?: any) => string;
}) {
  const title = t(item.titleKey, item.bodyParams ?? {});
  const body = t(item.bodyKey, item.bodyParams ?? {});
  const Icon = TYPE_ICON[item.type] ?? Bell;
  const accent = TYPE_COLOR[item.type] ?? "var(--sgi-purple)";

  return (
    <button
      onClick={onPress}
      className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors"
      style={{
        background: item.read ? "transparent" : "hsl(var(--sidebar-accent))",
        border: "1px solid hsl(var(--sidebar-border))",
      }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: `${accent}22` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {!item.read && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--sgi-purple)" }} />
          )}
          <span className="text-[13.5px] font-semibold text-foreground truncate">{title}</span>
        </div>
        <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "hsl(var(--muted-foreground))" }}>
          {body}
        </p>
      </div>
      <span className="text-[10.5px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
        {timeAgo(item.createdAt, t)}
      </span>
    </button>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetNotifications({});
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetNotificationsUnreadCountQueryKey() });
      },
    },
  });

  const items = useMemo(() => data?.notifications ?? [], [data]);
  const hasUnread = items.some((n) => !n.read);

  function handlePress(item: Notification) {
    if (!item.read) markRead.mutate({ id: item.id });
    if (item.deepLink) navigate(item.deepLink);
  }

  function handleMarkAllRead() {
    for (const item of items) {
      if (!item.read) markRead.mutate({ id: item.id });
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 font-display text-[18px] font-semibold text-foreground">
          {t("notifications.title")}
        </h1>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="text-[12px] font-medium"
            style={{ color: "var(--sgi-purple)" }}
          >
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[64px] w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <BellOff className="w-9 h-9" style={{ color: "hsl(var(--muted-foreground))" }} />
          <p className="text-[15px] font-semibold text-foreground">{t("notifications.empty")}</p>
          <p className="text-[13px] max-w-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("notifications.emptyDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} t={t} onPress={() => handlePress(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

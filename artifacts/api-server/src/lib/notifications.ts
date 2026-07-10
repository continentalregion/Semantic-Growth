import { db } from "@workspace/db";
import { notifications } from "@workspace/db";

export type NotificationType = "digest" | "badge" | "battle_result" | "streak_risk";

export async function createNotification(params: {
  userId: number;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  deepLink?: string;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    titleKey: params.titleKey,
    bodyKey: params.bodyKey,
    bodyParams: params.bodyParams ?? null,
    payload: params.payload ?? null,
    deepLink: params.deepLink ?? null,
  });
}

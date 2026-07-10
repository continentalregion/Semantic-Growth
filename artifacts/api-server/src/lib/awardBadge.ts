import { db } from "@workspace/db";
import { badges } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createNotification } from "./notifications";

// Single entry point for granting a badge: inserts the badge row (idempotent —
// callers are responsible for checking eligibility beforehand, this guards
// against double-award races) and writes the corresponding notification in
// the same place, so no badge-award call site can forget to notify the user.
export async function awardBadge(userId: number, badgeKey: string): Promise<boolean> {
  const existing = await db.select({ id: badges.id }).from(badges)
    .where(and(eq(badges.userId, userId), eq(badges.badgeKey, badgeKey))).limit(1);
  if (existing.length > 0) return false;

  await db.insert(badges).values({ userId, badgeKey }).onConflictDoNothing();

  await createNotification({
    userId,
    type: "badge",
    titleKey: "notifications.badge.title",
    bodyKey: "notifications.badge.body",
    bodyParams: { badgeKey },
    payload: { badgeKey },
    deepLink: "/gamification",
  });

  return true;
}

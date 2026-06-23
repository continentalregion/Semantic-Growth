import { db } from "@workspace/db";
import { users, gamification, missions, recommendations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { updateLeaderboardRank } from "../routes/users";

const CLERK_BAPI = "https://api.clerk.com/v1";

type DbUser = typeof users.$inferSelect;

async function fetchClerkEmail(clerkId: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  try {
    const r = await fetch(`${CLERK_BAPI}/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!r.ok) return null;
    const data = await r.json() as {
      email_addresses?: Array<{ email_address: string; id: string }>;
      primary_email_address_id?: string;
    };
    const primary = data.email_addresses?.find(e => e.id === data.primary_email_address_id);
    return primary?.email_address ?? data.email_addresses?.[0]?.email_address ?? null;
  } catch {
    return null;
  }
}

// getOrCreateUser: Returns the DB user for a given Clerk ID, auto-creating them
// if they signed up via Clerk (e.g. via BFF / mobile OAuth) but never called POST /api/users/me.
export async function getOrCreateUser(clerkId: string): Promise<DbUser | null> {
  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (existing) return existing;

  // User not yet in DB — auto-register using Clerk Admin API for email
  const email = await fetchClerkEmail(clerkId);
  if (!email) {
    // Can't register without email — fall back to placeholder
    console.warn(`[getOrCreateUser] could not fetch email for clerkId=${clerkId}`);
  }

  try {
    const [newUser] = await db
      .insert(users)
      .values({ clerkId, email: email ?? `${clerkId}@clerk.local`, plan: "free", sgiScore: 0 })
      .returning();
    if (!newUser) return null;

    await db.insert(gamification)
      .values({ userId: newUser.id, xp: 0, level: 1, streak: 0 })
      .onConflictDoNothing();

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(missions).values([
      { userId: newUser.id, type: "weekly", title: "First Steps", description: "Have 3 conversations", progress: 0, target: 3, completed: 0, expiresAt: nextWeek },
      { userId: newUser.id, type: "weekly", title: "Deep Thinker", description: "Achieve a reasoning depth score of 7+", progress: 0, target: 1, completed: 0, expiresAt: nextWeek },
    ]);

    await updateLeaderboardRank(newUser.id);

    console.info(`[getOrCreateUser] auto-registered clerkId=${clerkId} email=${email}`);
    return newUser;
  } catch (err) {
    console.error("[getOrCreateUser] failed:", err);
    return null;
  }
}

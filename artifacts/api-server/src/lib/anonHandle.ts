/**
 * Anonymous, persistent per-user display handle — derived from the numeric
 * `users.id` primary key, NEVER from email. Same convention already used for
 * the leaderboard (users.ts / leaderboard.ts `displayName`).
 *
 * Using the numeric id keeps the handle stable across a user's lifetime
 * without storing or exposing any PII on public, auth-less endpoints
 * (GET /threads, progress-cards, battle-cards, OG images).
 */
export function anonHandle(userId: number): string {
  return `User_${userId.toString().padStart(6, "0")}`;
}

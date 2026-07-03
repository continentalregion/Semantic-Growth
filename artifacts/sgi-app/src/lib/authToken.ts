import { toast } from "sonner";

interface GetTokenOptions {
  skipCache?: boolean;
}
type GetTokenFn = (options?: GetTokenOptions) => Promise<string | null>;

interface RetryOptions {
  /** Extra attempts after the first (default 2, so up to 3 total tries). */
  retries?: number;
  /** Max time to wait for a single getToken() call before treating it as failed. */
  timeoutMs?: number;
  /** Base delay between retries, multiplied by attempt number (backoff). */
  retryDelayMs?: number;
}

function raceTimeout(promise: Promise<string | null>, timeoutMs: number): Promise<string | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Wraps Clerk's getToken() with a timeout + automatic retry.
 *
 * Clerk's token can be momentarily unavailable (slow network, just-loaded tab)
 * or briefly stale/expired right after it's been cached. A single null/expired
 * result should NOT be treated as "logged out" — it silently turns into a
 * ghost 401 otherwise. First attempt uses Clerk's cache (fast path); retries
 * force `skipCache: true` so a stale/expired cached token gets refreshed
 * instead of being retried as-is. Returns null only once every attempt fails.
 */
export async function getTokenWithRetry(
  getToken: GetTokenFn,
  options: RetryOptions = {},
): Promise<string | null> {
  const { retries = 2, timeoutMs = 4000, retryDelayMs = 500 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let token: string | null = null;
    try {
      token = await raceTimeout(getToken(attempt === 0 ? undefined : { skipCache: true }), timeoutMs);
    } catch {
      token = null;
    }
    if (token) return token;
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }
  return null;
}

let lastSessionExpiredToastAt = 0;
const SESSION_EXPIRED_TOAST_COOLDOWN_MS = 20_000;

/**
 * Shows a clear, actionable "session expired" toast with a reload button,
 * instead of letting an auth failure look like a dead click. Debounced so
 * background polling (usage counter, progress cards, etc.) can't spam it.
 */
export function notifySessionExpired(t: any) {
  const now = Date.now();
  if (now - lastSessionExpiredToastAt < SESSION_EXPIRED_TOAST_COOLDOWN_MS) return;
  lastSessionExpiredToastAt = now;

  toast.error(t("common.sessionExpiredTitle", "Sessione scaduta"), {
    description: t("common.sessionExpiredDesc", "Ricarica la pagina per continuare."),
    action: {
      label: t("common.reloadBtn", "Ricarica"),
      onClick: () => window.location.reload(),
    },
    duration: 15_000,
  });
}

import { useEffect, useRef, useState } from "react";

interface StagedRevealOptions {
  steps: number;
  minWaitMs?: number;
  stepDelayMs?: number;
}

/**
 * Returns a `phase` counter (0 → steps) that increments once per step.
 * Starts only after `ready` becomes true and an optional minimum wait has
 * elapsed from mount time. Use phase-gated conditional rendering combined
 * with Reanimated `entering` props for staggered content reveals.
 *
 * Budget guide:
 *   Insight screens (AI data): minWaitMs=1200, stepDelayMs=600  → 2.5-4s total
 *   Thread list   (DB data):   minWaitMs=500,  stepDelayMs=0    → 0.8-1.5s total
 */
export function useStagedReveal(
  ready: boolean,
  { steps, minWaitMs = 1200, stepDelayMs = 500 }: StagedRevealOptions
): { phase: number } {
  const [phase, setPhase] = useState(0);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(0, minWaitMs - elapsed);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < steps; i++) {
      const delay = wait + i * stepDelayMs;
      const idx = i;
      timers.push(
        setTimeout(() => setPhase(idx + 1), delay)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [ready]);

  return { phase };
}

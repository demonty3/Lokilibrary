/**
 * Phase 5B — sleep-mode background reflection sweep.
 *
 * When the throttle pipeline enters the `'sleeping'` state (user
 * idle > 10 min, no fullscreen app), App.tsx schedules ONE pass of
 * this sweep after a short grace period. Each present agent with
 * `reflectionCounter > 0` gets a Tier-2 dispatch with the
 * per-real-hour rate-limit bypassed — this IS the once-per-sleep
 * moment the rate-limit was holding capacity for.
 *
 * Reflection texts the sweep produces are buffered in a module-local
 * array; the renderer reads them on wake (SLEEPING → FULL transition)
 * and surfaces them as the "morning dispatch" terminal banner. The
 * actual `plan` rows the reflection produces land in the memory
 * store as usual (Phase 5A path) — agents resume executing them
 * when the renderer ticker comes back up.
 *
 * Why not "tick continuously during sleep"? Two reasons: (1) the
 * PIXI ticker is fully stopped during SLEEPING, so the cohort tick
 * loop doesn't fire; (2) cost discipline — one reflection per agent
 * per sleep session is the natural cadence for the morning-dispatch
 * artifact, vs. burning multiple Sonnet calls per agent overnight.
 * If a future slice wants overnight cadence ("the agent did 5
 * different things while you slept"), it lives in a setInterval
 * here rather than the PIXI ticker.
 */

import { COHORT } from './cohort';
import { defaultAgentTransport, nullMemoryWriter, routeTier2 } from './router';
import { getCurrentMemoryWriter } from './memory/bootstrap';
import { buildLibraryContext } from './library-context';
import { listRuntimesIn } from '../state/agentRuntime';
import { listCellPaneScopes } from '../state/cellPaneScopes';
import { useAppStore } from '../state/store';

/** Reflection texts produced during the current sleep session,
 *  buffered for the morning-dispatch overlay to consume. Cleared by
 *  `consumeSleepReflections()` after the renderer displays them. */
const sleepReflectionsSinceWake: Array<{
  agentId: string;
  agentName: string;
  text: string;
  hadPlan: boolean;
}> = [];

/** Drain + return the buffered sleep reflections. The morning-dispatch
 *  overlay calls this on SLEEPING → FULL transition. After this
 *  returns, the buffer is empty; the next sleep entry can start fresh. */
export function consumeSleepReflections(): ReadonlyArray<{
  agentId: string;
  agentName: string;
  text: string;
  hadPlan: boolean;
}> {
  const out = sleepReflectionsSinceWake.slice();
  sleepReflectionsSinceWake.length = 0;
  return out;
}

/** Snapshot for diagnostics — doesn't drain. */
export function peekSleepReflections(): ReadonlyArray<{ agentId: string; text: string }> {
  return sleepReflectionsSinceWake.map((r) => ({ agentId: r.agentId, text: r.text }));
}

/** Fire the sleep reflection sweep. Iterates every PRESENT agent across
 *  the UNION of all live cell panes' runtimes (Phase 7 / v2.x — single
 *  'root' pane reduces to today's behaviour), looks up the matching
 *  `AgentDef` from COHORT, and
 *  calls `routeTier2` with `reflectionMinIntervalMs: 0` so the
 *  per-real-hour rate-limit doesn't block (this IS the budget being
 *  spent). Agents with `reflectionCounter === 0` are skipped — no
 *  recent perceptions to reflect on.
 *
 *  Fire-and-forget: returns a promise that resolves when all
 *  dispatches finish, but the caller (App.tsx throttle subscription)
 *  doesn't await it. Each agent's dispatch runs in parallel. If any
 *  fail, the rest still try (Promise.allSettled pattern). */
export async function triggerSleepReflection(): Promise<void> {
  const memory = getCurrentMemoryWriter() ?? nullMemoryWriter;
  const defsById = new Map(COHORT.map((d) => [d.id, d]));
  const now = performance.now();
  // One read for the whole sweep so every agent shares one egress policy.
  const { loreEnabled, loreQuoteEnabled } = useAppStore.getState();
  const libraryLine = buildLibraryContext(useAppStore.getState().library) ?? undefined;
  // Phase 7 / v2.x — sweep the UNION of every live cell pane's runtimes.
  // Each pane is a live world that accrued reflectionCounter overnight, so
  // every pane's agents get the once-per-sleep dispatch. With the default
  // single 'root' cell pane this is exactly that pane's runtimes →
  // byte-identical to the pre-pane-scoping `listRuntimes()` sweep.
  const candidates = listCellPaneScopes()
    .flatMap((s) => listRuntimesIn(s))
    .filter((rt) => rt.present && rt.reflectionCounter > 0);
  if (candidates.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[sleep-reflection] no candidates (no agents with reflectionCounter > 0)');
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[sleep-reflection] firing for ${candidates.length} agent(s)`);
  await Promise.allSettled(
    candidates.map(async (runtime) => {
      const def = defsById.get(runtime.id);
      if (!def) return;
      try {
        const result = await routeTier2(def, runtime, now, {
          transport: defaultAgentTransport,
          memory,
          loreEnabled,
          loreQuote: loreQuoteEnabled,
          library: libraryLine,
          // Bypass the per-real-hour rate-limit (5A). The sleep
          // budget is the user's intentional choice to spend
          // here — relaxing on this one pass is the whole point
          // of sleep mode.
          reflectionMinIntervalMs: 0,
        });
        if (result.dispatched && result.reflection) {
          sleepReflectionsSinceWake.push({
            agentId: def.id,
            agentName: def.name,
            text: result.reflection.text,
            hadPlan: result.plan !== undefined && result.plan.stepCount > 0,
          });
          // eslint-disable-next-line no-console
          console.log(
            `[sleep-reflection] ${def.name} reflected (${result.plan?.stepCount ?? 0} plan steps)`,
          );
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[sleep-reflection] ${def.name} failed:`, (e as Error).message);
      }
    }),
  );
}

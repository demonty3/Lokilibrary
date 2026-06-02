# Phase 5A — Reflection completion (rate-limit + plan output + plan execution)

**Shipped** 2026-05-28 as commit `6d9c952` on `claude/phase3-pixelart`.

## What landed

Three coupled pieces that finish what Phase 2D started:

1. **Per-agent real-hour rate-limit** on Tier-2 dispatch.
   `REFLECTION_MIN_INTERVAL_MS = 3_600_000`. `routeTier2` early-returns
   `skipReason: 'rate_limited'` when called within the interval of a
   successful dispatch. Counter NOT reset on rate-limited skip;
   `force=true` bypasses both threshold AND rate-limit.

2. **Reflection emits a plan**. Worker `/api/agent/reflect` prompt
   extended to also emit a `plan` field with steps from the 5-verb
   whitelist (`move_to | inspect | place_mark | linger | withdraw`).
   Worker validates: caps to 5 steps, whitelists verbs, clamps
   locations to the 24×16 room. Router parses, calls
   `memory.recordPlan({status: 'active'})`, sets `runtime.activePlan`
   + `runtime.activePlanStepIndex = 0`.

3. **Tier-0 BT executes plan steps**. New candidate inserted between
   intent-approach (0.7) and schedule rules: `{score: 0.75, action,
   source: 'plan-step'}`. `planStepToAction` maps step kinds to
   existing Tier-0 primitives. `tryAdvancePlanStep` at top of
   tickBehavior advances location-bearing steps on arrival;
   no-location steps advance via post-pick handler (else they'd be
   skipped before execution).

Plan completion clears `runtime.activePlan` so the BT falls back to
wander/idle/schedule until the next Tier-2 dispatch.

## What surprised me

- **The advancement race**. My first cut had `tryAdvancePlanStep`
  auto-advancing no-location steps before the BT could pick them, so
  linger/withdraw steps were silently skipped. Fix: split the logic.
  Location-bearing steps advance in `tryAdvancePlanStep` (BEFORE
  pick, on arrival). No-location steps advance in a post-pick handler
  (AFTER the action was chosen + executed). Tagged the plan-step
  candidate with `source: 'plan-step'` so the post-pick can detect
  it. Worked first try after the refactor.

- **Multi-advancement per tick**. A multi-step plan where the agent
  is already at the location of the first step can race through 2+
  steps in a single tick (tryAdvance fires, picks step N+1, post-pick
  fires for no-location step → skips to N+2). Verified in smoke; not
  a bug, just emergent. Means a 3-step plan completes in 1-2 visible
  ticks if the agent's path is short.

- **Marginalia rendering surface unchanged**. cell.ts:179 already
  reads place_marks at mount via Phase 2E. 5A's reflection-driven
  place_mark steps land in the same DB rows, so they appear on next
  cell mount automatically. Live refresh during a session is a
  follow-up if needed.

- **Cost math is comfortably under target**. 5 agents × 12 wake hours
  × 30 days = 1800 Sonnet calls/month ≈ $0.30/month at Sonnet 4.6
  rates. CLAUDE.md ≤$1/user/month target has ~3× headroom for sleep
  mode (5B) to add overnight reflections.

## What's deferred

- **Live marginalia refresh** (place_mark from a reflection becomes
  visible the instant the agent arrives, not at next cell mount).
  Cosmetic. The DB rows persist; cell remount picks them up.
- **Plan step deduplication / dedup with active plan**. If two
  reflections in the same hour both pick the same target, the second
  overwrites the first's plan. Not yet a problem at the per-real-hour
  rate (cap = 1 plan/hour).
- **Telemetry per-real-hour bucket** for verifying the rate-limit is
  doing its job. Phase 2F overlay shows aggregate cost; doesn't yet
  bucket by hour. Tagged for sleep mode (5B) work.

## What the user verified (PENDING)

5A is freshly shipped; user verification on Windows pending. The plan
calls out this is the moment to fill in Phase 2 retro's aesthetic
question (`___` items in RETROS/phase-2.md). After ~15 min of
wallpaper-active time:
- PowerShell shows `[router] tier2 loki ... dispatched, plan_steps=N`
- Loki visibly walks to a specific cell rather than just wandering
- `sqlite3 ...memory.sqlite "SELECT kind, json_extract(payload_json,
  '$.text') FROM memories WHERE kind='plan' ORDER BY created_at DESC
  LIMIT 5"` returns recent reflection-driven plans

## Files

- `src/state/agentRuntime.ts` — `lastReflectionAt`, `activePlan`,
  `activePlanStepIndex` fields
- `src/agents/router.ts` — `REFLECTION_MIN_INTERVAL_MS`, rate-limit
  branch, plan parsing + persistence, `ReflectRouteResult.plan?`,
  `ReflectRouteResult.skipReason` gains `'rate_limited'`
- `src/agents/behavior.ts` — `tryAdvancePlanStep`, plan-step
  candidate + `source` tag, post-pick advancement,
  `planStepToAction`
- `src/api/agent.ts` — `ReflectResult.plan?` optional field
- `worker/index.ts` — prompt extended for plan output, whitelist +
  validation
- `scripts/smoke-5a-reflection.mts` (new, 41 assertions) — full
  rate-limit matrix, plan persistence, BT execution + advancement,
  step-kind mapping

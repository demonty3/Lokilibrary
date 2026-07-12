/**
 * Staging smoke — `npx tsx scripts/smoke-events-stage.mts`.
 * Fake writer: catch-up walk (cap 7), first-run today-only, idempotence
 * via recorded days, note→recordPlan effect with resolved slot, move→
 * ledger + rationale mark, perception broadcast, dispatch line buffer.
 */
import { makeChecker } from './lib/smoke.ts';
import type { LibraryGame } from '../src/types.ts';

const { stageMissedDays, consumeCalendarDispatch } = await import('../src/agents/events/stage.ts');
const { nullMemoryWriter } = await import('../src/agents/router.ts');
const { eventForDay, buildLibraryFacts, dayKey, addDays } = await import('../src/procedural/calendar.ts');

const { check, report } = makeChecker('smoke events-stage');

const g = (appid: number, name: string, mins: number, state?: LibraryGame['state']): LibraryGame => ({
  appid, name, playtime_forever: mins, ...(state && { state }),
});
const GAMES: LibraryGame[] = [
  g(1, 'Hades', 91 * 60, 'loved'), g(2, 'Elden Ring', 140 * 60, 'loved'),
  g(3, 'Crusader Kings III', 210 * 60, 'dusty'), g(4, 'BG3', 80 * 60, 'dusty'),
  g(5, 'Celeste', 12 * 60, 'abandoned'), g(6, 'Hollow Knight', 30 * 60, 'abandoned'),
];
const SEED = 0xc0ffee;
const NOW = new Date(2026, 6, 12, 9, 0, 0);

function fakeWriter(initialLastDay: string | null) {
  const events: Array<{ day: string; kind: string }> = [];
  const plans: Array<{ agentId: string; text: string; steps: any[] }> = [];
  let last = initialLastDay;
  return {
    writer: {
      ...nullMemoryWriter,
      recordWorldEvent(ev: any) { events.push({ day: ev.day, kind: ev.kind }); last = ev.day; },
      lastStagedDay() { return last; },
      recordPlan(args: any) { plans.push(args); return 'plan-id'; },
    },
    events, plans,
  };
}
const runtime = { id: 'archivist', present: true, perceptionQueue: [] as any[] } as any;

// first run: today only
const fr = fakeWriter(null);
const s1 = stageMissedDays({ writer: fr.writer as any, games: GAMES, profileSeed: SEED,
  slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [runtime], now: NOW });
const todayEvent = eventForDay(dayKey(NOW), SEED, buildLibraryFacts(GAMES));
check('first run stages ≤1 day', fr.events.length <= 1);
check('first run matches pure function', (todayEvent === null) === (fr.events.length === 0));
check('summary.staged consistent', s1.staged === fr.events.length);

// catch-up: 30 days away → at most 7 walked
const far = fakeWriter(addDays(dayKey(NOW), -30));
stageMissedDays({ writer: far.writer as any, games: GAMES, profileSeed: SEED,
  slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [runtime], now: NOW });
check('catch-up cap: staged days ⊆ last 7', far.events.every((e) =>
  ['2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11','2026-07-12'].includes(e.day)));

// idempotence: already staged today → nothing new
const same = fakeWriter(dayKey(NOW));
const s3 = stageMissedDays({ writer: same.writer as any, games: GAMES, profileSeed: SEED,
  slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [runtime], now: NOW });
check('same-day rerun stages nothing', s3.staged === 0 && same.events.length === 0);

// effects: every staged event leaves a loki place_mark plan with the note
check('every event leaves a rationale mark', far.events.length === far.plans.length
  && far.plans.every((p) => p.agentId === 'loki' && p.steps[0]?.kind === 'place_mark' && typeof p.text === 'string'));

// perception: one world_event per staged event
check('perception broadcast', runtime.perceptionQueue.filter((e: any) => e.kind === 'world_event').length > 0
  || far.events.length === 0);

// dispatch buffer: line present when staged>0, drained after consume
const line = consumeCalendarDispatch();
if (far.events.length + fr.events.length > 0) {
  check('dispatch line buffered', line !== null && /changed while you were away/.test(line!.text));
} else {
  check('no events → no line', line === null);
}
check('buffer drains', consumeCalendarDispatch() === null);

// session guard: a null-ledger writer (lastStagedDay always null) called
// twice in one session stages once — no duplicate perceptions on remount
{
  const rt2 = { id: 'cat', present: true, perceptionQueue: [] as any[] } as any;
  const plans2: any[] = [];
  const noLedger = {
    ...nullMemoryWriter,
    recordPlan(args: any) { plans2.push(args); return 'p'; },
  };
  const a = stageMissedDays({ writer: noLedger as any, games: GAMES, profileSeed: SEED,
    slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [rt2], now: NOW });
  const qAfterFirst = rt2.perceptionQueue.length;
  const b = stageMissedDays({ writer: noLedger as any, games: GAMES, profileSeed: SEED,
    slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [rt2], now: NOW });
  check('session guard: second same-day call stages 0', b.staged === 0);
  check('session guard: no duplicate perceptions', rt2.perceptionQueue.length === qAfterFirst);
  check('session guard: first call behaved normally', a.staged === qAfterFirst);
}
// registration set: two panes both run on callStageNow; unregister works
{
  const { registerStageNow, callStageNow } = await import('../src/agents/events/stage.ts');
  let ran: string[] = [];
  const u1 = registerStageNow(() => ran.push('p1'));
  const u2 = registerStageNow(() => ran.push('p2'));
  check('callStageNow runs every registered pane', callStageNow() === true && ran.join(',') === 'p1,p2');
  u1();
  ran = [];
  callStageNow();
  check('unregister removes only its own', ran.join(',') === 'p2');
  u2();
  check('empty set → false', callStageNow() === false);
}

report();

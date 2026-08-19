/**
 * Marginalia on land — pure mark placement, vocab, and reveal logic.
 *
 * The wear.ts posture: no PIXI, no IPC, no wall clock; rand injected
 * (the land's runtime rng stream — renderer-side "deterministic-enough",
 * NOT the procedural PRNG; src/procedural/ is untouched). terminalLand
 * calls maybeMark at each intent re-pick as a side-effect of living —
 * deliberately NOT a new BeingIntent kind, so pickIntent's scoring
 * ladder and resumeIntent's handoff decay stay byte-identical.
 *
 * Notes are local-only: rendered and persisted on-device, never
 * egressed. The {thought} slot folds the mind's existing Tier-1 intent
 * string in — zero new AI calls; the key-free rail gets everything but
 * the garnish.
 */

/** Where a completed intent happened, for vocab + odds. */
export type MarkContextKind = 'after_crossing' | 'at_structure' | 'at_edge' | 'mid_wander';

/** Most-recent marks rendered per land (retrieval caps at 64 plan rows;
 *  this keeps the land uncluttered). */
export const MARK_RENDER_CAP = 12;
/** No new mark within this many columns of an existing one. */
export const MARK_DEDUPE_COLS = 2;
/** Per-context placement odds — marks are occasional punctuation, not
 *  confetti. at_structure/after_crossing likeliest; mid_wander the tail. */
export const MARK_CHANCE: Record<MarkContextKind, number> = {
  after_crossing: 0.45,
  at_structure: 0.5,
  at_edge: 0.3,
  mid_wander: 0.06,
};

/** Reveal: a passing being unfurls a mark's note (ambient, wallpaper-first). */
export const REVEAL_RADIUS_COLS = 1.5;
export const REVEAL_COOLDOWN_S = 60;
/** Harry, 2026-08-08: the note "flashes up on the screen". It did — 0.4 s of
 *  LINEAR ramp to full opacity is a UI toast, not something surfacing in a
 *  world. Slowed 3.5x and eased at both ends (below), so it emerges. */
export const REVEAL_FADE_S = 1.4;
export const REVEAL_HOLD_S = 4;
/** Peak opacity. Marginalia is found, not announced — it never reaches full. */
export const REVEAL_PEAK_ALPHA = 0.74;

/**
 * The reveal's opacity envelope at `t` seconds since it opened: eased in,
 * held, eased out, then 0 forever. Pure — the wear.ts posture, so the shape
 * is smokeable without PIXI (scripts/smoke-t2-marks.mts).
 *
 * Smoothstep rather than linear at both ends: a linear ramp has a corner at
 * each end, and the corner at t=0 is exactly what reads as a flash — the eye
 * catches the sudden onset of change, not the brightness.
 */
export function revealAlpha(t: number): number {
  const total = REVEAL_FADE_S + REVEAL_HOLD_S + REVEAL_FADE_S;
  if (t <= 0 || t >= total) return 0;
  const raw = t < REVEAL_FADE_S
    ? t / REVEAL_FADE_S
    : t < REVEAL_FADE_S + REVEAL_HOLD_S
      ? 1
      : (total - t) / REVEAL_FADE_S;
  return REVEAL_PEAK_ALPHA * raw * raw * (3 - 2 * raw); // smoothstep
}

/** FNV-1a of the agent id (the seamCooldownMs pattern in behavior.ts) —
 *  NOT the injected rand, so the stagger neither perturbs the rng
 *  sequence nor depends on draw count. */
function fnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Per-being mark cooldown, id-staggered into [90, 180) seconds. */
export function markCooldownS(agentId: string): number {
  const BASE_S = 90;
  const SPREAD_S = 90;
  return BASE_S + (fnv1a(agentId) % SPREAD_S);
}

export interface MarkAttempt {
  agentId: string;
  kind: MarkContextKind;
  col: number;
  /** elapsedS at the re-pick (the land's throttle-frozen clock). */
  nowS: number;
  /** elapsedS of this being's last placed mark; -Infinity if none. */
  lastMarkAtS: number;
  existingCols: readonly number[];
  /** The mind's live Tier-1 intent string ('' = none) — the garnish. */
  thought: string;
}

/** Decide whether a completed intent earns a mark. Null = no mark. */
export function maybeMark(
  rand: () => number,
  a: MarkAttempt,
): { note: string; col: number } | null {
  if (a.nowS - a.lastMarkAtS < markCooldownS(a.agentId)) return null;
  const col = Math.round(a.col);
  for (const c of a.existingCols) {
    if (Math.abs(c - col) <= MARK_DEDUPE_COLS) return null;
  }
  if (rand() >= MARK_CHANCE[a.kind]) return null;
  return { note: noteFor(a.agentId, a.kind, rand, a.thought), col };
}

/** Display row for a mark: one above the CURRENT surface at its column.
 *  The stored y is advisory — the joined-edge Hermite ramp shifts surface
 *  rows near seams, and a mark must sit on the ground as it is now. */
export function markDisplayRow(surface: readonly number[], col: number): number {
  const c = Math.min(surface.length - 1, Math.max(0, col));
  return surface[c] - 1;
}

/** First mark eligible for a reveal: cooldown passed AND a being within
 *  the radius. The caller owns the single reveal slot; while it is
 *  occupied, passes don't queue — notes stay an event. */
export function pickReveal(
  marks: ReadonlyArray<{ col: number; lastRevealAtS: number }>,
  beingCols: readonly number[],
  nowS: number,
): number | null {
  for (let i = 0; i < marks.length; i++) {
    if (nowS - marks[i].lastRevealAtS < REVEAL_COOLDOWN_S) continue;
    for (const b of beingCols) {
      if (Math.abs(b - marks[i].col) <= REVEAL_RADIUS_COLS) return i;
    }
  }
  return null;
}

/** Per-being, per-context note lines, written against each persona's
 *  [MARKS] clause (persona/loki.ts, persona/npc.ts) — deterministic
 *  paths must already be in-voice (the LAUNCH_MARK_NOTES rule). The
 *  table is total: every being × every context has plain lines.
 *  `thoughted` templates fold the mind's own words in when it has any. */
type Lines = { plain: readonly string[]; thoughted?: readonly string[] };
const VOCAB: Record<string, Record<MarkContextKind, Lines>> = {
  loki: {
    after_crossing: {
      plain: ['crossed over. the ground held.', 'new ground. same habit of checking twice.'],
      thoughted: ['came over thinking {thought}. still am.'],
    },
    at_structure: {
      plain: ['leaned here a while. the wall has opinions.', 'dog-eared this spot. it reads well.'],
      thoughted: ['stood here on {thought}. the spot agrees.'],
    },
    at_edge: {
      plain: ['watched the edge. something watched back.', 'the far side keeps its own hours. noted.'],
    },
    mid_wander: {
      plain: ['nothing here. that was the point.'],
      thoughted: ['wandered off {thought}. found this instead.'],
    },
  },
  archivist: {
    after_crossing: {
      plain: ['crossing logged. one of one this hour.', 'arrived. filed under: arrivals.'],
    },
    at_structure: {
      plain: ['four visits to this column. this makes five.', 'measured the lean of this wall. within tolerance.'],
      thoughted: ['noted at station: {thought}. counted once.'],
    },
    at_edge: {
      plain: ['edge traffic: sparse. recorded anyway.', 'watched the boundary. nothing crossed. that is also data.'],
    },
    mid_wander: {
      plain: ['surveyed between landmarks. registered: grass.'],
    },
  },
  cat: {
    after_crossing: {
      plain: ['a warm dent, fresh from the crossing.', 'fur on the threshold. the threshold started it.'],
    },
    at_structure: {
      plain: ['slept against this wall. the wall is claimed now.', 'a knocked pebble. it needed knocking.'],
    },
    at_edge: {
      plain: ['sat at the drop. judged it.', 'the edge is a shelf with no books. acceptable.'],
    },
    mid_wander: {
      plain: ['passed through. rearranged one thing. find it.'],
    },
  },
  visitor: {
    after_crossing: {
      plain: ['a bus ticket, dropped just past the seam.', 'left a folded map corner here. wrong map.'],
    },
    at_structure: {
      plain: ['initials almost carved, thought better of it.', 'a coffee ring on the step. it was cold anyway.'],
      thoughted: ['stopped here meaning {thought}. left this instead.'],
    },
    at_edge: {
      plain: ['stood here counting the far lights. lost count.', 'a pebble pocketed, a pebble put back.'],
    },
    mid_wander: {
      plain: ['dropped a receipt. nothing on it worth keeping.'],
    },
  },
  ghost: {
    after_crossing: {
      plain: ['"someone else crossed here once. it was colder then."', 'a chill that arrived with no footsteps.'],
    },
    at_structure: {
      plain: ['"this wall was leaned on, all night, years ago."', 'the stone remembers a warmer hand.'],
      thoughted: ['something meant to {thought} here. long ago.'],
    },
    at_edge: {
      plain: ['"the edge was watched before there were watchers."', 'cold gathers where the land stops.'],
    },
    mid_wander: {
      plain: ['a patch of air worth avoiding. or not.'],
    },
  },
};

/** Launcher-beat notes: what a runner leaves at the door on the way in.
 *  Its own table because a launch is not one of the ambient contexts — it
 *  always leaves a trace (maybeMark's odds + cooldown are bypassed), and
 *  the line names the game. `{game}` is the only slot. In-voice per being,
 *  same rule as VOCAB above. */
const LAUNCH_VOCAB: Record<string, readonly string[]> = {
  loki: ['gone into {game}. back when it lets me.', 'the door was open. {game} was on the other side.'],
  archivist: ['entered {game}. session logged, duration unknown.', 'departed into {game}. the desk continues without me.'],
  cat: ['went in after {game}. do not wait up.', '{game} had a warm doorway. obviously.'],
  visitor: ['ducked into {game}. borrowed the door.', 'off to {game}. left the map on the step.'],
  ghost: ['"{game} was played here before. it is being played again."', 'a cold shape passed into {game}.'],
};

/** Dungeon rung 1 — the expedition's one line above ground, in the
 *  DISPATCHING being's voice (spec bar 4: exactly one, attributed, no
 *  numerals — the outcome arrives as words). Its own table because an
 *  expedition, like a launch, is an event: odds + cooldown are bypassed.
 *  `{name}` is the only slot — the first delver who did not come back.
 *  Keys are delve.ts OutcomeKinds:
 *    rich — returned heavy; hollow — turned back with little;
 *    loss — some returned, one did not; lost — none returned. */
const EXPEDITION_VOCAB: Record<string, Record<string, readonly string[]>> = {
  loki: {
    rich: ['the delvers came up heavy. the deep was generous, this once.', 'sacks up from below. the dark paid its rent.'],
    hollow: ['the delvers turned back early. the deep kept its own counsel.', 'they came up with dust and their lives. fair trade.'],
    loss: ['the delvers came up one short. {name} stays below.', 'sent them down. the deep kept {name}.'],
    lost: ['sent a party down. the shaft has gone quiet.', 'no lamps came back up. the deep owes me nothing.'],
  },
  archivist: {
    rich: ['expedition returned. yield: considerable. filed.', 'the delvers surfaced with a full ledger. entered.'],
    hollow: ['expedition returned early. yield: negligible. noted without comment.', 'they went down, they came up. the interval is the record.'],
    loss: ['expedition returned incomplete. {name}: no further entries.', 'the roster is shorter by one. {name}, struck through gently.'],
    lost: ['expedition overdue past all margins. the file stays open.', 'nothing surfaced. the ledger holds an empty page for them.'],
  },
  cat: {
    rich: ['the small ones came up smelling of cold and metal. good.', 'watched the delvers surface, heavy and pleased with themselves.'],
    hollow: ['the small ones hurried back up. wise, probably.', 'they brought up nothing. the nothing was heavy anyway.'],
    loss: ['one warm shape fewer under the floor. {name} was the quick one.', 'the small ones came up quiet. {name} did not.'],
    lost: ['the under-floor has gone still. no one to watch now.', 'sat by the shaft a long while. nothing came up.'],
  },
  visitor: {
    rich: ['saw the delvers off, saw them back, heavier. a good day out.', 'the party came up singing something low. they earned it.'],
    hollow: ['they turned around down there. some doors are just doors.', 'the delvers came back with pockets of grit. souvenirs, of a kind.'],
    loss: ['walked them to the shaft. {name} is still down there.', 'the party came up missing {name}. left a pebble at the mouth.'],
    lost: ['waved a party down. kept waiting at the mouth. still waiting.', 'the shaft took the whole party. the mouth looks smaller now.'],
  },
  ghost: {
    rich: ['"they came up laden. the deep was in a giving mood, once, too."', 'warmth rose from the shaft with them. it fades.'],
    hollow: ['"they turned back. the deep remembers who turns back kindly."', 'a party rose empty-handed. the stone kept what it keeps.'],
    loss: ['"{name} walks deeper now. some of us stay below."', 'a cold spot by the shaft where {name} used to pass.'],
    lost: ['"a whole party, gone under. the stone has room for everyone."', 'the shaft breathes colder now. none of them rose.'],
  },
};

/** The expedition's marginalia line. Unknown dispatcher ids fall back to
 *  the loki table (the DEFAULT_MARK_STYLE philosophy). */
export function expeditionNote(
  agentId: string,
  kind: string,
  deadName: string,
  rand: () => number,
): string {
  const table = EXPEDITION_VOCAB[agentId] ?? EXPEDITION_VOCAB.loki;
  const lines = table[kind] ?? table.hollow;
  return lines[Math.floor(rand() * lines.length)].replace('{name}', deadName);
}

/** Every authored expedition line, for the no-numerals smoke (spec kill
 *  condition: "a number appears"). */
export function expeditionVocabLines(): string[] {
  const out: string[] = [];
  for (const table of Object.values(EXPEDITION_VOCAB)) {
    for (const lines of Object.values(table)) out.push(...lines);
  }
  return out;
}

/** A note for a launch runner. Unknown ids fall back to loki (the
 *  DEFAULT_MARK_STYLE philosophy, as in noteFor). */
export function launchNote(agentId: string, game: string, rand: () => number): string {
  const lines = LAUNCH_VOCAB[agentId] ?? LAUNCH_VOCAB.loki;
  return lines[Math.floor(rand() * lines.length)].replace('{game}', game);
}

/** A note line for (being, context). Unknown ids fall back to the loki
 *  table (the DEFAULT_MARK_STYLE philosophy). With a non-empty thought
 *  and a thoughted template available, ~half the picks fold the mind's
 *  words in, lowercased; otherwise an authored plain line. */
export function noteFor(
  agentId: string,
  kind: MarkContextKind,
  rand: () => number,
  thought: string,
): string {
  const table = VOCAB[agentId] ?? VOCAB.loki;
  const entry = table[kind];
  const th = thought.trim().toLowerCase();
  if (entry.thoughted && th !== '' && rand() < 0.5) {
    const t = entry.thoughted[Math.floor(rand() * entry.thoughted.length)];
    return t.replace('{thought}', th);
  }
  return entry.plain[Math.floor(rand() * entry.plain.length)];
}

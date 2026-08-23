/**
 * Build the four format-uniform library summaries for taste bar 4b —
 * `npx tsx scripts/build-matching-summaries.mts`.
 *
 * The three fakes (scripts/lib/matching-profiles.ts) go through the SAME
 * derivations + tagLibrary + buildProfile as the real pull; Harry's summary
 * comes straight out of the pull fixture (identical builder), so the text
 * format cannot leak which profile is real. Asserts the four flagships are
 * distinct and each fake lands its designed pole. Output: gitignored
 * fixtures/matching/summary-<id>.txt.
 */
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { tagLibrary, stateCounts, type LibraryState } from '../worker/lib/state.ts';
import { buildProfile } from '../worker/lib/profile.ts';
import { FAKE_PROFILES, MATCHING_NOW_S, type FakeGame } from './lib/matching-profiles.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'fixtures/matching');
const LIBRARY_DIR = join(ROOT, 'fixtures/library');

/** Worker's RECENT_WINDOW_S — the same 7-day recency the real pull uses. */
const RECENT_WINDOW_S = 60 * 60 * 24 * 7;

let failures = 0;
function check(label: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
}

/** Mirror the pull script's enrichment derivations for a static fake row. */
function toProfileInput(g: FakeGame) {
  const rtime_last_played =
    g.lastPlayedDaysAgo !== undefined
      ? MATCHING_NOW_S - g.lastPlayedDaysAgo * 86400
      : undefined;
  const completion_fraction =
    g.hltb && g.hltb.mainStoryHours > 0 && g.playtime_forever > 0
      ? Math.round(((g.playtime_forever / 60) / g.hltb.mainStoryHours) * 100) / 100
      : undefined;
  const recent =
    rtime_last_played !== undefined && rtime_last_played >= MATCHING_NOW_S - RECENT_WINDOW_S;
  return {
    appid: g.appid,
    name: g.name,
    playtime_forever: g.playtime_forever,
    ...(rtime_last_played !== undefined && { rtime_last_played }),
    ...(g.achievements && { achievements: g.achievements }),
    ...(g.hltb && { hltb: g.hltb }),
    ...(completion_fraction !== undefined && { completion_fraction }),
    ...(recent && { recent: true }),
  };
}

mkdirSync(OUT_DIR, { recursive: true });

interface BuiltProfile {
  id: string;
  flagship: string;
  counts: Record<LibraryState, number>;
  summary: string;
}
const built: BuiltProfile[] = [];

for (const fake of FAKE_PROFILES) {
  const rows = fake.games
    .map(toProfileInput)
    .sort((a, b) => b.playtime_forever - a.playtime_forever);
  const tagged = tagLibrary(rows, MATCHING_NOW_S);
  const profile = buildProfile(tagged, 15);
  writeFileSync(join(OUT_DIR, `summary-${fake.id}.txt`), profile.summary + '\n');
  built.push({
    id: fake.id,
    flagship: profile.topGames[0].name,
    counts: stateCounts(tagged),
    summary: profile.summary,
  });
  console.log(`\n== ${fake.id} (${fake.pole}) ==`);
  console.log(profile.summary);
}

// Harry's real summary, from the pull fixture if it exists yet.
const harryFixture = (() => {
  try {
    const file = readdirSync(LIBRARY_DIR).find((f) => /^harry-\d+\.json$/.test(f));
    return file ? join(LIBRARY_DIR, file) : null;
  } catch {
    return null;
  }
})();

if (harryFixture) {
  const data = JSON.parse(readFileSync(harryFixture, 'utf8'));
  writeFileSync(join(OUT_DIR, 'summary-harry.txt'), data.profile.summary + '\n');
  built.push({
    id: 'harry',
    flagship: data.profile.topGames[0].name,
    counts: stateCounts(data.library),
    summary: data.profile.summary,
  });
  console.log(`\n== harry (real, from ${harryFixture}) ==`);
  console.log(data.profile.summary);
} else {
  console.warn('\nno harry fixture in fixtures/library/ yet — run scripts/pull-library.mts first;');
  console.warn('distinctness below covers the three fakes only and must re-run after the pull.');
}

// Distinctness bars — flagships distinct, and each fake lands its pole.
console.log('');
const flagships = built.map((b) => b.flagship.toLowerCase());
check('flagships distinct across profiles', new Set(flagships).size === flagships.length);
const by = Object.fromEntries(built.map((b) => [b.id, b.counts]));
check('finisher pole: ≥4 mastered', by.finisher.mastered >= 4);
check('cozy pole: ≥1 loved and ≥3 recent', by.cozy.loved >= 1 && by.cozy.recent >= 3);
check('collector pole: ≥15 dusty', by.collector.dusty >= 15);
// Abandoned is the REAL profile's pole — it must stay unique to it.
check(
  'abandoned unique to the real profile: every fake has 0',
  by.finisher.abandoned === 0 && by.cozy.abandoned === 0 && by.collector.abandoned === 0,
);
// Confound strengthener: Deep Rock Galactic must appear in ≥2 summaries
// (Harry's played copy + the collector's unopened one).
const drgCount = built.filter((b) => b.summary.includes('Deep Rock Galactic')).length;
if (harryFixture) check('confound: Deep Rock Galactic in ≥2 summaries', drgCount >= 2);
for (const b of built) {
  check(`${b.id}: summary is non-trivial`, b.summary.split('\n').length >= 6);
}

console.log(failures === 0 ? '\nsummaries OK' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

/**
 * Phase 5C smoke — `npx tsx scripts/smoke-5c-lore.mts`.
 *
 * Covers the WSL-testable surface of the lore-upload embedding backbone
 * (slice 5C.1):
 *   - chunkText() window/overlap boundary math + edge cases (empty,
 *     whitespace-only, sub-window, exact boundary, overlap carry-over)
 *   - approxTokens() heuristic
 *   - nomic prefix helpers (search_document: / search_query:)
 *   - embedTexts() client wrapper against a mocked global fetch — asserts
 *     request shape, success parse, empty short-circuit, and error paths.
 *     No Ollama needed.
 *
 * NOT covered (needs a live Worker + Ollama, or Electron):
 *   - the real POST /api/embed -> nomic-embed-text round-trip (768-dim).
 *     Verify on the Windows box after `ollama pull nomic-embed-text`.
 *   - db.attachEmbedding persistence (better-sqlite3 + sqlite-vec,
 *     Electron-only). Lands + verified in slice 5C.2.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { chunkText, approxTokens } = await import('../src/agents/memory/chunk.ts');

const { check, report } = makeChecker('smoke 5C');

// ---------------------------------------------------------------------------
// 1. chunkText — edge cases

check('chunk: empty string -> []', chunkText('').length === 0);
check('chunk: whitespace-only -> []', chunkText('   \n\t  ').length === 0);

const short = chunkText('hello world', { maxTokens: 500, overlapTokens: 50 });
check('chunk: sub-window text -> single chunk', short.length === 1);
check('chunk: sub-window chunk preserves text', short[0] === 'hello world');

// Whitespace is collapsed to single spaces on the join.
const messy = chunkText('  hello   \n  world  ', { maxTokens: 500 });
check('chunk: collapses whitespace', messy.length === 1 && messy[0] === 'hello world');

// ---------------------------------------------------------------------------
// 2. chunkText — boundary + overlap math (small windows for determinism)

// maxTokens=2 -> 8 chars, overlap=0. Greedy fill, no carry-over.
const noOverlap = chunkText('one two three four five', { maxTokens: 2, overlapTokens: 0 });
check(
  'chunk: maxTokens=2 overlap=0 splits greedily',
  JSON.stringify(noOverlap) === JSON.stringify(['one two', 'three', 'four', 'five']),
  JSON.stringify(noOverlap),
);

// maxTokens=3 -> 12 chars, overlap=1 -> 4 chars. Each window carries its
// trailing word into the next.
const withOverlap = chunkText('alpha beta gamma delta', { maxTokens: 3, overlapTokens: 1 });
check(
  'chunk: maxTokens=3 overlap=1 carries one word forward',
  JSON.stringify(withOverlap) === JSON.stringify(['alpha beta', 'beta gamma', 'gamma delta']),
  JSON.stringify(withOverlap),
);

// Exact boundary: window budget is a strict `>` so an exact fit stays in one.
// 'aaaa bbbb' = 9 chars; maxTokens=3 -> 12 chars (fits). maxTokens=2 -> 8 (splits).
check(
  'chunk: exact-fit stays in one window',
  chunkText('aaaa bbbb', { maxTokens: 3 }).length === 1,
);
check(
  'chunk: one-over splits into two',
  chunkText('aaaa bbbb', { maxTokens: 2, overlapTokens: 0 }).length === 2,
);

// overlapTokens clamped to [0, maxTokens-1] — overlap >= maxTokens must not loop.
const clamped = chunkText('alpha beta gamma delta epsilon', { maxTokens: 2, overlapTokens: 99 });
check('chunk: oversized overlap is clamped (terminates)', clamped.length >= 1);

// Multi-chunk default behaviour: consecutive chunks overlap by >=1 word.
const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
const chunks = chunkText(long); // default 500/50
check('chunk: large input -> multiple chunks', chunks.length >= 2);
let everyPairOverlaps = true;
for (let i = 1; i < chunks.length; i++) {
  const prevWords = chunks[i - 1].split(' ');
  const curWords = chunks[i].split(' ');
  if (!curWords.some((w) => prevWords.includes(w))) everyPairOverlaps = false;
}
check('chunk: consecutive default chunks share an overlap', everyPairOverlaps);

// ---------------------------------------------------------------------------
// 3. approxTokens

check('approxTokens: empty -> 0', approxTokens('') === 0);
check('approxTokens: whitespace -> 0', approxTokens('   ') === 0);
check('approxTokens: 4 chars -> 1 token', approxTokens('abcd') === 1);
check('approxTokens: 40 chars -> 10 tokens', approxTokens('a'.repeat(40)) === 10);
check('approxTokens: rounds up', approxTokens('abcde') === 2);

// ---------------------------------------------------------------------------
// 4. nomic prefix helpers + embedTexts client wrapper (mocked fetch)

const { withDocumentPrefix, withQueryPrefix, embedTexts } = await import('../src/api/embed.ts');

check('prefix: document', withDocumentPrefix('x') === 'search_document: x');
check('prefix: query', withQueryPrefix('x') === 'search_query: x');

type FetchArgs = { url: string; body: unknown };
let lastFetch: FetchArgs | null = null;
function installFetch(impl: (args: FetchArgs) => Response): void {
  (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    lastFetch = { url, body };
    return impl({ url, body });
  };
}
function jsonResponse(obj: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  } as unknown as Response;
}

// Empty input short-circuits without a request.
lastFetch = null;
const empty = await embedTexts([]);
check('embedTexts: empty input -> ok with no vectors', empty.ok === true && empty.embeddings.length === 0);
check('embedTexts: empty input makes no request', lastFetch === null);

// Happy path: posts {texts} to /api/embed and parses embeddings.
installFetch(() => jsonResponse({ embeddings: [[0.1, 0.2, 0.3]] }));
const okRes = await embedTexts(['hi']);
check('embedTexts: posts to /api/embed', lastFetch?.url === '/api/embed');
check(
  'embedTexts: request body carries texts[]',
  JSON.stringify(lastFetch?.body) === JSON.stringify({ texts: ['hi'] }),
);
check('embedTexts: parses embeddings', okRes.ok === true && okRes.embeddings.length === 1);

// 501 (cloud provider / not implemented) -> graceful {ok:false}.
installFetch(() => jsonResponse({ error: 'local only' }, false, 501));
const denied = await embedTexts(['hi']);
check('embedTexts: 501 -> ok:false', denied.ok === false);
check('embedTexts: 501 error carries status', denied.ok === false && denied.error.includes('501'));

// Malformed success body (no embeddings field) -> {ok:false}.
installFetch(() => jsonResponse({ nope: true }));
const malformed = await embedTexts(['hi']);
check('embedTexts: missing embeddings -> ok:false', malformed.ok === false);

report();

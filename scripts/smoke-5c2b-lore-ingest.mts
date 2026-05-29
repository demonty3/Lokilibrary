/**
 * Phase 5C.2b smoke — `npx tsx scripts/smoke-5c2b-lore-ingest.mts`.
 *
 * Covers the ingest orchestration (chunk → embed → recordLore) with an
 * injected embed fn + a recording fake writer. No browser, no Ollama.
 *   - happy path: text → N chunks → N embeddings → N lore rows, each with
 *     a vector; document prefix applied to embed inputs.
 *   - embed 501 / failure: chunks still persisted (FTS-only), embeddedCount
 *     0, embedError surfaced, embedding NOT passed to recordLore.
 *   - count mismatch: treated as failure (FTS-only fallback).
 *   - embed throws: caught, FTS-only fallback.
 *   - empty / whitespace text: no chunks, no writes.
 *
 * NOT covered (needs DOM/React + Electron): the drop-zone component,
 * file.text() reads, the Ctrl+U toggle, the will-navigate guard.
 */

import { createRequire } from 'node:module';
import { makeChecker } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { ingestLore } = await import('../src/agents/lore-ingest.ts');
const { NOMIC_DOC_PREFIX } = await import('../src/api/embed.ts');

const { check, report } = makeChecker('smoke 5C.2b');

interface RecordedLore {
  text: string;
  source: string;
  embedding?: readonly number[];
}

function makeWriter() {
  const rows: RecordedLore[] = [];
  let n = 0;
  return {
    rows,
    writer: {
      recordLore(args: RecordedLore): string {
        rows.push(args);
        return `lore-${++n}`;
      },
    },
  };
}

// A long enough document to split into multiple chunks at small window.
const doc = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');

// ---------------------------------------------------------------------------
// 1. Happy path — every chunk embedded + recorded

{
  const { rows, writer } = makeWriter();
  let embedInputs: readonly string[] = [];
  const result = await ingestLore(doc, 'campaign.md', writer as never, {
    chunk: { maxTokens: 5, overlapTokens: 1 },
    embed: async (texts) => {
      embedInputs = texts;
      return { ok: true, embeddings: texts.map(() => [0.1, 0.2, 0.3]) };
    },
  });

  check('happy: chunkCount > 1', result.chunkCount > 1, String(result.chunkCount));
  check('happy: embeddedCount == chunkCount', result.embeddedCount === result.chunkCount);
  check('happy: loreIds length == chunkCount', result.loreIds.length === result.chunkCount);
  check('happy: no embedError', result.embedError === undefined);
  check('happy: source recorded', rows.every((r) => r.source === 'campaign.md'));
  check('happy: every row carries an embedding', rows.every((r) => Array.isArray(r.embedding)));
  check(
    'happy: embed inputs carry the document prefix',
    embedInputs.length > 0 && embedInputs.every((t) => t.startsWith(NOMIC_DOC_PREFIX)),
  );
  check(
    'happy: stored chunk text is UN-prefixed (prefix only on embed input)',
    rows.every((r) => !r.text.startsWith(NOMIC_DOC_PREFIX)),
  );
}

// ---------------------------------------------------------------------------
// 2. Embed 501 / failure — FTS-only fallback, chunks still stored

{
  const { rows, writer } = makeWriter();
  const result = await ingestLore(doc, 'lore.txt', writer as never, {
    chunk: { maxTokens: 5, overlapTokens: 1 },
    embed: async () => ({ ok: false, error: '501 local only' }),
  });

  check('fail: chunks still persisted', result.loreIds.length === result.chunkCount && result.chunkCount > 0);
  check('fail: embeddedCount is 0', result.embeddedCount === 0);
  check('fail: embedError surfaced', result.embedError === '501 local only');
  check('fail: rows recorded WITHOUT embedding', rows.every((r) => r.embedding === undefined));
}

// ---------------------------------------------------------------------------
// 3. Count mismatch — treated as failure

{
  const { rows, writer } = makeWriter();
  const result = await ingestLore(doc, 'x.md', writer as never, {
    chunk: { maxTokens: 5, overlapTokens: 1 },
    embed: async () => ({ ok: true, embeddings: [[0.1, 0.2]] }), // too few
  });
  check('mismatch: FTS-only fallback (embeddedCount 0)', result.embeddedCount === 0);
  check('mismatch: embedError mentions mismatch', !!result.embedError && result.embedError.includes('mismatch'));
  check('mismatch: chunks still stored', rows.length === result.chunkCount && rows.every((r) => r.embedding === undefined));
}

// ---------------------------------------------------------------------------
// 4. Embed throws — caught, FTS-only fallback

{
  const { rows, writer } = makeWriter();
  const result = await ingestLore(doc, 'y.md', writer as never, {
    chunk: { maxTokens: 5, overlapTokens: 1 },
    embed: async () => { throw new Error('network down'); },
  });
  check('throw: caught → FTS-only fallback', result.embeddedCount === 0 && rows.length === result.chunkCount);
  check('throw: embedError carries the message', result.embedError === 'network down');
}

// ---------------------------------------------------------------------------
// 5. Empty / whitespace — no chunks, no writes, no embed call

{
  const { rows, writer } = makeWriter();
  let embedCalled = false;
  const result = await ingestLore('   \n\t ', 'empty.md', writer as never, {
    embed: async (t) => { embedCalled = true; return { ok: true, embeddings: t.map(() => [0]) }; },
  });
  check('empty: chunkCount 0', result.chunkCount === 0);
  check('empty: no rows written', rows.length === 0);
  check('empty: no embed call', embedCalled === false);
}

report();

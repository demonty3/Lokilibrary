/**
 * Pure, dependency-free text chunker for lore upload (Phase 5C slice 5C.1).
 *
 * Splits free text into ~`maxTokens`-token windows with `overlapTokens`
 * overlap — the Smallville convention (PLAN.md: 500-token windows,
 * 50-token overlap).
 *
 * We deliberately avoid a BPE tokenizer. tiktoken ships a WASM blob, and
 * the worker + web build share one root `package.json` / one `node_modules`
 * (there is no `worker/package.json`), so any dependency added here is
 * visible to the Vite web bundle — CLAUDE.md's ">500KB gzipped" rule. And
 * it's unnecessary: `nomic-embed-text` tokenizes its own input server-side,
 * so exact BPE counts don't matter for windowing. A ~4-chars/token
 * heuristic over whitespace-delimited words is accurate enough.
 *
 * Pure functions only — no I/O, no deps — so the smoke harness imports
 * them directly and they're safe on either side of the worker/web split.
 */

export interface ChunkOptions {
  /** Target window size in approximate tokens. Default 500. */
  readonly maxTokens?: number;
  /** Tokens carried from the tail of one window into the next. Default 50. */
  readonly overlapTokens?: number;
}

/** Standard English heuristic: ~4 characters per token. */
export const CHARS_PER_TOKEN = 4;
export const DEFAULT_MAX_TOKENS = 500;
export const DEFAULT_OVERLAP_TOKENS = 50;

/** Rough token count for a string — `ceil(trimmedLength / 4)`, 0 for blank. */
export function approxTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return Math.max(1, Math.ceil(trimmed.length / CHARS_PER_TOKEN));
}

/**
 * Split `text` into overlapping windows. Whitespace-delimited; each window
 * is a space-joined run of words whose approximate token budget stays at or
 * under `maxTokens`. Successive windows share an `overlapTokens`-sized tail
 * so a fact spanning a boundary still embeds intact in at least one chunk.
 *
 * Contract:
 *   - blank / whitespace-only input → `[]`
 *   - input shorter than one window → a single trimmed chunk
 *   - exact-boundary input → fits in one window (budget check is strict `>`)
 *   - `overlapTokens` is clamped to `[0, maxTokens - 1]`
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxTokens = Math.max(1, opts.maxTokens ?? DEFAULT_MAX_TOKENS);
  const overlapTokens = Math.max(
    0,
    Math.min(opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS, maxTokens - 1),
  );
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let window: string[] = [];
  let windowChars = 0;

  for (const word of words) {
    // +1 approximates the joining space cost once the window is non-empty.
    const wordChars = word.length + (window.length > 0 ? 1 : 0);
    if (windowChars + wordChars > maxChars && window.length > 0) {
      chunks.push(window.join(' '));
      // Seed the next window with an overlap tail drawn from this window's end.
      const tail: string[] = [];
      let tailChars = 0;
      for (let i = window.length - 1; i >= 0 && tailChars < overlapChars; i--) {
        tail.unshift(window[i]);
        tailChars += window[i].length + 1;
      }
      window = tail;
      windowChars = tail.reduce((n, w) => n + w.length + 1, 0);
    }
    window.push(word);
    windowChars += word.length + (window.length > 1 ? 1 : 0);
  }
  if (window.length > 0) chunks.push(window.join(' '));
  return chunks;
}

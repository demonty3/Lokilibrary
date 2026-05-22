/**
 * Writer surface for the memory stream. Every Tier-1/Tier-2 path goes
 * through one of `recordObservation` / `recordReflection` / `recordPlan`
 * / `recordDialogue`. Each writer:
 *
 *   1. Mints a UUIDv7 + timestamps.
 *   2. Computes importance via `defaultImportance` (caller may override
 *      for Tier-2 reflections that score themselves).
 *   3. Inserts the row into SQLite.
 *   4. Writes the matching Markdown vault file (fire-and-forget; vault
 *      errors log but don't fail the write — DB is the source of truth).
 *   5. Enqueues the row's text for embedding (slice 2D drains the queue).
 *
 * The embedding queue is process-local — fine for Phase 2 because the
 * renderer is the only writer. If we ever move agent runtime into the
 * Electron main process, the queue moves with it.
 */

import type { MemoryDb } from './db';
import type { MemoryVault } from './vault';
import {
  defaultImportance,
  type DialoguePayload,
  type Memory,
  type MemoryPayload,
  type MemoryRow,
  type ObservationPayload,
  type PlanPayload,
  type ReflectionPayload,
} from './schema';
import { uuidv7 } from './uuid';

export interface NamespaceCtx {
  readonly agentId: string;
  readonly cellId: string;
  readonly libraryId: string;
}

export interface RecordOptions {
  /** Override the default importance heuristic (Tier-2 self-scoring). */
  readonly importance?: number;
  /** Parent memory id — reflections point at synthesised observations. */
  readonly parentId?: string;
  /** Override the timestamp (tests + replay). Defaults to Date.now(). */
  readonly now?: number;
}

/** Record a sensory observation — perception layer's primary writer. */
export function recordObservation(
  db: MemoryDb,
  vault: MemoryVault | null,
  ns: NamespaceCtx,
  payload: ObservationPayload,
  opts: RecordOptions = {},
): Memory {
  return record(db, vault, ns, { kind: 'observation', data: payload }, opts);
}

/** Record a Tier-2 reflection synthesised from prior memories. */
export function recordReflection(
  db: MemoryDb,
  vault: MemoryVault | null,
  ns: NamespaceCtx,
  payload: ReflectionPayload,
  opts: RecordOptions = {},
): Memory {
  return record(db, vault, ns, { kind: 'reflection', data: payload }, opts);
}

/** Record an agent plan — Loki's "place a mark near the Hades shelf" lives here. */
export function recordPlan(
  db: MemoryDb,
  vault: MemoryVault | null,
  ns: NamespaceCtx,
  payload: PlanPayload,
  opts: RecordOptions = {},
): Memory {
  return record(db, vault, ns, { kind: 'plan', data: payload }, opts);
}

/** Record a dialogue exchange. NPC-only — Loki's persona forbids this kind. */
export function recordDialogue(
  db: MemoryDb,
  vault: MemoryVault | null,
  ns: NamespaceCtx,
  payload: DialoguePayload,
  opts: RecordOptions = {},
): Memory {
  return record(db, vault, ns, { kind: 'dialogue', data: payload }, opts);
}

// ---------- embedding queue ----------

export interface EmbedJob {
  readonly memoryId: string;
  readonly agentId: string;
  readonly text: string;
  readonly enqueuedAt: number;
}

const embedQueue: EmbedJob[] = [];

/** Drain and return all pending embed jobs. Slice 2D calls this from the
 *  worker-fronted embedder; tests use it to assert enqueue happened. */
export function drainEmbedQueue(): EmbedJob[] {
  const out = embedQueue.splice(0, embedQueue.length);
  return out;
}

/** Peek without draining — telemetry overlays. */
export function pendingEmbeddings(): number {
  return embedQueue.length;
}

// ---------- internal ----------

function record(
  db: MemoryDb,
  vault: MemoryVault | null,
  ns: NamespaceCtx,
  payload: MemoryPayload,
  opts: RecordOptions,
): Memory {
  const id = uuidv7();
  const now = opts.now ?? Date.now();
  const importance = opts.importance ?? defaultImportance(payload);
  if (importance < 1 || importance > 10) {
    throw new Error(
      `[memory/import] importance out of range: ${importance} (must be 1-10)`,
    );
  }

  const row: MemoryRow = {
    id,
    agent_id: ns.agentId,
    cell_id: ns.cellId,
    library_id: ns.libraryId,
    kind: payload.kind,
    created_at: now,
    accessed_at: now,
    importance,
    payload_json: JSON.stringify(payload.data),
    embedding_id: null,
    parent_id: opts.parentId ?? null,
  };

  db.insertMemory(row);

  if (vault) {
    try {
      vault.write(row);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[memory/import] vault write failed for ${id}: ${(e as Error).message}`,
      );
    }
  }

  // Every kind currently has a `.text` field; enqueue all of them.
  const text = textOf(payload);
  if (text.length > 0) {
    embedQueue.push({
      memoryId: id,
      agentId: ns.agentId,
      text,
      enqueuedAt: now,
    });
  }

  // Re-inflate to typed Memory for the caller (saves a getMemory round-trip).
  return inflate(row, payload);
}

function textOf(payload: MemoryPayload): string {
  return payload.data.text;
}

function inflate(row: MemoryRow, payload: MemoryPayload): Memory {
  switch (payload.kind) {
    case 'observation':
      return { ...row, kind: 'observation', payload: payload.data };
    case 'reflection':
      return { ...row, kind: 'reflection', payload: payload.data };
    case 'plan':
      return { ...row, kind: 'plan', payload: payload.data };
    case 'dialogue':
      return { ...row, kind: 'dialogue', payload: payload.data };
  }
}

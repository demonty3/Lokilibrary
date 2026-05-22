/**
 * DB-backed MemoryWriter — adapter from the router's MemoryWriter
 * interface to the better-sqlite3 store (db.ts) + markdown vault
 * (vault.ts) from Phase 2A. Constructed at app boot (Electron only);
 * the pure-web build keeps the `nullMemoryWriter` from router.ts.
 *
 * Namespacing: every write uses `ns.cellId` + `ns.libraryId` so the
 * memory stream stays segmented per (profile-seed × steam-id). When
 * the player signs into a different account or the cell re-mounts to
 * a different layout, the writer instance is replaced (the existing
 * one is `close()`-d via its db handle).
 *
 * Importance heuristic for perception events: the router passes us a
 * value via `importance`; we forward it verbatim (no per-writer
 * tuning). Reflections take their importance from the Tier-2 model's
 * self-score, clamped 1..10 (worker route already clamps; we
 * defensive-clamp again).
 */

import type { MemoryDb } from './db';
import type { MemoryVault } from './vault';
import type {
  MemoryWriter,
  PersonaSnippet,
  RecentMemorySummary,
} from '../router';
import type { PerceptionEvent } from '../../state/agentRuntime';
import {
  recordObservation,
  recordReflection as recordReflectionMemory,
} from './import';
import { recentForRouter } from './retrieval';

export interface WriterNamespace {
  cellId: string;
  libraryId: string;
}

export interface BuildWriterOptions {
  db: MemoryDb;
  vault: MemoryVault | null;
  /** Namespacing for every write. */
  ns: WriterNamespace;
}

export function buildMemoryWriter(opts: BuildWriterOptions): MemoryWriter {
  const { db, vault, ns } = opts;

  return {
    recordPerception(agentId, event, importance) {
      const memory = recordObservation(
        db,
        vault,
        { agentId, cellId: ns.cellId, libraryId: ns.libraryId },
        {
          text: describeEvent(event),
          source: sourceFromEventKind(event.kind),
          subjects: event.subject ? [event.subject] : undefined,
          location: event.at,
        },
        { importance: clampImportance(importance) },
      );
      return memory.id;
    },
    recordReflection({ agentId, text, synthesisedFrom, themes, importance }) {
      const memory = recordReflectionMemory(
        db,
        vault,
        { agentId, cellId: ns.cellId, libraryId: ns.libraryId },
        {
          text,
          synthesised_from: synthesisedFrom,
          themes,
        },
        { importance: clampImportance(importance) },
      );
      return memory.id;
    },
    logTier1(args) {
      db.logTelemetry({
        agent_id: args.agentId,
        tier: 1,
        model: args.model,
        provider: args.provider,
        tokens_in: args.tokensIn,
        tokens_out: args.tokensOut,
        latency_ms: args.latencyMs,
        cost_usd_est: args.costUsdEst,
        created_at: Date.now(),
      });
    },
    logTier2(args) {
      db.logTelemetry({
        agent_id: args.agentId,
        tier: 2,
        model: args.model,
        provider: args.provider,
        tokens_in: args.tokensIn,
        tokens_out: args.tokensOut,
        latency_ms: args.latencyMs,
        cost_usd_est: args.costUsdEst,
        created_at: Date.now(),
      });
    },
    recentMemories(agentId, n): readonly RecentMemorySummary[] {
      return recentForRouter(db, agentId, n);
    },
    persona(agentId): PersonaSnippet | null {
      const row = db.getPersona(agentId);
      if (!row) return null;
      return { name: row.name, system_prompt: row.system_prompt };
    },
  };
}

// ---------- helpers ----------

function describeEvent(ev: PerceptionEvent): string {
  switch (ev.kind) {
    case 'player_proximity':
      return `the player came near (${ev.at.x},${ev.at.y})`;
    case 'player_holding':
      return `the player lingered nearby for a while`;
    case 'agent_meeting':
      return `${ev.subject ?? 'another agent'} was nearby at (${ev.at.x},${ev.at.y})`;
    case 'bookshelf_in_reach':
      return `a bookshelf was within reach at (${ev.at.x},${ev.at.y})`;
    default:
      return `${ev.kind}${ev.subject ? `:${ev.subject}` : ''} at (${ev.at.x},${ev.at.y})`;
  }
}

/**
 * Map perception-event kind → the schema's ObservationSource. Adding
 * a new perception event kind that maps cleanly to an existing source
 * is fine; introducing a new source is a schema change (bump
 * SCHEMA_VERSION + migrate).
 */
function sourceFromEventKind(
  kind: string,
):
  | 'player_proximity'
  | 'agent_meeting'
  | 'bookshelf_e'
  | 'game_launched'
  | 'cell_mount'
  | 'self_perception' {
  switch (kind) {
    case 'player_proximity':
    case 'player_holding':
      return 'player_proximity';
    case 'agent_meeting':
      return 'agent_meeting';
    case 'bookshelf_in_reach':
      return 'bookshelf_e';
    case 'game_launched':
      return 'game_launched';
    case 'cell_mount':
      return 'cell_mount';
    default:
      return 'self_perception';
  }
}

function clampImportance(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}

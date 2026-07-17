/**
 * Phase 2A memory-stream schema. The discriminated union below is the
 * long-lived artifact of Phase 2 — the agent runtime can be rewritten
 * end-to-end without touching this, but renaming a `kind` here breaks
 * every persisted vault and every SQLite row. Treat as a stable contract.
 *
 * Smallville verbatim: `observation` / `reflection` / `plan` plus our
 * `dialogue` kind for the NPC cohort (Archivist / Visitor) that may
 * actually speak. Loki's persona contract forbids `dialogue` rows
 * for `agent_id='loki'` — the whitelist enforcement lives in router
 * (slice 2C), not here.
 *
 * MCP tool surface (no server in Phase 2; this is the schema-fit check
 * so a Phase-5+ MCP layer can be a thin adapter rather than a rewrite).
 * The queries listed are the ones a Phase-5+ MCP server would expose to
 * external agents — schema design proves they're cheap with these
 * indexes, no rewrite needed later.
 *
 * @mcp.tool list_recent_observations — `SELECT * FROM memories WHERE agent_id=? AND kind='observation' ORDER BY created_at DESC LIMIT ?`
 * @mcp.tool query_memories_by_importance — `SELECT * FROM memories WHERE agent_id=? AND importance >= ? ORDER BY importance DESC, created_at DESC LIMIT ?`
 * @mcp.tool get_reflections_for — `SELECT * FROM memories WHERE agent_id=? AND kind='reflection' ORDER BY created_at DESC LIMIT ?`
 * @mcp.tool search_memories — FTS5 over `memory_fts` joined to `memories` rowid
 * @mcp.tool get_agent_personality — `SELECT * FROM agent_personas WHERE agent_id=?`
 * @mcp.tool get_cost_summary — aggregate `agent_telemetry` by `(provider, model)` over a window
 */

/** Discriminated-union kind tag. Mirrored as the SQL CHECK constraint. */
export type MemoryKind = 'observation' | 'reflection' | 'plan' | 'dialogue';

export const MEMORY_KINDS: readonly MemoryKind[] = [
  'observation',
  'reflection',
  'plan',
  'dialogue',
];

/** Where a 2D-coordinate observation happened. Cell-local tile coords. */
export interface CellPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Salience sources the perception layer can attribute an observation to.
 * Extending this is a schema-touching change — bump the schema version
 * and migrate. Routine ticks should NOT generate observation rows;
 * they're Tier-0 only.
 */
export type ObservationSource =
  | 'self_perception'
  | 'agent_meeting'
  | 'player_proximity'
  | 'bookshelf_e'
  | 'game_launched'
  | 'external_fullscreen'
  | 'cell_mount'
  | 'terminal_crossing'
  | 'terminal_arrival';

export interface ObservationPayload {
  readonly text: string;
  readonly source: ObservationSource;
  /** Other agent_ids / object ids involved (e.g., bookshelf slot id). */
  readonly subjects?: readonly string[];
  readonly location?: CellPoint;
}

export interface ReflectionPayload {
  readonly text: string;
  /** Parent memory ids that this reflection synthesises. */
  readonly synthesised_from: readonly string[];
  /** Optional themes the Tier-2 call extracted ("escapism", "completion"). */
  readonly themes?: readonly string[];
}

export type PlanStepKind =
  | 'move_to'
  | 'inspect'
  | 'place_mark'
  | 'linger'
  | 'withdraw';

export interface PlanStep {
  readonly kind: PlanStepKind;
  /** Target object id or agent_id ("shelf:hades", "player", etc.). */
  readonly target?: string;
  readonly location?: CellPoint;
  readonly status: 'pending' | 'done';
}

export interface PlanPayload {
  readonly text: string;
  readonly steps: readonly PlanStep[];
  readonly status: 'active' | 'completed' | 'abandoned';
}

export type DialogueAddressee = 'self' | 'agent' | 'player';

export interface DialoguePayload {
  readonly text: string;
  readonly addressee: DialogueAddressee;
  /** Other agent_id, if `addressee === 'agent'`. */
  readonly target?: string;
  readonly tone?: string;
}

export type MemoryPayload =
  | { kind: 'observation'; data: ObservationPayload }
  | { kind: 'reflection'; data: ReflectionPayload }
  | { kind: 'plan'; data: PlanPayload }
  | { kind: 'dialogue'; data: DialoguePayload };

/**
 * Row shape as it sits in SQLite. `payload_json` is the encoded
 * `MemoryPayload.data` for the matching `kind`. Use `decodeMemory()`
 * to inflate into a typed `Memory`.
 */
export interface MemoryRow {
  readonly id: string;
  readonly agent_id: string;
  readonly cell_id: string;
  readonly library_id: string;
  readonly kind: MemoryKind;
  readonly created_at: number;
  readonly accessed_at: number;
  readonly importance: number;
  readonly payload_json: string;
  readonly embedding_id: number | null;
  readonly parent_id: string | null;
}

/** Typed, inflated memory — what the agent runtime works with. */
export type Memory =
  | (Omit<MemoryRow, 'kind' | 'payload_json'> & {
      kind: 'observation';
      payload: ObservationPayload;
    })
  | (Omit<MemoryRow, 'kind' | 'payload_json'> & {
      kind: 'reflection';
      payload: ReflectionPayload;
    })
  | (Omit<MemoryRow, 'kind' | 'payload_json'> & {
      kind: 'plan';
      payload: PlanPayload;
    })
  | (Omit<MemoryRow, 'kind' | 'payload_json'> & {
      kind: 'dialogue';
      payload: DialoguePayload;
    });

/**
 * Lore row (Phase 5C). User-uploaded world/canon text, chunked on
 * ingest. Lives in its OWN `lore` table — NOT `memories` — so it stays
 * additive (no migration to the stable memories contract) and
 * **library-scoped** (one upload, every agent in that library can
 * reference it). `embedding_id` FKs into the `lore_vec` table the same
 * way `memories.embedding_id` FKs into `memory_vec`.
 */
export interface LoreRow {
  readonly id: string;
  readonly library_id: string;
  readonly text: string;
  /** Provenance — original filename, or 'paste'. */
  readonly source: string;
  readonly created_at: number;
  readonly embedding_id: number | null;
}

/** Cell namespace helper. Same `profileSeed` → same `cell_id`. */
export function cellIdFor(profileSeed: number): string {
  return `cell:${(profileSeed >>> 0).toString(16)}`;
}

/** Library namespace helper. Anonymous users get a stable sentinel. */
export function libraryIdFor(steamId: string | null | undefined): string {
  return `library:${steamId ?? 'anonymous'}`;
}

/** Inflate a stored row into its typed `Memory`. Throws on malformed JSON. */
export function decodeMemory(row: MemoryRow): Memory {
  const payload = JSON.parse(row.payload_json);
  switch (row.kind) {
    case 'observation':
      return { ...row, kind: 'observation', payload };
    case 'reflection':
      return { ...row, kind: 'reflection', payload };
    case 'plan':
      return { ...row, kind: 'plan', payload };
    case 'dialogue':
      return { ...row, kind: 'dialogue', payload };
  }
}

/** Importance heuristic. 1–10, Smallville scale. Tier-2 reflections
 *  may override; this is the default at write time. */
export function defaultImportance(payload: MemoryPayload): number {
  switch (payload.kind) {
    case 'observation':
      switch (payload.data.source) {
        case 'game_launched':
          return 8;
        case 'agent_meeting':
          return 6;
        case 'bookshelf_e':
          return 5;
        case 'terminal_crossing':
          return 5;
        case 'player_proximity':
          return 4;
        case 'cell_mount':
          return 3;
        case 'terminal_arrival':
          return 3;
        case 'self_perception':
          return 2;
      }
      return 2;
    case 'reflection':
      return 7;
    case 'plan':
      return 6;
    case 'dialogue':
      return payload.data.addressee === 'player' ? 6 : 3;
  }
}

/** Events-calendar ledger row (spec 2026-07-12-events-calendar-design). */
export interface WorldEventRow {
  day: string;      // YYYY-MM-DD, PK — one event max per day
  kind: string;     // 'note' | 'move'
  payload: string;  // DayEvent JSON
  staged_at: number;
}

/** Schema version. Bump when changing column shape; migration lives in db.ts.
 *  v3 (2026-07-17): +terminal_crossing/+terminal_arrival ObservationSource
 *  tokens — additive only (`source` is unconstrained TEXT; old rows untouched;
 *  the version table accumulates one row per version). */
export const SCHEMA_VERSION = 3;

/**
 * Phase 2A SQLite memory store. Wraps `better-sqlite3` + the `sqlite-vec`
 * extension. Electron-only — pure-web throws on `openMemoryDb()` because
 * neither package runs in a browser. The renderer has `nodeIntegration:
 * true, contextIsolation: false` (see `desktop/src/main.ts:97`) so
 * `require()` from the renderer works directly; no IPC bridge needed.
 * If a future hardening pass turns the sandbox back on, lift this
 * module into the main process and IPC-bridge `MemoryDb` — the public
 * surface is already async-friendly (better-sqlite3 calls are sync, but
 * our wrapper returns plain values, easy to wrap in IPC.invoke).
 *
 * sqlite-vec loads best-effort: if `loadExtension` fails (older
 * better-sqlite3 build without `allowExtension`, or extension binary
 * mismatch), we log + continue. Retrieval (slice 2D) checks
 * `db.hasVec` and falls back to FTS5-only.
 *
 * No `Math.random()` here. Determinism contract applies only to
 * `src/procedural/`; UUIDv7 *intentionally* uses crypto.getRandomValues
 * because memory ids should not be reproducible across runs (privacy +
 * vault filename collisions).
 */

import {
  MEMORY_KINDS,
  SCHEMA_VERSION,
  type LoreRow,
  type MemoryRow,
  type WorldEventRow,
} from './schema';

/** Public-facing wrapper. All methods are sync (better-sqlite3 is sync). */
export interface MemoryDb {
  readonly path: string;
  readonly hasVec: boolean;
  /** Insert a memory row. Throws on FK / CHECK failure. */
  insertMemory(row: MemoryRow): void;
  /** Update `accessed_at` for retrieval recency. No-op if id missing. */
  touchMemory(id: string, accessedAt: number): void;
  /** Overwrite the `text` field inside a row's payload. Used by vault
   *  re-import when an external editor changes the .md body. Other
   *  payload fields are preserved. */
  updateMemoryText(id: string, text: string): void;
  /** Attach an embedding to an existing memory. Both writes in one tx. */
  attachEmbedding(memoryId: string, embedding: Float32Array): void;
  /** Generic select-by-id helper; primarily for tests + vault re-import. */
  getMemory(id: string): MemoryRow | undefined;
  /** Recent memories for an agent, newest first. */
  recentForAgent(agentId: string, limit: number): MemoryRow[];
  /** Recent memories for a given cell + kind. Used by the cell renderer
   *  to read back persisted plans (e.g. Loki's "place a mark near the
   *  Hades shelf" on next mount). */
  recentByCellAndKind(cellId: string, kind: string, limit: number): MemoryRow[];
  /** FTS5 keyword search over memory text; returns rows ordered by bm25. */
  searchFts(query: string, agentId: string | null, limit: number): MemoryRow[];

  // ---- Lore (Phase 5C) — library-scoped uploaded canon, own tables ----
  /** Insert a lore chunk row. */
  insertLore(row: LoreRow): void;
  /** Attach an embedding to a lore row (lore_vec insert + FK update),
   *  both in one tx. No-op when sqlite-vec is unavailable. */
  attachLoreEmbedding(loreId: string, embedding: Float32Array): void;
  /** Most-recent lore chunks for a library, newest first. */
  recentLore(libraryId: string, limit: number): LoreRow[];
  /** FTS5 keyword search over lore text within one library. */
  searchLoreFts(query: string, libraryId: string, limit: number): LoreRow[];
  /** Cosine KNN over `lore_vec`. Returns up to `k` nearest rows
   *  globally (across libraries) with their cosine distance; the caller
   *  filters by library + slices to topK. Empty array when vec is off. */
  searchLoreVec(
    embedding: Float32Array,
    k: number,
  ): Array<{ row: LoreRow; distance: number }>;
  /** Count lore chunks in a library. */
  loreCount(libraryId: string): number;

  // ---- World-events ledger (events-calendar, 2026-07-12) ----
  /** Insert one day's staged event. INSERT OR IGNORE on the `day` PK —
   *  re-staging the same day is a no-op (idempotent). */
  insertWorldEvent(row: WorldEventRow): void;
  /** All ledger rows, day ASC. Small table (one row/day) — no paging. */
  listWorldEvents(): WorldEventRow[];

  /** Upsert per-agent persona row. */
  upsertPersona(agentId: string, name: string, systemPrompt: string, metadataJson: string): void;
  getPersona(agentId: string): { name: string; system_prompt: string; metadata_json: string } | undefined;
  /** Append a telemetry row (cost log). */
  logTelemetry(row: {
    agent_id: string;
    tier: 0 | 1 | 2;
    model: string;
    provider: string;
    tokens_in: number;
    tokens_out: number;
    latency_ms: number;
    cost_usd_est: number;
    created_at: number;
  }): void;
  /** Read telemetry rows in [sinceMs, now]. Used by the debug overlay
   *  (slice 2F) for live cost aggregation. */
  telemetrySince(sinceMs: number): Array<{
    agent_id: string;
    tier: number;
    model: string;
    provider: string;
    tokens_in: number;
    tokens_out: number;
    latency_ms: number;
    cost_usd_est: number;
    created_at: number;
  }>;
  close(): void;
}

export interface OpenOptions {
  /** Absolute path. Pass `:memory:` for in-memory (tests). */
  path: string;
  /** Quiet vec-extension warning. Useful in tests where we don't care. */
  suppressVecWarning?: boolean;
}

/**
 * Open + initialise the SQLite store. Idempotent — running twice on the
 * same path returns a connection against the already-bootstrapped DB.
 *
 * @throws if the host has no `require` (pure web build) or if
 * better-sqlite3 fails to construct (path permission / corrupt file).
 */
export function openMemoryDb(opts: OpenOptions): MemoryDb {
  const Database = loadBetterSqlite();
  const db = new Database(opts.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  // Tier-1 terminals: multiple renderer processes share this file (one
  // memory.sqlite per userData). WAL handles concurrent readers; a busy
  // writer should wait briefly, not throw SQLITE_BUSY into a tick.
  db.pragma('busy_timeout = 3000');

  const hasVec = tryLoadVec(db, opts.suppressVecWarning ?? false);
  bootstrap(db, hasVec);

  // Prepared statements — created once, reused per call.
  const insertMemoryStmt = db.prepare<MemoryRow>(`
    INSERT INTO memories
      (id, agent_id, cell_id, library_id, kind, created_at, accessed_at,
       importance, payload_json, embedding_id, parent_id)
    VALUES
      (@id, @agent_id, @cell_id, @library_id, @kind, @created_at,
       @accessed_at, @importance, @payload_json, @embedding_id, @parent_id)
  `);
  const touchStmt = db.prepare<{ id: string; accessed_at: number }>(
    `UPDATE memories SET accessed_at = @accessed_at WHERE id = @id`,
  );
  const updateTextStmt = db.prepare<{ id: string; payload_json: string }>(
    `UPDATE memories SET payload_json = @payload_json WHERE id = @id`,
  );
  const getMemoryStmt = db.prepare<string>(`SELECT * FROM memories WHERE id = ?`);
  // Secondary `id DESC` tie-breaks rows that share a millisecond timestamp.
  // UUIDv7 ids encode sub-ms ordering already, so id DESC matches insertion
  // order within a tick — important for `recentForAgent` to be stable.
  const recentStmt = db.prepare<[string, number]>(
    `SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
  );
  const cellKindStmt = db.prepare<[string, string, number]>(
    `SELECT * FROM memories
     WHERE cell_id = ? AND kind = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  );
  const ftsStmt = db.prepare<[string, number]>(`
    SELECT m.* FROM memories m
    JOIN memory_fts f ON f.rowid = m.rowid
    WHERE memory_fts MATCH ?
    ORDER BY bm25(memory_fts)
    LIMIT ?
  `);
  const ftsAgentStmt = db.prepare<[string, string, number]>(`
    SELECT m.* FROM memories m
    JOIN memory_fts f ON f.rowid = m.rowid
    WHERE memory_fts MATCH ? AND m.agent_id = ?
    ORDER BY bm25(memory_fts)
    LIMIT ?
  `);
  const upsertPersonaStmt = db.prepare<{
    agent_id: string; name: string; system_prompt: string;
    metadata_json: string; updated_at: number;
  }>(`
    INSERT INTO agent_personas (agent_id, name, system_prompt, metadata_json, updated_at)
    VALUES (@agent_id, @name, @system_prompt, @metadata_json, @updated_at)
    ON CONFLICT(agent_id) DO UPDATE SET
      name = excluded.name,
      system_prompt = excluded.system_prompt,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `);
  const getPersonaStmt = db.prepare<string>(
    `SELECT name, system_prompt, metadata_json FROM agent_personas WHERE agent_id = ?`,
  );
  const logTelemetryStmt = db.prepare<{
    agent_id: string; tier: number; model: string; provider: string;
    tokens_in: number; tokens_out: number; latency_ms: number;
    cost_usd_est: number; created_at: number;
  }>(`
    INSERT INTO agent_telemetry
      (agent_id, tier, model, provider, tokens_in, tokens_out,
       latency_ms, cost_usd_est, created_at)
    VALUES
      (@agent_id, @tier, @model, @provider, @tokens_in, @tokens_out,
       @latency_ms, @cost_usd_est, @created_at)
  `);
  const telemetrySinceStmt = db.prepare<number>(`
    SELECT agent_id, tier, model, provider, tokens_in, tokens_out,
           latency_ms, cost_usd_est, created_at
    FROM agent_telemetry
    WHERE created_at >= ?
    ORDER BY created_at ASC
  `);

  // ---- Lore statements (Phase 5C) ----
  const insertLoreStmt = db.prepare<LoreRow>(`
    INSERT INTO lore (id, library_id, text, source, created_at, embedding_id)
    VALUES (@id, @library_id, @text, @source, @created_at, @embedding_id)
  `);
  const recentLoreStmt = db.prepare<[string, number]>(
    `SELECT * FROM lore WHERE library_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
  );
  const loreFtsStmt = db.prepare<[string, string, number]>(`
    SELECT l.* FROM lore l
    JOIN lore_fts f ON f.rowid = l.rowid
    WHERE lore_fts MATCH ? AND l.library_id = ?
    ORDER BY bm25(lore_fts)
    LIMIT ?
  `);
  const loreCountStmt = db.prepare<string>(
    `SELECT COUNT(*) AS n FROM lore WHERE library_id = ?`,
  );

  // ---- World-events statements ----
  const insertWorldEventStmt = db.prepare<WorldEventRow>(`
    INSERT OR IGNORE INTO world_events (day, kind, payload, staged_at)
    VALUES (@day, @kind, @payload, @staged_at)
  `);
  const listWorldEventsStmt = db.prepare(
    `SELECT day, kind, payload, staged_at FROM world_events ORDER BY day ASC`,
  );

  let insertVecStmt: { run: (b: Uint8Array) => { lastInsertRowid: number | bigint } } | null = null;
  let updateEmbeddingFkStmt: { run: (...a: unknown[]) => unknown } | null = null;
  let insertLoreVecStmt: { run: (b: Uint8Array) => { lastInsertRowid: number | bigint } } | null = null;
  let updateLoreFkStmt: { run: (...a: unknown[]) => unknown } | null = null;
  let loreVecStmt: { all: (b: Uint8Array, k: number) => unknown[] } | null = null;
  if (hasVec) {
    insertVecStmt = db.prepare(`INSERT INTO memory_vec (embedding) VALUES (?)`);
    updateEmbeddingFkStmt = db.prepare(
      `UPDATE memories SET embedding_id = ? WHERE id = ?`,
    );
    insertLoreVecStmt = db.prepare(`INSERT INTO lore_vec (embedding) VALUES (?)`);
    updateLoreFkStmt = db.prepare(`UPDATE lore SET embedding_id = ? WHERE id = ?`);
    loreVecStmt = db.prepare(`
      SELECT l.id, l.library_id, l.text, l.source, l.created_at, l.embedding_id,
             v.distance AS distance
      FROM lore_vec v
      JOIN lore l ON l.embedding_id = v.rowid
      WHERE v.embedding MATCH ? AND k = ?
      ORDER BY v.distance
    `) as unknown as { all: (b: Uint8Array, k: number) => unknown[] };
  }

  // better-sqlite3 accepts Uint8Array for BLOB binds; no need for Buffer here.
  const attachEmbeddingTx = hasVec
    ? db.transaction((memoryId: string, vec: Float32Array) => {
        const bytes = new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
        const res = insertVecStmt!.run(bytes);
        const rowid = Number(res.lastInsertRowid);
        updateEmbeddingFkStmt!.run(rowid, memoryId);
      })
    : null;

  const attachLoreEmbeddingTx = hasVec
    ? db.transaction((loreId: string, vec: Float32Array) => {
        const bytes = new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
        const res = insertLoreVecStmt!.run(bytes);
        const rowid = Number(res.lastInsertRowid);
        updateLoreFkStmt!.run(rowid, loreId);
      })
    : null;

  return {
    path: opts.path,
    hasVec,
    insertMemory(row) {
      insertMemoryStmt.run(row);
    },
    touchMemory(id, accessedAt) {
      touchStmt.run({ id, accessed_at: accessedAt });
    },
    updateMemoryText(id, text) {
      const existing = getMemoryStmt.get(id) as MemoryRow | undefined;
      if (!existing) return;
      const payload = JSON.parse(existing.payload_json) as { text?: string };
      payload.text = text;
      updateTextStmt.run({ id, payload_json: JSON.stringify(payload) });
    },
    attachEmbedding(memoryId, embedding) {
      if (!attachEmbeddingTx) {
        // Vec disabled — silently skip; retrieval falls back to FTS5.
        return;
      }
      attachEmbeddingTx(memoryId, embedding);
    },
    getMemory(id) {
      return getMemoryStmt.get(id) as MemoryRow | undefined;
    },
    recentForAgent(agentId, limit) {
      return recentStmt.all(agentId, limit) as MemoryRow[];
    },
    recentByCellAndKind(cellId, kind, limit) {
      return cellKindStmt.all(cellId, kind, limit) as MemoryRow[];
    },
    searchFts(query, agentId, limit) {
      const stmt = agentId ? ftsAgentStmt : ftsStmt;
      const rows = agentId
        ? stmt.all(query, agentId, limit)
        : stmt.all(query, limit);
      return rows as MemoryRow[];
    },
    insertLore(row) {
      insertLoreStmt.run(row);
    },
    attachLoreEmbedding(loreId, embedding) {
      if (!attachLoreEmbeddingTx) return; // vec disabled — FTS5 fallback
      attachLoreEmbeddingTx(loreId, embedding);
    },
    recentLore(libraryId, limit) {
      return recentLoreStmt.all(libraryId, limit) as LoreRow[];
    },
    searchLoreFts(query, libraryId, limit) {
      return loreFtsStmt.all(query, libraryId, limit) as LoreRow[];
    },
    searchLoreVec(embedding, k) {
      if (!loreVecStmt) return [];
      const bytes = new Uint8Array(
        embedding.buffer,
        embedding.byteOffset,
        embedding.byteLength,
      );
      const rows = loreVecStmt.all(bytes, k) as Array<
        LoreRow & { distance: number }
      >;
      return rows.map(({ distance, ...row }) => ({ row, distance }));
    },
    loreCount(libraryId) {
      const r = loreCountStmt.get(libraryId) as { n: number } | undefined;
      return r?.n ?? 0;
    },
    insertWorldEvent(row) {
      insertWorldEventStmt.run(row);
    },
    listWorldEvents() {
      return listWorldEventsStmt.all() as WorldEventRow[];
    },
    upsertPersona(agentId, name, systemPrompt, metadataJson) {
      upsertPersonaStmt.run({
        agent_id: agentId,
        name,
        system_prompt: systemPrompt,
        metadata_json: metadataJson,
        updated_at: Date.now(),
      });
    },
    getPersona(agentId) {
      const r = getPersonaStmt.get(agentId) as
        | { name: string; system_prompt: string; metadata_json: string }
        | undefined;
      return r;
    },
    logTelemetry(row) {
      logTelemetryStmt.run(row);
    },
    telemetrySince(sinceMs) {
      return telemetrySinceStmt.all(sinceMs) as Array<{
        agent_id: string;
        tier: number;
        model: string;
        provider: string;
        tokens_in: number;
        tokens_out: number;
        latency_ms: number;
        cost_usd_est: number;
        created_at: number;
      }>;
    },
    close() {
      db.close();
    },
  };
}

// ---------- internal ----------

function loadBetterSqlite(): BetterSqliteCtor {
  const req = pickRequire();
  if (!req) {
    throw new Error(
      '[memory/db] better-sqlite3 unavailable — this module only runs ' +
        'in Electron (nodeIntegration) or Node. The web build cannot ' +
        'hold the memory store.',
    );
  }
  try {
    return req('better-sqlite3') as BetterSqliteCtor;
  } catch (e) {
    throw new Error(
      `[memory/db] failed to require('better-sqlite3'): ${(e as Error).message}. ` +
        'In desktop/, run \`npm run rebuild\` (electron-rebuild) so the native ' +
        'module is built against Electron\'s Node ABI.',
    );
  }
}

function tryLoadVec(db: SqliteHandle, suppressWarning: boolean): boolean {
  const req = pickRequire();
  if (!req) return false;
  try {
    // sqlite-vec ships a `.load(db)` helper that resolves the right
    // platform binary and calls `db.loadExtension()` for us.
    const sqliteVec = req('sqlite-vec') as { load: (d: SqliteHandle) => void };
    sqliteVec.load(db);
    return true;
  } catch (e) {
    if (!suppressWarning) {
      // eslint-disable-next-line no-console
      console.warn(
        `[memory/db] sqlite-vec unavailable (${(e as Error).message}); ` +
          'retrieval will degrade to FTS5-only.',
      );
    }
    return false;
  }
}

function bootstrap(db: SqliteHandle, hasVec: boolean): void {
  const kindCheck = MEMORY_KINDS.map((k) => `'${k}'`).join(',');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
    INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION});

    CREATE TABLE IF NOT EXISTS memories (
      id           TEXT PRIMARY KEY,
      agent_id     TEXT NOT NULL,
      cell_id      TEXT NOT NULL,
      library_id   TEXT NOT NULL,
      kind         TEXT NOT NULL CHECK (kind IN (${kindCheck})),
      created_at   INTEGER NOT NULL,
      accessed_at  INTEGER NOT NULL,
      importance   INTEGER NOT NULL CHECK (importance BETWEEN 1 AND 10),
      payload_json TEXT NOT NULL,
      embedding_id INTEGER,
      parent_id    TEXT,
      FOREIGN KEY (parent_id) REFERENCES memories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_memories_agent_created
      ON memories(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_agent_kind
      ON memories(agent_id, kind, importance DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_cell
      ON memories(cell_id, agent_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
      USING fts5(text, content='', contentless_delete=1);

    CREATE TABLE IF NOT EXISTS agent_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      tier INTEGER NOT NULL CHECK (tier IN (0,1,2)),
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      tokens_in INTEGER NOT NULL,
      tokens_out INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      cost_usd_est REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_created
      ON agent_telemetry(created_at DESC);

    CREATE TABLE IF NOT EXISTS agent_personas (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- World-events ledger (events-calendar, spec 2026-07-12). One row
    -- per calendar day the palace staged an event; day is the PK, which
    -- makes staging idempotent (INSERT OR IGNORE). Global, not
    -- library-scoped — the calendar is a property of the world, not the viewer.
    CREATE TABLE IF NOT EXISTS world_events (
      day       TEXT PRIMARY KEY,
      kind      TEXT NOT NULL CHECK (kind IN ('note','move')),
      payload   TEXT NOT NULL,
      staged_at INTEGER NOT NULL
    );

    -- Lore (Phase 5C). Library-scoped uploaded canon, additive — its own
    -- table + FTS + vec, never touching the memories contract. id is a
    -- TEXT PK (UUIDv7) so the implicit rowid still feeds lore_fts/lore_vec.
    CREATE TABLE IF NOT EXISTS lore (
      id           TEXT PRIMARY KEY,
      library_id   TEXT NOT NULL,
      text         TEXT NOT NULL,
      source       TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      embedding_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_lore_library
      ON lore(library_id, created_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS lore_fts
      USING fts5(text, content='', contentless_delete=1);
  `);

  // lore_fts triggers — lore.text is a real column (not JSON), so the
  // trigger inserts new.text directly rather than json_extract.
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS lore_ai_fts
    AFTER INSERT ON lore BEGIN
      INSERT INTO lore_fts (rowid, text) VALUES (new.rowid, new.text);
    END;
    CREATE TRIGGER IF NOT EXISTS lore_ad_fts
    AFTER DELETE ON lore BEGIN
      DELETE FROM lore_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER IF NOT EXISTS lore_au_fts
    AFTER UPDATE ON lore BEGIN
      DELETE FROM lore_fts WHERE rowid = old.rowid;
      INSERT INTO lore_fts (rowid, text) VALUES (new.rowid, new.text);
    END;
  `);

  // FTS5 triggers — keep `memory_fts` in sync with `memories`. We use
  // contentless FTS (content='') because the FTS row text is just the
  // payload's `text` field, not the full row. Triggers extract it from
  // `payload_json` via json_extract.
  // FTS5 contentless_delete=1 allows plain DELETE on the FTS table;
  // the legacy 'delete'-magic insert is rejected (SQLITE_ERROR). Use
  // DELETE + INSERT rather than the legacy form so the schema stays
  // compatible with whatever contentless mode we land on.
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ai_fts
    AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts (rowid, text)
      VALUES (new.rowid, json_extract(new.payload_json, '$.text'));
    END;
    CREATE TRIGGER IF NOT EXISTS memories_ad_fts
    AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER IF NOT EXISTS memories_au_fts
    AFTER UPDATE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts (rowid, text)
      VALUES (new.rowid, json_extract(new.payload_json, '$.text'));
    END;
  `);

  if (hasVec) {
    // 768-dim matches nomic-embed-text (slice 2D).
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(embedding float[768]);`,
    );
    // Lore uses an explicit cosine metric (Phase 5C): nomic-embed-text
    // vectors aren't unit-normalised, so cosine — not the default L2 —
    // is the right semantic-similarity measure for lore retrieval.
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS lore_vec USING vec0(embedding float[768] distance_metric=cosine);`,
    );
  }
}

// ---------- environment glue ----------

/**
 * Resolve a `require` function in a way Vite / Rollup won't statically
 * follow. In Electron renderer with nodeIntegration this returns
 * `window.require`; in Node it returns `module.require`. In a vanilla
 * browser it returns null (and `loadBetterSqlite` throws cleanly).
 */
function pickRequire(): ((id: string) => unknown) | null {
  type RequireBearer = { require?: (id: string) => unknown };
  const g = globalThis as unknown as RequireBearer;
  if (typeof g.require === 'function') return g.require.bind(g);
  return null;
}

// Shapes loose enough that we don't need to depend on better-sqlite3 typings.
interface SqliteHandle {
  exec: (sql: string) => unknown;
  prepare: <P = unknown>(sql: string) => PreparedStmt<P>;
  pragma: (s: string) => unknown;
  transaction: <Args extends unknown[]>(
    fn: (...args: Args) => void,
  ) => (...args: Args) => void;
  close: () => void;
}
interface PreparedStmt<P> {
  run: (params?: P, ...rest: unknown[]) => { lastInsertRowid: number | bigint };
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown;
}
type BetterSqliteCtor = new (path: string) => SqliteHandle;

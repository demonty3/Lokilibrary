/**
 * Lazy bootstrap of the renderer-side memory store. Web build returns
 * the null writer (`router.nullMemoryWriter`); Electron resolves the
 * user-data path via the preload IPC and constructs the DB-backed
 * writer once. Subsequent calls return the same instance — memory
 * doesn't need to be re-initialised on theme / profile changes; only
 * the namespace (cell_id / library_id) changes.
 *
 * Currently called from App.tsx on mount before mountPalace. Profile
 * remount (slice 2G) will re-derive cell_id + library_id from the
 * loaded profile and rebuild the writer with the new namespace.
 *
 * Failure modes:
 *   - `window.electronAPI` missing → web build path, returns null writer
 *   - getUserDataPath rejects → log, return null writer (no crash)
 *   - openMemoryDb throws → log, return null writer
 * The renderer never blocks on memory store availability — the cohort
 * just runs without DB persistence (same surface as web).
 */

import { nullMemoryWriter, type MemoryWriter } from '../router';
import { getElectronAPI } from '../../api/electron';
import { cellIdFor, libraryIdFor } from './schema';
import { openMemoryDb, type MemoryDb } from './db';
import { openMemoryVault, type MemoryVault } from './vault';
import { buildMemoryWriter } from './writer';
import type { Profile } from '../../types';

export interface BootstrapResult {
  writer: MemoryWriter;
  db: MemoryDb | null;
  vault: MemoryVault | null;
  /** Resolved user-data root (Electron only); null in the web build. */
  rootDir: string | null;
}

let cached: BootstrapResult | null = null;

export interface BootstrapNamespace {
  cellId: string;
  libraryId: string;
}

/** Derive the (cell_id, library_id) namespace from a Profile + seed.
 *  Pure helper — callers may want to compute the namespace without
 *  bootstrapping (tests). */
export function namespaceFor(
  profile: Profile | null,
  steamId: string | null,
  seed: number,
): BootstrapNamespace {
  return {
    cellId: cellIdFor(seed),
    libraryId: libraryIdFor(steamId ?? (profile ? null : 'anonymous')),
  };
}

/**
 * Idempotent bootstrap. First call opens the DB; later calls return
 * the cached instance regardless of namespace. The MemoryWriter wraps
 * the namespace closure, so namespace changes require a fresh writer —
 * `bootstrapMemory({ namespace, rebuild: true })` for that.
 */
export async function bootstrapMemory(opts: {
  namespace: BootstrapNamespace;
  rebuild?: boolean;
}): Promise<BootstrapResult> {
  if (cached && !opts.rebuild) return cached;

  const api = getElectronAPI();
  if (!api) {
    cached = {
      writer: nullMemoryWriter,
      db: null,
      vault: null,
      rootDir: null,
    };
    return cached;
  }

  let rootDir: string;
  try {
    rootDir = await api.getUserDataPath();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[memory/bootstrap] getUserDataPath failed; falling back to null writer: ${(e as Error).message}`,
    );
    cached = { writer: nullMemoryWriter, db: null, vault: null, rootDir: null };
    return cached;
  }

  // If we already have a DB open and only the namespace changed,
  // rebuild the writer without reopening the file.
  if (cached?.db && opts.rebuild) {
    const writer = buildMemoryWriter({
      db: cached.db,
      vault: cached.vault,
      ns: opts.namespace,
    });
    cached = { ...cached, writer };
    return cached;
  }

  try {
    const req = (globalThis as { require?: (id: string) => unknown }).require;
    if (!req) throw new Error('require unavailable in renderer');
    const path = req('node:path') as { join: (...p: string[]) => string };
    const dbPath = path.join(rootDir, 'memory.sqlite');
    const vaultDir = path.join(rootDir, 'vaults');
    const db = openMemoryDb({ path: dbPath });
    const vault = openMemoryVault({ rootDir: vaultDir });
    const writer = buildMemoryWriter({ db, vault, ns: opts.namespace });
    // eslint-disable-next-line no-console
    console.log(
      `[memory/bootstrap] db ready at ${dbPath} (hasVec=${db.hasVec}); vault at ${vaultDir}`,
    );
    cached = { writer, db, vault, rootDir };
    return cached;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[memory/bootstrap] failed to open store: ${(e as Error).message}; falling back to null writer`,
    );
    cached = { writer: nullMemoryWriter, db: null, vault: null, rootDir: null };
    return cached;
  }
}

/** Drop the cached singleton. Useful for tests + the slice-2G
 *  profile remount that wants a fresh writer instance. */
export function resetBootstrap(): void {
  if (cached?.db) {
    try {
      cached.db.close();
    } catch {
      /* ignore */
    }
  }
  cached = null;
}

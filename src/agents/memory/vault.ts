/**
 * Markdown vault export — the Obsidian-shaped surface on top of the
 * SQLite memory stream. SQLite is the runtime source of truth; the
 * vault is the human-inspectable + version-controllable mirror, and
 * (post Phase 5) the editing surface.
 *
 * Path: `<rootDir>/<agent_id>/<created_at>--<kind>--<uuid>.md`
 *
 * Frontmatter mirrors row columns; body is `payload.text` plus
 * `[[backlinks]]` for `parent_id` references. Filenames are stable —
 * the `<created_at>--<kind>--<uuid>` triplet is unique per row and
 * collates in time order in `ls`.
 *
 * Re-import (slice 2A scope): scans for `.md` files whose mtime
 * exceeds the previously-seen value for that file. If the file's body
 * differs from the row's `payload.text`, the DB is updated (text-only
 * edits — schema changes need a vault-tool, not direct .md edits).
 * Re-import is opt-in via `reimportChanged(db)`; we never auto-import
 * on the write path because edits should be deliberate.
 *
 * Like db.ts this module is Electron/Node-only. `pickRequire()` mirrors
 * db.ts so the pattern stays consistent if we ever lift either into the
 * main process.
 */

import type { MemoryDb } from './db';
import type { MemoryRow } from './schema';

export interface MemoryVault {
  readonly rootDir: string;
  /** Write or overwrite the vault file for a row. Idempotent. */
  write(row: MemoryRow): void;
  /** Scan for externally-edited files; update DB text where they differ.
   *  Returns the number of memories whose text was updated. */
  reimportChanged(db: MemoryDb): number;
  /** Vault file path for a row, without writing. Useful for tests. */
  pathFor(row: MemoryRow): string;
  /** Number of `.md` files currently in the vault. Useful for tests. */
  count(): number;
}

export interface OpenVaultOptions {
  /** Absolute directory. Created if missing. */
  rootDir: string;
}

export function openMemoryVault(opts: OpenVaultOptions): MemoryVault {
  const fs = loadNodeFs();
  const path = loadNodePath();

  fs.mkdirSync(opts.rootDir, { recursive: true });

  // Track last-seen mtime per file so reimportChanged only processes
  // genuinely modified files. Map<absPath, mtimeMs>.
  const seenMtime = new Map<string, number>();

  // Prime from existing files so the first reimport call after restart
  // doesn't claim every pre-existing file as "changed."
  for (const f of walkMdFiles(fs, path, opts.rootDir)) {
    const stat = fs.statSync(f);
    seenMtime.set(f, stat.mtimeMs);
  }

  return {
    rootDir: opts.rootDir,
    write(row) {
      const file = pathForRow(path, opts.rootDir, row);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const md = renderMd(row);
      fs.writeFileSync(file, md, 'utf8');
      const stat = fs.statSync(file);
      seenMtime.set(file, stat.mtimeMs);
    },
    reimportChanged(db) {
      let updated = 0;
      for (const f of walkMdFiles(fs, path, opts.rootDir)) {
        const stat = fs.statSync(f);
        const prev = seenMtime.get(f) ?? 0;
        if (stat.mtimeMs <= prev) continue;
        seenMtime.set(f, stat.mtimeMs);
        const id = idFromFilename(path, f);
        if (!id) continue;
        const row = db.getMemory(id);
        if (!row) continue;
        const body = fs.readFileSync(f, 'utf8');
        const newText = parseBody(body);
        if (newText == null) continue;
        const existingText = textOfRow(row);
        if (newText === existingText) continue;
        db.updateMemoryText(id, newText);
        updated++;
      }
      return updated;
    },
    pathFor(row) {
      return pathForRow(path, opts.rootDir, row);
    },
    count() {
      let n = 0;
      for (const _ of walkMdFiles(fs, path, opts.rootDir)) n++;
      return n;
    },
  };
}

// ---------- file layout ----------

function pathForRow(p: NodePath, root: string, row: MemoryRow): string {
  const dir = p.join(root, sanitize(row.agent_id));
  return p.join(dir, `${row.created_at}--${row.kind}--${row.id}.md`);
}

function idFromFilename(p: NodePath, file: string): string | null {
  const base = p.basename(file, '.md');
  // <created_at>--<kind>--<uuid>
  const parts = base.split('--');
  if (parts.length < 3) return null;
  const id = parts.slice(2).join('--'); // uuid contains hyphens; rejoin
  if (!/^[0-9a-f-]+$/.test(id)) return null;
  return id;
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// ---------- markdown rendering ----------

function renderMd(row: MemoryRow): string {
  const fm = renderFrontmatter(row);
  const body = bodyFor(row);
  return `${fm}\n${body}\n`;
}

function renderFrontmatter(row: MemoryRow): string {
  // Hand-rolled YAML — no nested values, no quoting needed beyond
  // escaping the few problem chars. Keep this trivial; if it grows,
  // pull in `yaml`.
  const lines = [
    '---',
    `id: ${row.id}`,
    `agent_id: ${yamlScalar(row.agent_id)}`,
    `cell_id: ${yamlScalar(row.cell_id)}`,
    `library_id: ${yamlScalar(row.library_id)}`,
    `kind: ${row.kind}`,
    `created_at: ${row.created_at}`,
    `importance: ${row.importance}`,
  ];
  if (row.parent_id) lines.push(`parent_id: ${row.parent_id}`);
  lines.push('---');
  return lines.join('\n');
}

function bodyFor(row: MemoryRow): string {
  const text = textOfRow(row) ?? '';
  const links = backlinksFor(row);
  return links ? `${text}\n\n${links}` : text;
}

function backlinksFor(row: MemoryRow): string {
  if (row.parent_id) return `Parent: [[${row.parent_id}]]`;
  // For reflections, `synthesised_from` is the rich link set; surface
  // it in the body so a vault reader can jump-by-link.
  if (row.kind === 'reflection') {
    try {
      const payload = JSON.parse(row.payload_json) as {
        synthesised_from?: string[];
      };
      if (payload.synthesised_from?.length) {
        return (
          'Synthesised from:\n' +
          payload.synthesised_from.map((id) => `- [[${id}]]`).join('\n')
        );
      }
    } catch {
      /* malformed payload — render text only */
    }
  }
  return '';
}

function textOfRow(row: MemoryRow): string | null {
  try {
    const payload = JSON.parse(row.payload_json) as { text?: string };
    return payload.text ?? null;
  } catch {
    return null;
  }
}

function yamlScalar(s: string): string {
  // Quote if contains characters YAML reserves; otherwise bare.
  if (/[:#{}\[\],&*!|>'"%@`]/.test(s) || /^\s/.test(s) || /\s$/.test(s)) {
    return JSON.stringify(s); // JSON strings are valid YAML double-quoted strings.
  }
  return s;
}

/**
 * Strip frontmatter + trailing backlinks block, returning the user's
 * editable text. Conservative — if the file doesn't match the format
 * we wrote, returns null and skips re-import for that file.
 */
function parseBody(md: string): string | null {
  if (!md.startsWith('---\n')) return null;
  const end = md.indexOf('\n---\n', 4);
  if (end === -1) return null;
  let body = md.slice(end + 5);
  // Strip trailing newline padding we added.
  body = body.replace(/\n+$/, '');
  // Strip the backlinks block if present.
  body = body.replace(/\n+(?:Parent: \[\[[^\]]+\]\]|Synthesised from:\n(?:- \[\[[^\]]+\]\]\n?)+)$/, '');
  return body;
}

// ---------- internal: fs walk + raw update ----------

function* walkMdFiles(
  fs: NodeFs,
  path: NodePath,
  root: string,
): IterableIterator<string> {
  // Two-level walk: rootDir / agent_id / *.md
  let topEntries: string[];
  try {
    topEntries = fs.readdirSync(root);
  } catch {
    return;
  }
  for (const agent of topEntries) {
    const agentDir = path.join(root, agent);
    let stat;
    try {
      stat = fs.statSync(agentDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    let files: string[];
    try {
      files = fs.readdirSync(agentDir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      yield path.join(agentDir, f);
    }
  }
}

// ---------- environment glue ----------

function pickRequire(): ((id: string) => unknown) | null {
  type RequireBearer = { require?: (id: string) => unknown };
  const g = globalThis as unknown as RequireBearer;
  if (typeof g.require === 'function') return g.require.bind(g);
  return null;
}

function loadNodeFs(): NodeFs {
  const req = pickRequire();
  if (!req) {
    throw new Error('[memory/vault] node:fs unavailable — Electron/Node only.');
  }
  return req('node:fs') as NodeFs;
}

function loadNodePath(): NodePath {
  const req = pickRequire();
  if (!req) {
    throw new Error('[memory/vault] node:path unavailable — Electron/Node only.');
  }
  return req('node:path') as NodePath;
}

interface NodeFs {
  mkdirSync(p: string, opts?: { recursive?: boolean }): void;
  writeFileSync(p: string, data: string, enc: string): void;
  readFileSync(p: string, enc: string): string;
  readdirSync(p: string): string[];
  statSync(p: string): { mtimeMs: number; isDirectory(): boolean };
}
interface NodePath {
  join(...parts: string[]): string;
  dirname(p: string): string;
  basename(p: string, ext?: string): string;
}

/**
 * Lore-upload drop-zone (Phase 5C slice 5C.2b).
 *
 * A DOM React component — NOT a PIXI overlay — because HTML5 file
 * drag-drop (`dataTransfer` / `File.text()`) is a DOM-only API. Rendered
 * as a sibling of the PIXI canvas in App.tsx (same pattern as <Hud>),
 * gated on `store.loreUploadOpen` (toggled by Ctrl+U).
 *
 * Flow on drop / pick: read each `.txt` / `.md` file's text, hand it to
 * `ingestLore` (chunk → embed → recordLore against the bootstrapped
 * memory writer). Embedding is best-effort — chunks persist for FTS5 even
 * when /api/embed 501s (web build / cloud provider).
 *
 * Terminal aesthetic, hardcoded palette to match <Hud> (the DOM layer
 * doesn't thread the PIXI theme).
 */

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import { getCurrentMemoryWriter } from '../agents/memory/bootstrap';
import { ingestLore, type IngestResult } from '../agents/lore-ingest';

const ACCEPT = ['.txt', '.md'];
const MAX_BYTES = 1024 * 1024; // 1 MB — lore is text, not novels

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; label: string }
  | { kind: 'done'; results: IngestResult[] }
  | { kind: 'error'; message: string };

function accepted(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPT.some((ext) => lower.endsWith(ext));
}

export function LoreDropZone() {
  const open = useAppStore((s) => s.loreUploadOpen);
  const close = useAppStore((s) => s.setLoreUploadOpen);
  const loreEnabled = useAppStore((s) => s.loreEnabled);
  const setLoreEnabled = useAppStore((s) => s.setLoreEnabled);
  const loreQuoteEnabled = useAppStore((s) => s.loreQuoteEnabled);
  const setLoreQuoteEnabled = useAppStore((s) => s.setLoreQuoteEnabled);
  const bumpLoreVersion = useAppStore((s) => s.bumpLoreVersion);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ingestFiles = useCallback(async (files: File[]) => {
    const writer = getCurrentMemoryWriter();
    if (!writer) {
      setStatus({
        kind: 'error',
        message: 'memory store unavailable — lore upload needs the desktop app',
      });
      return;
    }
    const usable = files.filter((f) => accepted(f.name));
    if (usable.length === 0) {
      setStatus({ kind: 'error', message: 'drop a .txt or .md file' });
      return;
    }
    const results: IngestResult[] = [];
    for (const file of usable) {
      if (file.size > MAX_BYTES) {
        setStatus({ kind: 'error', message: `${file.name} is over 1 MB` });
        return;
      }
      setStatus({ kind: 'working', label: `reading ${file.name}…` });
      let text: string;
      try {
        text = await file.text();
      } catch (e) {
        setStatus({ kind: 'error', message: `read failed: ${(e as Error).message}` });
        return;
      }
      setStatus({ kind: 'working', label: `embedding ${file.name}…` });
      const result = await ingestLore(text, file.name, writer);
      results.push(result);
    }
    // Phase 5D.4: the lore corpus grew — bump loreVersion so App.tsx's
    // palace-mount effect remounts the world with the theme recomputed
    // from the new corpus (LOCAL palette recolor; no egress).
    bumpLoreVersion();
    setStatus({ kind: 'done', results });
  }, [bumpLoreVersion]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void ingestFiles(Array.from(e.dataTransfer.files));
    },
    [ingestFiles],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) void ingestFiles(Array.from(e.target.files));
    },
    [ingestFiles],
  );

  if (!open) return null;

  return (
    <div
      onClick={() => close(false)}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        font: '13px/1.5 ui-monospace, monospace',
        color: '#cdd6f4',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: 460,
          maxWidth: '80vw',
          border: `1px dashed ${dragging ? '#a6e3a1' : '#585b70'}`,
          background: dragging ? 'rgba(166,227,161,0.08)' : 'rgba(30,30,46,0.97)',
          padding: '20px 22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: '#f9e2af' }}>── upload lore ──</span>
          <span
            onClick={() => close(false)}
            style={{ cursor: 'pointer', opacity: 0.7 }}
            title="close (Ctrl+U / Esc)"
          >
            ✕
          </span>
        </div>

        <p style={{ margin: '0 0 12px', opacity: 0.8 }}>
          Drop a <code>.txt</code> or <code>.md</code> file — your campaign
          notes, fanfic, worldbuilding. The agents start weaving its names
          and places into what they notice.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          style={{
            font: 'inherit',
            color: '#cdd6f4',
            background: 'transparent',
            border: '1px solid #585b70',
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          choose file…
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          multiple
          onChange={onPick}
          style={{ display: 'none' }}
        />

        <div style={{ marginTop: 14, minHeight: 20, opacity: 0.9 }}>
          {status.kind === 'working' && <span>{status.label}</span>}
          {status.kind === 'error' && (
            <span style={{ color: '#f38ba8' }}>⚠ {status.message}</span>
          )}
          {status.kind === 'done' &&
            status.results.map((r, i) => (
              <div key={i} style={{ color: '#a6e3a1' }}>
                ✓ {r.source}: {r.chunkCount} chunk{r.chunkCount === 1 ? '' : 's'}
                {r.embeddedCount > 0
                  ? ` embedded`
                  : ` stored (FTS-only${r.embedError ? `: ${r.embedError}` : ''})`}
              </div>
            ))}
        </div>

        <label
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid #585b70',
            cursor: 'pointer',
            alignItems: 'flex-start',
          }}
        >
          <input
            type="checkbox"
            checked={loreEnabled}
            onChange={(e) => setLoreEnabled(e.target.checked)}
            style={{ accentColor: '#a6e3a1', marginTop: 2 }}
          />
          <span style={{ opacity: 0.85 }}>
            <strong style={{ color: '#a6e3a1' }}>Theme &amp; mood.</strong> Let your
            lore steer the agents' voice. Sends only abstract theme tags (e.g.{' '}
            <code>nautical</code>, <code>gothic</code>) to the model — never your
            uploaded text. Off by default.
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 10,
            cursor: 'pointer',
            alignItems: 'flex-start',
          }}
        >
          <input
            type="checkbox"
            checked={loreQuoteEnabled}
            onChange={(e) => setLoreQuoteEnabled(e.target.checked)}
            style={{ accentColor: '#f9e2af', marginTop: 2 }}
          />
          <span style={{ opacity: 0.85 }}>
            <strong style={{ color: '#f9e2af' }}>Quote directly.</strong> Let agents
            reference specific names and places from your notes. Sends relevant{' '}
            <em>excerpts of your uploaded text</em> (and its filename) to the
            model. Off by default.
          </span>
        </label>
      </div>
    </div>
  );
}

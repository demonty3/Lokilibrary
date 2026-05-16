import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import type { ManifestStatus } from '../state/store';
import { useAppStore } from '../state/store';

/**
 * Overlay panel summoned by the in-world computer. v0.1 surfaces the three
 * service slots that the rest of the build wires up:
 *   - Steam Library (v0.2 — OpenID + GetOwnedGames)
 *   - Claude / Anthropic (v0.1 — via Cloudflare Worker proxy; keys live in
 *     worker/.dev.vars, never the client)
 *   - Asset Pipeline (Meshy/Tripo for 3D, image-gen for 2D — all baked at
 *     template-build time per SPEC §12)
 *
 * Buttons are disabled placeholders until the relevant backend lands.
 */
export function ConnectorPanel() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const closeMenu = useAppStore((s) => s.closeMenu);
  const manifestStatus = useAppStore((s) => s.manifestStatus);
  const manifestSource = useAppStore((s) => s.manifestSource);
  const manifestError = useAppStore((s) => s.manifestError);
  const manifest = useAppStore((s) => s.manifest);

  useEffect(() => {
    if (!menuOpen) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, closeMenu]);

  if (!menuOpen) return null;

  return (
    <div style={backdropStyle}>
      <div style={panelStyle}>
        <header style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>LIBRARYWORLD</div>
            <div style={titleStyle}>System</div>
          </div>
          <button onClick={closeMenu} style={btnGhostStyle}>close · esc</button>
        </header>

        <Section
          title="Steam Library"
          status="not connected"
          statusColor="#7a6a7a"
          description="Sign in with Steam OpenID. Pulls owned games, playtime, recent activity, achievements. Wires up at v0.2 — for v0.1 the library is hard-coded."
          action="Connect Steam — v0.2"
        />

        <Section
          title="Claude (Anthropic)"
          status={claudeStatusLabel(manifestStatus, manifestSource)}
          statusColor={claudeStatusColor(manifestStatus, manifestSource)}
          description={claudeStatusDescription(manifestStatus, manifestSource, manifestError, manifest?.metaphor)}
          action="—"
        />

        <Section
          title="Asset Pipeline"
          status="meshy account ready"
          statusColor="#7accbf"
          description="3D hero objects via Meshy/Tripo, 2D environment textures via image-gen — both baked at template-build time with curation discipline (5–10 candidates per asset, hand-pick, no runtime gen). CC0 packs (Kenney, Quaternius) for filler. Per-game art stays Steam CDN; see SPEC §12."
          action="Wire seaside_town pipeline — next"
        />

        <footer style={footerStyle}>
          press <kbd style={kbdStyle}>esc</kbd> to return to the world
        </footer>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  status: string;
  statusColor: string;
  description: string;
  action: string;
}

function Section({ title, status, statusColor, description, action }: SectionProps) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>{title}</div>
        <div style={{ ...statusBadgeStyle, color: statusColor }}>{status}</div>
      </div>
      <p style={sectionBodyStyle}>{description}</p>
      <button style={btnDisabledStyle} disabled>{action}</button>
    </section>
  );
}

function claudeStatusLabel(status: ManifestStatus, source: 'worker' | 'stub' | null): string {
  if (status === 'loading') return 'calling worker…';
  if (status === 'loaded' && source === 'worker') return 'live';
  if (status === 'loaded' && source === 'stub') return 'stub fallback';
  if (status === 'error') return 'error';
  return 'idle';
}

function claudeStatusColor(status: ManifestStatus, source: 'worker' | 'stub' | null): string {
  if (status === 'loaded' && source === 'worker') return '#7accbf';
  if (status === 'loaded' && source === 'stub') return '#c8a64a';
  if (status === 'error') return '#d57a7a';
  return '#7a6a7a';
}

function claudeStatusDescription(
  status: ManifestStatus,
  source: 'worker' | 'stub' | null,
  error: string | null,
  metaphor: string | undefined,
): string {
  if (status === 'loading') return 'Stage 1 call in flight — fetching the world manifest from the worker.';
  if (status === 'loaded' && source === 'worker' && metaphor) {
    return `Live manifest: "${metaphor}"`;
  }
  if (status === 'loaded' && source === 'stub') {
    return `Worker unreachable (${error ?? 'unknown'}). Falling back to the hard-coded stub manifest so the scene still renders. Start the worker with \`npm run worker\` and refresh.`;
  }
  return 'Picks the world\'s organising metaphor and casts each game as an archetype. Key lives in worker/.dev.vars.';
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 1, 6, 0.55)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const panelStyle: CSSProperties = {
  width: 'min(720px, 92vw)',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: 'rgba(20, 18, 30, 0.96)',
  border: '1px solid #44324a',
  borderRadius: 6,
  padding: '24px 28px 22px',
  color: '#dadbe6',
  fontFamily: 'ui-monospace, monospace',
  boxShadow: '0 30px 80px rgba(0, 0, 0, 0.55)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 16,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 2.5,
  color: '#7accbf',
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  marginTop: 2,
};

const sectionStyle: CSSProperties = {
  borderTop: '1px solid #2a232f',
  padding: '14px 0',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
};

const statusBadgeStyle: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
};

const sectionBodyStyle: CSSProperties = {
  fontSize: 12,
  color: '#9990a3',
  lineHeight: 1.55,
  margin: '8px 0 12px',
};

const btnBaseStyle: CSSProperties = {
  background: '#2a2238',
  border: '1px solid #4a3a5a',
  color: '#dadbe6',
  padding: '7px 14px',
  fontSize: 12,
  fontFamily: 'ui-monospace, monospace',
  cursor: 'pointer',
  borderRadius: 3,
};

const btnDisabledStyle: CSSProperties = {
  ...btnBaseStyle,
  cursor: 'not-allowed',
  opacity: 0.55,
};

const btnGhostStyle: CSSProperties = {
  ...btnBaseStyle,
  background: 'transparent',
  borderColor: '#33293d',
  color: '#7e7488',
};

const footerStyle: CSSProperties = {
  marginTop: 22,
  fontSize: 11,
  color: '#6c6473',
  textAlign: 'center',
};

const kbdStyle: CSSProperties = {
  background: '#1a1626',
  border: '1px solid #33293d',
  padding: '1px 6px',
  borderRadius: 2,
  fontFamily: 'inherit',
};

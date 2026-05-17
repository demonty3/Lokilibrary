import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import type { AuthStatus, LibraryStatus, ManifestStatus } from '../state/store';
import { useAppStore } from '../state/store';
import { STEAM_LOGIN_PATH } from '../api/auth';
import type { LibraryFailureReason } from '../api/library';
import type { LibraryGame, Profile, SteamPersona } from '../types';

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
  const authStatus = useAppStore((s) => s.authStatus);
  const steamId = useAppStore((s) => s.steamId);
  const persona = useAppStore((s) => s.persona);
  const signOut = useAppStore((s) => s.signOut);
  const library = useAppStore((s) => s.library);
  const libraryStatus = useAppStore((s) => s.libraryStatus);
  const libraryError = useAppStore((s) => s.libraryError);
  const totalGames = useAppStore((s) => s.totalGames);
  const topN = useAppStore((s) => s.topN);
  const profile = useAppStore((s) => s.profile);
  const loadLibrary = useAppStore((s) => s.loadLibrary);

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

        <SteamSection
          status={authStatus}
          steamId={steamId}
          persona={persona}
          library={library}
          libraryStatus={libraryStatus}
          libraryError={libraryError}
          totalGames={totalGames}
          topN={topN}
          profile={profile}
          onSignOut={() => { void signOut(); }}
          onReload={() => { void loadLibrary({ force: true }); }}
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

interface SteamSectionProps {
  status: AuthStatus;
  steamId: string | null;
  persona: SteamPersona | null;
  library: LibraryGame[] | null;
  libraryStatus: LibraryStatus;
  libraryError: { reason: LibraryFailureReason; message: string } | null;
  totalGames: number | null;
  topN: number;
  profile: Profile | null;
  onSignOut: () => void;
  onReload: () => void;
}

function SteamSection({
  status,
  steamId,
  persona,
  library,
  libraryStatus,
  libraryError,
  totalGames,
  topN,
  profile,
  onSignOut,
  onReload,
}: SteamSectionProps) {
  const isAuthed = status === 'authenticated' && steamId;
  const statusLabel = libraryStatusLabel(status, libraryStatus, libraryError);
  const statusColor = libraryStatusColor(status, libraryStatus, libraryError);

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>Steam Library</div>
        <div style={{ ...statusBadgeStyle, color: statusColor }}>{statusLabel}</div>
      </div>

      {!isAuthed && (
        <p style={sectionBodyStyle}>
          Sign in with Steam OpenID. Slice 1 establishes the session; slice 2
          (this build) pulls your owned games + persona via the Steam Web API,
          cached server-side for an hour.
        </p>
      )}

      {isAuthed && (
        <div style={{ ...sectionBodyStyle, display: 'flex', gap: 12, alignItems: 'center' }}>
          {persona?.avatarUrl && (
            <img
              src={persona.avatarUrl}
              alt=""
              width={48}
              height={48}
              style={{ borderRadius: 4, border: '1px solid #3a2f48' }}
            />
          )}
          <div style={{ lineHeight: 1.55 }}>
            <div style={{ color: '#dadbe6' }}>
              {persona?.name ?? `Steam ID ${steamId}`}
            </div>
            <div style={{ color: '#9990a3', fontSize: 11 }}>
              {libraryStatus === 'loading' && 'Loading library…'}
              {libraryStatus === 'loaded' && library && totalGames !== null && (
                <LibrarySummary
                  library={library}
                  totalGames={totalGames}
                  topN={topN}
                  profile={profile}
                />
              )}
              {libraryStatus === 'error' && libraryError && (
                <span style={{ color: '#d57a7a' }}>
                  {libraryErrorHint(libraryError.reason, libraryError.message)}
                </span>
              )}
              {libraryStatus === 'idle' && 'Library fetch will start automatically.'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {isAuthed ? (
          <>
            <button style={btnBaseStyle} onClick={onReload} disabled={libraryStatus === 'loading'}>
              {libraryStatus === 'loading' ? 'Loading…' : 'Reload library'}
            </button>
            <button style={btnGhostStyle} onClick={onSignOut}>Sign out</button>
          </>
        ) : (
          <a
            href={STEAM_LOGIN_PATH}
            style={{ ...btnBaseStyle, textDecoration: 'none', display: 'inline-block' }}
          >
            Connect Steam
          </a>
        )}
      </div>
    </section>
  );
}

/**
 * Slice 3 enrichment summary. The worker only enriches the top-N games with
 * achievements + recency, so this counts within `library.slice(0, topN)`.
 */
function LibrarySummary({
  library,
  totalGames,
  topN,
  profile,
}: {
  library: LibraryGame[];
  totalGames: number;
  topN: number;
  profile: Profile | null;
}) {
  const enriched = library.slice(0, topN);
  const playedThisWeek = enriched.filter((g) => g.recent).length;
  const mastered = enriched.filter((g) => g.achievements && g.achievements.percent >= 80).length;
  const pastMain = enriched.filter(
    (g) => typeof g.completion_fraction === 'number' && g.completion_fraction >= 1,
  ).length;
  const hltbHits = enriched.filter((g) => g.hltb).length;
  const top = library[0];
  return (
    <>
      {totalGames} games · top {Math.min(topN, library.length)} enriched
      {top && (
        <>
          {' · '}top played:{' '}
          <span style={{ color: '#dadbe6' }}>
            {top.name} ({Math.round(top.playtime_forever / 60)}h)
          </span>
        </>
      )}
      <br />
      {playedThisWeek} played this week · {mastered} mastered · {pastMain} past main story
      {hltbHits < enriched.length && (
        <span style={{ color: '#7a6a7a' }}>
          {' · '}HLTB matched {hltbHits}/{enriched.length}
        </span>
      )}
      {profile && <ProfilePreview profile={profile} />}
    </>
  );
}

/**
 * Slice 5 preview: shows the behavioral-profile headline numbers + a
 * collapsible <details> revealing the exact prompt-ready text that Stage 1
 * will receive at slice 7. Mostly a debug surface — useful for sanity-checking
 * what the LLM is going to see before it actually goes out.
 */
function ProfilePreview({ profile }: { profile: Profile }) {
  const bingePct = Math.round(profile.bingeRatio * 100);
  const bingeLabel =
    profile.bingeRatio >= 0.7 ? 'very high'
      : profile.bingeRatio >= 0.5 ? 'high'
      : profile.bingeRatio >= 0.3 ? 'moderate'
      : 'low';
  return (
    <>
      <br />
      <span style={{ color: '#9aa6b4' }}>
        {profile.totalPlaytimeHours.toLocaleString()}h total · binge {bingePct}% ({bingeLabel})
        {profile.completionRateAvg !== undefined && (
          <> · avg completion {profile.completionRateAvg}%</>
        )}
        {' · '}{profile.dustyGames} dusty
      </span>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', color: '#7a6a7a', fontSize: 11 }}>
          Stage 1 prompt preview
        </summary>
        <pre
          style={{
            background: '#15121d',
            border: '1px solid #2a232f',
            padding: '8px 10px',
            marginTop: 6,
            borderRadius: 3,
            fontSize: 11,
            lineHeight: 1.4,
            color: '#bdb3c4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {profile.summary}
        </pre>
      </details>
    </>
  );
}

function libraryStatusLabel(
  auth: AuthStatus,
  lib: LibraryStatus,
  err: { reason: LibraryFailureReason; message: string } | null,
): string {
  if (auth === 'loading') return 'checking…';
  if (auth === 'anonymous') return 'not connected';
  if (auth !== 'authenticated') return 'idle';
  if (lib === 'loading') return 'loading library…';
  if (lib === 'loaded') return 'connected';
  if (lib === 'error' && err) return err.reason === 'private_profile' ? 'profile private' : 'library error';
  return 'connected';
}

function libraryStatusColor(
  auth: AuthStatus,
  lib: LibraryStatus,
  err: { reason: LibraryFailureReason; message: string } | null,
): string {
  if (auth === 'loading' || lib === 'loading') return '#c8a64a';
  if (auth === 'authenticated' && lib === 'loaded') return '#7accbf';
  if (lib === 'error' && err) return '#d57a7a';
  return '#7a6a7a';
}

function libraryErrorHint(reason: LibraryFailureReason, message: string): string {
  if (reason === 'private_profile') {
    return "Profile or game details are private — flip 'Game details' to Public in Steam → Edit Profile → Privacy.";
  }
  if (reason === 'rate_limited') return 'Steam rate-limited the worker. Try again in a minute.';
  if (reason === 'unauthenticated') return 'Session expired — sign in again.';
  return message;
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

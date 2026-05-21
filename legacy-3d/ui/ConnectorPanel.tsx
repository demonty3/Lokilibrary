import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import type { AuthStatus, LibraryStatus, ManifestStatus, ShareCreateStatus } from '../state/store';
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
  const viewOnly = useAppStore((s) => s.viewOnly);
  const shareCreateStatus = useAppStore((s) => s.shareCreateStatus);
  const shareUrl = useAppStore((s) => s.shareUrl);
  const shareError = useAppStore((s) => s.shareError);
  const createCurrentShare = useAppStore((s) => s.createCurrentShare);
  const resetShareCreate = useAppStore((s) => s.resetShareCreate);

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
            <div style={titleStyle}>{viewOnly ? `Viewing ${persona?.name ?? 'someone'}'s world` : 'System'}</div>
          </div>
          <button onClick={closeMenu} style={btnGhostStyle}>close · esc</button>
        </header>

        {viewOnly && (
          <p style={viewOnlyBannerStyle}>
            You're walking a shared world. Pressing E on an archetype shows what
            it represents, but won't launch a game on your machine.
            {' '}
            <a href="/" style={{ color: '#7accbf' }}>Build your own →</a>
          </p>
        )}

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
          viewOnly={viewOnly}
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

        {!viewOnly && authStatus === 'authenticated' && (
          <ShareSection
            status={shareCreateStatus}
            url={shareUrl}
            error={shareError}
            canShare={Boolean(profile)}
            onShare={() => { void createCurrentShare(); }}
            onReset={resetShareCreate}
          />
        )}

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
  viewOnly: boolean;
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
  viewOnly,
  onSignOut,
  onReload,
}: SteamSectionProps) {
  const isAuthed = status === 'authenticated' && steamId;
  const statusLabel = viewOnly
    ? 'shared world'
    : libraryStatusLabel(status, libraryStatus, libraryError);
  const statusColor = viewOnly ? '#7accbf' : libraryStatusColor(status, libraryStatus, libraryError);
  const showLibrarySummary = (viewOnly || isAuthed) && libraryStatus === 'loaded' && library && totalGames !== null;

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>
          {viewOnly ? 'Their library' : 'Steam Library'}
        </div>
        <div style={{ ...statusBadgeStyle, color: statusColor }}>{statusLabel}</div>
      </div>

      {!viewOnly && !isAuthed && (
        <p style={sectionBodyStyle}>
          Sign in with Steam OpenID. Slice 1 establishes the session; slice 2
          (this build) pulls your owned games + persona via the Steam Web API,
          cached server-side for an hour.
        </p>
      )}

      {(viewOnly || isAuthed) && (
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
              {persona?.name ?? (steamId ? `Steam ID ${steamId}` : 'Someone')}
            </div>
            <div style={{ color: '#9990a3', fontSize: 11 }}>
              {!viewOnly && libraryStatus === 'loading' && 'Loading library…'}
              {showLibrarySummary && library && totalGames !== null && (
                <LibrarySummary
                  library={library}
                  totalGames={totalGames}
                  topN={topN}
                  profile={profile}
                />
              )}
              {!viewOnly && libraryStatus === 'error' && libraryError && (
                <span style={{ color: '#d57a7a' }}>
                  {libraryErrorHint(libraryError.reason, libraryError.message)}
                </span>
              )}
              {!viewOnly && libraryStatus === 'idle' && 'Library fetch will start automatically.'}
            </div>
          </div>
        </div>
      )}

      {!viewOnly && (
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
      )}
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
  const sc = profile.stateCounts;
  const stateParts: string[] = [];
  if (sc) {
    if (sc.loved) stateParts.push(`${sc.loved} loved`);
    if (sc.mastered) stateParts.push(`${sc.mastered} mastered`);
    if (sc.recent) stateParts.push(`${sc.recent} recent`);
    if (sc.abandoned) stateParts.push(`${sc.abandoned} abandoned`);
  }
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
      {stateParts.length > 0 && (
        <>
          <br />
          <span style={{ color: '#9aa6b4' }}>
            Library states: {stateParts.join(' · ')}
          </span>
        </>
      )}
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

/** Stub-fallback messaging routes by what actually went wrong with /api/world.
 *  Slice 7 added auth-failure paths that aren't "the worker is down." */
function stubFallbackDescription(error: string | null): string {
  const reason = error ?? 'unknown';
  if (reason.includes('sign in')) {
    return 'Connect Steam to build the world from your real library. Right now you\'re seeing a sample seaside town.';
  }
  if (reason.includes('private')) {
    return 'Your Steam profile is private. Flip game details to Public to generate your own world; sample seaside town rendered in the meantime.';
  }
  if (reason.includes('rate')) {
    return 'Upstream rate-limited the worker. Try again shortly; stub manifest rendered in the meantime.';
  }
  return `Worker unreachable (${reason}). Falling back to the hard-coded stub manifest so the scene still renders. Start the worker with \`npm run worker\` and refresh.`;
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
    return stubFallbackDescription(error);
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

const viewOnlyBannerStyle: CSSProperties = {
  fontSize: 12,
  color: '#bdb3c4',
  lineHeight: 1.55,
  margin: '0 0 12px',
  padding: '10px 12px',
  background: 'rgba(122, 204, 191, 0.07)',
  border: '1px solid rgba(122, 204, 191, 0.25)',
  borderRadius: 4,
};

interface ShareSectionProps {
  status: ShareCreateStatus;
  url: string | null;
  error: string | null;
  canShare: boolean;
  onShare: () => void;
  onReset: () => void;
}

/**
 * "Share this world" surface. POSTs to /api/share, copies the resulting
 * /w/:id URL to the clipboard, surfaces status + the URL inline.
 */
function ShareSection({ status, url, error, canShare, onShare, onReset }: ShareSectionProps) {
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (older browsers, insecure context) —
      // the URL is still visible inline so the user can copy by hand.
    }
  };
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>Share this world</div>
        <div style={{ ...statusBadgeStyle, color: shareStatusColor(status) }}>
          {shareStatusLabel(status)}
        </div>
      </div>
      <p style={sectionBodyStyle}>
        Generate a /w/:id URL that opens this world for anyone — they don't need
        a Steam account or a LibraryWorld build of their own. Read-only: clicking
        an archetype shows what it represents, never launches a game.
      </p>
      {status === 'done' && url && (
        <div style={{ ...sectionBodyStyle, color: '#dadbe6' }}>
          <code style={{ background: '#15121d', padding: '2px 6px', borderRadius: 2 }}>{url}</code>
        </div>
      )}
      {status === 'error' && error && (
        <p style={{ ...sectionBodyStyle, color: '#d57a7a' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {status === 'done' && url ? (
          <>
            <button style={btnBaseStyle} onClick={() => { void copy(); }}>Copy URL</button>
            <button style={btnGhostStyle} onClick={onReset}>Generate another</button>
          </>
        ) : (
          <button
            style={canShare && status !== 'creating' ? btnBaseStyle : btnDisabledStyle}
            onClick={onShare}
            disabled={!canShare || status === 'creating'}
          >
            {status === 'creating' ? 'Saving…' : 'Share this world'}
          </button>
        )}
      </div>
    </section>
  );
}

function shareStatusLabel(s: ShareCreateStatus): string {
  if (s === 'creating') return 'saving…';
  if (s === 'done') return 'ready';
  if (s === 'error') return 'error';
  return 'idle';
}
function shareStatusColor(s: ShareCreateStatus): string {
  if (s === 'creating') return '#c8a64a';
  if (s === 'done') return '#7accbf';
  if (s === 'error') return '#d57a7a';
  return '#7a6a7a';
}

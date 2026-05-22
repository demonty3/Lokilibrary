# Phase 0 spike retrospective — Memory Palace pivot

The first stage of the pivot from LibraryWorld (3D Three.js Steam-library
visualiser) to Memory Palace (terminal-aesthetic 2D pixel-art agent
society). Plan in `docs/pivot/{DESIGN,FEASIBILITY}.md`; pivot plan at
`/home/henrydemontfort/.claude/plans/i-m-pivoting-this-project-cozy-newell.md`.

**Verified 2026-05-22.** Four of five checks green. Check 2 (wallpaper
mode) is **deferred to v1.x** — Win11 22H2+ tightened UIPI restrictions
block cross-process SetParent against Progman/WorkerW; the SetWindowPos
HWND_BOTTOM fallback only achieves "bottom of normal z-order, in front
of icons," not true wallpaper layering. See § Wallpaper deferral below.

The decision is to fast-forward `main` and proceed to Phase 1 without
wallpaper mode. The remaining four integrations are sound, and the
revised pitch (alt-tab destination, walkable explore mode, launcher
when wanted) covers what wallpaper would have covered for v1.0.

Post-verification cleanup (prune commits A–E on this branch) renames
the repo to `lokilibrary`, archives the v0.6 `desktop/` wrapper to
`legacy-desktop-v0.6/`, and rebuilds a minimal `desktop/` with just
Steamworks init + tray Quit (no wallpaper, no peek, no display picker).

## What Phase 0 shipped (5 code commits on `claude/pivot-memory-palace`)

| # | Commit | Verifies |
|---|---|---|
| 1 | `pivot commit 1: archive 3D, drop Three.js deps, stub PixiJS-ready App` | repo cleanly compiles + builds with 3D archived |
| 2 | `pivot commit 2: PixiJS hello-world, Solarized theme JSON` | PixiJS v8 boots, renders unicode, tears down cleanly |
| 3 | `pivot commit 3: desktop README for Windows-side run + renderer swap` | Electron TS builds against the new renderer |
| 4 | `pivot commit 4: drop worker /api/share + worker/lib/share.ts` | web-viewer drop (decision #3) propagated server-side |
| 5 | `pivot commit 5: Tier 1 agent micro-action — /api/agent/tick` | renderer → worker → Tier 1 LLM round-trip wired |

What the spike does **not** touch yet (Phase 1+ territory):
- PixiJS bitmap-font loader (BitmapText + .fnt atlas) — Phase 1
- Multiple themes (Gruvbox, Catppuccin, Tokyo Night, IBM-3270) — Phase 1
- Scale-ladder controller (cell → district → island → continent → planet → solar system) — Phase 1
- Smallville memory stream + reflection + retrieval — Phase 2
- Tiered router with BT/utility-AI Tier 0 — Phase 2
- Pixel-art pipeline (Python sidecar, SDXL + LoRA, PixelLab fallback, WFC) — Phase 3
- Lore upload (chunk + embed + seed) — Phase 5
- Loki personality layer — Phase 2

## The five integration checks

Each must be green before fast-forwarding `main`. Fill in observations and
numbers after running it locally; first three need Windows-native Node.

### 1. Vite + PixiJS hello-world (WSL or Windows)

  `npm install && npm run dev` → open `http://localhost:5183`

Expected: a Solarized-Dark canvas with a box-drawing-glyph panel reading
"memory palace / phase 0 spike / theme: solarized-dark". The canvas fills
the window and recentres on resize.

- Status: ✅ green (2026-05-22)
- Notes: PixiJS v8 renders Solarized canvas cleanly; HMR works; teardown
  bug surfaced + fixed in commit `f1dec58` (don't `removeChild` the
  canvas before `app.destroy(true)` — destroy already detaches).

### 2. Electron + PixiJS in wallpaper mode (Windows-native only)

  Windows PowerShell, with Vite running from step 1:
  `cd desktop && npm install && npm run dev`

Expected:
- Electron window loads PixiJS frontend (same content as step 1).
- Tray menu → "Wallpaper mode" reparents the window behind desktop
  icons via the custom WorkerW code. PixiJS canvas continues rendering.
- `Ctrl+Alt+L` peek lifts the window into the foreground; tray
  "Exit peek" or the same hotkey returns it to wallpaper.
- Tray → Display submenu picks which monitor hosts the wallpaper on a
  multi-monitor rig.

Known risk: PixiJS WebGL/WebGPU context may need
`app.renderer.resize()` after the WorkerW reparent settles. If the
canvas goes blank during the reparent transition, that's the suspect
— fix is renderer-side in `src/render/PixiApp.ts`.

- Status: ❌ **DEFERRED to v1.x** (2026-05-22)
- Notes: Win11 22H2+ UIPI restrictions broke the integration.
  - `SetParent(hwnd, WorkerW)` failed with `ERROR_INVALID_WINDOW_HANDLE`
    (1400) on every WorkerW candidate (15 enumerated on this host) and
    on `Progman` as the documented fallback. We tried Progman magic-
    message variants (`wParam=0x0D/0x0A` per RaymondChen / Lively),
    `WS_CHILD`-first style flip retry, explicit `GetParent` verification
    of zombie WorkerWs — all failed with the same error code.
  - The SetWindowPos HWND_BOTTOM fallback (commit `daa4951`) put the
    window "at the back of normal z-order" — clickable through to
    desktop icons (good), but visible IN FRONT of them (bad). Progman
    sits below HWND_BOTTOM; we cannot get under it without reparenting.
  - Wallpaper Engine / Lively solve this with an unsandboxed helper
    process. That's the v1.x revisit plan.
  - Tray menu auto-fire surfaced as a separate Electron-on-Win11 bug
    (radio + checkbox menu items re-fire click handlers on
    `setContextMenu` rebuild). Partially mitigated with applyMode-noop
    guard in commit `37aaa34`; doesn't fully prevent the startup fire.
    Moot post-prune since the new minimal tray has no toggle.

### 3. Steamworks.js init + Steam overlay (Windows-native only)

  Same Electron app from step 2, with Steam client running.
  `desktop/steam_appid.txt` = `480` (Spacewar, valid pre-partner-approval).

Expected:
- Electron startup logs `steamworks initialised against appid 480`.
- `Shift+Tab` while focused brings up the Steam overlay over the
  PixiJS canvas.
- `POST /api/auth/steamticket` from the renderer (driven by the
  existing `signInWithSteamTicket()` in `src/api/electron.ts`) returns
  a 200 with `{authenticated: true, steamId}`.

- Status: ✅ green (2026-05-22)
- Notes: `steamworks.init(480)` returned cleanly against the running
  Steam client; logged `steamid 76561198405139364`. Steam overlay
  rendered over the PixiJS canvas on Shift+Tab. Ticket auth path was
  exercised earlier in v0.6 slice 2 and is unchanged here.

### 4. Worker on its own (WSL or Windows)

  `npm run worker` → curl `http://localhost:8787/healthz`

Expected: `{ ok: true, provider: "anthropic" | "local", … }`. Confirms
the `/api/share` removal didn't break compilation and provider
configuration is intact.

- Status: ✅ green (2026-05-22)
- Notes: `/healthz` responded as expected. `/api/share` removal didn't
  regress anything; the worker compiles + serves all remaining routes.

### 5. Tier 1 agent round-trip (WSL or Windows + Ollama daemon)

  `ollama pull qwen2.5:7b`
  `ollama serve` (background)
  In `worker/.dev.vars`: `LLM_PROVIDER=local` (or leave default for
  Anthropic if `ANTHROPIC_API_KEY` is set)
  `npm run worker` + `npm run dev`
  Open `http://localhost:5183` and watch the browser console.

Expected: one log line `[phase 0] agent tick { action, intent, model,
provider, latencyMs }` within a few seconds of page load. `model`
should be `qwen2.5:7b` (local) or `claude-haiku-4-5-20251001`
(anthropic) depending on `LLM_PROVIDER`. `action` and `intent` should
be coherent strings — the model interpreting Loki's perception of the
plaza and choosing something to do.

If `[phase 0] agent tick failed: …` shows instead:
- `502 tier1 …` — provider unreachable. For local: is Ollama running on
  `:11434`? Did `ollama pull qwen2.5:7b` complete? For Anthropic: is
  `ANTHROPIC_API_KEY` set in `worker/.dev.vars`?
- `502 tier1 returned invalid json` — the model produced output the
  parser couldn't read. For local Qwen this can happen with bad system
  prompts; the prompt in `worker/index.ts` should hold but tune if
  necessary.

- Status: ✅ green (2026-05-22)
- Notes: Round-trip works end-to-end (renderer → worker → provider →
  back to renderer console). Initial Anthropic response was fenced
  markdown JSON; fixed in commit `f1dec58` by routing the response
  through the existing `extractJson()` helper that already handles the
  same case in `worker/lib/manifest.ts`.
- Latency (local Qwen 2.5 7B): **27 280 ms** — CPU-bound, not using the
  GPU. Phase 2 follow-up: confirm Ollama is detecting the GPU and that
  the right CUDA / ROCm runtime is installed; expect <1s on the 4070.
- Latency (Claude Haiku 4.5): **1 744 ms** — within FEASIBILITY's
  micro-action budget.

## Cost envelope (preliminary)

FEASIBILITY's design target is **≤$1/user/month at Claude Sonnet rates**
for the full agent runtime (Tier 0 free, Tier 1 cheap, Tier 2
batched-reflection). Phase 0 doesn't exercise enough of the runtime to
measure — Phase 2 lands the first real per-agent tick loop, and that's
when the meter starts.

Telemetry-from-day-one is in the CLAUDE.md rewrite outline. The Phase
2 work should land it: log `{agent_id, tier, tokens_in, tokens_out,
latency_ms, model, provider}` for every Tier 1/2 call into a SQLite
table, surface as a debug overlay.

## Wallpaper deferral (Check 2)

Wallpaper mode was always the most architecturally awkward piece of the
v1.0 pitch. On Win10 and pre-22H2 Win11 the WorkerW reparent technique
works; on Win11 22H2+ Microsoft tightened UIPI so cross-process
`SetParent` against `Progman` and its WorkerW children returns 1400
(`ERROR_INVALID_WINDOW_HANDLE`) regardless of which child you target.
There is no public, sanctioned API to enter the wallpaper layer.

What still works on 22H2+:
- A privileged helper process with elevated UIPI/integrity. Wallpaper
  Engine and Lively both ship one. ~1 week of native Win32 work + a
  privileged-install user story we don't currently have.
- Maintaining a topmost-style "alt-tab destination" — which is what we
  already get from window mode. This is the v1.0 product.

v1.x revisit (when product warrants it): build an unsandboxed C++ /
Rust helper that does the WorkerW reparent and communicates with
Electron via stdio. The v0.6 SetParent + magic-message code in
`legacy-desktop-v0.6/src/wallpaper/windows.ts` is the reference
implementation for the helper to follow.

## Prune commits A–E (this branch, 2026-05-22)

Post-spike cleanup after the wallpaper deferral decision. All on
`claude/pivot-memory-palace`.

- **A** — `git mv desktop legacy-desktop-v0.6` (archive v0.6 wrapper).
- **B** — minimal new `desktop/`: Electron + Steamworks init + IPC for
  steamid / availability / auth-ticket / launch + tray with Quit only.
  No wallpaper code, no peek, no multi-monitor. 203 lines `main.ts`,
  57 lines `preload.ts` (was 394 + 133).
- **C** — Cloudflare Worker name `libraryworld` → `lokilibrary`
  (wrangler.toml + worker/README.md).
- **D** — npm package name `library-world` → `lokilibrary`; session
  cookie `lw_session` → `ll_session`; Steam Web API identity string
  `libraryworld` → `lokilibrary` (atomic across worker + desktop).
- **E** — this retrospective update.

## Pending follow-ups (write into Phase 1)

- **Doc rewrites.** `CLAUDE.md`, `SPEC.md`, `PLAN.md` rewrite outlines
  are in the pivot plan. Write the new files at the top of Phase 1
  once the spike confirms the stack — that's the moment we can rewrite
  with confidence rather than guessing at what survived.
- **GPU detection for Ollama.** Tier 1 latency on the developer box is
  27s — that's CPU. Confirm Ollama detects the 4070 and the right CUDA
  runtime is loaded; expect <1s once GPU is wired. Without this, local
  dev with Qwen is impractical; we'd default to Anthropic Haiku.
- **`src/state/playerPos.ts` and `src/procedural/scatter.ts`** are in
  `legacy-3d/` for now. Phase 1 revives both: playerPos as a vec2
  outside Zustand; scatter against the 2D tile grid + new keepouts.
- **Pixel-art pipeline scaffold.** Not in Phase 0 — Phase 3 territory.
  Worth flagging that the FEASIBILITY-recommended SDXL + `nerijs/pixel-
  art-xl` LoRA path needs a Python sidecar that doesn't exist yet, and
  the PixelLab.ai fallback needs a paid account.
- **Steam Direct paperwork.** 30-day waiting clock starts when the
  partner application is filed. FEASIBILITY says file it during Phase
  0 so the clock runs in parallel with Phases 1–5. Has this happened?
  - ⬜ Steam Direct partner application filed: ___
  - ⬜ Tax interview / identity verification completed: ___

## Decision: fast-forward `main` to the pivot branch tip?

Decision: ✅ **ff-merge to main** (2026-05-22).

- Checks 1, 3, 4, 5 green.
- Check 2 deferred to v1.x — wallpaper mode requires a privileged
  helper process that's a non-trivial native build, not v1.0 work.
- v0.6 inherited `desktop/` archived; minimal replacement in place.
- Repo renamed to `lokilibrary` (commits A–E).

Next: ff-merge `main`, start Phase 1 (renderer foundations, multi-
theme, scale ladder, doc rewrites).

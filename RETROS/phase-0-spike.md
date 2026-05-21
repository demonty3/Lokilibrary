# Phase 0 spike retrospective — Memory Palace pivot

The first stage of the pivot from LibraryWorld (3D Three.js Steam-library
visualiser) to Memory Palace (terminal-aesthetic 2D pixel-art agent
society). Plan in `docs/pivot/{DESIGN,FEASIBILITY}.md`; pivot plan at
`/home/henrydemontfort/.claude/plans/i-m-pivoting-this-project-cozy-newell.md`.

**This is a stack-validation checkpoint.** Fill in the runtime numbers
after running the desktop wrapper on Windows-native Node + a local
Ollama daemon. The decision rule: if all five integrations close green,
fast-forward `main` to `claude/pivot-memory-palace` and start Phase 1
(renderer foundations). If any blocker shows up, document and re-plan.

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

- Status: ⬜ pending user verification
- Notes:

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

- Status: ⬜ pending Windows-runtime verification
- Notes:

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

- Status: ⬜ pending Windows-runtime verification
- Notes:

### 4. Worker on its own (WSL or Windows)

  `npm run worker` → curl `http://localhost:8787/healthz`

Expected: `{ ok: true, provider: "anthropic" | "local", … }`. Confirms
the `/api/share` removal didn't break compilation and provider
configuration is intact.

- Status: ⬜ pending user verification
- Notes:

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

- Status: ⬜ pending user verification
- Notes:
- Latency (local Qwen 2.5 7B on your GPU): ___ ms
- Latency (Claude Haiku 4.5): ___ ms

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

## Pending follow-ups (write into Phase 1)

- **Doc rewrites.** `CLAUDE.md`, `SPEC.md`, `PLAN.md` rewrite outlines
  are in the pivot plan. Write the new files at the top of Phase 1
  once the spike confirms the stack — that's the moment we can rewrite
  with confidence rather than guessing at what survived.
- **`LIBRARYWORLD_*` env vars + `library-world` package names**
  deferred until the working-title-rename commit. Per pivot decision
  #1, that happens after Phase 0 fast-forward.
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

Conditions for ✅:
- Checks 1, 4, 5 green (renderer + worker + Tier 1 round-trip).
- Checks 2, 3 green from Windows runtime (Electron + Steamworks).
- No stack blocker turned up (e.g. `electron-as-wallpaper` after all,
  PixiJS WebGPU fallback issues, Steamworks ↔ PixiJS overlay conflict).

If ✅: `git checkout main && git merge --ff-only claude/pivot-memory-palace`
and start Phase 1 work (renderer foundations, multi-theme, scale
ladder, doc rewrites).

If any ❌: write up the blocker in this file (replace the "Notes:"
lines with the failure) and re-plan in conversation before proceeding.

Decision date: ___
Decision: ⬜ ff-merge to main / ⬜ re-plan / ⬜ partial — ship some commits, re-plan others

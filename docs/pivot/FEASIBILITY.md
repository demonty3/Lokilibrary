# Memory Palace — Technical Feasibility & Implementation Report

## TL;DR
- **Build Memory Palace on Electron + steamworks.js, render the simulation in a PixiJS canvas, and use Lively Wallpaper's Progman/WorkerW reparenting technique (via the `electron-as-wallpaper` Node module) for the live-wallpaper layer.** This stack is by far the best fit for a designer-led, LLM-assisted solo developer who needs Steam distribution, web-tech velocity, and proven wallpaper-mode tooling on Windows; Tauri's lower bundle and RAM are real but its lack of a drop-in wallpaper module and Rust friction outweigh those wins for this builder.
- **Use a hybrid pixel-art pipeline: local Stable Diffusion via the `diffusers` library with the `nerijs/pixel-art-xl` SDXL LoRA (CreativeML OpenRAIL-M, commercial-permitted) for users with ≥8 GB VRAM, falling back to the PixelLab.ai API (~$0.007–$0.013/image, commercial license included on all paid plans) for everyone else, with Astropulse PixelDetector + Pillow `Image.quantize()` palette enforcement and Wave Function Collapse (`mxgmn/WaveFunctionCollapse` + `BorisTheBrave/DeBroglie`) for tile composition.** This keeps cost per user well under a dollar a month in the cloud path and zero in the local path.
- **For the agent layer, port the Stanford "Generative Agents / Smallville" memory-stream / reflection / retrieval pattern (`joonspk-research/generative_agents`) onto a tiered router that defaults to a behaviour-tree / utility-AI tick, batches reflection calls, and only escalates to an LLM on events; back it with a pluggable provider abstraction (Vercel AI SDK or LiteLLM-style) so Ollama (local Qwen/Llama) and Anthropic/OpenAI are swappable at runtime.** Steam Direct is a $100/title recoupable fee, with a mandatory AI-content disclosure that, after the January 2026 rewrite, separates pre-generated, live-generated, and (exempt) efficiency-tool AI — Memory Palace must disclose the first two and describe its guardrails.

## Key Findings

1. **Engine choice is settled by Steam + wallpaper + dev-ergonomics, not by raw performance.** Electron is the only stack that combines a mature Steamworks binding (`ceifa/steamworks.js`, ~569–587 GitHub stars as of May 2026), a documented wallpaper-mode plugin (`meslzy/electron-as-wallpaper`), and the largest LLM-assisted-coding training corpus. Tauri's measured advantages are substantial — Electron installers run 80–200 MB vs. Tauri's 2–10 MB, and Electron apps "often idle at 200 to 300 MB. Tauri apps usually sit at 30 to 40 MB" (PkgPulse / RaftLabs 2025–2026 benchmarks) — but Tauri forces Rust for every Win32 Progman/WorkerW call and has no drop-in wallpaper crate. Godot is excellent for 2D pixel art but pulls you out of the JS/TS world your LLM coding assistant is strongest in.
2. **Wallpaper-mode on Windows is a solved problem you can copy directly.** Lively Wallpaper (`rocksdanister/lively`, GPL-v3) is the canonical reference: send the undocumented `0x052C` message to `Progman`, find the second `WorkerW`, `SetParent` your window to it (below SHELLDLL_DefView so desktop icons stay clickable). The `electron-as-wallpaper` Node module wraps this in a single `attach(mainWindow, …)` call with optional `forwardKeyboardInput` and `forwardMouseInput`. Wallpaper Engine's three-tier throttling (full / paused on maximised / stopped on exclusive fullscreen) is configurable per-app via a window-size pixel-perfect comparison; re-implement this with `EnumWindows` + foreground-window queries.
3. **The agent layer is the highest-risk, highest-leverage system, and the literature now tells you exactly how to build it cheaply.** Stanford's Smallville architecture (memory stream → recency × relevance × importance retrieval → reflection when the cumulative importance of recent events exceeds 150 → top-down recursive planning) is fully open-source and reproducible. The shipping pattern that controls cost is tiering: behaviour-tree tick at 1–10 Hz for default actions; LLM call only on perception events, reflection thresholds, or direct user interaction. With a local 7–8B model (Qwen 2.5, Llama 3.1, Mistral) via Ollama, inference is essentially free; on a CPU-only AMD EPYC 7763 Llama-2-7B Q4_K_M reaches ~15 tokens/sec (Easecloud.io 2026 llama.cpp guide), and an RTX 3060 12 GB delivers ~42 tok/s for 8B Q4_K_XL (Hardware Corner via singhajit.com).
4. **The AI pixel-art pipeline has three viable paths and you should ship a hybrid.** (a) Local SDXL + `nerijs/pixel-art-xl` LoRA via `diffusers` is free at inference and palette-lockable, but needs ~8 GB VRAM. (b) PixelLab API ($12/$24/$50/mo tiers, ~$0.007–$0.013/image pay-as-you-go, commercial license on all paid plans; FAQ states verbatim *"Yes, you are allowed to use AI assets in your games"*) is the right cloud fallback. (c) Retro Diffusion API is higher quality but ~$0.25 per 256×256 image — too expensive for daily-per-user. Wrap all three behind a `PixelArtProvider` interface; default to local if VRAM detected, else PixelLab.
5. **Terminal aesthetic should be pixel-art-that-looks-like-a-terminal, not a true TUI.** Box-drawing characters (U+2500–U+257F) and Unicode glyphs render beautifully as sprites in PixiJS using a bitmap font (Cozette, Cascadia Code, Berkeley Mono, Iosevka) baked to an atlas; a true TUI (Ratatui, blessed, notcurses) gives up sub-character animation, particle effects, palette gradients, and the entire pixel-art world. Use Ratatui/notcurses only if you ship a CLI companion ("memory-palace --status").
6. **Steam Direct is $100/title, recoupable against the first $1,000 of Adjusted Gross Revenue, with a 30-day waiting period and a mandatory "Coming Soon" page for ≥2 weeks.** The AI Content Survey was rewritten in January 2026 and now distinguishes pre-generated (must disclose), live-generated (must disclose + describe guardrails), and efficiency-tool AI (exempt). Memory Palace ships both pre-generated AI assets and live runtime LLM/image generation, so you must check both boxes and write a clear guardrail description.
7. **Privacy/permission model for the year-2 filesystem feature follows the OS file-picker pattern: per-folder opt-in via native dialog only, never a recursive scan, no network egress of file contents.** Electron's `dialog.showOpenDialog({ properties: ['openDirectory'] })` and Tauri's capability-scoped `fs` plugin both give you this; the UX pattern from Obsidian (vault selection) and Raycast (per-action transparency log) is the model.

## Details

### 1. Pixel-Art Generation & Composition Pipeline

**Existing libraries / models / repos (verified May 2026):**

*Local / open-source models:*
- **`nerijs/pixel-art-xl`** (https://huggingface.co/nerijs/pixel-art-xl) — SDXL LoRA, ~163 MB, CreativeML OpenRAIL-M (commercial use permitted under RAIL use restrictions). Trigger word: `pixel art`. Recommended workflow: downscale 8× with nearest neighbor; pair with LCM-LoRA for 8-step gen at guidance 1.5.
- **`PublicPrompts/All-In-One-Pixel-Model`** (https://huggingface.co/PublicPrompts/All-In-One-Pixel-Model) — SD 1.5 DreamBooth checkpoint, OpenRAIL-M. Triggers `pixelsprite` (sprite art) and `16bitscene` (scene art). Outputs require palette post-processing.
- **`mikeyandfriends/PixelWave_FLUX.1-schnell_04`** (https://huggingface.co/mikeyandfriends/PixelWave_FLUX.1-schnell_04) — fine-tune of FLUX.1-schnell, **Apache 2.0** (cleanest commercial license in the space). GGUF Q4_K_M (6.92 GB) runs on 8 GB VRAM via `city96/ComfyUI-GGUF`. ⚠️ The FLUX.1-**dev** variant of PixelWave is on the FLUX.1 [dev] Non-Commercial License; use schnell.
- **`segmind/SSD-1B`** (https://huggingface.co/segmind/SSD-1B) — distilled SDXL, OpenRAIL-M, ~6–7 GB VRAM; viable fallback below the 8 GB SDXL floor.
- **`Astropulse/pixeldetector`** (https://github.com/Astropulse/pixeldetector) — companion downscaler that finds the true pixel grid of a fuzzy SD output and snaps to it.

*Cloud APIs:*
- **PixelLab.ai** — `https://api.pixellab.ai/v1`, Python SDK `pip install pixellab` (https://github.com/pixellab-code/pixellab-python), JS SDK at `pixellab-code/pixellab-js`. Subscription tiers: Free trial (40 fast gens, no card); **$12/mo "Pixel Apprentice"** (1,000 images/mo, up to 320×320); **$24/mo "Pixel Pro"** (3,000); **$50/mo "Pixel Architect"** (6,000). Pay-per-image at 64×64 ≈ $0.0071, 128×128 ≈ $0.00797, 200×200 ≈ $0.01122, 400×400 ≈ $0.0132. FAQ: *"Yes, you are allowed to use AI assets in your games"* and *"we do not use any user inputs or generated content to train our models."* Endpoints: `generate_image_pixflux` (text→pixel-art), `generate_image_bitforge` (reference-image style transfer), plus skeleton/text animation, rotation, inpainting.
- **Retro Diffusion API** — `https://api.retrodiffusion.ai/v1/inferences`, auth via `X-RD-Token`. Cost per official API examples README: `max(0.02, ((width × height) + 13700) / 600000) × num_images` USD. 256×256 RD_PRO ≈ $0.25. Developer (Astropulse) public comment: *"the code and models are owned by Astropulse LLC, and not able to be used commercially, but the outputs of the code and models are owned by whoever creates them (you) and are able to be used commercially since you have the rights."* Use only as a premium tier; do not bundle weights.
- **Scenario.gg** — Starter $15/mo (1,500 credits), Pro $45/mo (5,000), Max $75/mo (10,000); annual = 33% off. Hosts the Retro Diffusion family (RD Plus / RD Tile / RD Animation) under partnership. Pricing-page FAQ: *"All paid plans include a full commercial license. You own what you create … Free plan outputs are for personal and evaluation use only."* SOC 2 Type II; data never used for training.

*Palette enforcement & post-processing:*
- **Pillow `Image.quantize(palette=palette_image, dither=Image.Dither.FLOYDSTEINBERG)`** — stdlib, deterministic; build a 1×N PNG of the target palette and quantize against it.
- **`sedthh/pyxelate`** (https://github.com/sedthh/pyxelate, MIT) — Bayesian Gaussian Mixture palette generation, palette transfer, dithering modes (`none`/`naive`/`bayer`/`floyd`/`atkinson`).
- **`dimtoneff/ComfyUI-PixelArt-Detector`** (https://github.com/dimtoneff/ComfyUI-PixelArt-Detector, MIT) — combines PixelDetector, Lospec palette loading, k-means / OpenCV / Pycluster colour reduction, and Bayer-pattern dithering in one node chain. Canonical post-processing pipeline.

*Style consistency:*
- **IP-Adapter** (https://github.com/tencent-ailab/IP-Adapter, Apache 2.0) — 22M-param adapter for image-prompt conditioning; lets you anchor every per-user generation to a single reference sprite sheet. SDXL variant: `ip-adapter-plus_sdxl_vit-h.safetensors`. **InstantStyle** (style-only IP-Adapter variant) at `https://github.com/InstantStyle/InstantStyle`.
- **`kohya-ss/sd-scripts`** and **Ostris's `ai-toolkit`** — train a custom 10–30-image "style anchor" LoRA on your art bible, then load at strength 0.7–1.2 on every generation (rank 8–16, batch 1, ~30 min on a 24 GB GPU). Matches Scenario's documented "10–30 images for style, 5–15 for character/object" guidance and Multi-LoRA blend pattern.

*Procedural / tile composition:*
- **`mxgmn/WaveFunctionCollapse`** (https://github.com/mxgmn/WaveFunctionCollapse, MIT) — canonical WFC implementation, ported to C++, Python, Rust, JS, Godot 4, Unity, Unreal 5.
- **`BorisTheBrave/DeBroglie`** — C# WFC + non-local constraints + backtracking; best documented and used in shipping games (Bad North, Caves of Qud).
- **`jamesfebin/bevy_procedural_tilemaps`** — if you take the Rust path.

**Hardest risks & how shipping products solved them:**
- *Output style drift between days* → solved by IP-Adapter conditioning on a frozen reference image (the "style anchor" pattern) + a small custom LoRA, as documented in Scenario's Multi-LoRA training guidance.
- *Palette violations from SD blur/anti-alias* → solved by the PixelDetector → nearest-neighbor downscale → `Image.quantize` chain (codified in ComfyUI-PixelArt-Detector), never by prompting alone.
- *Per-user generation cost at scale* → solved by tiered offload: detect VRAM (WebGPU `requestAdapter()` or an `nvidia-smi` shell-out), run local if ≥8 GB else PixelLab; cache aggressively (regenerate only when library state changes).
- *Commercial licensing surprises* → use the explicitly Apache-2.0 PixelWave FLUX-schnell or OpenRAIL-M LoRAs locally; PixelLab/Scenario paid tiers in the cloud. Never bundle Retro Diffusion model weights.

**v1.0 MVP scope:**
- One local model path (SDXL + `nerijs/pixel-art-xl` via `diffusers` Python sidecar process spawned by Electron) + PixelLab.ai cloud fallback.
- 32×32 sprite scale, fixed 32-colour palette derived from the user's chosen terminal theme (Solarized / Gruvbox / Catppuccin / Tokyo Night), enforced via Pillow `quantize`.
- WFC for tile placement using a hand-authored 12–16-tile bible.
- Cache key: hash of `(game appID, theme, palette, prompt template)`.

### 2. Wallpaper-Mode Desktop Integration (Windows-first)

**Existing libraries & techniques:**
- **`rocksdanister/lively`** (https://github.com/rocksdanister/lively, GPL-v3) — definitive reference in WinUI 3 / C#. Its `Lively.Core.WinDesktopCore` class is the gold standard for Progman→WorkerW initialisation, handle hooking, and `WorkerW destroyed` recovery (visible in its logs as a `WorkerW destroyed → Restarting wallpaper service → WorkerW initialized {handle}` cycle).
- **`meslzy/electron-as-wallpaper`** (https://github.com/meslzy/electron-as-wallpaper) — single-call wrapper: `attach(mainWindow, { transparent: true, forwardKeyboardInput: true, forwardMouseInput: true })`. This is the recommended path if you go Electron.
- **`robinwassen/electron-wallpaper`** (https://github.com/robinwassen/electron-wallpaper) — older sibling, no input forwarding (purely visual dashboards); less suitable for an interactive alt-tab destination.
- **The Progman/WorkerW technique itself**, documented in CodeProject's "Draw Behind Desktop Icons in Windows 8+" and Microsoft Q&A: `FindWindow("Progman", "Program Manager")` → `SendMessage(progman, 0x052C, …)` to spawn the second WorkerW behind the SHELLDLL_DefView icons layer → find the WorkerW whose previous sibling contains SHELLDLL_DefView, then take the next one via `FindWindowEx(NULL, firstWorkerW, "WorkerW", NULL)` → `SetParent(yourHwnd, secondWorkerW)`.
- **macOS later**: `NSWindow.level = CGWindowLevelForKey(kCGDesktopWindowLevel)` (or `.desktopWindow` in Swift) — equivalent single-call, but no equivalent ecosystem yet.

**Hardest risks:**
- *WorkerW destroyed* on Windows 11 26xx insider builds (issue #2074 on `rocksdanister/lively`) — the window hierarchy gets reset by explorer.exe restarts and dwm.exe updates. Lively's solution: watch the WorkerW handle in a watchdog process; on `WorkerW destroyed`, re-run initialisation. **Copy this pattern exactly.**
- *Desktop icons must stay clickable on top* — never reparent SHELLDLL_DefView; always parent below it.
- *Alt-tab destination behaviour* — when the user wants to interact, you need a separate non-wallpaper window at a normal z-order. Pattern: keep the wallpaper window passive (no input forwarding by default), pop a second BrowserWindow on a global hotkey for the rich interactive view.
- *Pushing opened windows in front* — by parenting to WorkerW you're already behind every normal app, including the taskbar. Verified behaviour in Wallpaper Engine and Lively.
- *Three-tier throttling*:
  - **FULL** when the window is visible and no fullscreen app is foreground.
  - **THROTTLED_1HZ** when a non-fullscreen window covers it — detect via `EnumWindows` + `GetWindowRect` pixel-perfect size comparison (Wallpaper Engine's documented approach: compare window size to screen size).
  - **PAUSED** when a fullscreen game is detected via `GetForegroundWindow` → `GetWindowRect` matching the monitor's full resolution. Wallpaper Engine's published "Application rules" model — `is_fullscreen` / `is_running` / `is_playing_audio` predicates against a per-`.exe` policy — is the right shape to ship.

**v1.0 MVP scope:**
- Electron + `electron-as-wallpaper` for wallpaper mode.
- Three throttling tiers implemented as a `RenderBudget` enum (`FULL` / `THROTTLED_1HZ` / `PAUSED`) driven by a foreground-window poll every 500 ms.
- Global hotkey (`Ctrl+Alt+M`) opens the interactive BrowserWindow at normal z-order.
- Multi-monitor: out of scope for v1.0; pin to primary monitor.
- macOS: stub the wallpaper-mode API behind a `WallpaperHost` interface, ship as a regular windowed app on Mac in v1.0.

### 3. Multi-Agent Simulation Architecture

**Existing libraries & named techniques:**
- **`joonspk-research/generative_agents`** (https://github.com/joonspk-research/generative_agents) — the original Smallville reference (Django + Phaser). Architecture: memory stream → recency × relevance × importance retrieval → reflection (triggered when the sum of importance scores of recent events exceeds 150; "in practice, our agents reflected roughly two or three times a day") → top-down recursive planning. ACM paper: `dl.acm.org/doi/fullHtml/10.1145/3586183.3606763`.
- **`nmatter1/smallville`** (https://github.com/nmatter1/smallville) — Java/JS reimplementation; runs as a server you talk to over HTTP, easier to embed in a non-Python app.
- **LangGraph** (`langchain-ai/langgraph`) — stateful agent orchestration with a node graph; natural fit for "perception → retrieve → reflect → act" loops.
- **CrewAI** (role-based) and **AutoGen** (flexible reasoning chains) — both have Ollama bindings.
- **Vercel AI SDK** (`sdk.vercel.ai`) or **LiteLLM** (`BerriAI/litellm`) — pluggable provider abstraction (Ollama / Anthropic / OpenAI / Google behind one interface). Vercel AI SDK is the more natural fit in an Electron/Node app.
- **Ollama** (`ollama.com`) — local LLM server at `http://localhost:11434` exposing an OpenAI-compatible `/v1/chat/completions` endpoint. Qwen 2.5, Llama 3.1, Mistral, and command-r have native tool-calling support in Ollama as of 2025–2026.

**Cheap-vs-expensive tier pattern (the most important architectural decision):**
- **Tier 0 — utility AI / behaviour tree** (no LLM): default tick at 1–10 Hz; agents wander, sleep, do scheduled chores. Implement with a small utility-AI scorer (each behaviour scores against current needs; highest wins) or a behaviour tree library (`behavior3js`, or hand-rolled).
- **Tier 1 — templated micro-LLM call** (small local model, ~50–200 tokens): triggered on perception events ("agent sees a new book on the shelf") or short social exchanges. Qwen 2.5 7B at Q4 on a 6 GB GPU is sufficient.
- **Tier 2 — full reflection / planning** (large local model OR cloud): triggered on the Smallville 150-importance threshold or on user interaction; produces multi-step plans, character introspection, lore weaving. This is where Claude/GPT shines.

**Hardest risks:**
- *Cost runaway* → solved by Tier 0 default + batched Tier 2 reflections (queue events, fire one reflection per agent per real-world hour, not per game-time hour). Cloud cost target: ≤ $1/user/month at Claude Sonnet rates.
- *Latency on local models* → 7–8B Q4 models in CPU-only inference reach 5–16 tok/s on modern x86 (Easecloud.io's 2026 llama.cpp benchmarks measured Llama-2-7B Q4_K_M at 15 tok/s and Mistral 7B at 16 tok/s on an AMD EPYC 7763), and ~42 tok/s for 8B Q4_K_XL on an RTX 3060 12 GB (Hardware Corner). Both are acceptable for non-blocking background generation. Never block the render loop on an LLM call.
- *Persistent memory bloat* → cap memory stream at N = 1,000 entries per agent, age out via importance × recency decay; persist as SQLite (`better-sqlite3` in Electron) with FTS5 + a vector column via `sqlite-vec`.
- *Spatially-bounded perception* → 2D circular FOV radius around each agent; the simulation only feeds the LLM events from inside that radius. This is exactly Smallville's pattern (Section 3 of the paper).
- *Creative-budget accumulation* (per the design's spec) → model as an integer that ticks up each in-game day; spending it triggers a Tier 2 build/creation LLM call.

**v1.0 MVP scope:**
- 4–6 agents on a single zoom level.
- Tiered router: BT default, local Ollama (Qwen 2.5 7B) for Tier 1, cloud (Anthropic Claude Sonnet, configurable) for Tier 2.
- Memory stream in SQLite with FTS5 + `sqlite-vec` embeddings.
- Reflection threshold = 150 (port directly from Smallville).
- "Loki" personality implemented as a system-prompt prefix injected on every Tier 1/2 call.

### 4. Local-Only Filesystem Access + Privacy / Permission Model

**Patterns & libraries:**
- **Electron's `dialog.showOpenDialog({ properties: ['openDirectory'] })`** — the only path forward; never `fs.readdir` outside an explicit user-picked folder.
- **Tauri's `fs` scope + capability system** — capability files declare exactly which paths the frontend can touch; enforced at compile time by Rust.
- **Obsidian** is the model for vault-style folder opt-in UX (explicit pick, persisted as a "vault" with clear visual).
- **Raycast** is the model for the "what the agent has seen" transparency log — a scrollable list of every file the agent has read, with a per-item "forget" button.
- **Network egress lockout**: in Electron, set a strict CSP and use `session.defaultSession.webRequest.onBeforeRequest` to block all non-allowlisted hosts when in "local-processing only" mode. In Tauri, the capability allowlist already restricts this.

**Hardest risks:**
- *Accidental cloud-LLM leak of file contents* → solved by a hard switch: when "local files" mode is on, the LLM router must refuse all non-local providers. Implement as a boolean in the provider registry, validated on every dispatch.
- *Permissions persistence across reboots* → persist the picked folder paths in an encrypted store (Electron `safeStorage` / Windows DPAPI).
- *User confusion about what's been seen* → ship the transparency log as a first-class UI surface, not a settings page.

**v1.0 MVP:** out of scope (year-2 feature). Stub the `FileSystemAdapter` interface and ship a no-op implementation.

### 5. Terminal-Aesthetic Rendering Tech

**The recommendation is pixel-art-that-looks-like-a-terminal, not a true TUI.** Reasons:
- Themes (Solarized / Gruvbox / Catppuccin / Tokyo Night) are JSON palette swaps in a sprite/canvas renderer; trivial.
- Sub-character animation (an agent walking *between* cells, particles, glow effects) is impossible in a true terminal.
- Box-drawing characters (U+2500–U+257F) and Unicode glyphs render beautifully as bitmap-font sprites at 8–16 px; use **Cozette**, **Cascadia Code**, **Berkeley Mono**, or **Iosevka** baked to a sprite atlas with `msdf-bmfont-xml` or `bmfont`.
- 24/7 performance: WebGL/WebGPU sprite batching in PixiJS idles at <2 % CPU when throttled to 1 Hz; a real OS terminal redrawing at 60 Hz with 100 k cells is heavier than the sprite path because it isn't optimised for animated scenes.

**Libraries:**
- **PixiJS v8** (https://pixijs.com) — WebGL/WebGPU 2D renderer; bitmap text via `PIXI.BitmapText`. **Recommended.**
- **Phaser 3** — heavier (game engine) but built-in tilemap, input, audio, sprite animation; useful if you treat Memory Palace partly as a game.
- **Ratatui** (`ratatui.rs`, https://github.com/ratatui/ratatui) — Rust TUI library, immediate-mode rendering, full box-drawing widget set; only worth it if you also ship a CLI companion. The `tui-box-text` crate adds large-text-via-line-drawing rendering on top.
- **notcurses** / **blessed** / **ink** — TUI alternatives in C / JS / React; same caveat as Ratatui.
- **rot.js** (https://ondras.github.io/rot.js/) — roguelike toolkit with pre-built terminal-style canvas rendering of Unicode glyphs; useful starter library.

**v1.0 MVP:** PixiJS + bitmap font atlas (Cozette 12 px) + JSON theme files for Solarized / Gruvbox / Catppuccin / Tokyo Night.

### 6. Steam Direct + AI Content Disclosure (2026)

- **Fee:** $100 per app, recoupable against the first $1,000 of Adjusted Gross Revenue (Steam Store and in-app purchases). Per Steamworks docs: *"In order to get fully set up, you will need to pay a $100.00 fee for each product you wish to distribute on Steam (the 'Steam Direct Fee'). … This fee is not refundable, but will be recoupable in the payment made after your product has at least $1,000.00 Adjusted Gross Revenue."*
- **Process:** Steamworks signup → tax interview (W-9 for US, W-8BEN for non-US) → identity verification → digital paperwork (NDA, SDA) → pay fee → **30-day waiting period** between fee payment and release → store page must be live **≥ 2 weeks** as "Coming Soon" → submit build for review (1–5 business days) → release.
- **AI Content Survey, as rewritten January 2026** (three questions; two apply to Memory Palace):
  - "Do you use AI to generate pre-rendered content for your game, its store page, marketing materials, and/or community assets?" → **Yes** (pre-generated sprite tiles, palette swatches, possibly trailer art).
  - "Do you use AI to live-generate content or code during gameplay?" → **Yes** (agent dialogue, lore weaving, on-demand sprite generation).
  - Efficiency-tool AI (Copilot, generative-fill for concept art that doesn't ship) is **exempt** as of the January 2026 update; Valve's update language is that disclosure is required when AI output "ships with your game, and is consumed by players."
- **Guardrails description (required for live-generated):** Valve requires you to explain how illegal/infringing content is prevented. Concrete language to use: *"All live LLM calls pass through provider-side safety filters (Anthropic/OpenAI default moderation, or for local Ollama models, a local content classifier). Generated sprites are constrained to a fixed palette and 32×32 grid, eliminating photo-realistic output. Users can flag any output via an in-app report that sends to a moderation queue. The new Steam Overlay 'illegal AI generation' report channel is supported."*
- **Steam Workshop:** revenue share for paid Workshop items is **set by the Application's developer/publisher** (you) — per Valve's Supplemental Workshop Terms, *"The percentage of Adjusted Gross Revenue that you are entitled to receive will be determined by the developer/publisher of the Application associated with the Workshop to which you have submitted your Contribution."* There is no platform-wide default; published creator shares like the ~25% figure that appears for CS2 weapon skins are publisher-specific, not Steam-wide. Memory Palace can choose its own split when it opens Workshop.
- **Workshop moderation:** Steam requires you (the Publisher) to moderate. Practical pattern: Workshop submissions auto-import the user-uploaded lore text into a sandbox; **never auto-publish**; require a manual approve step; an in-game report button on live-generated content feeds a server-side queue.
- **Non-game / "application" type apps**: Steam allows non-gaming applications since 2012 and grants access to the same Steamworks API (cloud save, Workshop, etc.). Memory Palace can ship as either a "Game" or "Application" category; "Game" generally gets more discovery, "Application" sets correct user expectations for an alt-tab destination.

**v1.0 MVP:** disclose both pre-gen and live-gen with the guardrail text above; ship the moderation queue + in-app report button before opening Workshop.

### 7. Engine/Wrapper Choice — Recommendation Matrix

| Dimension | Electron | Tauri | Godot 4 | Bevy (Rust) |
|---|---|---|---|---|
| 2D pixel-art rendering | Excellent via PixiJS/Phaser (WebGL/WebGPU) | Same as Electron but constrained to system WebView; WebKit on macOS lags Chrome on CSS/shaders | Native, best-in-class; pixel-perfect viewport + integer scaling built-in; nearest-neighbor filter project default | Native, performant, but immature ecosystem for complex UI |
| Steamworks SDK maturity | **`ceifa/steamworks.js`**, ~569–587★, active, electron-aware, ships `electronEnableSteamOverlay()` | **`Noxime/steamworks-rs`** + optional `tauri-plugin-hal-steamworks`; mature, Rust-only | **GodotSteam** (GDExtension 4.4+, Steamworks SDK 1.64); excellent, plug-and-play; used by hundreds of shipped games | **`HouraiTeahouse/bevy_steamworks`** (Steamworks SDK 1.58a); good but smaller |
| Wallpaper mode (Windows) | **`electron-as-wallpaper`** drop-in | Possible via custom Rust + Win32 calls; **no off-the-shelf crate** | No first-class support; would need a custom Windows launcher | No first-class support; same as Godot |
| Bundle size | 80–200 MB | **2–10 MB** | ~50–80 MB (templates trimmed) | ~10–20 MB |
| RAM at idle | 200–300 MB | **30–40 MB** | 100–200 MB | 30–100 MB |
| Embedded/external LLM | Native — Node spawns Ollama, `fetch` to cloud APIs | Native — Rust spawns Ollama, `reqwest` to cloud | Possible via GDExtension or HTTP; less ergonomic | Native via `reqwest` |
| 24/7 low-resource operation | Acceptable with throttling | Best | Acceptable | Best |
| Designer-led, LLM-assisted coding | **Best — largest training corpus, biggest ecosystem** | Good — Rust corpus smaller; Claude/GPT still strong | Good — GDScript well-trained; smaller community | Weakest — Rust + ECS is the steepest curve |

**Primary recommendation: Electron.** The combination of (a) the only mature Steamworks JS binding, (b) a drop-in wallpaper-mode module, (c) the largest LLM-coding training set, and (d) the option to host the pixel-art and agent code in a familiar Node + browser environment outweighs the bundle and RAM cost. For a paid Steam app whose users have gaming-grade hardware, a 100–200 MB installer and 200–300 MB of RAM are non-issues — and the entire WorkerW + Steamworks integration is days, not weeks.

**Secondary recommendation: Godot 4 with GodotSteam** — if you find that PixiJS pixel-art quality isn't good enough (shader effects, smooth camera over a low-res viewport, particle systems), Godot is the natural escape hatch. Its pixel-perfect setup (Texture filter = Nearest, Stretch Mode = viewport, integer scaling, Snap 2D Transforms to Pixel) and the GodotSteam plugin are best-in-class. The cost is moving away from JS/TS and writing a custom Windows wallpaper launcher.

**Reject:** Tauri (no wallpaper module, Rust friction for a designer-led builder) and Bevy (ecosystem too immature for a 24/7 app with this UI complexity).

---

## Inherited Assets & How to Reuse Them

The prior 3D LibraryWorld build's reusable pieces map cleanly onto the Electron stack:
- **Steam OpenID auth** → port to Electron's main process with the same redirect URL pattern; reuse the JWT/session handling unchanged.
- **Behavioural profile (Steam playtime + HowLongToBeat completion)** → already JSON; load directly into the new agent system as seed memories per user.
- **Deterministic seeded procedural layout** → the seed feeds both WFC tile placement and the LLM lore generator; hash-based determinism survives the engine change.
- **Library-state model** → already engine-agnostic; lift and shift.

The four-tier personalisation model maps to four prompt-template fragments composed at runtime:
1. **Library data** → inventory list in agent context.
2. **Behavioural profile** → "the user prefers [genre] and completes [pace] games" injected into Loki's voice and into NPC seed personalities.
3. **Terminal aesthetic** → palette + bitmap font (no LLM involvement; pure renderer config).
4. **Uploaded lore** → chunked, embedded, stored as long-term memory entries seeded into one or more agents; this is the lore-seeding mechanic.

The lore-seeding feature is implemented end-to-end in Phase 5: a drop-zone in the interactive window accepts `.txt`/`.md`, chunks into ~500-token windows, embeds via a local model (e.g. `nomic-embed-text` in Ollama), writes into the same SQLite memory stream that NPCs query — so user lore competes for retrieval on equal footing with Smallville-style observations.

---

## Consolidated Recommended Stack

- **Shell:** Electron (latest LTS) + electron-builder for the Windows installer.
- **Steam:** `ceifa/steamworks.js` with `electronEnableSteamOverlay()` in main, `nodeIntegration: true` + `contextIsolation: false` only in the (separate) renderer that needs the binding. Be aware of the Electron 21+ V8 memory cage caveat documented in steamworks.js issue #51; pin Electron versions accordingly.
- **Wallpaper:** `meslzy/electron-as-wallpaper` with a watchdog that re-attaches on `WorkerW destroyed`.
- **Rendering:** PixiJS v8 (WebGPU when available, WebGL fallback) with a bitmap font atlas.
- **Procedural tiles:** `mxgmn/WaveFunctionCollapse` JS port (or DeBroglie via a Node child process).
- **Pixel-art:** local SDXL + `nerijs/pixel-art-xl` LoRA via a Python `diffusers` sidecar spawned by Electron, with PixelLab.ai API fallback behind a `PixelArtProvider` interface; Pillow `Image.quantize` palette enforcement; PixelDetector for grid-snap.
- **Agents:** custom tiered router (BT → Ollama Qwen 2.5 7B → cloud) on top of a Vercel AI SDK provider abstraction; SQLite + sqlite-vec for memory stream + reflection.
- **LLM hosts:** Ollama for local; Anthropic Claude / OpenAI behind an `LLM_PROVIDER` config.
- **Persistence:** SQLite via `better-sqlite3`.
- **Distribution:** Steam Direct ($100), AI Content Survey both boxes checked with the guardrail language above.
- **Build tooling:** electron-forge (or electron-vite) + Vite + TypeScript.

## Phased v1.0 MVP Build Plan (designer-led, LLM-assisted, solo, Windows-first)

**Phase 0 — Spike (1–2 weeks).** Hello-world Electron app with steamworks.js (test against Spacewar AppID 480), confirm Steam overlay appears. `electron-as-wallpaper` hello-world: a static PixiJS canvas rendering behind desktop icons. Ollama running Qwen 2.5 7B locally; one round-trip from Electron to `/v1/chat/completions`. **File the Steam Direct paperwork now** — the 30-day clock starts here.

**Phase 1 — Core renderer (3–4 weeks).** PixiJS scene with bitmap font + box-drawing tile bible (12 tiles). Solarized / Gruvbox / Catppuccin / Tokyo Night theme JSONs. WFC tile placement (deterministic seed = Steam ID + game-AppID-list hash). Reuse Steam OpenID auth from the 3D build.

**Phase 2 — Agent v0 (4–6 weeks).** 4 agents with BT default (wander, sleep, idle). Spatially-bounded perception (radius FOV). Memory stream + SQLite + sentence-embedding retrieval. Tier 1 LLM calls on perception events. Loki narrator system prompt.

**Phase 3 — Pixel-art pipeline (3–4 weeks).** Python sidecar with `diffusers` + `nerijs/pixel-art-xl` LoRA; spawned on demand. VRAM detection → fall back to PixelLab.ai if < 8 GB. Pillow palette quantize to the active theme palette. Cache by `(appID, theme, prompt-template hash)`. Pre-generate a sprite set for the user's top 20 games on first run.

**Phase 4 — Wallpaper polish (2–3 weeks).** Three-tier throttling (FULL / THROTTLED_1HZ / PAUSED). Global hotkey to open the interactive window. WorkerW watchdog. "Launch this game" via steamworks.js / shell.

**Phase 5 — Reflection + lore (3–4 weeks).** Smallville-style reflection at importance threshold 150. Tier 2 cloud LLM calls (Claude/GPT) for reflection and weekly "dream" sequences. Upload-lore feature: drop a `.txt`/`.md`, chunk, embed, seed as agent memories.

**Phase 6 — Steam release (2 weeks).** Store page polish, screenshots, capsule art (disclose pre-gen AI on assets), trailer. Content Survey: disclose pre-gen + live-gen AI with the guardrail text above. 30-day wait will already be elapsed if Phase 0 paperwork was filed on time. Build review; release.

**Benchmarks that would change the plan:**
- If local SDXL gen takes > 15 s on a 3060Ti, switch to PixelLab-default and demote local to a "premium quality" toggle.
- If Qwen 2.5 7B reflection quality is unusable in user testing, escalate Tier 2 to cloud-only and add a "private mode" disclaimer.
- If WorkerW reparenting breaks on a Windows 11 release after launch, escalate to the Lively maintainers' issue tracker (their fix latency is the upper bound on yours) and ship an interim "always-on-bottom normal window" fallback.
- If cloud LLM cost per active user exceeds $1.50/month, harden the batching policy (one reflection per agent per real-world hour) and/or move all Tier 2 calls to local 14B+ models on capable users' machines.

## Recommendations

1. **Start the Electron + steamworks.js + `electron-as-wallpaper` spike this week.** This is the single highest-risk integration; de-risk it before any other code.
2. **Lock the licensing path now**: use `nerijs/pixel-art-xl` (OpenRAIL-M) and/or PixelWave FLUX-schnell (Apache 2.0) locally; PixelLab (paid tier, commercial-OK) in the cloud. Do not ship Retro Diffusion weights inside your bundle.
3. **Treat the LLM provider as a configuration value from day one.** Vercel AI SDK or a thin custom adapter. The cost of a late-stage swap is high.
4. **Port the Smallville architecture verbatim before optimising.** The 150-importance reflection threshold and recency × relevance × importance retrieval are battle-tested; don't reinvent.
5. **File the Steam Direct paperwork in Phase 0**, not Phase 6. The 30-day waiting period is calendar time you can't compress, and the AI Content Survey copy can be drafted in parallel with engineering.
6. **Defer the year-2 filesystem feature.** Stub the `FileSystemAdapter` interface and ship without it; the privacy/UX work is a project on its own.
7. **Build telemetry into the agent router from day one** — agent ID, tier called, tokens in/out, latency, model name. Cost surprises will come from event-volume tails, not averages.

## Caveats

- The January 2026 Steam AI policy rewrite is recent; Valve has signalled further changes and Epic's CEO has publicly argued for removing AI disclosures entirely. Build the disclosure copy as a config string you can edit without a code release.
- Lively Wallpaper is GPL-v3 — do **not** copy code directly. Reimplement the Progman/WorkerW pattern from the public CodeProject article and the documented Win32 calls.
- The Smallville paper used GPT-3.5; cost and quality extrapolation to local Qwen/Llama is plausible but un-benchmarked for Memory Palace's specific event volumes. Telemetry from day one is mandatory.
- WebGPU support in Electron's bundled Chromium is still maturing as of mid-2026; PixiJS v8 falls back to WebGL cleanly, but test on a range of GPUs.
- PixelLab and Retro Diffusion are small (2–3 person) startups; build the provider abstraction so you can swap if they shut down or change terms.
- Wallpaper Engine's exact throttling heuristic (window-size pixel-perfect comparison) is documented by its developer in Steam Community threads, not in formal docs; expect to tune the foreground-detection logic against real-world apps (Source-engine games and Chromium-based borderless windows are the historical edge cases).
- The `ceifa/steamworks.js` `nodeIntegration: true` / `contextIsolation: false` pattern is a known security relaxation; an open issue (#188) recommends moving to context-isolation + a preload bridge in future. Plan to harden post-MVP.
- Tauri's measured size and memory wins (80–200 MB → 2–10 MB; 200–300 MB → 30–40 MB at idle, per PkgPulse / RaftLabs 2025–2026 benchmarks) are real and large; if a future v2 demands those numbers (e.g. enterprise distribution), a Tauri rewrite is feasible once the pattern is proven in Electron.
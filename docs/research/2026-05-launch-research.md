*Filed 2026-05-17 as reference material. Not part of the active rulebook; specific findings that became decisions are reflected in SPEC.md (§2.2, §6.2, §10) and CLAUDE.md as appropriate. Re-evaluate findings on a yearly cadence or when major ecosystem changes warrant.*

# LibraryWorld: Research Report on Tools, Systems, and Strategy

*Prepared May 2026 for a solo/small-team Steam indie utility project*

This report is organized by the seven scope areas you specified. Within each section, items are ordered roughly by relevance to LibraryWorld. "Why it matters" framing is included for every item. Genuinely novel or strategy-changing findings are flagged with **⚑**. Honest gaps are called out where the evidence is thin.

---

## 1. Technical Tools and Systems

### 1.1 Steamworks integration in a web-tech desktop app — **⚑ critical finding: this almost certainly forces you to Electron**

Two libraries dominate Node-based Steamworks integration: **greenworks** (Greenheart Games, originally built for Game Dev Tycoon, still works but the maintainer explicitly says "active development is not a priority") and **steamworks.js** by ceifa (modern, TypeScript-typed, NAPI bindings, actively maintained as of mid-2025, with documented Electron integration guides).

The decisive operational fact: **steamworks.js and greenworks both require Node.js as the host runtime, which means they work natively in Electron (and NW.js) but not in Tauri.** A widely-cited 2024–25 substack post by a developer who tried to wrap a JS game for Steam concluded that "Electron and NW.js are also the only desktop frameworks officially supported by the two main libraries that help distribute games on Steam." A November 2025 Hacker News comment from the Microlandia developer confirms the same conclusion from the other direction: they shipped Tauri on Windows and macOS successfully but had to repackage in Electron to get Steamworks working on Linux's Steam Runtime sniper SDK.

You *can* technically call the Steamworks C SDK from Rust (the `steamworks-rs` crate exists), so Tauri is not impossible — but as a non-coder solo founder, you'd be the integration test case and would not benefit from the existing Electron-targeted examples for Workshop upload, overlay, and achievements.

**Setup gotchas for steamworks.js in Electron:** you must set `contextIsolation: false` and `nodeIntegration: true` in your BrowserWindow's `webPreferences` (this weakens Electron's sandbox — you'll need to be disciplined about not loading untrusted remote content into that window); you must call `require('steamworks.js').electronEnableSteamOverlay()` at the end of main.js for the Steam overlay to attach; and you must copy `steam_api64.dll` (Windows), `libsteam_api.dylib` (Mac), or `libsteam_api.so` (Linux) from the SDK redistributables into the build root.

**Actionable takeaway:** Plan to ship on Electron, not Tauri. This is a strategy-changing decision because most of your other research probably assumed Tauri was the lighter, modern choice. It is — but Steamworks integration is the single technical dependency that overrides that preference. See §1.3 for how to mitigate Electron's downsides.

### 1.2 Wallpaper Engine: architecture, ecosystem, and what to copy

Wallpaper Engine is the only directly relevant reference product on Steam. Key technical patterns (reconstructed from official docs, community wikis, and the developer's own dev posts):

- **Desktop integration on Windows:** WE renders by reparenting its window under the `Progman`/`WorkerW` desktop handle so it draws behind icons and above the static wallpaper. This is the standard live-wallpaper technique used by Lively Wallpaper (open source, MIT-licensed) and basically every clone. Read the Lively Wallpaper source — it's the closest thing to a documented reference implementation. The DhiWise build-guide and several Stack Overflow threads describe the `FindWindow("Progman")` → `SendMessage 0x052C` → `FindWindowEx WorkerW` ritual.
- **Pause/throttle policy:** WE uses a three-tier render loop — full speed when desktop visible, throttled (often 30fps or paused video) when partially occluded, fully paused when a fullscreen application or game is detected. The dev's own documentation calls this out as the single most important feature for trust.
- **Performance envelope claims:** Vendor/affiliate sources cite "<1% CPU, <10% GPU" for typical scene wallpapers; this is marketing-grade phrasing but matches user observation that the app stays out of the way. 3D and 2D scenes are GPU-bound; web (Chromium) and "application" wallpapers are the heaviest CPU-wise.
- **Scene wallpapers as a model:** WE differentiates 2D and 3D scenes. The 3D format supports PBR maps (albedo, normal, metallic, roughness, emissive), bones, animations, and a JavaScript fork called "SceneScript" for logic. They publish glTF-compatible model import docs. This is essentially what you want LibraryWorld templates to be: a deterministic scene definition + assets, runnable in a sandbox.
- **Ecosystem scale:** The developer announced when leaving Early Access (Nov 2018) that the WE Workshop had become "the third biggest Workshop on Steam." On Steam it currently shows ~225,000 reviews at ~98% positive, with ~6,800 reviews in the last 30 days (as of the search result snapshot) — sustained engagement nearly a decade after release. List price is $4.99. The Workshop currently shows 2.78M items, including 21,169 "Application" type items, 98,612 "Web" type, and 1.5M "Scene" type.
- **Hard lesson from WE's own history:** the developer publicly disabled the paid item store inside WE, citing inability to verify third-party application/video submissions, codec licensing, and confusion among buyers about whether items were free or paid. This is directly relevant to your post-v1.0 Workshop plans — **avoid trying to monetize community templates yourself; let it be free.**

**Actionable takeaway:** Wallpaper Engine is the validation that a $4.99–$9.99 Steam utility with a Workshop can sustain a single developer for a decade. Copy its three-tier render loop, its game-detection auto-pause, and its 2D/3D scene split. Don't try to take a cut of Workshop content — WE tried and gave up.

### 1.3 Tauri vs Electron for a 3D Three.js wallpaper app

Multiple 2025–2026 benchmarks (DoltHub, Hopp, RaftLabs, OpenReplay, PkgPulse, Tech Insider) converge on the same numbers: Electron apps are 80–180 MB installers idling at 150–300 MB RAM; Tauri apps are 3–12 MB installers idling at 30–85 MB RAM. The Hoppscotch team's published migration reduced their bundle from 165 MB to 8 MB and memory by 70%.

**However, for a 3D Three.js app that lives as a wallpaper, the relevant factors invert several of these comparisons:**

1. **Steamworks support** (see §1.1) → Electron wins decisively.
2. **WebGL/WebGPU rendering consistency:** Tauri uses WebView2 (Chromium) on Windows but WKWebView (WebKit) on macOS and WebKit2GTK on Linux. The Webgamedev.com publishing guide explicitly notes that "WebKit web views (which you would get on Mac or Linux with Tauri for instance) are not as performant as Chromium when it comes to graphics. So if you want the most performant cross-platform experience, go for Electron or NW.js." For a Three.js-heavy app this matters; for a TODO app it doesn't.
3. **Always-on memory footprint:** Tauri's 30–40 MB advantage is genuinely real and meaningful for a live wallpaper, but it's largely offset by the fact that the Three.js renderer + asset buffers will themselves take 200–500 MB depending on scene complexity. The runtime overhead is no longer the dominant cost.
4. **Bundle size:** Electron's ~100 MB hurts download conversion and first-impression reviews, but is no worse than a typical mid-sized indie game.

**Actionable takeaway:** Ship Electron. Mitigate its weight with: (a) ASAR + native module unpacking properly configured; (b) lazy-load heavy AI-generated assets from your Cloudflare Workers CDN rather than bundling them; (c) keep the renderer-process window strict about CSP since you've had to disable context isolation for steamworks.js. Don't even attempt the Tauri path unless someone in the community ships a stable Steamworks Rust crate with Workshop upload support that you've personally tested.

### 1.4 Three.js performance for always-on rendering

The single most important pattern for a live-wallpaper Three.js app is **render-on-demand**, not the default `requestAnimationFrame` loop. Three.js Fundamentals (Greggman) has a canonical lesson on it; React-Three-Fiber bakes it in via `<Canvas frameloop="demand" />` plus `invalidate()` from `useThree()`. Quoting the R3F docs: "If the moving parts in your scene are allowed to come to rest, then it would be wasteful to keep rendering. In such cases you can opt into on-demand rendering, which will only render when necessary. This saves battery and keeps noisy fans in check." For LibraryWorld this maps perfectly: the world is mostly static; subtle ambient animations (flicker, wind, water) only need to drive frames when visible and active.

Additional patterns from the Tympanus/Codrops 2025 R3F guide and the Utsubo "100 Three.js Tips" guide (2026):

- **Visibility-based throttling:** Listen for `document.visibilitychange` and switch `frameloop` to `'never'` when hidden (alt-tabbed away). For wallpaper mode, listen to OS-level focus/foreground-window events through Electron's `desktopCapturer` / `BrowserWindow` events.
- **Instancing:** Use `InstancedMesh` (or `BatchedMesh` since r161) for repeated archetype objects. If a user has 200 games and 50 are "bookshelves," that's one draw call instead of 50.
- **KTX2/Basis textures:** PNG/JPG decompress fully in VRAM (a 200 KB PNG can hit 20 MB VRAM). KTX2 with Basis Universal stays compressed on GPU, ~10× memory reduction. Use UASTC for normals, ETC1S for diffuse.
- **Draco compression** for geometry: 90–95% file-size reduction for GLTF models. Critical because your AI-generated Meshy/Tripo objects will dominate download size.
- **Target ≤100 draw calls** per frame for smooth 60fps on integrated GPUs.
- **WebGPU renderer** (production-ready since r171) gives ~20–40% better perf than WebGL2 on modern hardware with automatic fallback. Worth adopting since your audience is gamers with relatively new GPUs.
- **Troika's optimizations are worth studying as reference**: octree-accelerated raycasting (your "click on object to launch game" interaction will benefit hugely), and bypassing Three.js's per-frame scene-graph traversal for invisible nodes.

**Actionable takeaway:** Build the renderer with `frameloop="demand"` from day one, an `invalidate()` call on user input and on animation tick events, and InstancedMesh for archetypes. Bake heavy lighting and AO into textures at template-build time (you're already baking AI assets — extend that pipeline). Target ≤100 draw calls.

### 1.5 Steam Workshop integration for non-game apps

The Steamworks ISteamUGC interface supports Workshop for any Steam app, not just games. Wallpaper Engine, RPG Maker MV/MZ asset packs, Aseprite palettes, and Tabletop Simulator mods are all examples of non-game Workshop use. steamworks.js exposes the full UGC API: `client.workshop.createItem`, `updateItem`, `subscribeItem`, `getSubscribedItems`, `downloadItem`, and the metadata/tags/preview-image fields.

Content surface for LibraryWorld templates would naturally be:
- A scene JSON (camera paths, archetype placements, lighting, audio cues)
- Referenced asset blobs (GLB models, KTX2 textures, audio clips, skybox)
- Metadata: preview image, tags, description, version

**Critical caveat from Wallpaper Engine's experience:** Workshop is *not* a free moderation system. WE has had ongoing problems with NSFW content, IP-infringing game-art reuse, and malicious application wallpapers. You will face the same problems the moment Workshop opens. Plan for: (1) a curation/featured queue, separate from auto-published; (2) automated mesh validation (poly count caps, file size caps, no executables); (3) image moderation API integration (Hive, AWS Rekognition, or Cloudflare's built-in image moderation) for preview images; (4) a reporting flow that goes to your Cloudflare Workers backend, not just to Valve. Valve's Workshop moderation is light-touch and slow.

**Workshop revenue sharing:** Valve's Workshop revenue-share program exists but is invitation-only and historically limited to TF2 hats, Skyrim mods (briefly), and a few cosmetic-economy games. **There is no general-purpose Workshop monetization for utility apps.** WE tried it and shut it down. Plan for free Workshop content as a discovery/retention engine, not a revenue line.

### 1.6 Procedural generation libraries (JS/TS, 2026)

For a 3D scene built from a personal library, you'll need WFC-like constraint-based placement for archetype objects in plausible compositions. The relevant tools:

- **ndwfc** (LingDong-/ndwfc) — N-dimensional Wave Function Collapse with infinite canvas, has 2D/3D helper tools (WFCTool2D/3D), and a Three.js demo. Cleanest API. Good default.
- **Boris the Brave's DeBroglie** (.NET) and his js-wfc — the most thoroughly documented WFC implementations on the web; his blog has the best WFC tutorial bar none.
- **A 2024 high-performance Three.js WFC solver** posted on the Three.js Discourse forum optimizes the naive implementation 10–100× by using typed-array bitmasks for cell state. Worth reading even if you don't use it directly.
- **Hex-grid WFC reference (felixturner)** — recent (2025) full-stack write-up of a modular hex WFC system in Three.js + WebGPU + TSL shaders. He explicitly notes "WFC is great at local edge matching but terrible at large-scale patterns" — he abandoned WFC for tree/building *placement* and used it only for terrain. **This is directly relevant to LibraryWorld:** use WFC for ground/path/tile composition; use Poisson disk sampling or simple weighted random placement for hero archetype objects.

Other useful libraries: **poisson-disk-sampling** (kchapelier) for natural object scatter; **simplex-noise** (jwagner) for terrain; **rosebud-l-systems** or roll your own L-systems for procedural foliage.

**Actionable takeaway:** ndwfc + poisson-disk-sampling + simplex-noise covers 90% of your placement needs. Use WFC only for the ground/tile layer; place hero objects manually-but-procedurally with Poisson + per-archetype weighted rules.

### 1.7 Steam OpenID for authentication (web + desktop)

Steam's auth is **OpenID 2.0** — the legacy spec, not OpenID Connect. This causes real friction:
- It's not supported out of the box by NextAuth/Auth.js, Clerk, Supabase Auth, or most modern auth platforms. There's an ongoing nextauthjs/next-auth GitHub discussion (#697) where the community has built custom forks.
- For Node.js, the practical libraries are `passport-steam` and `node-steam-openid`.
- **You must keep your Steam Web API key server-side** — Steam's Terms of Use forbid exposing it in client JS. This means even your web viewer needs a small server (your Cloudflare Workers backend) to handle the OpenID exchange and Web API calls.
- Steam OpenID **cannot run in an iframe**, and you must use one of Valve's official "Sign in through Steam" button images.
- The OpenID response gives you only the 64-bit SteamID. To get the owned-games list (`IPlayerService/GetOwnedGames`), playtime, achievements, etc., you then use the Web API with your secret key. **Critically, if the user's Steam profile is private, you get nothing** — your onboarding flow must instruct them to set game details to public for the duration of world generation, or you must accept failure gracefully.

**For the Electron app specifically:** the standard pattern is to open the Steam OpenID URL in the system browser (`shell.openExternal`), listen on a local loopback HTTP server for the redirect with the OpenID params, validate the signature with Steam (`openid.mode=check_authentication`), and persist the SteamID + a session token. **Or**, simpler: skip OpenID entirely in the desktop app and use steamworks.js's `client.localplayer.getSteamId()` — if the user is logged into Steam (which they must be, because the app launched from Steam), you already have their SteamID. Use OpenID only for the web viewer.

**Actionable takeaway:** Two auth flows. Desktop: read SteamID directly from steamworks.js, query Web API server-side. Web viewer: full OpenID 2.0 dance through Cloudflare Workers.

### 1.8 Scene capture for share artifacts

Three.js → MP4/WebM share clips can be done with the browser-standard `MediaRecorder` API capturing from `canvas.captureStream(60)`. The pattern works in both Electron's Chromium and modern browsers. For higher-quality offline rendering, **CCapture.js** is the established library, and **canvas-capture** (mattdesl) is its modern successor. For pure stills, `renderer.domElement.toBlob()` is fine.

**For social-share artifacts specifically**, the pattern from Spotify Wrapped, Strava, and GitHub Wrapped is a vertical 9:16 short with text overlays, ~15–30 seconds. Render this offline at template-build time (not at click time), since your AI pipeline already runs there. Pre-bake a 1080×1920 MP4 + a 1200×630 OG image per world.

---

## 2. Research Papers and Academic Work

### 2.1 Behavioral profiling from gameplay data

**Bartle's 1996 taxonomy** (Achievers / Explorers / Socializers / Killers) remains the most-cited framework but has been substantially critiqued. The two key successors:

- **Nick Yee** (Daedalus Project / Quantic Foundry) argued the four-category model is too rigid and proposed a *component* model — players have measurable scores on multiple orthogonal motivational dimensions rather than belonging to a type. His factor analysis of 7,000 MMO players found Bartle's "Explorer" type didn't cluster as a single factor: "exploring the world" and "analyzing the game mechanics" did not correlate. Yee's **Gamer Motivation Profile** at Quantic Foundry uses 12 motivations grouped into 6 clusters — this is the academically and commercially most-validated successor.
- **Marczewski's HEXAD** (Player, Socializer, Free Spirit, Achiever, Philanthropist, Disruptor) is the gamification-industry successor, more applicable to non-game contexts.
- **Telemetry-based clustering** (recent work — see the ResearchGate paper on a "typologically anchored, game event log-based framework" for inferring player personas from FPS telemetry without questionnaires) shows that behavioral data alone can recover stable, interpretable clusters: aggressive high-risk, cautious survivor, exploration-oriented tactician.

**Why this matters for LibraryWorld:** Your AI personalization will be more compelling if it casts users along a *spectrum* (Yee model) rather than slotting them into one of four boxes (Bartle). Don't write copy that says "You are an Explorer." Write copy that says "Your library leans heavily toward open-world exploration, with a strong undercurrent of completionism — that's why we built you a lighthouse on a cliff overlooking a half-charted map." The data sources you have (Steam playtime by genre, achievement %, HLTB completion ratios) map well onto Quantic Foundry's six clusters.

### 2.2 Self-portraits and personal-data visualizations

Genuinely rigorous academic work here is thin, but the most-cited reference points are:
- **Giorgia Lupi & Stefanie Posavec's "Dear Data"** project (2014–15) and Lupi's "Data Humanism" manifesto — the canonical argument that personal data viz feels meaningful when it (a) preserves messiness and idiosyncrasy, (b) is hand-touched / artist-mediated rather than chart-template-y, (c) makes the viewer the *protagonist* of the artifact. This is the design philosophy you want.
- **Eric Zimmerman & Heather Chaplin's work on play biographies** and the broader "ludography" movement in game studies.
- Industry write-ups on Spotify Wrapped repeatedly identify the same mechanic: data → identity → social shareability. (See §3.2.)

**Gap:** I did not find a peer-reviewed paper that directly studies *why* one personal-data viz feels meaningful and another feels gimmicky. The pattern from industry post-mortems is consistent though: gimmicky ones describe data ("you played 1,247 hours"); meaningful ones interpret it ("you spent more time in cozy farming sims than the average user spends sleeping in a year"). LibraryWorld's "Hades = the lighthouse that keeps relighting itself" example is exactly the right register.

### 2.3 Spatial memory and 3D-as-personal

The relevant academic ground here is the **method of loci / memory palace** literature (Yates 1966's "The Art of Memory" is the foundational text; more recent neuroscience by Maguire et al. on London taxi-drivers and the work of Foer's "Moonwalking with Einstein") and the HCI sub-literature on **spatial hypertext** (Marshall & Shipman, 1990s–2000s). The consistent finding: humans encode and retrieve information better when it's spatially situated, *especially* when the space has navigable affordances (rooms, paths, landmarks) rather than abstract coordinates.

This is the strongest theoretical justification for LibraryWorld over a grid. **But be honest with yourself about the gap:** none of this research specifically validates that a digital 3D library is better than a grid for the *task users actually do* (find a game to play). Wallpaper Engine succeeds as ambient art, not as a navigation tool. Your product is ambient-art-first, launcher-second, and you should accept that framing.

### 2.4 Steam library research

This is a thin area in peer-reviewed work but there's solid grey-literature data:
- **Ars Technica's 2014 analysis** (still cited because no one else has redone it at scale): ~37% of Steam-owned games had never been played; the median user played fewer than half their owned games. The "Steam pile of shame" is universal.
- **SteamDB and Steam Years** regularly publish library-size distributions; the "100+ games" power-user cohort is in the low double-digit percentage of the userbase but accounts for the heaviest spending and review activity.
- **Newzoo and Steam's own end-of-year recaps** show monthly active users in the ~130–160M range with ~30M peak concurrent.

**Why it matters:** Your TAM for a $7–10 utility is gated by library size. Users with <20 games will not pay $7 to visualize them. Users with 100+ are your real market. This is probably ~15–25M Steam users, of whom maybe 1–5% would buy a personalization utility — a ceiling of perhaps 150,000–1.2M lifetime sales if you become well-known. Wallpaper Engine's ~12M+ owners (estimated from its review-to-owner ratio and SteamDB rankings) is the optimistic ceiling reference.

### 2.5 HCI work on alternative launchers / library visualizations

Sparse academic literature; mostly industry blog posts. Worth knowing: every major Steam alternative launcher (Playnite, LaunchBox, GOG Galaxy) has stayed niche. The pattern is clear — users *say* they want a better launcher but in practice stick with the default. **LibraryWorld's strategic move is to not compete on launcher functionality but on ambient/aesthetic identity.** Don't pitch it as "a better Steam library." Pitch it as "a place where your games live."

### 2.6 What makes AI narrative descriptions feel personal

No single canonical paper, but the practical heuristics validated across product post-mortems (Replika, Character.AI, Spotify's listener archetypes) converge on: (1) reference *specific* user data points by name rather than abstractions ("your 312 hours in Stardew Valley" not "your favorite cozy game"); (2) use second person and present tense; (3) include at least one observation the user wouldn't have noticed themselves; (4) leave the metaphor slightly ambiguous so the user fills in meaning (the lighthouse example does this — "keeps relighting itself" is evocative, not pinned down). Anthropic's own published guidance on Claude for personalization tasks reinforces these points.

---

## 3. Similar Products and Case Studies

### 3.1 Wallpaper Engine — your North Star

Covered in §1.2. Key facts to memorize:
- **Released October 2016 (Early Access), 1.0 in November 2018.** Solo-dev origin.
- **List price $4.99** (drops to $3.49 on sale). Has never raised its price despite being on Steam's top-25 played apps for years.
- **~225K reviews at ~98% positive** (Steam, May 2026). Implies 11M+ owners using common review-to-owner ratios.
- **Workshop is "the third biggest on Steam"** per the developer's own 2018 milestone post.
- **No Workshop monetization**: developer tried and abandoned it. Items are free.
- **Companion app on Android** is free, used for transferring wallpapers to phone — gives the product a social-share surface beyond Steam.
- **Single developer** (Kristjan Skutta, "Kachuck") for years.

**Strategy lessons for LibraryWorld:** Low price, no monetized Workshop, multi-monitor + mobile companion, aggressive auto-pause-while-gaming, never raise the price.

### 3.2 Spotify Wrapped et al. — viral mechanics for personal-data artifacts

Multiple sources agree on the core mechanic: turn ambient personal data into a **shareable identity statement** with a fixed cadence (annual scarcity). Specific design patterns:

- **Visual identity that reads at thumbnail size** — bold colors, big numbers, one hero stat per card (Spotify, Strava, GitHub Wrapped all do this).
- **Bragging-rights frames** — "you're in the top 1% of Hades players" works because it's a status claim the user can post without seeming self-promotional.
- **Friction-zero share** — pre-baked PNG/MP4 sized for Instagram Stories and TikTok (9:16, 1080×1920).
- **Scarcity** — Wrapped runs for a limited window each December; missing it creates FOMO and trains the annual habit.
- **2025 lesson (per Campaign Del Mar's post-mortem):** Wrapped 2025 wobbled because Spotify added "clutter" (Listening Archive, Club feature) that didn't generate bragging-rights cards. **Each feature should pay for itself in one shareable frame.**

**For LibraryWorld:** Build an annual "Year in Library" mode that re-generates the world with playtime-this-year weights. Pre-bake a 9:16 share video at template-build time. Each significant game gets one shareable card with a one-line AI metaphor.

### 3.3 Lensa, Prequel, AI avatar apps — the rise-and-fall pattern (gap: based on general knowledge, not fresh search)

Lensa's "Magic Avatars" feature went viral in late 2022 and reached #1 on the US App Store; revenue reportedly spiked into eight figures monthly during the peak weeks. The crash was equally fast — by mid-2023 daily downloads had collapsed >95%. The pattern across this category (Lensa, Reface, Dream by Wombo, EpikAI):

1. **One-shot novelty** — users generate avatars once, share them, never return.
2. **No retention loop** — the artifact has no relationship to the app after sharing.
3. **Backlash risk** — Lensa hit IP/training-data controversies and NSFW exploits within weeks of going viral.

**For LibraryWorld this is a real risk and a real opportunity:**
- ⚑ **Risk:** if your launch goes viral on the "look at my AI library world" axis alone, you'll get Lensa-pattern collapse.
- **Opportunity:** unlike Lensa, your product has an *ongoing* daily use (it's a wallpaper / alt-tab destination). The world *updates* as the user plays. **Lean hard into that.** Marketing should emphasize "this changes with you" not "this generates a thing for you."

### 3.4 Steam alternative launchers and library tools

- **Playnite** — open-source, free, unifies Steam/GOG/Epic/Xbox libraries. Strong cult following, has plugins. Stays niche (probably <500K active users) because most people don't want to leave Steam's launcher.
- **LaunchBox** — paid premium version, retro/emulation-focused, similar niche scale.
- **GOG Galaxy** — same multi-library concept from a platform holder; never reached critical mass for non-GOG users.
- **Steam Years** — simple, free, web-only annual recap; popular each January but no monetization.
- **Astats, SteamDB, Augmented Steam** — power-user analytics tools, also free, also niche.

**The lesson:** Free + power-user-only stays niche. Paid + aesthetic + low-friction (Wallpaper Engine) can be mass-market. LibraryWorld is squarely on the WE side of this divide *if* you keep it aesthetic-first.

### 3.5 Cozy indie utilities and generative-art apps (gap: light data)

Townscaper ($5.99 on Steam, ~150K+ reviews at 97% positive), Mountain ($1.99 by David OReilly, sold ~250K+ over time per public statements), Cloud Gardens, Dorfromantik (Game of the Year 2022 German Game Award, sold 500K+ in first year per developer interviews) all share a price band of $5–$15 and a "meditative procedural" framing. Townscaper is the closest aesthetic reference — Oskar Stålberg built it solo over years as a procedural-construction toy. The pricing range supports LibraryWorld's $7–10 target.

**Generative art apps that monetized:** Field, generative.fm (Alex Bainter — donations/Patreon), most generative-art projects monetize through prints or NFTs not software sales. Cinema 4D and Houdini are pro tools, not relevant comparables.

### 3.6 VR-adjacent "digital collection as place"

BigScreen Home Environments, VRChat homes, Resonite worlds — there's clear validation that users find meaning in inhabitable digital spaces tied to their identity. But none of these have monetized as utilities; they're features inside larger platforms. **The opportunity for LibraryWorld is to be the first to do this on the desktop, where users actually spend their time, without requiring a headset.**

### 3.7 Companion-app patterns

Spotify desktop client, Pocket Casts, Plex media server clients, Discord — the pattern is: small persistent app that sits alongside a primary platform, offers value the primary platform doesn't, retains via daily-use ambience rather than feature parity. **LibraryWorld fits this exactly** — Steam remains the primary platform; LibraryWorld is the ambient/aesthetic layer.

---

## 4. Business and Distribution Strategy

### 4.1 Steam Direct 2026: process, costs, timing

- **$100 USD one-time fee per app**, paid in Steam's checkout, recoupable as a credit against your first $1,000 in adjusted gross revenue.
- **Revenue split:** 70/30 to developer up to $10M lifetime; 75/25 from $10M–$50M; 80/20 above $50M. For LibraryWorld's scale, assume 70/30 indefinitely.
- **30-day mandatory wait** between paying the fee and being allowed to release.
- **Coming Soon page must be public for ≥2 weeks** before launch (this is your wishlist accumulation window — critical).
- **Review process: 1–5 business days** typically. Common rejection reasons cited in 2026 guides: store assets misleading vs. actual product, build crashes on launch, AI content not disclosed.
- **AI Disclosure: required.** See §5.4. You will need to fill out the Content Survey describing how AI generates content. The 2026 rewritten policy excludes developer-side AI tools (Copilot, ChatGPT for code) but **requires disclosure for any content "consumed by players,"** which includes your generated 3D objects, metaphor text, audio, and skybox imagery.
- **Steam Direct context:** ~19,000 games launched on Steam in 2025; median lifetime earnings ~$249 gross / ~$174 after Valve cut. The "most games fail" reality is real. Your wedge is that you're a *utility*, not a game — competing against ~50 utility releases a year, not 19,000 games.

### 4.2 Pricing strategy for $5–10 Steam utilities

Confirmed pricing comparables: Wallpaper Engine ($4.99), Aseprite ($19.99 — outlier), Lively Wallpaper (free, not on Steam), Wallpaper Engine clones on Steam ($2–5). Your $7–10 target is at the high end of WE's band but justified by the AI personalization differentiator.

**Pricing-research notes from the 2026 Datahumble guides:**
- Steam's auto-regional pricing is often too high for LATAM/MENA; manual adjustment improves unit sales.
- Launch discount of 10–40% is standard for visibility lift; 15% is the sweet spot most developers use.
- Higher launch prices are easier to drop later than raise. Start at $9.99, discount to $6.99 in launch week, settle at $7.99 long-term.

### 4.3 Steam Workshop monetization for utility apps

**As covered in §1.5: there is no functional revenue-share path for Workshop on utility apps.** Plan for free templates as a community/retention engine, with monetization staying on the base app price (and optional later DLC packs of *your* curated templates if needed).

### 4.4 Marketing playbook for indie Steam utilities in 2026

From the Summer Engine, Mad Octopus, and Ziva 2026 guides, the consensus playbook:

1. **Wishlist velocity is the algorithm signal.** Median game at Feb 2026 Steam Next Fest gained ~200 wishlists; top 5% gained ~7,000; games entering with <2,000 wishlists got little lift. **Run a 6–8 week pre-launch where every post drives wishlist clicks.**
2. **TikTok and YouTube Shorts are the top indie marketing channels in 2026.** 15–60 second gameplay clips. **For LibraryWorld this is a perfect fit** — every generated world is a screen-recording video naturally suited to short-form. Each user is a marketer.
3. **Demo strategy** — Steam Next Fest requires a demo. For LibraryWorld, a demo could be "see your library as a world (limited features)" — exactly the value prop, with the share/save feature locked.
4. **Influencer outreach** — mid-tier streamers (10K–100K subs) playing cozy/indie or commentary categories. People like Kowoma, Ludwig, Northernlion are too big; target the cozy-corner Twitch and the Pirate Software/Game Maker's Toolkit YouTube tier.
5. **Steam Curators** — a long tail of mostly-low-impact accounts. Send keys broadly; expect ~5% to publish reviews.
6. **Reddit:** r/Steam (3M+), r/pcgaming (4M+), r/IndieGaming, r/CozyGamers. Native posts, not promo. The "I built this app" template works once per subreddit.
7. **Discord:** Start your own from day one. Indie utilities that build community Discords (Aseprite, Wallpaper Engine, Playnite) have outsized retention. Use it for Workshop template sharing post-v1.0.

### 4.5 Partnering with Steam directly

**Realistic assessment:** Valve almost never partners with third-party tools at the marketing level. The Steam Web API is a public, ToS-governed resource and Valve treats use of it as your responsibility. The most you can hope for is (a) being featured on a curated indie page if a Valve employee notices you, (b) Steam Awards nominations (utility category exists), (c) Steam Next Fest inclusion (automatic via demo). **Don't build strategy around partnership.** Build around Workshop because that's the only formal integration channel Valve provides.

---

## 5. Ecosystem Risks and Policies

### 5.1 Steam Web API and OpenID terms of service

- **API key must be kept server-side** (your Cloudflare Workers).
- **Subject to the Steam Web API Terms of Use** — you may not store full data dumps long-term, may not redistribute, must respect user privacy. You are *probably* fine processing playtime/achievements ephemerally to generate a world, then storing only the resulting scene JSON.
- **Private profile = no data**, and you cannot work around this. Onboarding must communicate it clearly.
- **No known significant 2025–2026 changes to the Web API ToS** were surfaced in this research. Verify directly at steamcommunity.com/dev/apiterms before launch.

### 5.2 HowLongToBeat — **⚑ this is your most fragile data dependency**

HLTB has no official public API. The de facto data is gathered through scrapers — `howlongtobeat` (npm, ckatzorke), `howlongtobeatpy` (Python), `howlongtobeat-scraper` (Rust), `HowLongToBeatApi` (.NET), and several Apify-hosted scrapers. **HLTB has actively broken the scrapers multiple times** by changing HTML structure and search endpoints (visible in the GitHub issue history of these libraries — there are recurring "broken in May 2024," "fixed in Sept 2024" issues).

**Risk for LibraryWorld:** If HLTB times-to-complete are a core input to your archetype casting (e.g., "long completionist game = lighthouse"), your AI pipeline can stop working with no warning. Mitigations:
1. Pre-fetch and cache HLTB data **at template-build time on your backend**, not at runtime in the desktop client. If HLTB breaks for a week, existing worlds still work; only new world generations are affected.
2. Build a fallback: if HLTB returns nothing, infer rough completion length from Steam achievement count + average playtime. Imperfect but resilient.
3. Consider reaching out to HLTB about a partnership; small independent sites have historically been open to it.

### 5.3 IGDB and alternatives

IGDB (owned by Twitch/Amazon) is the standard structured games-metadata API. Rate limits are 4 requests/second per IP on the free tier with OAuth authentication via Twitch credentials. Alternatives: **RAWG** (similar coverage, friendlier free tier, 20k req/month) and **GiantBomb** (declining since their 2025 layoffs, not recommended for new projects). **For LibraryWorld, IGDB is fine** because your usage is server-side and batched at template-build time. Pre-cache aggressively.

### 5.4 Valve's AI policy — current state and what you must do

Valve substantially **rewrote the AI disclosure rules in late 2025 / January 2026** (per VGC, GameSpot, 80.lv, and Generation Amiga reporting). Current state:

- **Two categories:** "Pre-Generated" (AI used during development to produce shipping assets) and "Live-Generated" (AI runs at runtime in the user's session).
- **You must disclose** in the Content Survey, freeform text, what AI tools generated player-consumed content (art, audio, text, localization, etc.).
- **You no longer need to disclose** AI used purely as dev-side tooling (Copilot, ChatGPT for code, AI-upscaling tools in art pipeline — anything where the AI output is not directly experienced by players).
- **Live-Generated requires additional guardrails disclosure** — what you do to prevent illegal content.
- The disclosure appears on the store page in an "AI Generated Content Disclosure" section.

**For LibraryWorld:** You are Pre-Generated (Claude generates text, Stable Audio generates audio, Blockade Labs generates skybox, Meshy/Tripo generate 3D objects — all *baked* at template-build time, then shipped). You are not Live-Generated. Disclose this clearly. **Word the disclosure as a feature**, not as a confession — your audience for this product is more pro-AI than the average Steam gamer.

**Risk to monitor:** The policy is "voluntary and not enforced by moderation on Valve's end" (per GameSpot). But repeated rule rewrites suggest the policy may tighten. Build your pipeline so you can ship without AI generation in an emergency (use a curated default-template pool as fallback).

### 5.5 steam:// protocol handler

The `steam://run/<appid>` protocol launches games via the installed Steam client. It's stable, well-supported, and works from both your Electron app and the web viewer (browsers will prompt the user to confirm the protocol handler; this confirmation is *not* a bug, it's required browser security). I found no evidence of 2025–2026 reliability changes. **For your web viewer, expect 1 click of friction the first time and 0 thereafter** (most browsers cache the consent). Provide a fallback "open in Steam app" link.

### 5.6 IP and fair use of game art

Using Steam's `header.jpg`, `library_600x900.jpg`, and `capsule_*.jpg` images is technically a copyright question. In practice: every Steam library tool ever (Steam Years, SteamDB, Astats, Backloggd, IsThereAnyDeal) uses these images via Steam's CDN URLs and Valve has never issued takedowns to a non-commercial display use. **Commercial use in a paid app is a slightly grayer area**, but Wallpaper Engine, Playnite, and every Steam wrapper has operated this way for years without incident. **However:** Do *not* feed game art to AI models as training data or use it as a base image for generation — that crosses into clear infringement. Your Meshy/Tripo prompts should reference genre and theme, not the game's own art.

---

## 6. Audio and Sound Design

(This area was less covered by the live searches; the following is largely from general knowledge — flagged as such.)

### 6.1 Ambient audio practices for non-game apps

The reference work is the audio design in apps like **Endel**, **Calm**, **Wallpaper Engine's audio-responsive wallpapers**, and games-as-ambience like **Mountain**, **Proteus**, and **A Short Hike**. The consistent patterns:
1. **Layered loops at different lengths** so the combination never quite repeats (e.g., wind 3:47, distant birds 1:13, water 4:31).
2. **Diegetic UI sounds** — when the user clicks an archetype, the click sound *is* something in the scene (a lantern lighting, a page turning, an arcade button), not a generic UI ping. This is the single most important "feels alive" technique.
3. **Spatial audio via Web Audio API's PannerNode** — Three.js has `PositionalAudio` built in, hooks into Web Audio. Sounds get louder as you approach archetypes. Free and built-in.

### 6.2 Audio middleware

For your stack and scope:
- **Web Audio API directly** (via Three.js's `PositionalAudio`/`Audio` classes) is sufficient for v1.0. Do not adopt FMOD or Wwise.
- **FMOD Studio** has a free indie tier (<$200K revenue projected) but its strength is dynamic interactive music systems you don't need.
- **Wwise** has a free non-commercial tier; commercial use starts at $7.5K per platform. Overkill.

### 6.3 Music licensing for commercial Steam apps

For an indie paid Steam app:
- **Stable Audio commercial license** (Stability AI's terms as of 2025) allows commercial use of generated audio; verify current terms before launch as this area is changing.
- **ElevenLabs** has a clear commercial tier; outputs are usable in commercial products under their Creator/Pro plans.
- **Royalty-free libraries** that are safe for Steam release: **Epidemic Sound** (subscription, broad license), **Artlist**, **Pixabay Music** (free, broad license but verify per-track), **Free Music Archive** (track-by-track, mixed licenses — read each).
- **Avoid:** YouTube Audio Library (license terms exclude some commercial app use), Suno/Udio outputs (active legal uncertainty in 2025–2026 around their training data; Steam itself has had submissions flagged).

**Actionable takeaway:** For commercial safety, ship with Stable Audio + ElevenLabs (both have clear commercial terms) plus an Epidemic Sound subscription for fallback hand-curated ambient. Avoid Suno/Udio for shipped content until their legal situation stabilizes.

---

## 7. Things You Might Be Missing

### 7.1 Spatial computing / VR future-proofing

Vision Pro (Apple) and Quest 3/4 (Meta) — both ship in 2024–2026 — have validated the concept of "inhabitable digital spaces" as a consumer category. Vision Pro shipped with a "Environments" feature where users sit in a virtual landscape; Quest's Horizon Home is a personalizable space. **The Three.js codebase you build is WebXR-capable with relatively modest changes** (~few weeks of work to add WebXR session support).

**Strategic implication:** Don't build for VR/spatial in v1.0, but architect so it's possible. The pitch "your Steam library, walkable in Vision Pro" is a 2027–2028 narrative that would extend product life and open press angles. Steam itself has Vision Pro support being tentatively explored per scattered reporting; track this.

### 7.2 Browser-based 3D apps that have monetized

This is a genuinely weak category commercially. **Bruno Simon's portfolio** is a marketing artifact, not a product. **Spline** (web-based 3D editor) raised significant venture funding but monetizes through SaaS, not Three.js consumer apps. **Krunker, Diep.io**, and similar browser games monetize through ads + cosmetics — not your model. The cleanest reference for "Three.js + paid utility on Steam" is, again, none — you would be the first significant example. **This is a feature, not a bug**, but be honest with yourself that the playbook is unwritten.

### 7.3 HackerNews / r/IndieDev launch patterns to study

Patterns from indie utility launches 2024–2026: **Aseprite** ($19.99, ~30K reviews, sustained for a decade via slow updates + Workshop-equivalent script ecosystem); **RPG Maker MV/MZ** ($79.99, sustained via DLC asset packs and Workshop); **Pixaki** (iPad pixel art, $19.99 one-time, multi-year sustained); and the smaller cohort of "weekend project went viral" launches that nearly always fall back to long-tail (~80% of revenue in first 30 days, then a long flat tail).

**Pattern relevant to LibraryWorld:** Plan revenue projection as 60% launch month, 30% first year, 10% indefinite long tail. A successful launch is $50K–$200K total revenue; a viral launch is $200K–$2M; a Wallpaper-Engine-scale outlier is $10M+ over a decade.

### 7.4 Local LLMs for dev iteration on RTX 4070 12GB

You said this was already covered, but one 2026-specific update worth noting: **Qwen 3 series (Alibaba, late 2025)** and **DeepSeek V3.2** offer Claude-quality text generation in ~8–14B parameter ranges that fit 4070 12GB at 4-bit quantization via Ollama or LM Studio. For metaphor generation iteration, you can ditch local LLMs for testing entirely and just batch through Claude's API at $3/M input — generating 10,000 game metaphors costs ~$5–15. Local LLMs are overkill for this workload; use them only if cost per iteration becomes a constraint at scale.

### 7.5 The Workshop-moderation timebomb — **⚑**

Across two passes of this research, the single most consistent risk that emerged is **moderation of community-generated templates post-v1.0**. Wallpaper Engine, Steam Workshop broadly, and every other UGC platform deals with: NSFW content, IP infringement (Disney/anime/AAA-game characters showing up in templates), executable malware in "application" type content, and harassment via custom content. **For LibraryWorld templates specifically**, the risk is amplified because templates can include AI-generation prompts that produce NSFW/infringing imagery on someone else's machine when they apply the template.

Plan now:
1. Workshop templates ship as *static baked assets only* — no live AI generation from community templates. Your built-in AI pipeline is for your own first-party generation.
2. Pre-publish moderation queue with image-moderation API checks on every preview.
3. Clear DMCA flow on your own site, supplementing Valve's.
4. A way to remotely deactivate templates from your backend (a kill switch via Cloudflare Workers that the desktop app checks on launch).

This is the single area where doing the technical/policy work *before* launching v1.0 saves you from a months-long crisis later.

---

## Final Strategic Synthesis

The two findings most likely to change your strategy:

**1. Ship Electron, not Tauri** (§1.1, §1.3). Steamworks integration via steamworks.js is mature and Tauri-incompatible. The bundle-size penalty is real but acceptable for a one-time-paid utility. Don't waste weeks fighting Tauri.

**2. Frame LibraryWorld as ambient art with a launcher inside, not a launcher with art on it** (§3.4, §3.7). Every "better Steam launcher" stays niche. Wallpaper Engine is a $4.99 ambient-art product with utility features bolted on, and it's earned its developer a decade of solo income. The Lensa lesson (§3.3) reinforces this: one-shot novelty crashes; ongoing-ambience retains.

The two largest risks to plan around:

**1. HowLongToBeat scraper fragility** (§5.2). Build a fallback before launch.

**2. Workshop moderation** (§7.5). Build the moderation pipeline before v1.0, not after.

The single most strategically interesting opportunity not fully explored elsewhere:

**Annual "Year in Library" mode** (§3.2). Spotify Wrapped is the best-validated viral-personal-data pattern in consumer software. You have all the inputs (per-year playtime, achievements unlocked this year, completion ratios). One Wrapped-style export per year per user is essentially free marketing in early December annually, in perpetuity.

The honest gaps in this research worth a follow-up pass before launch: specific Wallpaper Engine sales numbers (only review counts were available), detailed adoption stats for Playnite and Steam Years, recent commercial-use clarity for Suno/Udio, and any 2025–2026 changes to Valve's Workshop revenue-share program for non-game apps.

# lokilibrary Worker — deployment

The Cloudflare Worker at `worker/index.ts` is the single AI orchestration
surface (CLAUDE.md / SPEC §6.1). All API keys live server-side here; the
frontend never holds one.

## Local development

```
npm run worker      # wrangler dev on :8787, reads worker/.dev.vars
```

`worker/.dev.vars` is gitignored. Copy `worker/.dev.vars.example` and fill
in your `ANTHROPIC_API_KEY` (or set `LLM_PROVIDER=local` for Ollama).

## Production deployment via Cloudflare Workers Builds

Cloudflare auto-deploys this worker on every push to `main` once two things
are configured. **Both are one-time dashboard/CLI actions; nothing in this
repo can do them for you.**

### 1. Set the root directory in the dashboard

This repo keeps `wrangler.toml` co-located with the worker code under
`worker/`, not at the repo root. Cloudflare Workers Builds defaults to the
root, so it needs to be pointed at `worker/`:

1. Cloudflare dashboard → Workers & Pages → `lokilibrary` → Settings → Builds
2. Set **Root directory** to `worker`
3. Save

### 2. Set production secrets

`.dev.vars` is local-only. Production secrets must be set explicitly:

```
wrangler secret put ANTHROPIC_API_KEY --name lokilibrary
# (paste the sk-ant-... key when prompted)
```

Or via dashboard → Workers & Pages → `lokilibrary` → Settings → Variables
and Secrets → "Add" → type: secret.

Verify with:

```
curl https://lokilibrary.<your-subdomain>.workers.dev/healthz
# should return {"ok":true,"provider":"anthropic","anthropic_configured":true}
```

## Frontend wiring

The web frontend defaults to `http://localhost:8787` for the worker. For
production builds, set `VITE_WORKER_URL` at build time:

```
VITE_WORKER_URL=https://lokilibrary.<your-subdomain>.workers.dev npm run build
```

(Not needed for the dev server, which uses the local worker.)

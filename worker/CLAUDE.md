# Worker — local LLM dev mode

(Moved from the root CLAUDE.md "How to run". The rule that local LLM
is never the shipped default lives in the root file's "Things to NOT
do".)

**Local LLM dev mode (optional — needs a box that can host Ollama):**

```
ollama pull qwen2.5:7b           # one-time
ollama serve                      # background daemon at http://localhost:11434
# Set LLM_PROVIDER=local in worker/.dev.vars
npm run worker                    # now hits Ollama instead of Anthropic
```

Harry's Mac can't host local models — dev iteration on this box uses the
Claude API (`LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` in
`worker/.dev.vars`; Haiku Tier-1 latency ~1.7s). The Ollama path remains
a self-hoster / contributor opt-in, never the default.

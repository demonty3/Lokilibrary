# Desktop wrapper — how to run

(Moved from the root CLAUDE.md "How to run"; the macOS-only platform
rule stays in the root file.)

Third terminal, alongside `npm run dev` + `npm run worker` at the repo
root:

```
cd desktop
npm install
npm run dev       # tsc + electron pointing at localhost:5183
```

One-time Steamworks setup (only needed for the launch-a-game path —
rendering + agents run without it), per
`desktop/STEAMWORKS_SDK_LICENSE.txt` neighbours: drop the Steamworks
SDK's `redistributable_bin/<platform>/` into
`desktop/sdk/redistributable_bin/<platform>/`, create
`desktop/steam_appid.txt` containing `480` (SpaceWar).

Prefer the `.claude/skills/launch-desktop-app` skill over ad-hoc runs —
it encodes the verified macOS launch + CDP-driving recipe.

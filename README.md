# UsForge

Small games made by a few friends. Minimal on purpose: a grid of games, a page to play them, nothing else.

## Add a game

- **Members** sign in at `/upload.html` on https://usforge.usforge.workers.dev and upload a folder (needs `index.html`; optional `cover.png`), a single HTML file, or a link. They can update or remove their own games there.
- **Everyone else** sends their game to Taurus.
- **New accounts:** the friend makes a *password code* on the Upload page and sends it to Taurus, who pastes it into "Add a friend's account" (admin only). Passwords themselves are never shared or stored — only codes, in `accounts.json`.

House rules: only change your own games; first names or nicknames only (no last names, photos, schools); nothing mean about real people; any game comes down if its maker asks.

## How it works

- `index.html`: the grid (reads `games.json`). `play.html?g=<folder>` runs a game in a sandboxed frame. `add.html` is the guide above.
- `games.json` is **generated**: `scripts/build_list.py` collects every `games/*/game.json`. On GitHub this runs automatically (`.github/workflows/deploy.yml`) before every publish, so don't edit `games.json` by hand.
- Folders starting with `_` are ignored (handy for drafts).
- Uploads: the site runs as a Cloudflare Worker (`wrangler.jsonc`, `worker/index.js`). `/api/*` checks the account against `accounts.json` and saves by committing to this repo with a GitHub key stored only in Cloudflare as the secret `GITHUB_TOKEN` (fine-grained, this repo only, Contents: read and write). Each upload rewrites `games.json` in the same commit.

Preview locally: `python3 scripts/build_list.py && python3 -m http.server`, then open http://localhost:8000.

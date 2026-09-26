# UsForge

Small games made by a few friends. Minimal on purpose: a grid of games, a page to play them, nothing else.

## Add a game

Everything happens on the GitHub website:

1. Go into the `games` folder → **Add file → Upload files**.
2. Drag in a folder (lowercase, dashes: `potato-dash`) containing your game's `index.html` and other files, plus a `game.json`:

   ```json
   { "title": "Potato Dash", "author": "potato", "blurb": "Dodge the forks." }
   ```

   Optional: `cover.png` screenshot, `"pixel": true` for pixel art, `"url": "https://…"` for games that only live at a link.
3. **Commit changes.** The site republishes itself within a minute or so.

House rules: only edit your own game's folder; first names or nicknames only (no last names, photos, schools); nothing mean about real people; any game comes down if its maker asks.

## How it works

- `index.html`: the grid (reads `games.json`). `play.html?g=<folder>` runs a game in a sandboxed frame. `add.html` is the guide above.
- `games.json` is **generated**: `scripts/build_list.py` collects every `games/*/game.json`. On GitHub this runs automatically (`.github/workflows/deploy.yml`) before every publish, so don't edit `games.json` by hand.
- Folders starting with `_` are ignored (handy for drafts).

Preview locally: `python3 scripts/build_list.py && python3 -m http.server`, then open http://localhost:8000.

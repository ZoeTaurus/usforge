"""Builds games.json from every games/<folder>/game.json.

Runs automatically on GitHub before each deploy, so nobody has to edit a shared list.
Run it yourself to preview locally:  python3 scripts/build_list.py
"""
import json, pathlib, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAMES = ROOT / 'games'
COVERS = ('cover.png', 'cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif')
# the genres a game can be tagged with (up to 3) — the same list lives in site.js and worker/index.js
GENRES = ['Action', 'Adventure', 'Arcade', 'Boss rush', 'Casual', 'Crafting', 'Endless runner', 'Exploration', 'Fighting', 'Idle', 'Management', 'Open world', 'Physics', 'Platformer', 'Puzzle', 'Racing', 'Rhythm', 'Roguelike', 'RPG', 'Sandbox', 'Shooter', 'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Tower defense', 'Board game', 'Card game', 'Educational', 'Multiplayer', 'Party', 'Quiz', 'Text-based', 'Word game', 'Comedy', 'Fantasy', 'Horror', 'Mystery', 'Pixel art', 'Sci-fi', 'Space', 'Story']



def clip(text, n):
    """Shorten to n characters at a whole word, ending with an ellipsis (never mid-word)."""
    text = ' '.join(text.split())
    if len(text) <= n:
        return text
    return text[:n - 1].rsplit(' ', 1)[0].rstrip(' ,;:-–—') + '…'


def added_at(folder):
    """When the folder first appeared in the project (newest games go first). 0 if git doesn't know."""
    try:
        out = subprocess.run(['git', 'log', '--diff-filter=A', '--format=%at', '--', str(folder)],
                             cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.split()
        return int(out[-1]) if out else int(time.time())   # not committed yet: it's brand new
    except Exception:
        return int(time.time())


def updated_at(folder, added):
    """When the game's files (not just its details) last changed, if that was after it was first added. None if never."""
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%at', '--', str(folder), f':(exclude){folder}/game.json'],
                             cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.split()
        t = int(out[0]) if out else None
        return t if t and t > added + 3600 else None
    except Exception:
        return None


games, problems = [], []
for folder in sorted(p for p in GAMES.iterdir() if p.is_dir() and not p.name.startswith(('_', '.'))):
    info_file = folder / 'game.json'
    if not info_file.exists():
        problems.append(f'{folder.name}: no game.json — skipped')
        continue
    try:
        info = json.loads(info_file.read_text(encoding='utf-8'))
    except Exception as e:
        problems.append(f'{folder.name}: game.json is not valid JSON ({e}) — skipped')
        continue
    url = str(info.get('url', '')).strip()
    playable = (folder / 'index.html').exists()
    dev = bool(info.get('dev'))   # still in development: listed in its own section, and may have no build yet
    if not playable and not url and not dev:
        problems.append(f'{folder.name}: needs an index.html (or a "url" in game.json) — skipped')
        continue
    cover = next((c for c in COVERS if (folder / c).exists()), None)
    games.append({
        'slug': folder.name,
        'title': str(info.get('title') or folder.name.replace('-', ' ').title())[:60],
        'author': str(info.get('author') or 'someone')[:30],
        'owner': str(info.get('owner') or info.get('author') or ''),   # the account allowed to update it
        'blurb': clip(str(info.get('blurb') or ''), 300),
        'cover': f'games/{folder.name}/{cover}' if cover else None,
        'pixel': bool(info.get('pixel')),   # pixel-art covers stay crisp instead of blurry
        'url': None if playable else (url or None),   # games that only live elsewhere (like a Claude artifact link)
        'genres': [g for g in GENRES if g.lower() in {str(x).lower() for x in info.get('genres') or []}][:3],
        'dev': dev,
        'progress': max(0, min(100, int(info['progress']))) if dev and isinstance(info.get('progress'), (int, float)) else None,
        'next': str(info.get('next') or '')[:100] if dev else '',   # what they're working on next
        'build': playable or bool(url),   # False = a teaser for a game with nothing to play yet
        'added': added_at(folder),
    })
    up = updated_at(folder, games[-1]['added'])
    if up:
        games[-1]['updated'] = up   # new files since it was first added (the site shows "Updated")

games.sort(key=lambda g: (-g['added'], g['title'].lower()))
(ROOT / 'games.json').write_text(json.dumps(games, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'games.json: {len(games)} game(s)')
for p in problems:
    print('  !', p)
sys.exit(0)

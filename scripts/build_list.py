"""Builds games.json from every games/<folder>/game.json.

Runs automatically on GitHub before each deploy, so nobody has to edit a shared list.
Run it yourself to preview locally:  python3 scripts/build_list.py
"""
import json, pathlib, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAMES = ROOT / 'games'
COVERS = ('cover.png', 'cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif')


def added_at(folder):
    """When the folder first appeared in the project (newest games go first). 0 if git doesn't know."""
    try:
        out = subprocess.run(['git', 'log', '--diff-filter=A', '--format=%at', '--', str(folder)],
                             cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.split()
        return int(out[-1]) if out else int(time.time())   # not committed yet: it's brand new
    except Exception:
        return int(time.time())


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
    if not playable and not url:
        problems.append(f'{folder.name}: needs an index.html (or a "url" in game.json) — skipped')
        continue
    cover = next((c for c in COVERS if (folder / c).exists()), None)
    games.append({
        'slug': folder.name,
        'title': str(info.get('title') or folder.name.replace('-', ' ').title())[:60],
        'author': str(info.get('author') or 'someone')[:30],
        'owner': str(info.get('owner') or info.get('author') or ''),   # the account allowed to update it
        'blurb': str(info.get('blurb') or '')[:140],
        'cover': f'games/{folder.name}/{cover}' if cover else None,
        'pixel': bool(info.get('pixel')),   # pixel-art covers stay crisp instead of blurry
        'url': None if playable else url,   # games that only live elsewhere (like a Claude artifact link)
        'added': added_at(folder),
    })

games.sort(key=lambda g: (-g['added'], g['title'].lower()))
(ROOT / 'games.json').write_text(json.dumps(games, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'games.json: {len(games)} game(s)')
for p in problems:
    print('  !', p)
sys.exit(0)

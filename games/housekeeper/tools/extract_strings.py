#!/usr/bin/env python3
"""Find every player-facing English string in the game, the same way js/i18n.js looks them up.

Usage:
  python3 tools/extract_strings.py            # list keys missing from each translation
  python3 tools/extract_strings.py --all OUT  # write all keys to OUT as JSON [[id, key], ...]

Strings are split into translation units like the game does at runtime: each <p>/<li>/<h3>/<div>... paragraph
(keeping inline <b>/<i>/<kbd> tags), and ${...} in template literals becomes {0}, {1}, ...
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOCK = {'p', 'li', 'h1', 'h2', 'h3', 'div', 'ol', 'ul', 'section', 'nav', 'canvas', 'button', 'label'}
VOID = {'br', 'img', 'input', 'meta', 'link', 'hr'}


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def unescape_js(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            n = s[i + 1]
            if n == 'n':
                out.append('\n'); i += 2
            elif n == 't':
                out.append('\t'); i += 2
            elif n == 'u':
                out.append(chr(int(s[i + 2:i + 6], 16))); i += 6
            else:
                out.append(n); i += 2
        else:
            out.append(c); i += 1
    return ''.join(out)


def lex(src):
    """Yield every string literal (template literals get {0}, {1}... for ${...})."""
    lits = []
    i = 0

    def read_string(i, q):
        j = i + 1
        while j < len(src):
            if src[j] == '\\':
                j += 2
                continue
            if src[j] == q:
                break
            j += 1
        return unescape_js(src[i + 1:j]), j + 1

    def read_template(i):
        j, text, n = i + 1, [], 0
        while j < len(src):
            c = src[j]
            if c == '\\':
                text.append(src[j:j + 2]); j += 2
                continue
            if c == '`':
                break
            if c == '$' and src[j + 1] == '{':
                depth, k = 1, j + 2
                while k < len(src) and depth > 0:
                    ch = src[k]
                    if ch in '\'"':
                        s, k = read_string(k, ch)
                        lits.append(s)
                        continue
                    if ch == '`':
                        k = read_template(k)
                        continue
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                    k += 1
                text.append('{%d}' % n); n += 1
                j = k
                continue
            text.append(c); j += 1
        lits.append(unescape_js(''.join(text)))
        return j + 1

    while i < len(src):
        c = src[i]
        if src.startswith('//', i):
            e = src.find('\n', i)
            i = len(src) if e < 0 else e
        elif src.startswith('/*', i):
            i = src.find('*/', i) + 2
        elif c in '\'"':
            s, i = read_string(i, c)
            lits.append(s)
        elif c == '`':
            i = read_template(i)
        else:
            i += 1
    return lits


def parse(html):
    """Tiny HTML tree: nodes are ('el', tag, start, end, children) or ('text', start, end)."""
    root = ['el', None, 0, len(html), []]
    stack = [root]
    pos = 0
    for m in re.finditer(r'<(/?)([a-zA-Z0-9]+)([^>]*)>', html):
        if m.start() > pos:
            stack[-1][4].append(['text', pos, m.start()])
        closing, tag = m.group(1), m.group(2).lower()
        if closing:
            for k in range(len(stack) - 1, 0, -1):
                if stack[k][1] == tag:
                    stack[k][3] = m.start()
                    del stack[k:]
                    break
        elif tag in VOID or m.group(3).endswith('/'):
            stack[-1][4].append(['el', tag, m.end(), m.end(), []])
        else:
            el = ['el', tag, m.end(), None, []]
            stack[-1][4].append(el)
            stack.append(el)
        pos = m.end()
    if pos < len(html):
        stack[-1][4].append(['text', pos, len(html)])
    for el in stack[1:]:
        el[3] = len(html)
    return root


def has_block(node):
    return any(c[0] == 'el' and (c[1] in BLOCK or has_block(c)) for c in node[4])


def collect(html, node, keys, pieces=False):
    for c in node[4]:
        if c[0] == 'el':
            if c[1] in ('canvas', 'script'):
                continue
            if not has_block(c):
                keys.append(norm(html[c[2]:c[3]]))
                if pieces:  # static page layout (e.g. HUD labels next to numbers) is translated piece by piece
                    collect(html, c, keys, pieces)
            else:
                collect(html, c, keys, pieces)
        elif html[c[1]:c[2]].strip():
            keys.append(norm(html[c[1]:c[2]]))


def code_like(s):
    return (re.match(r'^(#|rgba|rgb\(|hsl|js/|css/|data-|btn-|housesitting-|p_|https?:)', s)
            or re.search(r'=>|function\s*\(|^\s*[a-z-]+:\s|\.(js|css|png)$|^[a-z]+(-[a-z]+)+$|^[a-z]+[A-Z]\w*$', s)
            or re.match(r'^\d*[.\w]{1,3}$', s))


def keys_for(s, keys):
    t = s.strip()
    if not re.search(r'[A-Za-z]{2}', t) or code_like(t):
        return
    if not (' ' in t or re.match(r'^[A-Z][a-z]', t) or '<' in t):
        return
    if '<' in t:
        tree = parse(t)
        if not has_block(tree):
            keys.append(norm(t))
        else:
            collect(t, tree, keys)
    else:
        keys.append(norm(t))


def all_keys():
    index = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    files = [f for f in re.findall(r'src="(js/[^"]+)"', index) if 'i18n' not in f and '/lang/' not in f]
    keys = []
    body = index[index.index('<body>') + 6:index.index('<script')]
    collect(body, parse(body), keys, pieces=True)
    keys.append(norm(re.search(r'<title>(.*?)</title>', index).group(1)))
    for f in files:
        for s in lex(open(os.path.join(ROOT, f), encoding='utf-8').read()):
            keys_for(s, keys)
    seen, out = set(), []
    for k in keys:
        bare = re.sub(r'<[^>]+>|\{\d+\}|&\w+;', ' ', k)
        if k in seen or not (re.search(r'[A-Za-z]{3}', bare) or re.match(r'^\s*[A-Z]{2}', bare)):
            continue
        if k.startswith('sprite {0}'):
            continue
        seen.add(k)
        out.append(k)
    return out


if __name__ == '__main__':
    keys = all_keys()
    if len(sys.argv) > 2 and sys.argv[1] == '--all':
        json.dump([[i, k] for i, k in enumerate(keys)], open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        print(f'{len(keys)} keys written to {sys.argv[2]}')
    else:
        for lang in ('zh-Hans', 'zh-Hant', 'es'):
            path = os.path.join(ROOT, 'js', 'lang', f'{lang}.js')
            text = open(path, encoding='utf-8').read()
            have = set(norm(k) for k in json.loads(text[text.index('{'):text.rindex('}') + 1]).keys()) if '{' in text else set()
            missing = [k for k in keys if k not in have]
            print(f'{lang}: {len(keys) - len(missing)}/{len(keys)} translated')
            for k in missing[:20]:
                print('   missing:', k[:90])

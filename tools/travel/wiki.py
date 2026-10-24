"""Small wikitext parser for Wikivoyage articles: sections, listings, links, climate, images."""
import re, html

LISTING = {'see', 'do', 'eat', 'drink', 'sleep', 'buy', 'go', 'listing'}
DROP = {'mapframe', 'mapshape', 'mapshapes', 'mapmask', 'mapgroup', 'mapgroup-item', 'routebox', 'routebox-1', 'ispartof', 'pagebanner',
        'geo', 'anchor', 'dead link', 'index', 'stdcolor', 'forecastnoaa', 'forecast/us', 'related', 'relatedwikipedia', 'printdistricts',
        'seedistricts', 'otheruses', 'confused', 'hatnote', 'flag', 'rint', 'nycs', 'handicap-icon', 'hasdocent', 'usa national park passes',
        'see also', 'seealso', 'main', 'style', 'clear', 'toc', 'tocright', '-', 'commons', 'disamb', 'extraregion', 'sign of road',
        'mapframe/sandbox', 'printdistricts', 'regionlist', 'climate chart', 'infobox', 'cautionbox', 'warningbox', 'quickbar', 'ili', 'learn',
        'pagebanner/sandbox', 'navigation', 'mapframe2', 'eatpricerange', 'sleeppricerange', 'populationof', 'quote'}
STATUS = re.compile(r'^(outline|usable|guide|star|stub)(city|park|region|district|topic|airport|itinerary|ruralarea|diveguide|country|event)$')


def find_templates(s, start=0):
    """Yield (start, end) spans of top-level {{...}}."""
    i = s.find('{{', start)
    while i != -1:
        depth = 0; j = i
        while j < len(s) - 1:
            if s[j:j + 2] == '{{': depth += 1; j += 2; continue
            if s[j:j + 2] == '}}':
                depth -= 1; j += 2
                if depth == 0: break
                continue
            j += 1
        if depth != 0:
            return
        yield i, j
        i = s.find('{{', j)


def split_params(inner):
    parts = []; depth = 0; link = 0; cur = []
    i = 0
    while i < len(inner):
        two = inner[i:i + 2]
        if two == '{{': depth += 1; cur.append(two); i += 2; continue
        if two == '}}': depth -= 1; cur.append(two); i += 2; continue
        if two == '[[': link += 1; cur.append(two); i += 2; continue
        if two == ']]': link -= 1; cur.append(two); i += 2; continue
        ch = inner[i]
        if ch == '|' and depth == 0 and link == 0:
            parts.append(''.join(cur)); cur = []
        else:
            cur.append(ch)
        i += 1
    parts.append(''.join(cur))
    name = parts[0].strip()
    pos, named = [], {}
    for p in parts[1:]:
        m = re.match(r'^\s*([\w\- ]+?)\s*=(.*)$', p, re.S)
        if m and '[[' not in m.group(1): named[m.group(1).strip().lower()] = m.group(2).strip()
        else: pos.append(p.strip())
    return name, pos, named


def num(v):
    try: return float(str(v).replace(',', '').strip())
    except: return None


class Ctx:
    def __init__(self, linkfn):
        self.linkfn = linkfn  # title -> (href or None)
        self.images = []


def inline(s, ctx):
    """Wikitext fragment -> safe HTML (templates handled, links resolved)."""
    if not s: return ''
    out = []; last = 0
    for a, b in list(find_templates(s)):
        out.append(_text(s[last:a], ctx)); last = b
        out.append(_tmpl_inline(s[a + 2:b - 2], ctx))
    out.append(_text(s[last:], ctx))
    h = ''.join(out)
    h = re.sub(r'\s+', ' ', h).strip()
    return h


def _tmpl_inline(inner, ctx):
    name, pos, named = split_params(inner)
    n = name.lower().strip()
    if n == 'marker':
        nm = named.get('name', '')
        nm = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', nm)
        return '<b>' + html.escape(nm) + '</b>'
    if n in ('iata', 'faa lid'): return html.escape(pos[0]) if pos else ''
    if n in ('mi', 'mile', 'km', 'ft', 'feet', 'foot', 'm', 'acre', 'mph', 'in', 'ft2', 'mi2', 'fahrenheit', 'f', 'c', 'usd'):
        unit = {'mi': 'mi', 'mile': 'mi', 'km': 'km', 'ft': 'ft', 'feet': 'ft', 'foot': 'ft', 'm': 'm', 'acre': 'acres', 'mph': 'mph', 'in': 'in',
                'ft2': 'sq ft', 'mi2': 'sq mi', 'fahrenheit': '°F', 'f': '°F', 'c': '°C', 'usd': ''}[n]
        v = pos[0] if pos else ''
        return html.escape(('$' + v) if n == 'usd' else (v + (' ' if unit[0] != '°' else '') + unit))
    if n == 'convert':
        return html.escape((pos[0] + ' ' + pos[1]) if len(pos) >= 2 else '')
    if n in ('phone',): return html.escape(pos[0]) if pos else ''
    if n in ('w', 'wikipedia'): return html.escape(pos[-1] if pos else '')
    if n in ('nowrap', 'small', 'big', 'smaller', 'larger', 'lang', 'emdash', '!'):
        if n == 'emdash': return '—'
        if n == '!': return '|'
        return inline(pos[-1], ctx) if pos else ''
    if n in ('isbn',): return 'ISBN ' + html.escape(pos[0]) if pos else ''
    if n in ('event',):
        nm = named.get('name', ''); c = named.get('content', '')
        return '<b>' + inline(nm, ctx) + '</b>' + (' ' + inline(c, ctx) if c else '')
    if n in LISTING:
        L = listing(n, named, ctx)
        return '<b>' + html.escape(L['n']) + '</b>' + (' — ' + L['c'] if L.get('c') else '')
    return ''


def _text(s, ctx):
    # files
    def f_file(m):
        body = m.group(1)
        parts = body.split('|')
        fn = parts[0].strip()
        cap = parts[-1] if len(parts) > 1 and not re.match(r'^(thumb|right|left|\d+px|upright.*|center|none|frame|frameless)$', parts[-1].strip()) else ''
        cap = re.sub(r'<br\s*/?>', ' ', cap, flags=re.I)
        cap = re.sub(r'\{\{[^{}]*\}\}', '', cap)
        cap = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', cap)
        cap = re.sub(r"\[\[?|\]\]?|'''?|<[^>]+>", '', cap).strip()
        ctx.images.append({'f': fn, 'cap': cap})
        return ''
    s = re.sub(r'\[\[\s*(?:File|Image)\s*:((?:[^\[\]]|\[\[[^\]]*\]\])*)\]\]', f_file, s, flags=re.I)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'__[A-Z]+__', '', s)
    s = re.sub(r'<ref[^>]*?/>', '', s); s = re.sub(r'<ref.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'</?(span|div|small|big|center|sup|sub|u|s|font)[^>]*>', '', s, flags=re.I)
    s = re.sub(r'<br[^>]*>', ' ', s, flags=re.I)
    s = re.sub(r'\[\[\s*(?:File|Image)\s*:[^\n]*?\|thumb[^\n]*?(?=\n|$)', '', s, flags=re.I) if '[[File' in s and ']]' not in s.split('[[File', 1)[1][:600] else s
    s = re.sub(r'\[\[\s*(Category|:?[a-z]{2,3}|w|wikipedia|commons)\s*:[^\]]*\]\]', lambda m: '' if m.group(1).lower() in ('category',) or len(m.group(1)) <= 3 and m.group(1).lower() not in ('w',) else m.group(0), s)
    s = html.escape(s, quote=False)
    s = s.replace('&amp;nbsp;', ' ').replace('&amp;#160;', ' ').replace('&amp;ndash;', '–').replace('&amp;mdash;', '—').replace('&amp;amp;', '&amp;')

    def f_link(m):
        tgt = m.group(1).strip(); txt = m.group(2) if m.group(2) is not None else tgt
        if tgt.lower().startswith(('w:', 'wikipedia:')):
            return txt if m.group(2) is not None else tgt.split(':', 1)[1]
        tgt = tgt.split('#')[0].replace('_', ' ')
        href = ctx.linkfn(tgt) if tgt else None
        return f'<a href="{href}">{txt}</a>' if href else txt
    s = re.sub(r'\[\[([^|\]]*)(?:\|([^\]]*))?\]\]', f_link, s)
    s = re.sub(r'\[(https?://[^\s\]]+)\s+([^\]]+)\]', lambda m: f'<a href="{m.group(1)}" rel="nofollow noopener" target="_blank">{m.group(2)}</a>', s)
    s = re.sub(r'\[(https?://[^\s\]]+)\]', '', s)
    s = re.sub(r"'''''(.+?)'''''", r'<b><i>\1</i></b>', s)
    s = re.sub(r"'''(.+?)'''", r'<b>\1</b>', s)
    s = re.sub(r"''(.+?)''", r'<i>\1</i>', s)
    s = s.replace("'''", '').replace("''", '')
    s = s.replace('[[', '').replace(']]', '')
    return s


def listing(kind, p, ctx):
    k = kind if kind != 'listing' else (p.get('type', 'listing') or 'listing').lower()
    def clean(v):
        v = html.unescape(re.sub(r'<[^>]+>', '', inline(v or '', ctx)))
        return re.sub(r'\[\[?|\]\]?', '', v).strip()
    L = {'k': k, 'n': html.unescape(re.sub(r"'''?|<[^>]+>", '', clean(p.get('name', '')))), 'alt': clean(p.get('alt', '')),
         'url': '' if re.search(r'dead link', p.get('url') or '', re.I) else re.sub(r'\{\{.*', '', (p.get('url') or '')).strip().split(' ')[0], 'addr': clean(p.get('address', '')), 'lat': num(p.get('lat')), 'lon': num(p.get('long')),
         'dir': clean(p.get('directions', '')), 'ph': clean(p.get('phone', '')), 'hrs': clean(p.get('hours', '')),
         'pr': clean(p.get('price', '')), 'img': (p.get('image') or '').strip(), 'wp': (p.get('wikipedia') or '').strip(),
         'wd': (p.get('wikidata') or '').strip(), 'le': (p.get('lastedit') or '').strip()[:10], 'ci': clean(p.get('checkin', '')), 'co': clean(p.get('checkout', ''))}
    L['c'] = inline(p.get('content', '') or p.get('description', ''), ctx)
    if L['img'].lower().startswith(('file:', 'image:')): L['img'] = L['img'].split(':', 1)[1]
    if L['url'] and not L['url'].startswith('http'): L['url'] = 'http://' + L['url']
    for key in list(L):
        if L[key] in ('', None): del L[key]
    L.setdefault('n', '')
    L.setdefault('k', k)
    return L


def climate(inner):
    name, pos, named = split_params(inner)
    nums = [num(x) for x in pos]
    nums = [x for x in nums if x is not None]
    units = named.get('units', 'imperial').lower()
    if len(nums) < 36: return None
    lo = [nums[i * 3] for i in range(12)]; hi = [nums[i * 3 + 1] for i in range(12)]; pr = [nums[i * 3 + 2] for i in range(12)]
    if units.startswith('metric'):
        lo = [x * 9 / 5 + 32 for x in lo]; hi = [x * 9 / 5 + 32 for x in hi]; pr = [x / 25.4 for x in pr]
    return {'hi': [round(x) for x in hi], 'lo': [round(x) for x in lo], 'pr': [round(x, 1) for x in pr]}


def parse_article(title, text, linkfn):
    ctx = Ctx(linkfn)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    art = {'t': title}
    m = re.search(r'\{\{\s*pagebanner\s*\|([^}]*)\}\}', text, re.I)
    if m:
        _, pos, named = split_params('pb|' + m.group(1))
        art['banner'] = (pos[0] if pos else named.get('image', '')).strip()
        cap = pos[1] if len(pos) > 1 else named.get('caption', '')
        cap = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', cap)
        art['bcap'] = re.sub(r"\{\{[^{}]*\}\}|\[\[?|\]\]?|'''?|<[^>]+>", '', cap).strip()
    m = re.search(r'\{\{\s*geo\s*\|\s*([-\d.]+)\s*\|\s*([-\d.]+)', text, re.I)
    if m: art['lat'], art['lon'] = float(m.group(1)), float(m.group(2))
    for a, b in find_templates(text):
        n = text[a + 2:b - 2].split('|')[0].strip().lower()
        sm = STATUS.match(n)
        if sm: art['status'], art['type'] = sm.group(1), sm.group(2)
        if n == 'climate chart' and 'climate' not in art:
            c = climate(text[a + 2:b - 2])
            if c: art['climate'] = c
    # sections
    parts = re.split(r'^(={2,4})\s*(.+?)\s*\1\s*$', text, flags=re.M)
    lead = parts[0]
    secs = []
    for i in range(1, len(parts), 3):
        secs.append((len(parts[i]), parts[i + 1].strip(), parts[i + 2]))
    art['lead'] = blocks(lead, ctx)
    out = []
    for lvl, h, body in secs:
        bl = blocks(body, ctx)
        if lvl == 2:
            out.append({'h': html.unescape(re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', h)), 'b': bl})
        elif out:
            out[-1]['b'].append({'h3': re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', h).strip("'"), 'lvl': lvl})
            out[-1]['b'].extend(bl)
    art['secs'] = out
    art['imgs'] = ctx.images
    return art


def blocks(body, ctx):
    """Turn a section body into blocks: paragraphs, bullet lists, listings."""
    # replace top-level templates: listings become placeholders, drop others
    items = []
    spans = list(find_templates(body))
    buf = []; last = 0; listings = {}; inl = []
    sub_inl = lambda h: re.sub(r'\x00I(\d+)\x00', lambda m: inl[int(m.group(1))], h)
    for a, b in spans:
        buf.append(body[last:a]); last = b
        inner = body[a + 2:b - 2]
        name, pos, named = split_params(inner)
        n = name.lower().strip()
        if n in LISTING:
            key = f'\x00L{len(listings)}\x00'
            listings[key] = listing(n, named, ctx)
            buf.append(key)
        elif n in ('infobox', 'cautionbox', 'warningbox'):
            ttl = pos[0] if pos else named.get('title', '')
            txt = pos[1] if len(pos) > 1 else named.get('text', '')
            key = f'\x00B{len(listings)}\x00'
            listings[key] = {'box': inline(ttl, ctx), 'txt': inline(txt, ctx), 'warn': n != 'infobox'}
            buf.append('\n' + key + '\n')
        elif n in ('regionlist',):
            key = f'\x00R{len(listings)}\x00'
            regs = []
            for i in range(1, 30):
                nm = named.get(f'region{i}name')
                if not nm: continue
                regs.append({'name': inline(nm, ctx), 'items': inline(named.get(f'region{i}items', ''), ctx), 'desc': inline(named.get(f'region{i}description', ''), ctx)})
            listings[key] = {'regions': regs}
            buf.append('\n' + key + '\n')
        elif n in DROP or STATUS.match(n) or n.startswith('map'):
            buf.append('')
        else:
            key = f'\x00I{len(inl)}\x00'
            inl.append(_tmpl_inline(inner, ctx))
            buf.append(key)
    buf.append(body[last:])
    s = ''.join(buf)
    out = []
    para = []

    def flush():
        if para:
            t = sub_inl(inline(' '.join(para), ctx))
            if t: out.append({'p': t})
            para.clear()
    for line in s.split('\n'):
        st = line.strip()
        if not st:
            flush(); continue
        m = re.match(r'^\x00[LBR]\d+\x00$', st)
        if m:
            flush(); obj = listings[st]
            out.append({'L': obj} if 'n' in obj else obj); continue
        if st[0] in '*#':
            flush()
            depth = len(st) - len(st.lstrip('*#:'))
            txt = st.lstrip('*#: ')
            keys = re.findall(r'\x00L\d+\x00', txt)
            if keys and re.sub(r'\x00L\d+\x00', '', txt).strip() == '':
                for k in keys: out.append({'L': listings[k]})
                continue
            h = sub_inl(inline(re.sub(r'\x00L\d+\x00', '', txt), ctx))
            if h and h not in ('—', '-', ':'): out.append({'li': h, 'd': depth})
            for k in keys: out.append({'L': listings[k]})
            continue
        if st.startswith(('{|', '|}', '|-', '!')) or st.startswith('|'):
            continue
        if st.startswith(':'):
            st = st.lstrip(':')
        keys = re.findall(r'\x00[LBR]\d+\x00', st)
        if keys:
            rest = re.sub(r'\x00[LBR]\d+\x00', '', st).strip()
            if rest: para.append(rest)
            flush()
            for k in keys:
                obj = listings[k]; out.append({'L': obj} if 'n' in obj else obj)
            continue
        para.append(st)
    flush()
    # group consecutive li into lists
    res = []
    for bl in out:
        if 'li' in bl:
            if res and 'ul' in res[-1]: res[-1]['ul'].append(bl['li'])
            else: res.append({'ul': [bl['li']]})
        else:
            res.append(bl)
    return res

import pickle, re, json, math, csv, statistics, unicodedata, os, sys, hashlib
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wiki import parse_article

arts, red = pickle.load(open('raw/arts.pkl', 'rb'))
us, par = pickle.load(open('raw/us.pkl', 'rb'))
def _chain(t):
    out = []; seen = set()
    while t in par and t not in seen:
        seen.add(t); t = par[t]; out.append(t)
    return out
us = us + ['Hawaii'] + [t for t in arts if 'Hawaii' in _chain(t) and t not in us]
USSET = set(us)

STATES = {
 'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT',
 'Delaware': 'DE', 'Florida': 'FL', 'Georgia (state)': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN',
 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA',
 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York (state)': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington (state)': 'WA', 'West Virginia': 'WV',
 'Wisconsin': 'WI', 'Wyoming': 'WY', 'Washington, D.C.': 'DC'}
STATE_NAME = {v: re.sub(r' \(.*\)', '', k) for k, v in STATES.items()}
STATE_NAME['DC'] = 'Washington, D.C.'
missing = [s for s in STATES if s not in arts]
print('missing states', missing)


def chain(t):
    out = []; seen = set()
    while t in par and t not in seen:
        seen.add(t); t = par[t]; out.append(t)
    return out


def slugify(t):
    s = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or 'x'

# Slugs are kept stable across updates: once a title has a slug it keeps it (state/slugs.json is committed).
os.makedirs('state', exist_ok=True)
try:
    OLD = json.load(open('state/slugs.json'))
except FileNotFoundError:
    OLD = {}
SLUG = {}
used = set()
for t in us:
    if t in OLD: SLUG[t] = OLD[t]; used.add(OLD[t])
for t in sorted(us, key=lambda x: (len(x), x)):
    if t in SLUG: continue
    s = slugify(t)
    while s in used: s += '-2'
    used.add(s); SLUG[t] = s
# Titles that disappeared: follow Wikivoyage's redirect to the new title so old links (and journal entries) still work
ALIASES = {}
for t, s in OLD.items():
    if t not in SLUG:
        nt = red.get(t)
        if nt and nt in SLUG and SLUG[nt] != s: ALIASES[s] = SLUG[nt]
KEEP = dict(OLD); KEEP.update(SLUG)   # never reuse an old slug for a different place


def linkfn(tgt):
    tgt = tgt[0].upper() + tgt[1:] if tgt else tgt
    tgt = red.get(tgt, tgt)
    if tgt in SLUG: return '/travel/' + SLUG[tgt] + '/'
    if tgt in arts: return 'https://en.wikivoyage.org/wiki/' + tgt.replace(' ', '_')
    return None


def state_of(t):
    if t in STATES: return STATES[t]
    for c in chain(t):
        if c in STATES: return STATES[c]
    return None

# ---------------------------------------------------------------- airports
AIR = []
for r in csv.DictReader(open('raw/airports.csv', encoding='utf-8')):
    if r['iso_country'] == 'US' and r['type'] in ('large_airport', 'medium_airport') and r['scheduled_service'] == 'yes' and r['iata_code']:
        AIR.append((float(r['latitude_deg']), float(r['longitude_deg']), r['iata_code'], r['name'], r['municipality'], r['type'] == 'large_airport'))


def hav(a, b, c, d):
    R = 3958.8
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = p2 - p1, math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def airports(lat, lon):
    near = sorted(((hav(lat, lon, a[0], a[1]), a) for a in AIR))
    out = []
    for d, a in near[:6]:
        if len(out) >= 1 and d > 150: break
        out.append({'code': a[2], 'name': a[3], 'city': a[4], 'mi': round(d), 'big': a[5]})
        if len(out) >= 2: break
    big = next(((d, a) for d, a in near if a[5]), None)
    if big and all(o['code'] != big[1][2] for o in out) and big[0] < 300:
        out.append({'code': big[1][2], 'name': big[1][3], 'city': big[1][4], 'mi': round(big[0]), 'big': True})
    return out

CHI = (41.8781, -87.6298)


def drive(lat, lon, st):
    d = hav(CHI[0], CHI[1], lat, lon)
    if st in ('AK', 'HI'):
        return {'mi': round(d), 'fly': True}
    road = d * 1.22
    hrs = road / 58 + (road // 500) * 0.0
    return {'mi': round(road / 10) * 10 if road > 40 else round(road), 'hrs': round(hrs * 2) / 2}

# ---------------------------------------------------------------- climate & seasons
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def best_months(c):
    sc = []
    for i in range(12):
        hi, lo, pr = c['hi'][i], c['lo'][i], c['pr'][i]
        s = 0
        s -= max(0, 64 - hi) * 1.5 + max(0, hi - 85) * 1.3
        s -= max(0, 40 - lo) * .6
        s -= max(0, pr - 3.5) * 2
        sc.append(s)
    top = max(sc)
    good = [i for i in range(12) if sc[i] >= top - 4]
    for i in range(12):  # fill one-month gaps between good months
        if i not in good and (i - 1) % 12 in good and (i + 1) % 12 in good and sc[i] >= top - 9: good.append(i)
    return sorted(good)


def month_ranges(ms):
    if not ms: return ''
    ms = sorted(ms)
    runs = []; cur = [ms[0]]
    for m in ms[1:]:
        if m == cur[-1] + 1: cur.append(m)
        else: runs.append(cur); cur = [m]
    runs.append(cur)
    if len(runs) > 1 and runs[0][0] == 0 and runs[-1][-1] == 11:
        runs[0] = runs[-1] + runs[0]; runs.pop()
    return ', '.join(MON[r[0]] + ('–' + MON[r[-1]] if len(r) > 1 else '') for r in runs)

# ---------------------------------------------------------------- prices
PRICE = re.compile(r'\$\s?(\d{1,4}(?:,\d{3})?(?:\.\d\d)?)')


def prices(ls):
    v = []
    for L in ls:
        for m in PRICE.findall(L.get('pr', '')):
            x = float(m.replace(',', ''))
            if 3 <= x <= 3000: v.append(x)
    return v


def budget(sleep, eat):
    sp = prices(sleep); ep = prices(eat)
    out = {}
    if len(sp) >= 2:
        sp.sort()
        q = lambda p: sp[min(len(sp) - 1, int(p * (len(sp) - 1)))]
        out['sleep'] = {'low': round(q(.15)), 'mid': round(statistics.median(sp)), 'high': round(q(.9)), 'n': len(sp)}
    if len(ep) >= 2:
        ep.sort()
        out['meal'] = round(statistics.median(ep))
    return out

# ---------------------------------------------------------------- itinerary
def kmeans(pts, k, it=20):
    cs = [pts[int(i * len(pts) / k)] for i in range(k)]
    for _ in range(it):
        g = [[] for _ in range(k)]
        for p in pts:
            j = min(range(k), key=lambda i: (p[0] - cs[i][0]) ** 2 + (p[1] - cs[i][1]) ** 2)
            g[j].append(p)
        cs = [(sum(p[0] for p in gi) / len(gi), sum(p[1] for p in gi) / len(gi)) if gi else cs[i] for i, gi in enumerate(g)]
    return g


def order_nn(items):
    if not items: return items
    rest = items[1:]; out = [items[0]]
    while rest:
        a = out[-1]
        j = min(range(len(rest)), key=lambda i: (rest[i]['lat'] - a['lat']) ** 2 + (rest[i]['lon'] - a['lon']) ** 2)
        out.append(rest.pop(j))
    return out


def itinerary(sees, dos, eats, drinks):
    acts = [L for L in sees + dos if L.get('n')]
    if len(acts) < 2: return None
    pool = acts[:24]
    ndays = 1 if len(pool) <= 5 else (2 if len(pool) <= 10 else 3)
    geo = [L for L in pool if L.get('lat') and L.get('lon')]
    nogeo = [L for L in pool if not (L.get('lat') and L.get('lon'))]
    days = [[] for _ in range(ndays)]
    if len(geo) >= ndays * 2:
        pts = [(L['lat'], L['lon'], i) for i, L in enumerate(geo)]
        groups = kmeans([(p[0], p[1]) for p in pts], ndays)
        # map back
        left = list(geo)
        for d, gpts in enumerate(groups):
            for (la, lo) in gpts:
                for L in left:
                    if L['lat'] == la and L['lon'] == lo: days[d].append(L); left.remove(L); break
    else:
        nogeo = pool
    for i, L in enumerate(nogeo): days[i % ndays].append(L)
    days = sorted([d for d in days if d], key=len, reverse=True)
    eat_geo = [L for L in eats if L.get('n')]
    used = set(); out = []
    for d in days[:3]:
        d = order_nn([x for x in d if x.get('lat')]) + [x for x in d if not x.get('lat')]
        d = d[:5]
        cen = None
        g = [x for x in d if x.get('lat')]
        if g: cen = (sum(x['lat'] for x in g) / len(g), sum(x['lon'] for x in g) / len(g))

        def pick(cands):
            c = [x for x in cands if x['n'] not in used]
            if not c: return None
            if cen:
                cg = [x for x in c if x.get('lat')]
                if cg:
                    x = min(cg, key=lambda x: (x['lat'] - cen[0]) ** 2 + (x['lon'] - cen[1]) ** 2)
                    used.add(x['n']); return x
            used.add(c[0]['n']); return c[0]
        half = max(1, (len(d) + 1) // 2)
        lunch = pick(eat_geo); dinner = pick(eat_geo); bar = pick([L for L in drinks if L.get('n')])
        out.append({'am': [x['n'] for x in d[:half]], 'pm': [x['n'] for x in d[half:]],
                    'lunch': lunch['n'] if lunch else None, 'dinner': dinner['n'] if dinner else None, 'night': bar['n'] if bar else None})
    return out

# ---------------------------------------------------------------- photos
def commons(fn, w=None):
    fn = fn.strip().replace(' ', '_')
    fn = fn[0].upper() + fn[1:] if fn else fn
    h = hashlib.md5(fn.encode()).hexdigest()
    from urllib.parse import quote
    q = quote(fn)
    if not w: return f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}'
    ext = fn.rsplit('.', 1)[-1].lower()
    suffix = '.png' if ext in ('svg',) else ''
    return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}{suffix}'

SKIP = {'Cope', 'Connect', 'Work', 'Districts'}

# ---------------------------------------------------------------- main
places = {}
for t in us:
    a = parse_article(t, arts[t], linkfn)
    if a.get('type') in (None,) and 'disamb' in arts[t].lower(): continue
    a['slug'] = SLUG[t]; a['st'] = state_of(t)
    ch = chain(t)
    a['crumbs'] = [c for c in reversed(ch) if c in SLUG]
    a['parent'] = par.get(t)
    places[t] = a
print('parsed', len(places))

# places spanning states or missing one: nearest located place with a state
located = [(a['lat'], a['lon'], a['st']) for a in places.values() if a.get('lat') is not None and a['st']]
for t, a in places.items():
    if not a['st']:
        if a.get('lat') is not None:
            a['st'] = min(located, key=lambda p: (p[0] - a['lat']) ** 2 + (p[1] - a['lon']) ** 2)[2]
            a['multi'] = True
        else:
            a['st'] = 'US'
# children
kids = defaultdict(list)
for t, a in places.items():
    if a['parent'] in places: kids[a['parent']].append(t)

# climate lookup
clim = [(a['lat'], a['lon'], t) for t, a in places.items() if 'climate' in a and a.get('lat')]
print('with climate', len(clim))


def all_listings(a):
    out = defaultdict(list)
    for s in a['secs']:
        for b in s['b']:
            if 'L' in b:
                L = b['L']; out[L.get('k', 'listing')].append(L)
                L.setdefault('_sec', s['h'])
    return out

index = []
for t, a in places.items():
    ls = all_listings(a)
    a['n'] = {k: len(v) for k, v in ls.items()}
    if a.get('lat') is not None:
        if 'climate' in a: a['clim_src'] = t
        else:
            best = min(clim, key=lambda c: hav(a['lat'], a['lon'], c[0], c[1])) if clim else None
            if best and hav(a['lat'], a['lon'], best[0], best[1]) < 120:
                a['climate'] = places[best[2]]['climate']; a['clim_src'] = best[2]
        if 'climate' in a:
            a['best_m'] = best_months(a['climate']); a['best'] = month_ranges(a['best_m'])
        a['air'] = airports(a['lat'], a['lon'])
        a['drive'] = drive(a['lat'], a['lon'], a['st'])
    a['budget'] = budget(ls.get('sleep', []), ls.get('eat', []))
    a['itin'] = itinerary(ls.get('see', []), ls.get('do', []), ls.get('eat', []), ls.get('drink', []))
    # highlights: notable sees/dos
    cand = ls.get('see', []) + ls.get('do', [])
    notable = [L for L in cand if L.get('wd') or L.get('wp') or L.get('img')]
    hl = (notable + [L for L in cand if L not in notable])[:6]
    a['hl'] = [{'n': L['n'], 'c': re.sub(r'<[^>]+>', '', L.get('c', ''))[:220], 'img': L.get('img')} for L in hl if L.get('n')]
    # photos
    ph = []
    seen = set()
    for f, cap in ([(a.get('banner'), a.get('bcap', ''))] if a.get('banner') else []) + [(i['f'], i['cap']) for i in a['imgs']] + \
            [(L['img'], L['n']) for k in ('see', 'do', 'eat', 'drink', 'sleep', 'buy') for L in ls.get(k, []) if L.get('img')]:
        if not f or f in seen or f.lower().endswith(('.svg', '.pdf')) or 'banner' in f.lower() and f != a.get('banner'): continue
        seen.add(f); ph.append({'f': f, 'cap': cap})
    BADW = re.compile(r'map|locator|location|flag|seal|logo|icon|banner|sign\b|diagram|chart|route|shield|coat_of_arms|coat of arms|\.gif$', re.I)
    good = [x for x in ph if not BADW.search(x['f'])]
    rest = [x for x in ph if BADW.search(x['f']) and 'banner' not in x['f'].lower() and x['f'] != a.get('banner')]
    ban = [x for x in ph if x['f'] == a.get('banner')]
    a['photos'] = (good + ban + rest)[:16]
    a['hero_banner'] = not good and bool(ban)
    a['kids'] = sorted(kids.get(t, []), key=lambda k: -sum(places[k]['n'].values()) if 'n' in places[k] else 0)
    index.append({'t': t, 's': a['slug'], 'st': a['st'], 'ty': a.get('type', 'city'), 'la': a.get('lat'), 'lo': a.get('lon'),
                  'q': a.get('status', ''), 'img': (commons(a['photos'][0]['f'], 330) if a['photos'] else None)})

# finalize kid ordering now that 'n' exists
for t, a in places.items():
    a['kids'] = sorted(kids.get(t, []), key=lambda k: -sum(places[k]['n'].values()))

os.makedirs('data', exist_ok=True)
json.dump(KEEP, open('state/slugs.json', 'w'), indent=0, sort_keys=True, ensure_ascii=False)
json.dump(ALIASES, open('data/aliases.json', 'w'))
import datetime
json.dump({'dump': os.environ.get('DUMP_DATE') or datetime.date.fromtimestamp(os.path.getmtime('raw/wv.xml.bz2')).isoformat(),
           'built': datetime.date.today().isoformat()}, open('data/meta.json', 'w'))
pickle.dump(places, open('data/places.pkl', 'wb'))
json.dump(index, open('data/index.json', 'w'))
print('index', len(index), 'states', len({i['st'] for i in index}))
print('no state', [i['t'] for i in index if not i['st']][:20])

"""Render the travel site (static HTML) into <repo>/travel/."""
import pickle, json, os, re, html, hashlib, sys, shutil, math
from urllib.parse import quote, quote_plus

OUT = sys.argv[1] if len(sys.argv) > 1 else 'site/travel'
P = pickle.load(open('data/places.pkl', 'rb'))
IDX = json.load(open('data/index.json'))
BYSLUG = {a['slug']: t for t, a in P.items()}
META = json.load(open('data/meta.json'))
ALIASES = json.load(open('data/aliases.json'))
import datetime, numpy as np
DUMP = datetime.date.fromisoformat(META['dump'])
DUMP_TXT = DUMP.strftime('%-d %B %Y')

# nearby places (great-circle distance, numpy)
_LOC = [(t, a['lat'], a['lon']) for t, a in P.items() if a.get('lat') is not None and a.get('type') in ('city', 'park', 'ruralarea')]
_LA = np.radians([x[1] for x in _LOC]); _LO = np.radians([x[2] for x in _LOC])
def nearby(t, a, k=8, maxmi=80):
    if a.get('lat') is None: return []
    la, lo = np.radians(a['lat']), np.radians(a['lon'])
    d = 3958.8 * 2 * np.arcsin(np.sqrt(np.sin((_LA - la) / 2) ** 2 + np.cos(la) * np.cos(_LA) * np.sin((_LO - lo) / 2) ** 2))
    skip = set(a.get('kids', [])) | set(a.get('crumbs', [])) | {t}
    out = []
    for i in np.argsort(d):
        if d[i] > maxmi or len(out) >= k: break
        tt = _LOC[i][0]
        if tt in skip or '/' in tt and tt.split('/')[0] == t.split('/')[0]: continue
        out.append((tt, round(float(d[i]))))
    return out
VER = '7'
from saved import SAVED

STATE_NAME = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut',
              'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
              'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan',
              'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
              'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
              'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee',
              'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin',
              'WY': 'Wyoming', 'DC': 'Washington, D.C.', 'US': 'Multi-state'}
STATE_ART = {'GA': 'Georgia (state)', 'NY': 'New York (state)', 'WA': 'Washington (state)', 'DC': 'Washington, D.C.'}
def state_title(st): return STATE_ART.get(st, STATE_NAME.get(st))

TYPE_LABEL = {'city': 'City / town', 'park': 'Park', 'region': 'Region', 'district': 'Neighborhood', 'ruralarea': 'Rural area',
              'airport': 'Airport', 'diveguide': 'Dive site', 'itinerary': 'Route', 'topic': 'Topic', 'event': 'Event'}
KIND = {'see': ('See', '#'), 'do': ('Do', '#'), 'eat': ('Eat', '#'), 'drink': ('Drink', '#'), 'sleep': ('Stay', '#'), 'buy': ('Shop', '#'),
        'go': ('Go', '#'), 'listing': ('Place', '#')}
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def esc(s): return html.escape(s or '', quote=True)


def commons(fn, w=None):
    fn = fn.strip().replace(' ', '_')
    if not fn: return ''
    fn = fn[0].upper() + fn[1:]
    h = hashlib.md5(fn.encode()).hexdigest(); q = quote(fn)
    if not w: return f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}'
    suffix = '.png' if fn.lower().endswith('.svg') else ''
    return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}{suffix}'


def filepage(fn): return 'https://commons.wikimedia.org/wiki/File:' + quote(fn.strip().replace(' ', '_'))


def img(fn, w, alt='', cls='', eager=False):
    return (f'<img class="{cls}" src="{commons(fn, w)}" data-full="{commons(fn)}" alt="{esc(alt)}" '
            f'{"fetchpriority=high " if eager else "loading=lazy decoding=async "}onerror="tvImgErr(this)">')


def place_name(t):
    t = t.split('/')[-1] if '/' in t else t
    return re.sub(r' \([^)]*\)$', '', t)


def city_ctx(a):
    return place_name(a['t'].split('/')[0]) + ', ' + STATE_NAME.get(a['st'], '')


MAP_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/></svg>'


def maps_link(q, ll=None, label='Open in Maps', cls='tv-btn tv-btn-sm', frm=None):
    q = re.sub(r'<[^>]+>', '', q)
    if frm:
        g = 'https://www.google.com/maps/dir/?api=1&origin=' + quote_plus(frm) + '&destination=' + quote_plus(q)
    else:
        g = 'https://www.google.com/maps/search/?api=1&query=' + quote_plus(q)
    data = f' data-q="{esc(q)}"' + (f' data-ll="{ll[0]},{ll[1]}"' if ll and ll[0] is not None and ll[1] is not None else '') + (f' data-from="{esc(frm)}"' if frm else '')
    icon = MAP_ICON if 'tv-btn' in cls else ''
    return f'<a class="{cls} tv-maps" href="{g}"{data} target="_blank" rel="noopener">{icon}{label}</a>'


def maps_q(L, a):
    q = L.get('n', '')
    if L.get('addr'): q += ', ' + L['addr']
    return q + ', ' + city_ctx(a)


def gmaps(L, a):
    q = L.get('n', '')
    if L.get('addr'): q += ', ' + L['addr']
    q += ', ' + city_ctx(a)
    q = re.sub(r'<[^>]+>', '', q)
    return 'https://www.google.com/maps/search/?api=1&query=' + quote_plus(q)


def gmaps_place_q(a):
    return place_name(a['t']) + ', ' + STATE_NAME.get(a['st'], '') + ('' if a.get('type') not in ('region',) else ', USA')


def gmaps_place(a):
    if a.get('lat') is not None and a.get('type') not in ('region',):
        return 'https://www.google.com/maps/search/?api=1&query=' + quote_plus(place_name(a['t']) + ', ' + STATE_NAME.get(a['st'], ''))
    return 'https://www.google.com/maps/search/?api=1&query=' + quote_plus(place_name(a['t']) + ', ' + STATE_NAME.get(a['st'], '') + ', USA')


def href(t): return '/travel/' + P[t]['slug'] + '/'

# ---------------------------------------------------------------- shared chrome
HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#0a0e14" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f6f8fa" media="(prefers-color-scheme: light)">
{og}
<link rel="icon" type="image/svg+xml" href="/travel/assets/favicon.svg">
<script>(function(){{var t=null;try{{t=localStorage.getItem('theme')}}catch(e){{}}if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}})();
window.tvImgErr=function(im){{if(!im.dataset.tried&&im.dataset.full){{im.dataset.tried=1;im.src=im.dataset.full;return}}var a=im.closest('.tv-lthumb');if(a){{a.remove();return}}im.style.visibility='hidden'}};</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Sora:wght@600;700&display=swap">
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/travel/assets/travel.css?v={ver}">
{extra}
</head>
<body data-page="{page}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <nav class="nav wrap tv-navbar" aria-label="Main">
    <a class="tv-logo" href="/travel/" aria-label="Travel, home"><svg class="tv-mark" viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><defs><linearGradient id="tvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset="1" style="stop-color:var(--violet)"/></linearGradient></defs><g fill="none" stroke="url(#tvg)" stroke-width="2.6" stroke-linecap="round"><circle cx="20" cy="21" r="11"/><ellipse cx="20" cy="21" rx="4.6" ry="11"/><path d="M9 21h22"/><path d="M4 11.5C12 4 26 3.5 35 11" stroke-dasharray="1 4"/></g><path d="M36.5 9.5l-4 .3 2.2 3z" style="fill:var(--violet)"/></svg><span>Travel</span></a>
    <form class="tv-search" action="/travel/search/" role="search"><input type="search" name="q" placeholder="Search 6,500+ places" aria-label="Search places" autocomplete="off"><div class="tv-sugg" hidden></div></form>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links"><span class="sr-only">Menu</span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    <ul class="nav-links" id="nav-links">
      <li><a href="/travel/food/">Food</a></li>
      <li><a href="/travel/states/">States</a></li>
      <li><a href="/travel/map/">Map</a></li>
      <li><a href="/travel/journal/">My journal</a></li>
    </ul>
    <button class="theme-toggle" type="button" aria-label="Switch theme">
      <svg class="icon-sun" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <svg class="icon-moon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
    </button>
  </nav>
</header>
<main id="main">
'''

FOOT = '''</main>
<footer class="site-footer">
  <div class="wrap tv-foot-notes">{attr}<p>Your journal is saved in this browser. Back it up from <a href="/travel/journal/">My journal</a>. <span class="tv-mappref"></span></p></div>
  <div class="wrap footer-inner">
    <p>&copy; <span id="year">2026</span> Nishant Iyer · <a href="/travel/">Travel</a></p>
    <ul class="social">
      <li><a href="https://www.konnectingnots.com/">Portfolio</a></li>
      <li><a href="mailto:contact@konnectingnots.com">contact@konnectingnots.com</a></li>
      <li><a href="https://linkedin.com/in/nishantiyer" target="_blank" rel="noopener">LinkedIn</a></li>
      <li><a href="https://github.com/Nishant-Iyer" target="_blank" rel="noopener">GitHub</a></li>
    </ul>
  </div>
</footer>
<script src="/script.js?v=4" defer></script>
<script src="/travel/assets/travel.js?v={ver}" defer></script>
{extra}
</body></html>'''


SITE = 'https://travel.konnectingnots.com'
OG_DEFAULT = SITE + '/travel/assets/og-travel.jpg'


def page(title, desc, body, page='', attr='', extra_head='', extra_foot='', og_img=None, canon=''):
    img_ = og_img or OG_DEFAULT
    og = (f'<meta property="og:type" content="website"><meta property="og:site_name" content="Travel">'
          f'<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">'
          f'<meta property="og:image" content="{img_}">'
          + ('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' if not og_img else '')
          + f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}">'
          f'<meta name="twitter:description" content="{esc(desc)}"><meta name="twitter:image" content="{img_}">')
    if canon: og += f'<meta property="og:url" content="{SITE}{canon}"><link rel="canonical" href="{SITE}{canon}">'
    return HEAD.format(title=esc(title), desc=esc(desc), og=og, ver=VER, extra=extra_head, page=page) + body + \
        FOOT.format(attr=attr, ver=VER, extra=extra_foot)


def attribution(a):
    src = 'https://en.wikivoyage.org/wiki/' + quote(a['t'].replace(' ', '_'))
    return (f'<p class="tv-attr">Guide text adapted from <a href="{src}" rel="noopener" target="_blank">Wikivoyage: {esc(a["t"])}</a> '
            f'by its contributors, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener" target="_blank">CC BY-SA 4.0</a>. '
            f'Photos from Wikimedia Commons; tap a photo for its author and license. Weather, budget, drive times and itineraries are estimates computed from that data.</p>')

# ---------------------------------------------------------------- blocks -> html
def lid(L): return 'l-' + re.sub(r'[^a-z0-9]+', '-', (L.get('n') or '').lower()).strip('-')[:50]


def listing_html(L, a, show_kind=False):
    k = L.get('k', 'listing'); kl = KIND.get(k, ('Place', ''))[0]
    meta = []
    if L.get('addr'): meta.append(f'<span>📍 {esc(L["addr"])}</span>')
    if L.get('dir'): meta.append(f'<span class="tv-dim">{esc(L["dir"])}</span>')
    if L.get('hrs'): meta.append(f'<span>🕒 {esc(L["hrs"])}</span>')
    if L.get('pr'): meta.append(f'<span>💲 {esc(L["pr"])}</span>')
    if L.get('ci') or L.get('co'): meta.append(f'<span>Check-in {esc(L.get("ci", "–"))} · out {esc(L.get("co", "–"))}</span>')
    if L.get('ph'): meta.append(f'<span>☎ <a href="tel:{esc(re.sub(r"[^0-9+]", "", L["ph"]))}">{esc(L["ph"])}</a></span>')
    old = False
    lm = re.match(r'(\d{4})-(\d{2})', L.get('le', ''))
    if lm and 2001 <= int(lm.group(1)) <= DUMP.year and 1 <= int(lm.group(2)) <= 12:
        y, m = int(lm.group(1)), int(lm.group(2))
        old = (DUMP.year - y) * 12 + DUMP.month - m > 60
        meta.append(f'<span class="tv-checked{" tv-old" if old else ""}" title="When a Wikivoyage editor last checked this listing">{"⚠ Last checked " if old else "Checked "}{MON[m - 1]} {y}{" — confirm before you go" if old else ""}</span>')
    links = [maps_link(maps_q(L, a), (L.get('lat'), L.get('lon')) if L.get('lat') and L.get('lon') else None, 'Maps')]
    if L.get('url'): links.append(f'<a class="tv-btn tv-btn-sm tv-ghost" href="{esc(L["url"])}" target="_blank" rel="nofollow noopener">Website</a>')
    photo = ''
    if L.get('img') and not L['img'].lower().endswith(('.svg', '.pdf')):
        photo = f'<a class="tv-lthumb" href="{filepage(L["img"])}" data-lb="{commons(L["img"], 1280)}" data-cap="{esc(L.get("n", ""))}">{img(L["img"], 330, L.get("n", ""))}</a>'
    alt = f' <span class="tv-dim">({esc(L["alt"])})</span>' if L.get('alt') else ''
    data = f' data-lat="{L["lat"]}" data-lon="{L["lon"]}"' if L.get('lat') and L.get('lon') else ''
    badges = ''
    if 'dt' in L:
        data += f' data-cu="{esc("|".join(L["cu"]))}" data-dt="{" ".join(k + ":" + v for k, v in L["dt"].items())}" data-tier="{L.get("tier", 0)}" id="{lid(L)}"'
        bl = [f'<span class="tv-cu">{esc(c)}</span>' for c in L['cu']]
        dt = L['dt']
        if dt.get('vegan') == 'only': bl.append('<span class="tv-dg tv-dg-strong">Vegan restaurant</span>')
        elif dt.get('veg') == 'only': bl.append('<span class="tv-dg tv-dg-strong">Vegetarian restaurant</span>')
        else:
            if dt.get('vegan') == 'yes': bl.append('<span class="tv-dg">Vegan options</span>')
            elif dt.get('veg') == 'yes': bl.append('<span class="tv-dg">Vegetarian options</span>')
        for k, lab in (('halal', 'Halal'), ('kosher', 'Kosher'), ('gf', 'Gluten-free options')):
            if dt.get(k) == 'yes': bl.append(f'<span class="tv-dg">{lab}</span>')
        if L.get('tier'): bl.append(f'<span class="tv-cu">{"$" * L["tier"]}</span>')
        badges = f'<div class="tv-badges">{"".join(bl)}</div>' if bl else ''
    return (f'<article class="tv-listing tv-k-{k}"{data} data-name="{esc(L.get("n", ""))}" data-kind="{k}">{photo}<div class="tv-lbody">'
            f'<h4><span class="tv-kind">{kl}</span> {esc(L.get("n", ""))}{alt}</h4>{badges}'
            + (f'<p>{L["c"]}</p>' if L.get('c') else '') + (f'<div class="tv-meta">{"".join(meta)}</div>' if meta else '')
            + f'<div class="tv-acts">{"".join(links)}<button class="tv-btn tv-btn-sm tv-ghost tv-want" type="button" data-item="{esc(L.get("n", ""))}">☆ Want to go</button></div></div></article>')


def blocks_html(bl, a):
    out = []
    for b in bl:
        if 'p' in b: out.append(f'<p>{b["p"]}</p>')
        elif 'ul' in b: out.append('<ul>' + ''.join(f'<li>{x}</li>' for x in b['ul']) + '</ul>')
        elif 'h3' in b: out.append(f'<h3>{esc(b["h3"])}</h3>' if b.get('lvl', 3) == 3 else f'<h4 class="tv-h4">{esc(b["h3"])}</h4>')
        elif 'L' in b: out.append(listing_html(b['L'], a))
        elif 'box' in b:
            out.append(f'<aside class="tv-box{" tv-warn" if b.get("warn") else ""}"><strong>{b["box"]}</strong><p>{b["txt"]}</p></aside>')
        elif 'regions' in b:
            out.append('<div class="tv-regions">' + ''.join(
                f'<div class="tv-region"><h4>{r["name"]}</h4><p>{r["desc"]}</p></div>' for r in b['regions']) + '</div>')
    return '\n'.join(out)


def climate_svg(c):
    W, H = 640, 250; pad = 30
    hi, lo, pr = c['hi'], c['lo'], c['pr']
    tmin = min(lo); tmax = max(hi)
    top, bot = 22, 160
    y = lambda v: bot - (v - tmin) / max(1, (tmax - tmin)) * (bot - top)
    bw = (W - pad - 10) / 12
    parts = [f'<svg viewBox="0 0 {W} {H}" class="tv-clim" role="img" aria-label="Average monthly high and low temperatures and rainfall">']
    pmax = max(max(pr), 1)
    for i in range(12):
        x = pad + i * bw
        ph = pr[i] / pmax * 34
        parts.append(f'<rect x="{x + bw * .3:.1f}" y="{226 - ph:.1f}" width="{bw * .4:.1f}" height="{ph:.1f}" class="tv-pr"><title>{MON[i]}: {pr[i]} in rain</title></rect>')
        parts.append(f'<text x="{x + bw / 2:.1f}" y="{222 - ph:.1f}" class="tv-pl">{pr[i]:g}"</text>')
        parts.append(f'<rect x="{x + bw * .22:.1f}" y="{y(hi[i]):.1f}" width="{bw * .56:.1f}" height="{max(3, y(lo[i]) - y(hi[i])):.1f}" rx="5" class="tv-tb"><title>{MON[i]}: high {hi[i]}°F, low {lo[i]}°F</title></rect>')
        parts.append(f'<text x="{x + bw / 2:.1f}" y="{y(hi[i]) - 5:.1f}" class="tv-th">{hi[i]}°</text>')
        parts.append(f'<text x="{x + bw / 2:.1f}" y="{y(lo[i]) + 13:.1f}" class="tv-tl">{lo[i]}°</text>')
        parts.append(f'<text x="{x + bw / 2:.1f}" y="{H - 6}" class="tv-tm">{MON[i]}</text>')
    parts.append('</svg>')
    return ''.join(parts)


def season_words(c, best):
    hi = c['hi']; lo = c['lo']
    hot = [MON[i] for i in range(12) if hi[i] >= 90]
    cold = [MON[i] for i in range(12) if hi[i] <= 40]
    wet = sorted(range(12), key=lambda i: -c['pr'][i])[:2]
    s = []
    if best:
        allyear = best.count(',') == 0 and best.startswith(('Jan–Dec', 'Feb–Jan', 'Dec–Nov')) or len(best.replace(' ', '')) > 30
        s.append(f'<b>Most comfortable:</b> {esc(best)}.')
    s.append(f'Summer highs reach about {max(hi)}°F; winter lows dip to about {min(lo)}°F.')
    if hot: s.append(f'Very hot ({", ".join(hot)}) — plan outdoor time for mornings.')
    if cold: s.append(f'Cold months ({", ".join(cold)}) can bring snow and ice; check road conditions.')
    s.append(f'Wettest: {MON[wet[0]]} and {MON[wet[1]]}.')
    return ' '.join(s)


def plan_html(a):
    cards = []
    # best time & weather
    if a.get('climate'):
        c = a['climate']
        src = '' if a.get('clim_src') == a['t'] else f' <span class="tv-dim">(climate data from nearby {esc(place_name(a["clim_src"]))})</span>'
        cards.append(f'<section class="tv-card tv-span2" id="weather"><h3>Best time to visit & weather</h3><p>{season_words(c, a.get("best"))}{src}</p>{climate_svg(c)}'
                     f'<p class="tv-dim">Blue bars: average daily high and low (°F). Purple columns: average monthly rain and melted snow (inches).</p></section>')
    # getting there
    gt = []
    if a.get('lat') is not None:
        gt.append('<li class="tv-from-li"><b>From you:</b> <button type="button" class="tv-link tv-sethome">Set your starting point</button> to see whether to drive or fly, and how long it takes.</li>')
    for ap in a.get('air', []):
        gt.append(f'<li><b>{esc(ap["code"])}</b> {esc(ap["name"])}{", " + esc(ap["city"]) if ap.get("city") else ""} — {ap["mi"]} mi away{" (major hub)" if ap.get("big") else ""}. '
                  + maps_link(place_name(a['t']) + ', ' + STATE_NAME.get(a['st'], ''), None, 'Directions', 'tv-link', ap['name'] + ', ' + (ap.get('city') or '')) + '</li>')
    getin = next((s for s in a['secs'] if s['h'] == 'Get in'), None)
    gi_p = next((b['p'] for b in getin['b'] if 'p' in b), '') if getin else ''
    if gt or gi_p:
        cards.append(f'<section class="tv-card" id="getting-there"><h3>Getting there</h3><ul class="tv-facts">{"".join(gt)}</ul>' + (f'<p>{gi_p}</p>' if gi_p else '') +
                     (f'<a href="#sec-get-in">Full “Get in” guide ↓</a>' if getin else '') + '</section>')
    # budget & stay
    bd = a.get('budget') or {}
    if bd:
        rows = []
        sl = bd.get('sleep'); meal = bd.get('meal')
        if sl:
            rows.append(f'<li><b>Places to stay listed here:</b> about ${sl["low"]}–${sl["high"]} a night (typical ${sl["mid"]}), from {sl["n"]} listed prices.</li>')
        if meal: rows.append(f'<li><b>Typical meal:</b> about ${meal} per person at listed restaurants.</li>')
        if sl:
            m = meal or 20
            lowd = sl['low'] + 2 * m * .7 + 15; midd = sl['mid'] + 2 * m + 35; hid = sl['high'] + 3 * m * 1.6 + 70
            rows.append(f'<li><b>Estimated daily budget per person</b> (room, two meals, local transport and an activity): budget ~${round(lowd, -1):.0f}, mid-range ~${round(midd, -1):.0f}, comfortable ~${round(hid, -1):.0f}.</li>')
        sleep = next((s for s in a['secs'] if s['h'] == 'Sleep'), None)
        tiers = [b['h3'] for b in sleep['b'] if 'h3' in b] if sleep else []
        cards.append(f'<section class="tv-card" id="budget"><h3>Budget & where to stay</h3><ul class="tv-facts">{"".join(rows)}</ul>'
                     + (f'<p>Options are grouped as {", ".join(esc(t) for t in tiers[:4])} in the <a href="#sec-sleep">Sleep guide ↓</a>.</p>' if tiers else
                        ('<p>See the <a href="#sec-sleep">Sleep guide ↓</a> for places to stay.</p>' if sleep else '')) + '</section>')
    elif any(s['h'] == 'Sleep' for s in a['secs']):
        cards.append('<section class="tv-card" id="budget"><h3>Budget & where to stay</h3><p>No prices are listed for this place yet. See the <a href="#sec-sleep">Sleep guide ↓</a> for options.</p></section>')
    # itinerary
    it = a.get('itin')
    if a.get('type') in ('region', 'ruralarea') and len(a.get('kids', [])) >= 2:
        ks = a['kids'][:3]
        days = ''.join(f'<li><b>Day {i + 1}: <a href="{href(k)}">{esc(place_name(k))}</a></b> — '
                       + esc(', '.join(h['n'] for h in P[k]['hl'][:3]) or 'explore the town') + '.</li>' for i, k in enumerate(ks))
        cards.append(f'<section class="tv-card tv-span2" id="itinerary"><h3>Sample {len(ks)}-day trip</h3><ol class="tv-itin">{days}</ol>'
                     '<p class="tv-dim">Built from the best-covered destinations in this region; open each for its own day plan.</p></section>')
    elif it:
        dd = []
        for i, d in enumerate(it):
            seg = []
            if d['am']: seg.append(f'<li><span class="tv-slot">Morning</span> {esc(", ".join(d["am"]))}</li>')
            if d.get('lunch'): seg.append(f'<li><span class="tv-slot">Lunch</span> {esc(d["lunch"])}</li>')
            if d['pm']: seg.append(f'<li><span class="tv-slot">Afternoon</span> {esc(", ".join(d["pm"]))}</li>')
            if d.get('dinner'): seg.append(f'<li><span class="tv-slot">Dinner</span> {esc(d["dinner"])}</li>')
            if d.get('night'): seg.append(f'<li><span class="tv-slot">Evening</span> {esc(d["night"])}</li>')
            dd.append(f'<div class="tv-day"><h4>Day {i + 1}</h4><ul>{"".join(seg)}</ul></div>')
        cards.append(f'<section class="tv-card tv-span2" id="itinerary"><h3>Sample {len(it)}-day itinerary</h3><div class="tv-days">{"".join(dd)}</div>'
                     '<p class="tv-dim">Stops are grouped by area so each day needs little backtracking. Check opening hours before you go.</p></section>')
    if not cards: return ''
    return '<section class="tv-plan" id="plan"><h2>Plan your trip</h2><div class="tv-cards">' + ''.join(cards) + '</div></section>'


def food_links(a):
    city = place_name(a['t']); st = STATE_NAME.get(a['st'], '')
    loc = city + ', ' + (place_name(a['t'].split('/')[0]) + ', ' if '/' in a['t'] else '') + st
    z = f'https://www.zabihah.com/halal-restaurants/{re.sub(r"[^a-z0-9]+", "-", city.lower()).strip("-")}-{a["st"].lower()}-us' if a.get('type') in ('city', 'district') else ''
    return f' data-loc="{esc(loc)}" data-ll="{a.get("lat") or ""},{a.get("lon") or ""}" data-zab="{esc(z)}"'


def food_html(a):
    eat = next((s for s in a['secs'] if s['h'] in ('Eat', 'Eat and drink', 'Eat & drink')), None)
    intro = [b['p'] for b in eat['b'] if 'p' in b][:2] if eat else []
    n_food = a.get('n', {}).get('eat', 0) + a.get('n', {}).get('drink', 0)
    if not intro and not n_food and a.get('type') not in ('city', 'district', 'park'): return ''
    cu = a.get('food', {}).get('cu', [])
    return (f'<section class="tv-card tv-food" id="food"{food_links(a)}><h3>Food for you</h3>'
            + ''.join(f'<p>{p}</p>' for p in intro)
            + '<div class="tv-dietpick"></div>'
            + (f'<p class="tv-dp-q"><b>Cuisine</b> <span class="tv-dim">(tap to filter)</span></p><div class="tv-chips tv-cuchips">' + ''.join(f'<button type="button" class="tv-chip" data-cu="{esc(c)}">{esc(c)} {n}</button>' for c, n in cu[:12] if c != 'Bar / Café') + '</div>' if cu else '')
            + '<div class="tv-foodlist" aria-live="polite"></div>'
            + '<div class="tv-foodlive"></div><details class="tv-foodtips"><summary>What to ask about, for your diet</summary><ul></ul></details>'
            + f'<p class="tv-dim">Diet labels come from each listing\'s description and cuisine; “likely” means the cuisine usually has good choices, not a promise. Check with the restaurant. <a href="/travel/food/?in={a["slug"]}">Open the food finder</a></p></section>')


def section_id(h): return 'sec-' + re.sub(r'[^a-z0-9]+', '-', h.lower()).strip('-')

ORDER = ['Understand', 'Regions', 'Cities', 'Other destinations', 'Get in', 'Fees and permits', 'Get around', 'See', 'Do', 'See and do', 'Learn',
         'Buy', 'Eat', 'Eat and drink', 'Drink', 'Sleep', 'Stay safe', 'Stay healthy', 'Respect', 'Go next']
SKIP = {'Cope', 'Connect', 'Work', 'Districts', 'Talk'}


def journal_html(a):
    return f'''<section class="tv-journal" id="journal" data-slug="{a['slug']}" data-title="{esc(place_name(a['t']))}" data-st="{a['st']}" data-lat="{a.get('lat') or ''}" data-lon="{a.get('lon') or ''}">
<h2>My experience</h2>
<p class="tv-dim">Write about your trip here. Notes save automatically in this browser as you type; back them up from <a href="/travel/journal/">My journal</a>.</p>
<div class="tv-jgrid">
  <label class="tv-chk"><input type="checkbox" name="visited"> I've been here</label>
  <label class="tv-chk"><input type="checkbox" name="bucket"> On my bucket list</label>
  <label>When <input type="date" name="date"></label>
  <label>With <input type="text" name="with" placeholder="Who you went with"></label>
  <div class="tv-rate" role="radiogroup" aria-label="Rating">{''.join(f'<button type="button" data-v="{i}" aria-label="{i} stars">★</button>' for i in range(1, 6))}</div>
</div>
<label class="tv-full">My story<textarea name="notes" rows="7" placeholder="What did you do? What surprised you? Where did you eat, and was it good?"></textarea></label>
<div class="tv-jgrid2">
  <label>Best thing I did<input type="text" name="best"></label>
  <label>Best thing I ate<input type="text" name="food"></label>
  <label>Where I stayed<input type="text" name="stay"></label>
  <label>Would I go back?<select name="back"><option value="">—</option><option>Yes, definitely</option><option>Maybe</option><option>Once was enough</option></select></label>
</div>
<label class="tv-full">Photo links<textarea name="photos" rows="2" placeholder="Paste links to your photos (Google Photos, iCloud shared album…), one per line"></textarea></label>
<div class="tv-jfoot"><span class="tv-saved" aria-live="polite"></span><button class="tv-btn tv-ghost tv-jclear" type="button">Clear entry</button></div>
</section>'''


def saved_html(t, a):
    sv = SAVED.get(t)
    if not sv: return ''
    lab = {'food': 'Eat', 'stay': 'Stay', 'place': 'See'}
    items = ''.join(f'<li><span class="tv-kind">{lab[x["k"]]}</span> <b>{esc(x["n"])}</b> — {esc(x["note"])} · '
                    + maps_link(x['n'] + ', ' + city_ctx(a), None, 'Open in Maps', 'tv-link') + ' · '
                    + f'<a href="{x["url"]}" target="_blank" rel="noopener">Instagram post</a></li>' for x in sv)
    return f'<aside class="tv-saved-box"><strong>★ On my list from Instagram</strong><ul>{items}</ul></aside>'


def wv_edit(t): return 'https://en.wikivoyage.org/wiki/' + quote(t.replace(' ', '_'))


def place_page(t, a):
    name = place_name(t)
    st = a['st']; stn = STATE_NAME.get(st, '')
    ph = a['photos']
    hero_img = ph[0] if ph else None
    crumbs = ['<a href="/travel/">USA</a>'] + [f'<a href="{href(c)}">{esc(place_name(c))}</a>' for c in a['crumbs'] if c != t]
    typ = TYPE_LABEL.get(a.get('type', ''), 'Place')
    facts = []
    if a.get('best'): facts.append(f'<div><span>Best time</span><b>{esc(a["best"])}</b></div>')
    if a.get('lat') is not None:
        facts.append('<div class="tv-from"><span>From you</span><b><button type="button" class="tv-link tv-sethome">Set starting point</button></b></div>')
    if a.get('air'): facts.append(f'<div><span>Nearest airport</span><b>{esc(a["air"][0]["code"])} · {a["air"][0]["mi"]} mi</b></div>')
    if a.get('budget', {}).get('sleep'): facts.append(f'<div><span>Typical stay</span><b>${a["budget"]["sleep"]["mid"]}/night</b></div>')
    n = a.get('n', {})
    cnt = [f'{n[k]} {lbl}' for k, lbl in (('see', 'sights'), ('do', 'things to do'), ('eat', 'places to eat'), ('drink', 'bars & cafés'), ('sleep', 'places to stay')) if n.get(k)]
    hero = f'''<section class="tv-hero{' tv-hero-img' if hero_img else ''}{' tv-hero-banner' if a.get('hero_banner') else ''}">
{('<div class="tv-hero-bg">' + img(hero_img['f'], 1280, hero_img.get('cap') or name, 'tv-hero-pic', True) + '</div>') if hero_img else ''}
<div class="tv-wrap tv-hero-in">
<nav class="tv-crumbs" aria-label="Breadcrumb">{' › '.join(crumbs)}</nav>
<p class="tv-eyebrow">{esc(typ)} · {esc(stn)}{' · multi-state' if a.get('multi') else ''}</p>
<h1>{esc(name)}</h1>
{f'<p class="tv-hero-cap">{esc(hero_img.get("cap") or "")}</p>' if hero_img and hero_img.get('cap') else ''}
<div class="tv-hero-acts">{maps_link(gmaps_place_q(a), (a.get('lat'), a.get('lon')) if a.get('type') not in ('region', 'ruralarea') else None, 'Open in Maps', 'tv-btn')}
<a class="tv-btn tv-ghost" href="#journal">✎ Write about it</a>
<button class="tv-btn tv-ghost tv-quickvisit" type="button" data-slug="{a['slug']}">✓ Mark visited</button></div>
</div></section>'''
    apj = esc(json.dumps([[ap['code'], ap['name'], ap['mi'], 1 if ap.get('big') else 0] for ap in a.get('air', [])]))
    facts_html = (f'<div class="tv-facts-bar tv-wrap" data-lat="{a.get("lat") or ""}" data-lon="{a.get("lon") or ""}" data-st="{a["st"]}" data-air="{apj}">{"".join(facts)}</div>') if facts else ''
    toc = []
    secs = sorted([s for s in a['secs'] if s['h'] not in SKIP], key=lambda s: ORDER.index(s['h']) if s['h'] in ORDER else 50)
    for s in secs: toc.append(f'<a href="#{section_id(s["h"])}">{esc(s["h"])}</a>')
    lead = blocks_html(a['lead'], a)
    # highlights
    hl = ''
    if a['hl']:
        cards = ''.join(f'<div class="tv-hl">' + (img(h['img'], 500, h['n'], 'tv-hl-img') if h.get('img') and not h['img'].lower().endswith('.svg') else '')
                        + f'<div><h4>{esc(h["n"])}</h4><p>{esc(h["c"])}{"…" if len(h["c"]) >= 220 else ""}</p></div></div>' for h in a['hl'])
        hl = f'<section id="best"><h2>Best things about {esc(name)}</h2><div class="tv-hls">{cards}</div></section>'
    # gallery
    gal = ''
    if len(ph) > 1:
        gal = '<section id="photos"><h2>Photos</h2><div class="tv-gal">' + ''.join(
            f'<a href="{filepage(p["f"])}" data-lb="{commons(p["f"], 1280)}" data-cap="{esc(p.get("cap", ""))}">{img(p["f"], 500, p.get("cap") or name)}</a>' for p in ph[:12]) + '</div></section>'
    # destinations within
    kids = ''
    if a.get('kids'):
        kc = ''.join(card(k) for k in a['kids'][:60])
        more = f'<p><a href="/travel/search/?st={st}&in={a["slug"]}">See all {len(a["kids"])} →</a></p>' if len(a['kids']) > 60 else ''
        kids = f'<section id="inside"><h2>Places in {esc(name)}</h2><div class="tv-grid">{kc}</div>{more}</section>'
    guide = []
    for s in secs:
        if not s['b']: continue
        cls = ' tv-sec-list' if s['h'] in ('See', 'Do', 'Eat', 'Drink', 'Sleep', 'Buy') else ''
        guide.append(f'<section class="tv-sec{cls}" id="{section_id(s["h"])}"><h2>{esc(s["h"])}</h2>{blocks_html(s["b"], a)}</section>')
    has_map = any('L' in b and b['L'].get('lat') for s in a['secs'] for b in s['b'])
    food_block = food_html(a)
    near = nearby(t, a)
    near_html = ''
    if near:
        near_html = '<section id="nearby"><h2>Nearby</h2><div class="tv-grid">' + ''.join(
            card(x).replace('</p></div>', f' · {mi} mi away</p></div>', 1) for x, mi in near) + '</div></section>'
    total = sum(n.values())
    thin = ''
    if total < 4 and not a.get('kids'):
        thin = ('<aside class="tv-box"><strong>This guide is still short.</strong><p>Wikivoyage has only a little on this place so far. '
                + ('Places nearby have more — see <a href="#nearby">Nearby</a>. ' if near else '') + 'You can also help by adding to it on Wikivoyage.</p></aside>')
    mapsec = '<section id="map"><h2>Map</h2><div class="tv-lmap" data-center="' + (f'{a["lat"]},{a["lon"]}' if a.get('lat') else '') + '"></div><p class="tv-dim">Every listing with a location. Tap a pin for its Google Maps link.</p></section>' if has_map else ''
    body = f'''{hero}{facts_html}
<div class="tv-wrap tv-layout">
<details class="tv-toc" open><summary>On this page</summary><nav class="tv-toc-links" aria-label="On this page"><a href="#overview">Overview</a>{'<a href="#best">Best things</a>' if hl else ''}{'<a href="#plan">Plan your trip</a>' if a.get('climate') or a.get('itin') or a.get('air') else ''}{'<a href="#food">Food for you</a>' if food_block else ''}{'<a href="#photos">Photos</a>' if gal else ''}{'<a href="#inside">Places inside</a>' if kids else ''}{'<a href="#map">Map</a>' if mapsec else ''}{''.join(toc)}{'<a href="#nearby">Nearby</a>' if near else ''}<a href="#journal">My experience</a></nav></details>
<article class="tv-main">
{saved_html(t, a)}<section id="overview"><h2 class="tv-vh">Overview</h2>{lead}<p class="tv-counts">{esc(' · '.join(cnt))}</p>
<p class="tv-fresh">Updated from Wikivoyage on {DUMP_TXT} · <a href="{wv_edit(t)}" target="_blank" rel="noopener">Something wrong or missing? Improve it on Wikivoyage</a></p>{thin}</section>
{hl}
{plan_html(a)}
{food_block}
{gal}
{kids}
{mapsec}
{''.join(guide)}
{state_all_places(a['st']) if t == state_title(a['st']) else ''}
{near_html}
{journal_html(a)}
</article></div>
<nav class="tv-mbar" aria-label="Quick actions">{maps_link(gmaps_place_q(a), (a.get('lat'), a.get('lon')) if a.get('type') not in ('region', 'ruralarea') else None, 'Maps', 'tv-mb')}<a class="tv-mb" href="#journal">✎ Write</a><button class="tv-mb tv-quickvisit" type="button">✓ Visited</button><a class="tv-mb" href="#main">↑ Top</a></nav>'''
    desc = re.sub(r'<[^>]+>', '', a['lead'][0]['p'])[:155] if a['lead'] and 'p' in a['lead'][0] else f'Travel guide to {name}, {stn}.'
    extra = ''
    if has_map:
        extra = '<link rel="stylesheet" href="/travel/assets/leaflet/leaflet.css">'
    foot = '<script src="/travel/assets/leaflet/leaflet.js" defer></script>' if has_map else ''
    if t == state_title(a['st']): foot += FILTER_JS
    return page(f'{name}, {stn} travel guide: things to do, food & where to stay — Travel' if t != state_title(a['st']) else f'{name} travel guide: every place to visit', desc, body, 'place', attribution(a), extra, foot,
                commons(hero_img['f'], 1280) if hero_img else None, '/travel/' + a['slug'] + '/')


def card(t):
    a = P[t]
    p = a['photos'][0] if a['photos'] else None
    n = a.get('n', {})
    sub = TYPE_LABEL.get(a.get('type', ''), 'Place')
    total = sum(n.values())
    return (f'<a class="tv-pc" href="{href(t)}" data-slug="{a["slug"]}">' + (img(p['f'], 330, place_name(t), 'tv-pc-img') if p else '<div class="tv-pc-ph" aria-hidden="true"></div>')
            + f'<div class="tv-pc-b"><h3>{esc(place_name(t))}</h3><p>{esc(sub)}{" · " + str(total) + " listings" if total else ""}</p></div><span class="tv-pc-v" aria-hidden="true">✓</span></a>')


def write(path, s):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    s = re.sub(r'\x00[A-Z]\d+\x00', '', s)
    s = re.sub(r'&lt;/?maplink.*?(&gt;|$)', '', s)
    open(full, 'w', encoding='utf-8').write(s)


# ---------------------------------------------------------------- hub pages
TYC = {'city': 'c', 'park': 'p', 'region': 'r', 'district': 'd', 'ruralarea': 'u', 'airport': 'a'}
STATE_T = {st: state_title(st) for st in STATE_NAME if st != 'US'}


def index_json():
    rows = []
    for t, a in P.items():
        f = a['photos'][0]['f'] if a['photos'] else ''
        rows.append([place_name(t), a['slug'], a['st'], TYC.get(a.get('type'), 'o'),
                     round(a['lat'], 4) if a.get('lat') is not None else None, round(a['lon'], 4) if a.get('lon') is not None else None,
                     f, sum(a.get('n', {}).values())] + ([t] if place_name(t) != t else []))
    return json.dumps({'p': rows, 's': STATE_NAME}, separators=(',', ':'), ensure_ascii=False)


def state_card(st):
    t = STATE_T[st]; a = P.get(t)
    cnt = sum(1 for x in P.values() if x['st'] == st)
    ph = a['photos'][0]['f'] if a and a['photos'] else None
    return (f'<a class="tv-sc" href="{href(t) if a else "#"}" data-st="{st}">' + (img(ph, 500, STATE_NAME[st]) if ph else '') +
            f'<span class="tv-badge">Visited</span><div><h3>{esc(STATE_NAME[st])}</h3><p>{cnt} places</p></div></a>')


def by_score(ts):
    return sorted(ts, key=lambda t: -(sum(P[t].get('n', {}).values()) + len(P[t]['photos']) * 3 + {'star': 300, 'guide': 150, 'usable': 40}.get(P[t].get('status'), 0)))


COMING = [('🇨🇦', 'Canada'), ('🇲🇽', 'Mexico'), ('🇯🇵', 'Japan'), ('🇮🇳', 'India'), ('🇮🇹', 'Italy'), ('🇨🇭', 'Switzerland'),
          ('🇬🇧', 'United Kingdom'), ('🇫🇷', 'France'), ('🇪🇸', 'Spain'), ('🇵🇹', 'Portugal'), ('🇬🇷', 'Greece'), ('🇦🇹', 'Austria'),
          ('🇳🇴', 'Norway'), ('🇹🇷', 'Turkey'), ('🇮🇩', 'Indonesia'), ('🇦🇪', 'United Arab Emirates')]


MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


def month_blocks():
    out = []
    pool = by_score([t for t, a in P.items() if a.get('type') in ('city', 'park') and a.get('best_m') and len(a['best_m']) <= 8 and a['photos']])
    for m in range(12):
        picks = [t for t in pool if m in P[t]['best_m']][:12]
        out.append(f'<div class="tv-grid tv-mgrid" data-m="{m}"' + ('' if m == datetime.date.today().month - 1 else ' hidden') + '>' + ''.join(card(t) for t in picks) + '</div>')
    return ''.join(out)


def home_page():
    parks = by_score([t for t, a in P.items() if a.get('type') == 'park' and 'National Park' in t and '/' not in t])
    cities = by_score([t for t, a in P.items() if a.get('type') == 'city' and a.get('status') in ('star', 'guide')])
    towns = by_score([t for t, a in P.items() if a.get('type') == 'city' and a.get('status') == 'usable' and len(a['photos']) >= 4])
    n_list = sum(sum(a.get('n', {}).values()) for a in P.values())
    body = f'''<section class="tv-home-hero tv-wrap">
<p class="tv-live"><span class="tv-dot"></span>United States live now · more countries coming soon</p>
<h1>Every place in the <span>USA</span></h1>
<p>{len(P):,} destinations across all 50 states and D.C. — what to see and do, how the food is, when to go, what it costs, how to get there, and a page to write about your own trip.</p>
<form class="tv-bigsearch" action="/travel/search/" role="search"><input type="search" name="q" placeholder="Try “Zion”, “Savannah”, “Door County”…" aria-label="Search places" autocomplete="off"><div class="tv-sugg" hidden></div></form>
<div class="tv-stats"><div><b>{len(P):,}</b>places</div><div><b>{n_list:,}</b>things to see, do, eat & stay</div><div><b id="tv-my-visited">0</b>places I've visited</div><div><b id="tv-my-states">0</b>states I've visited</div></div>
</section>
<div class="tv-wrap">
<section class="tv-section" id="eat"><h2>Eat your way</h2><p class="tv-dim">Vegan, vegetarian, eggs-only, pescatarian or chicken-and-fish only? Pick once and every guide ranks its restaurants for you. Choose several for a mixed group.</p>
<div class="tv-card"><div class="tv-dietpick"></div><p style="margin:10px 0 0"><a class="tv-btn" href="/travel/food/">Open the food finder</a></p></div></section>
<section class="tv-section" id="countries"><h2>Countries</h2><div class="tv-countries">
<a class="tv-country is-live" href="#states"><span class="tv-flag">🇺🇸</span><span><b>United States</b><small>{len(P):,} places · all 50 states</small></span><span class="tv-pill">Live</span></a>
{"".join(f'<div class="tv-country"><span class="tv-flag">{f}</span><span><b>{n}</b><small>Coming soon</small></span></div>' for f, n in COMING)}
</div></section>
<section class="tv-section"><h2>★ My saved places</h2><p class="tv-dim">From my Instagram saves.</p><div class="tv-grid">{"".join(card(t) for t in SAVED if t in P)}</div></section>
<section class="tv-section" id="this-month"><h2>Where to go in <span class="tv-month">{MONTHS[datetime.date.today().month - 1]}</span></h2><p class="tv-dim">Places at their most comfortable this month, based on average weather.</p>{month_blocks()}</section>
<section class="tv-section" id="near-you"><h2>Weekend trips near you</h2><p class="tv-dim"><span class="tv-home-label">Under about 4½ hours by car.</span> <button type="button" class="tv-link tv-sethome">Set your starting point</button></p><div class="tv-grid" id="tv-near-grid"></div></section>
<section class="tv-section"><h2>National parks</h2><div class="tv-grid">{"".join(card(t) for t in parks[:24])}</div><p><a href="/travel/search/?ty=p">All parks →</a></p></section>
<section class="tv-section"><h2>Great cities</h2><div class="tv-grid">{"".join(card(t) for t in cities[:24])}</div><p><a href="/travel/search/?ty=c">All cities and towns →</a></p></section>
<section class="tv-section"><h2>Small towns worth the trip</h2><div class="tv-grid">{"".join(card(t) for t in towns[:16])}</div></section>
<section class="tv-section" id="states"><h2>Browse by state</h2><div class="tv-states">{"".join(state_card(st) for st in sorted(STATE_T, key=lambda s: STATE_NAME[s]))}</div></section>
</div>
<script>document.addEventListener('DOMContentLoaded',function(){{var a=tvJournal.load(),v=0,s={{}};for(var k in a)if(a[k].visited){{v++;s[a[k].st]=1}}document.getElementById('tv-my-visited').textContent=v;document.getElementById('tv-my-states').textContent=Object.keys(s).length;}});</script>'''
    return page('Travel — every place to visit in the USA', 'A guide to 6,591 places in all 50 states: things to do, food for every diet, best time to go, budget, itineraries, maps and your own travel journal. More countries coming soon.', body, 'home', '<p class="tv-attr">Guides adapted from <a href="https://en.wikivoyage.org/" rel="noopener">Wikivoyage</a> (CC BY-SA 4.0); photos from Wikimedia Commons.</p>', canon='/travel/')


def states_page():
    body = f'<div class="tv-wrap"><h1 style="margin-top:32px">All states</h1><div class="tv-states">{"".join(state_card(st) for st in sorted(STATE_T, key=lambda s: STATE_NAME[s]))}</div></div>'
    return page('All 50 states — Travel', 'Travel guides for every US state.', body, 'states', canon='/travel/states/')


def state_all_places(st):
    items = by_score([t for t, a in P.items() if a['st'] == st and t != STATE_T.get(st)])
    groups = [('c', 'Cities & towns'), ('p', 'Parks'), ('r', 'Regions'), ('d', 'Neighborhoods'), ('u', 'Rural areas'), ('a', 'Airports')]
    chips = '<div class="tv-chips" data-filter><button class="tv-chip on" data-ty="">All ' + str(len(items)) + '</button>' + ''.join(
        f'<button class="tv-chip" data-ty="{c}">{lbl} {sum(1 for t in items if TYC.get(P[t].get("type"), "o") == c)}</button>' for c, lbl in groups
        if any(TYC.get(P[t].get('type'), 'o') == c for t in items)) + '</div>'
    cards = ''.join(card(t).replace('<a class="tv-pc"', f'<a class="tv-pc" data-ty="{TYC.get(P[t].get("type"), "o")}"', 1) for t in items)
    return f'<section id="all"><h2>All {len(items)} places in {esc(STATE_NAME[st])}</h2>{chips}<div class="tv-grid" data-filtered>{cards}</div></section>'


FILTER_JS = '''<script>document.querySelectorAll('[data-filter]').forEach(function(c){c.addEventListener('click',function(e){var b=e.target.closest('.tv-chip');if(!b)return;c.querySelectorAll('.tv-chip').forEach(function(x){x.classList.toggle('on',x===b)});var ty=b.dataset.ty;c.nextElementSibling.querySelectorAll('.tv-pc').forEach(function(p){p.style.display=!ty||p.dataset.ty===ty?'':'none'})})});</script>'''

SEARCH_BODY = '''<div class="tv-wrap"><h1 style="margin-top:32px">Find a place</h1>
<form class="tv-bigsearch" style="margin:0 0 14px;max-width:none" onsubmit="return false"><input id="sq" type="search" placeholder="Search by name, state or region" aria-label="Search" autocomplete="off"></form>
<div class="tv-chips" id="sty"><button class="tv-chip on" data-ty="">Everything</button><button class="tv-chip" data-ty="c">Cities & towns</button><button class="tv-chip" data-ty="p">Parks</button><button class="tv-chip" data-ty="r">Regions</button><button class="tv-chip" data-ty="d">Neighborhoods</button><button class="tv-chip" data-ty="u">Rural areas</button>
<select id="sst" class="tv-chip" aria-label="State"><option value="">All states</option></select><button class="tv-chip" id="near" type="button">📍 Near me</button></div>
<p class="tv-box" id="smissing" hidden>That page has moved or is no longer in the guide. Here are the closest matches.</p><p class="tv-dim" id="scount"></p><div class="tv-results" id="sres"></div><p style="text-align:center"><button class="tv-btn tv-ghost" id="smore" hidden>Show more</button></p></div>
<script>
document.addEventListener('DOMContentLoaded',function(){
var P=new URLSearchParams(location.search),q=document.getElementById('sq'),res=document.getElementById('sres'),cnt=document.getElementById('scount'),more=document.getElementById('smore'),sst=document.getElementById('sst');
if(P.get('missing'))document.getElementById('smissing').hidden=false;var ty=P.get('ty')||'',st=P.get('st')||'',here=null,shown=60,list=[];q.value=P.get('q')||'';
document.querySelectorAll('#sty [data-ty]').forEach(function(b){b.classList.toggle('on',b.dataset.ty===ty);b.addEventListener('click',function(){ty=b.dataset.ty;document.querySelectorAll('#sty [data-ty]').forEach(function(x){x.classList.toggle('on',x===b)});run()})});
function d(a,b,c,e){var r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((e-b)*r/2);return 7918*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))}
function cardh(r){var J=tvJournal.load()[r.s];return '<a class="tv-pc'+(J&&J.visited?' is-visited':'')+'" href="/travel/'+r.s+'/">'+(r.f?'<img class="tv-pc-img" loading="lazy" src="'+tvThumb(r.f,330)+'" alt="" onerror="this.style.visibility=\\'hidden\\'">':'<div class="tv-pc-ph"></div>')+'<div class="tv-pc-b"><h3>'+tvEsc(r.n)+'</h3><p>'+tvEsc(tvTypes[r.ty]||'')+' · '+tvEsc(list.states[r.st]||r.st)+(here&&r.la?' · '+Math.round(d(here[0],here[1],r.la,r.lo))+' mi':'')+'</p></div><span class="tv-pc-v">✓</span></a>'}
function run(){var v=q.value.trim(),out;
 if(v)out=tvSearch(v,list,5000);else out=list.slice().sort(function(a,b){return b.k-a.k});
 out=out.filter(function(r){return(!ty||r.ty===ty)&&(!st||r.st===st)});
 if(here)out=out.filter(function(r){return r.la!=null}).sort(function(a,b){return d(here[0],here[1],a.la,a.lo)-d(here[0],here[1],b.la,b.lo)});
 cnt.textContent=out.length.toLocaleString()+' places';res.innerHTML=out.length?out.slice(0,shown).map(cardh).join(''):'<div class="tv-noresults"><b>No places match.</b> Try a shorter name, check the spelling, or clear the filters. Countries other than the US are coming soon.</div>';more.hidden=out.length<=shown;}
more.addEventListener('click',function(){shown+=60;run()});
q.addEventListener('input',function(){shown=60;run()});
sst.addEventListener('change',function(){st=sst.value;shown=60;run()});
document.getElementById('near').addEventListener('click',function(){var b=this;if(!navigator.geolocation){b.textContent='Location unavailable';return}b.textContent='Locating…';navigator.geolocation.getCurrentPosition(function(p){here=[p.coords.latitude,p.coords.longitude];b.textContent='📍 Sorted by distance';b.classList.add('on');run()},function(){b.textContent='Location blocked'})});
tvIndex().then(function(l){list=l;Object.keys(l.states).sort(function(a,b){return l.states[a]<l.states[b]?-1:1}).forEach(function(k){if(k==='US')return;var o=document.createElement('option');o.value=k;o.textContent=l.states[k];if(k===st)o.selected=true;sst.appendChild(o)});run()});
});
</script>'''

MAP_BODY = '''<div class="tv-wrap"><h1 style="margin-top:26px">Map of every place</h1><p class="tv-dim">Green pins are places you've marked visited. Tap a pin to open its guide.</p><div class="tv-bigmap" id="bigmap"></div></div>
<script>
document.addEventListener('DOMContentLoaded',function(){tvWhenLeaflet(function(){tvIndex().then(function(list){
var L=window.L,m=L.map('bigmap',{preferCanvas:true}).setView([39.5,-98.35],4);tvTiles(m);var J=tvJournal.load();
var col={c:'#2dd4f5',p:'#4ade80',r:'#a87cf7',d:'#8fb8ff',u:'#f5c04a',a:'#94a3b8',o:'#94a3b8'};
list.forEach(function(r){if(r.la==null)return;var v=J[r.s]&&J[r.s].visited;
L.circleMarker([r.la,r.lo],{radius:v?7:(r.ty==='p'?5:4),weight:v?2:1,color:v?'#fff':'rgba(0,0,0,.35)',fillColor:v?'#22c55e':col[r.ty],fillOpacity:.9}).addTo(m).bindPopup('<b><a href="/travel/'+r.s+'/">'+tvEsc(r.n)+'</a></b><br>'+tvEsc(tvTypes[r.ty]||'')+' · '+tvEsc(list.states[r.st]||''));});
})})});
</script>'''

JOURNAL_BODY = '''<div class="tv-wrap"><h1 style="margin-top:32px">My travel journal</h1>
<p class="tv-dim">Everything you've written on place pages, saved in this browser. Export a backup now and then. You can import it on another device or browser.</p>
<div class="tv-stat-cards"><div><b id="j-v">0</b>places visited</div><div><b id="j-s">0</b>states visited</div><div><b id="j-b">0</b>on my bucket list</div><div><b id="j-w">0</b>spots I want to see</div></div>
<div class="tv-acts" style="margin-bottom:18px"><button class="tv-btn" id="j-exp" type="button">Export backup (.json)</button><label class="tv-btn tv-ghost" style="cursor:pointer">Import backup<input id="j-imp" type="file" accept=".json,application/json" hidden></label><button class="tv-btn tv-ghost" id="j-print" type="button">Print my journal</button></div>
<h2>Where I've been</h2><div class="tv-lmap tv-jmap" id="j-map"></div>
<h2>My stories</h2><div id="j-list"><p class="tv-dim">Nothing yet. Open any place and use “My experience” at the bottom of its page.</p></div>
<h2>Bucket list</h2><div class="tv-grid" id="j-bucket"></div>
<h2>States</h2><div class="tv-chips" id="j-states"></div></div>
<script>
document.addEventListener('DOMContentLoaded',function(){
function render(){var A=tvJournal.load(),ks=Object.keys(A),vis=ks.filter(function(k){return A[k].visited}),st={},w=0;
vis.forEach(function(k){st[A[k].st]=1});ks.forEach(function(k){w+=(A[k].want||[]).length});
document.getElementById('j-v').textContent=vis.length;document.getElementById('j-s').textContent=Object.keys(st).length;
document.getElementById('j-b').textContent=ks.filter(function(k){return A[k].bucket}).length;document.getElementById('j-w').textContent=w;
var ent=ks.filter(function(k){var e=A[k];return e.notes||e.best||e.food||e.rating||e.visited}).sort(function(a,b){return(A[b].date||A[b].updated||'')>(A[a].date||A[a].updated||'')?1:-1});
if(ent.length)document.getElementById('j-list').innerHTML=ent.map(function(k){var e=A[k];return '<div class="tv-entry"><h3><a href="/travel/'+k+'/#journal">'+tvEsc(e.title||k)+'</a> <span class="tv-stars">'+'★'.repeat(e.rating||0)+'</span></h3><p class="tv-dim">'+[e.visited?'Visited':'',e.date,e.with?'with '+tvEsc(e.with):'',e.back].filter(Boolean).join(' · ')+'</p>'+(e.best?'<p><b>Best thing I did:</b> '+tvEsc(e.best)+'</p>':'')+(e.food?'<p><b>Best thing I ate:</b> '+tvEsc(e.food)+'</p>':'')+(e.stay?'<p><b>Stayed at:</b> '+tvEsc(e.stay)+'</p>':'')+(e.notes?'<pre>'+tvEsc(e.notes)+'</pre>':'')+((e.want||[]).length?'<p class="tv-dim">Want to see: '+tvEsc(e.want.join(', '))+'</p>':'')+'</div>'}).join('');
tvIndex().then(function(list){var by={};list.forEach(function(r){by[r.s]=r});
document.getElementById('j-bucket').innerHTML=ks.filter(function(k){return A[k].bucket&&!A[k].visited}).map(function(k){var r=by[k]||{n:A[k].title,s:k};return '<a class="tv-pc" href="/travel/'+k+'/">'+(r.f?'<img class="tv-pc-img" src="'+tvThumb(r.f,330)+'" alt="" loading="lazy">':'<div class="tv-pc-ph"></div>')+'<div class="tv-pc-b"><h3>'+tvEsc(r.n)+'</h3><p>'+tvEsc(list.states[r.st]||'')+'</p></div></a>'}).join('')||'<p class="tv-dim">Tick “On my bucket list” on any place page.</p>';
document.getElementById('j-states').innerHTML=Object.keys(list.states).filter(function(s){return s!=='US'}).sort(function(a,b){return list.states[a]<list.states[b]?-1:1}).map(function(s){return '<span class="tv-chip'+(st[s]?' on':'')+'">'+(st[s]?'✓ ':'')+tvEsc(list.states[s])+'</span>'}).join('');
tvWhenLeaflet(function(){var L=window.L,el=document.getElementById('j-map');if(el._m){el._m.remove()}var m=L.map(el).setView([39.5,-98.35],4);el._m=m;tvTiles(m);var pts=[];
ks.forEach(function(k){var e=A[k],r=by[k];var la=e.lat||(r&&r.la),lo=e.lon||(r&&r.lo);if(!la||!(e.visited||e.bucket))return;L.circleMarker([la,lo],{radius:8,color:'#fff',weight:2,fillColor:e.visited?'#22c55e':'#f5c04a',fillOpacity:.95}).addTo(m).bindPopup('<a href="/travel/'+k+'/">'+tvEsc(e.title||k)+'</a>');pts.push([la,lo])});
if(pts.length)m.fitBounds(pts,{padding:[30,30],maxZoom:9});});});}
render();
document.getElementById('j-exp').addEventListener('click',function(){var b=new Blob([JSON.stringify(tvJournal.load(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='travel-journal-'+new Date().toISOString().slice(0,10)+'.json';a.click();});
document.getElementById('j-imp').addEventListener('change',function(){var f=this.files[0];if(!f)return;f.text().then(function(t){try{var inc=JSON.parse(t),cur=tvJournal.load();Object.keys(inc).forEach(function(k){if(!cur[k]||(inc[k].updated||'')>(cur[k].updated||''))cur[k]=inc[k]});tvJournal.save(cur);render();alert('Imported '+Object.keys(inc).length+' entries.')}catch(e){alert('That file is not a journal backup.')}})});
document.getElementById('j-print').addEventListener('click',function(){window.print()});
});
</script>'''

LEAF_H = '<link rel="stylesheet" href="/travel/assets/leaflet/leaflet.css">'
LEAF_F = '<script src="/travel/assets/leaflet/leaflet.js" defer></script>'


def build_redirects():
    for old, new in ALIASES.items():
        u = f'/travel/{new}/'
        write(old + '/index.html', f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Moved</title><link rel="canonical" href="https://travel.konnectingnots.com{u}"><meta http-equiv="refresh" content="0; url={u}"><meta name="robots" content="noindex"></head><body><p>This page moved to <a href="{u}">{u}</a>.</p><script>location.replace("{u}"+location.hash)</script></body></html>')
    open(os.path.join(OUT, 'assets', 'aliases.json'), 'w').write(json.dumps(ALIASES))
    urls = ['https://travel.konnectingnots.com/travel/'] + [f'https://travel.konnectingnots.com/travel/{a["slug"]}/' for a in P.values()]
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + ''.join(f'<url><loc>{u}</loc><lastmod>{META["dump"]}</lastmod></url>\n' for u in urls) + '</urlset>\n')


FOOD_BODY = '''<div class="tv-wrap"><h1 style="margin-top:32px">Food finder</h1>
<p class="tv-dim">Every place to eat and drink in the guide, ranked for your diet. Your choice is remembered on every page.</p>
<div class="tv-card"><div class="tv-dietpick"></div>
<div class="tv-ffrow"><label>Cuisine<select id="fcu" class="tv-field"><option value="">Any cuisine</option>{cus}</select></label>
<label>Where<select id="fst" class="tv-field"><option value="">Choose a state…</option></select></label>
<label>Price<select id="fpr" class="tv-field"><option value="">Any</option><option value="1">$ Budget</option><option value="2">$$ Mid-range</option><option value="3">$$$ Splurge</option></select></label>
<label>Name<input id="fq" class="tv-field" type="search" placeholder="Optional"></label>
<button class="tv-btn tv-ghost" id="fnear" type="button">📍 Near me</button></div>
<label class="tv-chk"><input type="checkbox" id="fconf"> Only confirmed options (hide “likely” and “limited”)</label></div>
<p id="fstatus" class="tv-dim" aria-live="polite">Choose a state, or use Near me.</p>
<div id="fres" class="tv-fres"></div><p style="text-align:center"><button class="tv-btn tv-ghost" id="fmore" hidden>Show more</button></p></div>
<script>
document.addEventListener('DOMContentLoaded',function(){{
var P=new URLSearchParams(location.search),cache={{}},center=null,shown=40,st=document.getElementById('fst'),res=document.getElementById('fres'),stat=document.getElementById('fstatus'),more=document.getElementById('fmore');
function d(a,b,c,e){{var r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((e-b)*r/2);return 7918*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))}}
function loadSt(s){{if(cache[s])return Promise.resolve(cache[s]);return fetch('/travel/assets/food/'+s+'.json').then(function(r){{return r.json()}}).then(function(j){{cache[s]=j;return j}})}}
var IDX=null;
function statesNear(c,list){{var s={{}};list.forEach(function(r){{if(r.la!=null&&d(c[0],c[1],r.la,r.lo)<60)s[r.st]=1}});return Object.keys(s)}}
function run(){{var v=tvDiet.get(),cu=document.getElementById('fcu').value,pr=+document.getElementById('fpr').value,q=document.getElementById('fq').value.trim().toLowerCase(),conf=document.getElementById('fconf').checked;
 var states=center?statesNear(center,IDX):(st.value?[st.value]:[]);if(!states.length){{stat.textContent=center?'Nothing in the guide within 60 miles.':'Choose a state, or use Near me.';res.innerHTML='';more.hidden=true;return}}
 stat.textContent='Loading…';Promise.all(states.map(loadSt)).then(function(arrs){{var rows=[];arrs.forEach(function(a){{a.forEach(function(e){{
  if(cu&&e[3].split('|').indexOf(cu)<0)return;if(pr&&e[5]!==pr)return;if(q&&(e[0]+' '+e[2]).toLowerCase().indexOf(q)<0)return;
  var sc=tvScore(e[4],v);if(sc<(conf?3:1))return;var dist=center&&e[6]!=null?d(center[0],center[1],e[6],e[7]):null;if(center&&(dist==null||dist>40))return;rows.push([sc,dist,e])}})}});
  rows.sort(function(a,b){{return (b[0]-a[0])||((a[1]==null?1e9:a[1])-(b[1]==null?1e9:b[1]))}});
  stat.innerHTML='<b>'+rows.length.toLocaleString()+'</b> places'+(v.d.length?' for your diet':'')+(center?' within 40 miles':'');
  res.innerHTML=rows.slice(0,shown).map(function(r){{var e=r[2],qq=e[0]+', '+(e[9]?e[9]+', ':'')+e[2];return '<div class="tv-frow"><div><a href="/travel/'+e[1]+'/#'+e[8]+'"><b>'+tvEsc(e[0])+'</b></a> <span class="tv-dim">'+tvEsc(e[3].replace(/\|/g,' · '))+(e[5]?' · '+'$'.repeat(e[5]):'')+'</span>'+(v.d.length?' <span class="tv-lv tv-lv'+r[0]+'">'+(tvDiet.LVTXT[r[0]]||'')+'</span>':'')+'<br><span class="tv-dim">'+tvEsc(e[2])+(r[1]!=null?' · '+Math.round(r[1])+' mi':'')+'</span></div><a class="tv-btn tv-btn-sm tv-maps" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(qq)+'" data-q="'+tvEsc(qq)+'"'+(e[6]!=null?' data-ll="'+e[6]+','+e[7]+'"':'')+' target="_blank" rel="noopener">Maps</a></div>'}}).join('')||'<div class="tv-noresults">No matches. Loosen a filter, or use the live links on a place page to search Google Maps, Yelp or HappyCow.</div>';
  more.hidden=rows.length<=shown}})}}
['fcu','fpr','fconf'].forEach(function(id){{document.getElementById(id).addEventListener('change',function(){{shown=40;run()}})}});
document.getElementById('fq').addEventListener('input',function(){{shown=40;run()}});
st.addEventListener('change',function(){{center=null;shown=40;run()}});
more.addEventListener('click',function(){{shown+=40;run()}});
document.addEventListener('tv-diet',function(){{shown=40;run()}});
document.getElementById('fnear').addEventListener('click',function(){{var b=this;b.textContent='Locating…';navigator.geolocation.getCurrentPosition(function(p){{center=[p.coords.latitude,p.coords.longitude];st.value='';b.textContent='📍 Near me';run()}},function(){{b.textContent='Location blocked'}})}});
tvIndex().then(function(l){{IDX=l;Object.keys(l.states).filter(function(k){{return k!=='US'}}).sort(function(a,b){{return l.states[a]<l.states[b]?-1:1}}).forEach(function(k){{var o=document.createElement('option');o.value=k;o.textContent=l.states[k];st.appendChild(o)}});
 var near=P.get('near'),inp=P.get('in');
 if(near&&near.split(',')[0]){{center=near.split(',').map(Number)}}
 else if(inp){{var r=l.filter(function(x){{return x.s===inp}})[0];if(r){{if(r.la!=null)center=[r.la,r.lo];else st.value=r.st}}}}
 if(P.get('st'))st.value=P.get('st');run()}});
}});
</script>'''


def build_food():
    from food import CUISINES
    by = {}
    for t, a in P.items():
        for s in a['secs']:
            for b in s['b']:
                L = b.get('L')
                if not L or 'dt' not in L: continue
                la, lo = (L.get('lat'), L.get('lon')) if L.get('lat') and L.get('lon') else (a.get('lat'), a.get('lon'))
                by.setdefault(a['st'], []).append([L['n'], a['slug'], place_name(t) + ', ' + STATE_NAME.get(a['st'], ''), '|'.join(L['cu']),
                    ' '.join(k + ':' + v for k, v in L['dt'].items()), L.get('tier', 0),
                    round(la, 4) if la is not None else None, round(lo, 4) if lo is not None else None, lid(L), L.get('addr', '')[:80]])
    os.makedirs(os.path.join(OUT, 'assets', 'food'), exist_ok=True)
    for st, rows in by.items():
        open(os.path.join(OUT, 'assets', 'food', st + '.json'), 'w', encoding='utf-8').write(json.dumps(rows, separators=(',', ':'), ensure_ascii=False))
    cus = ''.join(f'<option>{esc(l)}</option>' for l, _ in CUISINES) + '<option>Bar / Café</option>'
    write('food/index.html', page('Food finder: vegan, vegetarian, halal and more — Travel', 'Find places to eat that suit your diet, by cuisine, state or distance.',
                                  FOOD_BODY.replace('{cus}', cus).replace('{{', '{').replace('}}', '}'), 'food', canon='/travel/food/'))


def build_hubs():
    os.makedirs(os.path.join(OUT, 'assets'), exist_ok=True)
    open(os.path.join(OUT, 'assets', 'index.json'), 'w', encoding='utf-8').write(index_json())
    write('index.html', home_page())
    write('states/index.html', states_page())
    write('search/index.html', page('Search places — Travel', 'Search every place to visit in the USA.', SEARCH_BODY, 'search', canon='/travel/search/'))
    write('map/index.html', page('Map of every place — Travel', 'Map of every destination in the USA.', MAP_BODY, 'map', '', LEAF_H, LEAF_F, canon='/travel/map/'))
    write('journal/index.html', page('My travel journal — Travel', 'My personal travel journal.', JOURNAL_BODY, 'journal', '', LEAF_H + '<meta name="robots" content="noindex">', LEAF_F))


if __name__ == '__main__':
    if os.path.exists(OUT):
        for d in os.listdir(OUT):
            if d not in ('assets',): shutil.rmtree(os.path.join(OUT, d)) if os.path.isdir(os.path.join(OUT, d)) else os.remove(os.path.join(OUT, d))
    only = os.environ.get('ONLY')
    for t, a in P.items():
        if only and t not in only.split('|'): continue
        write(a['slug'] + '/index.html', place_page(t, a))
    build_hubs()
    build_redirects()
    build_food()
    print('pages done')



"""Step 1: read the Wikivoyage dump into raw/arts.pkl and find every US article (raw/us.pkl)."""
import bz2, re, pickle, xml.etree.ElementTree as ET

arts, redirects = {}, {}
with bz2.open('raw/wv.xml.bz2', 'rb') as f:
    for ev, el in ET.iterparse(f):
        if el.tag.endswith('}page'):
            tag = el.tag[:-4]
            t = el.find(tag + 'title').text; n = el.find(tag + 'ns').text
            if n == '0':
                r = el.find(tag + 'redirect')
                txt = el.find(tag + 'revision/' + tag + 'text').text or ''
                if r is not None: redirects[t] = r.get('title')
                else: arts[t] = txt
            el.clear()
pickle.dump((arts, redirects), open('raw/arts.pkl', 'wb'))

par = {}
for t, x in arts.items():
    m = re.search(r'\{\{\s*IsPartOf\s*\|\s*([^}|]+)', x, re.I)
    if m:
        p = m.group(1).strip().replace('_', ' ')
        par[t] = redirects.get(p, p)


def chain(t):
    out = []; seen = set()
    while t in par and t not in seen:
        seen.add(t); t = par[t]; out.append(t)
    return out

us = [t for t in arts if 'United States' in chain(t)]
pickle.dump((us, par), open('raw/us.pkl', 'wb'))
print(len(arts), 'articles,', len(redirects), 'redirects,', len(us), 'in the US')

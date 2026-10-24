/* Travel USA — search, journal (saved in this browser), maps, gallery. No build step. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'tv-journal-v1';

  // ---------- storage ----------
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  window.tvJournal = { load: load, save: save, KEY: KEY };

  // Theme toggle, mobile menu and header border come from the portfolio's /script.js.

  // ---------- images: fall back to original, then hide ----------
  window.tvImgErr = function (im) {
    if (!im.dataset.tried && im.dataset.full) { im.dataset.tried = 1; im.src = im.dataset.full; return; }
    var a = im.closest('.tv-lthumb'); if (a) { a.remove(); return; }
    im.style.visibility = 'hidden';
  };

  // ---------- md5 (for Commons thumbnail paths) ----------
  function md5(str) {
    function rh(n) { var s = '', j; for (j = 0; j <= 3; j++) s += ((n >> (j * 8 + 4)) & 15).toString(16) + ((n >> (j * 8)) & 15).toString(16); return s; }
    function ad(x, y) { var l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cm(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cm((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cm((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cm(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cm(c ^ (b | (~d)), a, b, x, s, t); }
    str = unescape(encodeURIComponent(str));
    var n = ((str.length + 8) >> 6) + 1, x = new Array(n * 16), i;
    for (i = 0; i < n * 16; i++) x[i] = 0;
    for (i = 0; i < str.length; i++) x[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
    x[i >> 2] |= 0x80 << ((i % 4) * 8); x[n * 16 - 2] = str.length * 8;
    var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (i = 0; i < x.length; i += 16) {
      var oa = a, ob = b, oc = c, od = d;
      a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606); c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = ad(a, oa); b = ad(b, ob); c = ad(c, oc); d = ad(d, od);
    }
    return rh(a) + rh(b) + rh(c) + rh(d);
  }
  function thumb(f, w) {
    if (!f) return '';
    f = f.replace(/ /g, '_'); f = f.charAt(0).toUpperCase() + f.slice(1);
    var h = md5(f), q = encodeURIComponent(f).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')').replace(/'/g, '%27');
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + h[0] + '/' + h.slice(0, 2) + '/' + q + '/' + w + 'px-' + q + (/\.svg$/i.test(f) ? '.png' : '');
  }
  window.tvThumb = thumb;

  // ---------- index (lazy) ----------
  var IDX = null, idxP = null;
  var TY = { c: 'City / town', p: 'Park', r: 'Region', d: 'Neighborhood', u: 'Rural area', a: 'Airport', o: 'Other' };
  function getIndex() {
    if (IDX) return Promise.resolve(IDX);
    if (!idxP) idxP = fetch('/travel/assets/index.json').then(function (r) { return r.json(); }).then(function (d) {
      IDX = d.p.map(function (r) { return { n: r[0], s: r[1], st: r[2], ty: r[3], la: r[4], lo: r[5], f: r[6], k: r[7] || 0, full: r[8] || r[0] }; });
      IDX.states = d.s; return IDX;
    });
    return idxP;
  }
  window.tvIndex = getIndex; window.tvTypes = TY;
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function search(q, list, max) {
    q = norm(q.trim()); if (!q) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i], n = norm(r.n), full = norm(r.full + ' ' + (list.states[r.st] || '') + ' ' + r.st);
      var sc = n === q ? 100 : n.indexOf(q) === 0 ? 80 : (' ' + n).indexOf(' ' + q) >= 0 ? 60 : full.indexOf(q) >= 0 ? 30 : -1;
      if (sc < 0) { var words = q.split(/\s+/), ok = true; for (var j = 0; j < words.length; j++) if (full.indexOf(words[j]) < 0) { ok = false; break; } if (ok) sc = 20; }
      if (sc >= 0) out.push([sc + Math.min(r.k, 400) / 40 + (r.ty === 'c' || r.ty === 'p' ? 3 : 0), r]);
    }
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.slice(0, max || 20).map(function (x) { return x[1]; });
  }
  window.tvSearch = search;
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  window.tvEsc = esc;

  // ---------- search suggestions (NN/g + Baymard guidance) ----------
  function hiName(name, q) {
    var n = norm(name), i = n.indexOf(norm(q.trim()));
    if (i < 0) return '<b class="tv-hit">' + esc(name) + '</b>';
    var L = q.trim().length;   // typed part plain, the predicted part bold
    return '<b class="tv-hit">' + esc(name.slice(0, i)) + '</b><span>' + esc(name.slice(i, i + L)) + '</span><b class="tv-hit">' + esc(name.slice(i + L)) + '</b>';
  }
  var dim = null;
  function setDim(on) {
    if (on && !dim) { dim = document.createElement('div'); dim.className = 'tv-sdim'; document.body.appendChild(dim); dim.addEventListener('click', function () { document.querySelectorAll('.tv-sugg').forEach(function (x) { x.hidden = true; }); setDim(false); }); }
    if (!on && dim) { dim.remove(); dim = null; }
  }
  document.querySelectorAll('.tv-search, .tv-bigsearch').forEach(function (form) {
    var inp = form.querySelector('input'), box = form.querySelector('.tv-sugg'), sel = -1, typed = '', res = [];
    if (!inp || !box) return;
    function close() { box.hidden = true; setDim(false); sel = -1; }
    inp.addEventListener('focus', getIndex);
    inp.addEventListener('input', function () {
      typed = inp.value; sel = -1;
      if (typed.trim().length < 2) { close(); return; }
      getIndex().then(function (list) {
        res = search(typed, list, window.innerWidth < 600 ? 5 : 8);
        if (!res.length) { box.innerHTML = '<a href="/travel/search/?q=' + encodeURIComponent(typed) + '">No place called “' + esc(typed) + '” yet — search all places</a>'; box.hidden = false; setDim(true); return; }
        box.innerHTML = res.map(function (r) {
          return '<a href="/travel/' + r.s + '/">' + (r.f ? '<img src="' + thumb(r.f, 120) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<span class="ph"></span>') +
            '<span>' + hiName(r.n, typed) + '<small>' + esc(TY[r.ty] || '') + ' · ' + esc(list.states[r.st] || r.st) + '</small></span></a>';
        }).join('') + '<a href="/travel/search/?q=' + encodeURIComponent(typed) + '"><span>See all results for “' + esc(typed) + '”</span></a>';
        box.hidden = false; setDim(true);
      });
    });
    inp.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('a'); if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length + 1) % (items.length + 1) - 0;
        if (sel === items.length) sel = -1;   // loop back to what was typed
        items.forEach(function (a, i) { a.classList.toggle('on', i === sel); });
        inp.value = sel >= 0 && res[sel] ? res[sel].n : typed;
      } else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); location.href = items[sel].href; }
      else if (e.key === 'Escape') { e.preventDefault(); inp.value = typed; close(); }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target) && e.target !== dim) close(); });
  });

  // ---------- visited markers on cards ----------
  function paintVisited() {
    var all = load(), st = {};
    Object.keys(all).forEach(function (k) { if (all[k].visited) st[all[k].st] = 1; });
    document.querySelectorAll('.tv-pc[data-slug]').forEach(function (c) { c.classList.toggle('is-visited', !!(all[c.dataset.slug] && all[c.dataset.slug].visited)); });
    document.querySelectorAll('.tv-sc[data-st]').forEach(function (c) { c.classList.toggle('is-visited', !!st[c.dataset.st]); });
  }
  window.tvPaintVisited = paintVisited;
  paintVisited();

  // ---------- journal on place pages ----------
  var J = document.querySelector('.tv-journal');
  if (J) {
    var slug = J.dataset.slug;
    var meta = { title: J.dataset.title, st: J.dataset.st, lat: parseFloat(J.dataset.lat) || null, lon: parseFloat(J.dataset.lon) || null };
    var fields = J.querySelectorAll('input[name], textarea[name], select[name]');
    var stars = J.querySelectorAll('.tv-rate button');
    var status = J.querySelector('.tv-saved');
    var qvs = document.querySelectorAll('.tv-quickvisit');
    function entry() { return load()[slug] || {}; }
    function fill() {
      var e = entry();
      fields.forEach(function (f) { if (f.type === 'checkbox') f.checked = !!e[f.name]; else f.value = e[f.name] || ''; });
      stars.forEach(function (b) { b.classList.toggle('on', +b.dataset.v <= (e.rating || 0)); });
      qvs.forEach(function (qv) { qv.classList.toggle('is-on', !!e.visited); qv.textContent = qv.classList.contains('tv-mb') ? '✓ Visited' : (e.visited ? '✓ Visited' : '✓ Mark visited'); });
      document.querySelectorAll('.tv-want').forEach(function (b) { var on = (e.want || []).indexOf(b.dataset.item) >= 0; b.classList.toggle('is-on', on); b.textContent = on ? '★ Want to go' : '☆ Want to go'; });
    }
    var timer;
    function store(patch) {
      var all = load(), e = all[slug] || {};
      Object.keys(patch).forEach(function (k) { e[k] = patch[k]; });
      Object.keys(meta).forEach(function (k) { e[k] = meta[k]; });
      e.updated = new Date().toISOString();
      all[slug] = e;
      var ok = save(all);
      if (status) { status.textContent = ok ? 'Saved ✓' : 'Could not save — is private browsing on?'; clearTimeout(timer); timer = setTimeout(function () { status.textContent = ''; }, 1800); }
      fill();
    }
    fields.forEach(function (f) {
      f.addEventListener(f.type === 'checkbox' || f.tagName === 'SELECT' || f.type === 'date' ? 'change' : 'input', function () {
        var p = {}; p[f.name] = f.type === 'checkbox' ? f.checked : f.value;
        if (f.type === 'checkbox' && f.name === 'visited' && f.checked && !entry().date) p.date = new Date().toISOString().slice(0, 10);
        clearTimeout(f._t); f._t = setTimeout(function () { store(p); }, f.tagName === 'TEXTAREA' || f.type === 'text' ? 400 : 0);
      });
    });
    stars.forEach(function (b) { b.addEventListener('click', function () { var v = +b.dataset.v; store({ rating: entry().rating === v ? 0 : v }); }); });
    qvs.forEach(function (qv) { qv.addEventListener('click', function () { var v = !entry().visited; var p = { visited: v }; if (v && !entry().date) p.date = new Date().toISOString().slice(0, 10); store(p); }); });
    document.querySelectorAll('.tv-want').forEach(function (b) {
      b.addEventListener('click', function () {
        var w = (entry().want || []).slice(), i = w.indexOf(b.dataset.item);
        if (i >= 0) w.splice(i, 1); else w.push(b.dataset.item);
        store({ want: w });
      });
    });
    var clr = J.querySelector('.tv-jclear');
    if (clr) clr.addEventListener('click', function () {
      if (!window.confirm('Clear your notes for this place?')) return;
      var all = load(); delete all[slug]; save(all); fill();
    });
    fill();
  }

  // ---------- lightbox ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lb]'); if (!a) return;
    e.preventDefault();
    var lb = document.createElement('div'); lb.className = 'tv-lb';
    lb.innerHTML = '<button aria-label="Close">×</button><img src="' + a.dataset.lb + '" alt="" onerror="tvImgErr(this)" data-full="' + (a.querySelector('img') ? a.querySelector('img').dataset.full : '') + '">' +
      '<p>' + esc(a.dataset.cap || '') + ' <a href="' + a.href + '" target="_blank" rel="noopener">Photo credit &amp; license</a></p>';
    lb.addEventListener('click', function (ev) { if (ev.target === lb || ev.target.tagName === 'BUTTON') lb.remove(); });
    document.addEventListener('keydown', function k(ev) { if (ev.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', k); } });
    document.body.appendChild(lb);
  });

  // ---------- listing map on place pages (lazy) ----------
  function whenLeaflet(cb) {
    if (window.L) return cb();
    var n = 0, t = setInterval(function () { if (window.L || ++n > 100) { clearInterval(t); if (window.L) cb(); } }, 100);
  }
  window.tvWhenLeaflet = whenLeaflet;
  function tiles(map) {
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  }
  window.tvTiles = tiles;
  var lmap = document.querySelector('.tv-lmap:not(.tv-jmap)');
  if (lmap && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      if (!ents[0].isIntersecting) return; io.disconnect();
      whenLeaflet(function () {
        var L = window.L, m = L.map(lmap, { scrollWheelZoom: false }); tiles(m);
        var col = { see: '#2dd4f5', do: '#8fb8ff', eat: '#f5c04a', drink: '#f59e0b', sleep: '#a87cf7', buy: '#f472b6', go: '#94a3b8', listing: '#94a3b8' };
        var pts = [];
        document.querySelectorAll('.tv-listing[data-lat]').forEach(function (el) {
          var la = +el.dataset.lat, lo = +el.dataset.lon; if (!la || !lo) return;
          var mk = L.circleMarker([la, lo], { radius: 7, weight: 2, color: '#fff', fillColor: col[el.dataset.kind] || '#94a3b8', fillOpacity: .95 }).addTo(m);
          var g = el.querySelector('.tv-acts .tv-maps');
          mk.bindPopup('<b>' + esc(el.dataset.name) + '</b><br>' + (g ? g.outerHTML.replace('tv-btn tv-btn-sm', 'tv-link').replace(/<svg.*?<\/svg>/, '').replace('>Maps<', '>Open in Maps<') : ''));
          pts.push([la, lo]);
        });
        if (pts.length) m.fitBounds(pts, { padding: [24, 24], maxZoom: 15 });
        else if (lmap.dataset.center) m.setView(lmap.dataset.center.split(',').map(Number), 11);
      });
    }, { rootMargin: '200px' });
    io.observe(lmap);
  }

  // ---------- maps app chooser ----------
  var MKEY = 'tv-maps-app';
  var APPS = [
    { id: 'google', name: 'Google Maps', bg: '#1a73e8', ic: 'G' },
    { id: 'apple', name: 'Apple Maps', bg: '#34c759', ic: 'A' },
    { id: 'waze', name: 'Waze', bg: '#33ccff', ic: 'W' }
  ];
  if (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)) APPS.unshift(APPS.splice(1, 1)[0]);
  function enc(s) { return encodeURIComponent(s || ''); }
  function mapUrl(id, d) {
    var q = d.q, ll = d.ll, fr = d.from;
    if (id === 'apple') return fr ? 'https://maps.apple.com/?saddr=' + enc(fr) + '&daddr=' + enc(q) : 'https://maps.apple.com/?q=' + enc(q) + (ll ? '&ll=' + ll : '');
    if (id === 'waze') return ll ? 'https://waze.com/ul?ll=' + ll + '&navigate=yes' : 'https://waze.com/ul?q=' + enc(q) + '&navigate=yes';
    return fr ? 'https://www.google.com/maps/dir/?api=1&origin=' + enc(fr) + '&destination=' + enc(q) : 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  }
  function pref() { try { return localStorage.getItem(MKEY) || ''; } catch (e) { return ''; } }
  function setPref(v) { try { if (v) localStorage.setItem(MKEY, v); else localStorage.removeItem(MKEY); } catch (e) {} paintPref(); }
  function go(id, d) { var w = window.open(mapUrl(id, d), '_blank', 'noopener'); if (!w) location.href = mapUrl(id, d); }
  function closeMenu() { document.querySelectorAll('.tv-mapmenu,.tv-mapback').forEach(function (x) { x.remove(); }); }
  function openMenu(btn, d) {
    closeMenu();
    var back = document.createElement('div'); back.className = 'tv-mapback';
    var m = document.createElement('div'); m.className = 'tv-mapmenu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Open in which maps app?');
    m.innerHTML = '<p>Open in</p>' + APPS.map(function (a) {
      return '<a href="' + mapUrl(a.id, d) + '" data-app="' + a.id + '" target="_blank" rel="noopener"><span class="tv-mi" style="background:' + a.bg + '">' + a.ic + '</span>' + a.name + '</a>';
    }).join('') + '<label><input type="checkbox" id="tv-mrem"> Always use this app</label>';
    document.body.appendChild(back); document.body.appendChild(m);
    var r = btn.getBoundingClientRect(), mh = m.offsetHeight, mw = m.offsetWidth;
    var top = r.bottom + 8; if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 8);
    m.style.top = top + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + 'px';
    back.addEventListener('click', closeMenu);
    m.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-app]'); if (!a) return;
      if (m.querySelector('#tv-mrem').checked) setPref(a.dataset.app);
      setTimeout(closeMenu, 50);
    });
    var first = m.querySelector('a'); if (first) first.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.tv-maps'); if (!b || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    var d = { q: b.dataset.q, ll: b.dataset.ll, from: b.dataset.from };
    var p = pref();
    if (p) go(p, d); else openMenu(b, d);
  });
  function paintPref() {
    document.querySelectorAll('.tv-mappref').forEach(function (el) {
      var p = pref(), app = APPS.filter(function (a) { return a.id === p; })[0];
      el.innerHTML = 'Maps app: <b>' + (app ? app.name : 'ask every time') + '</b>' + (app ? ' · <a href="#" class="tv-mapreset">ask every time</a>' : '');
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('.tv-mapreset')) { e.preventDefault(); setPref(''); } });
  paintPref();

  // ---------- on-this-page: collapsed on phones, highlights where you are ----------
  var toc = document.querySelector('details.tv-toc');
  if (toc) {
    if (window.innerWidth < 900) toc.removeAttribute('open');
    toc.addEventListener('click', function (e) { if (e.target.closest('a') && window.innerWidth < 900) toc.removeAttribute('open'); });
    var tl = {}; toc.querySelectorAll('a[href^="#"]').forEach(function (a) { tl[a.getAttribute('href').slice(1)] = a; });
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting && tl[en.target.id]) { Object.keys(tl).forEach(function (k) { tl[k].classList.remove('on'); }); tl[en.target.id].classList.add('on'); } });
      }, { rootMargin: '-30% 0px -60% 0px' });
      Object.keys(tl).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
    }
  }

  // ---------- long listing sections: show 8, then "Show all" ----------
  document.querySelectorAll('.tv-sec-list').forEach(function (sec) {
    var ls = sec.querySelectorAll('.tv-listing'); if (ls.length <= 10) return;
    for (var i = 8; i < ls.length; i++) ls[i].classList.add('tv-hide');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tv-btn tv-ghost tv-more';
    b.textContent = 'Show all ' + ls.length + ' in ' + (sec.querySelector('h2') ? sec.querySelector('h2').textContent : 'this section');
    b.addEventListener('click', function () { sec.querySelectorAll('.tv-hide').forEach(function (x) { x.classList.remove('tv-hide'); }); b.remove(); });
    sec.appendChild(b);
  });
  // a link to a hidden listing (e.g. from the map) reveals it
  document.addEventListener('click', function (e) { var a = e.target.closest('a[href^="#"]'); if (!a) return; var t = document.getElementById(a.getAttribute('href').slice(1)); if (t && t.classList.contains('tv-hide')) t.classList.remove('tv-hide'); });

  // ---------- home: this month's picks follow the visitor's own date ----------
  var mg = document.querySelectorAll('.tv-mgrid');
  if (mg.length) {
    var mm = new Date().getMonth();
    mg.forEach(function (g) { g.hidden = +g.dataset.m !== mm; });
    var mn = document.querySelector('.tv-month'); if (mn) mn.textContent = new Date().toLocaleString('en-US', { month: 'long' });
  }

  // ---------- journal entries follow renamed places ----------
  (function () {
    var all = load(); if (!Object.keys(all).length) return;
    fetch('/travel/assets/aliases.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (al) {
      var cur = load(), moved = 0;
      Object.keys(al).forEach(function (o) { if (cur[o] && !cur[al[o]]) { cur[al[o]] = cur[o]; delete cur[o]; moved++; } });
      if (moved) save(cur);
    }).catch(function () {});
  })();
})();

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var RAD = Math.PI / 180;
  var state = { k: 5, weighting: 'population', lpi: 0, locked: [] };
  var data = null, result = null, reqId = 0, nameIndex = {};
  var canvas = $('globe'), ctx = canvas.getContext('2d'), status = $('status');
  var view = { lon: 15, lat: 18 };
  var fmt = function (n, d) { return n.toLocaleString(undefined, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var label = function (i) { return data.cities[i][0] + ', ' + data.cities[i][1]; };

  // ---------- Controls ----------
  $('k').addEventListener('input', function (e) { state.k = +e.target.value; sync(); schedule(); });
  $('lpi').addEventListener('input', function (e) { state.lpi = +e.target.value / 10; sync(); schedule(); });
  document.querySelectorAll('#weight-buttons button').forEach(function (b) {
    b.addEventListener('click', function () { state.weighting = b.dataset.weight; sync(); run(); });
  });
  $('lock-add').addEventListener('click', addLock);
  $('lock-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLock(); } });
  $('reset').addEventListener('click', function () { state = { k: 5, weighting: 'population', lpi: 0, locked: [] }; $('lock-msg').textContent = 'Force a site you already own; the optimizer places the rest around it.'; sync(); run(); });

  function addLock() {
    var v = $('lock-input').value.trim(), idx = nameIndex[v.toLowerCase()];
    if (idx === undefined) {
      // allow just the city name if it's unique
      var hits = data.cities.map(function (c, i) { return c[0].toLowerCase() === v.toLowerCase() ? i : -1; }).filter(function (i) { return i >= 0; });
      if (hits.length === 1) idx = hits[0];
    }
    if (idx === undefined) { $('lock-msg').textContent = v ? 'Pick a city from the list: "' + v + '" isn’t one of the 1,000 cities.' : 'Type a city name first.'; return; }
    if (state.locked.indexOf(idx) >= 0) { $('lock-msg').textContent = label(idx) + ' is already locked.'; return; }
    if (state.locked.length >= state.k) { $('lock-msg').textContent = 'You’ve locked as many cities as there are centers. Add a center or remove a city first.'; return; }
    state.locked.push(idx); $('lock-input').value = '';
    $('lock-msg').textContent = 'Locked ' + label(idx) + '. The optimizer places the rest around it.';
    sync(); run();
  }

  function sync() {
    $('k').value = state.k; $('k-out').textContent = state.k;
    $('lpi').value = Math.round(state.lpi * 10);
    $('lpi-out').textContent = state.lpi === 0 ? 'Off' : state.lpi < 0.4 ? 'Light' : state.lpi < 0.8 ? 'Medium' : 'Strong';
    document.querySelectorAll('#weight-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.weight === state.weighting)); });
    var ul = $('locked'); ul.innerHTML = '';
    state.locked.forEach(function (idx) {
      var li = document.createElement('li'); li.textContent = data ? label(idx) : '';
      var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Unlock ' + (data ? label(idx) : '')); x.textContent = '×';
      x.addEventListener('click', function () { state.locked = state.locked.filter(function (i) { return i !== idx; }); sync(); run(); });
      li.appendChild(x); ul.appendChild(li);
    });
  }

  // ---------- Solver ----------
  var worker = new Worker('distribution-worker.js?v=1'), timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 150); }
  function run() {
    var id = ++reqId;
    if (result) canvas.style.opacity = '0.65'; else status.textContent = 'Solving…';
    worker.postMessage({ id: id, opts: { k: state.k, weighting: state.weighting, lpiFactor: state.lpi, locked: state.locked.slice() } });
  }
  worker.onmessage = function (e) {
    var r = e.data; if (r.id !== reqId) return;
    canvas.style.opacity = '1';
    if (r.error) { status.textContent = 'Couldn’t load the city data (' + r.error + '). Reload the page to try again.'; return; }
    status.textContent = ''; result = r;
    $('avg').textContent = fmt(r.avgKm) + ' km';
    $('far').textContent = fmt(r.farShare * 100, r.farShare < 0.1 ? 1 : 0) + '%';
    $('time').textContent = r.ms < 1000 ? fmt(r.ms) + ' ms' : fmt(r.ms / 1000, 1) + ' s';
    $('passes').textContent = r.passes + ' improvement passes';
    if (!view.focused) { focusOn(r.centers); view.focused = true; }
    draw(); fillTable();
  };
  worker.onerror = function () { status.textContent = 'The demo couldn’t start in this browser.'; };

  fetch('data/distribution.json?v=1').then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    var dl = $('city-list'), frag = document.createDocumentFragment();
    d.cities.forEach(function (c, i) { var s = c[0] + ', ' + c[1]; nameIndex[s.toLowerCase()] = i; var o = document.createElement('option'); o.value = s; frag.appendChild(o); });
    dl.appendChild(frag);
    draw();
  });

  function focusOn(centers) {
    var x = 0, y = 0, z = 0;
    centers.forEach(function (i) { var c = data.cities[i], la = c[2] * RAD, lo = c[3] * RAD; x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la); });
    view.lon = Math.atan2(y, x) / RAD; view.lat = Math.max(-50, Math.min(50, Math.atan2(z, Math.hypot(x, y)) / RAD));
  }

  // ---------- Globe ----------
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function project(lat, lon, R, cx, cy) {
    var p = lat * RAD, l = (lon - view.lon) * RAD, p0 = view.lat * RAD;
    var cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    return { x: cx + R * Math.cos(p) * Math.sin(l), y: cy - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), v: cosc > 0 };
  }
  function arc(a, b, R, cx, cy) {   // great-circle points between two cities
    var la1 = a[2] * RAD, lo1 = a[3] * RAD, la2 = b[2] * RAD, lo2 = b[3] * RAD;
    var A = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
    var B = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), om = Math.acos(dot), steps = Math.max(2, Math.ceil(om / 0.06)), pts = [];
    for (var s = 0; s <= steps; s++) {
      var t = s / steps, k1 = om ? Math.sin((1 - t) * om) / Math.sin(om) : 1 - t, k2 = om ? Math.sin(t * om) / Math.sin(om) : t;
      var x = k1 * A[0] + k2 * B[0], y = k1 * A[1] + k2 * B[1], z = k1 * A[2] + k2 * B[2];
      pts.push(project(Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD, R, cx, cy));
    }
    return pts;
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var R = Math.min(W, H) / 2 - 8, cx = W / 2, cy = H / 2;

    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = css('--surface-2'); ctx.fill();
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.stroke();
    if (!data) return;

    // graticule
    ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
    for (var g = -150; g <= 180; g += 30) polyline(Array.from({ length: 37 }, function (_, i) { return [-90 + i * 5, g]; }));
    for (var gl = -60; gl <= 60; gl += 30) polyline(Array.from({ length: 73 }, function (_, i) { return [gl, -180 + i * 5]; }));
    function polyline(pts) {
      ctx.beginPath(); var pen = false;
      pts.forEach(function (p) { var q = project(p[0], p[1], R, cx, cy); if (q.v) { if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); pen = true; } else pen = false; });
      ctx.stroke();
    }
    // coastlines
    ctx.strokeStyle = css('--text-faint'); ctx.globalAlpha = 0.55; ctx.lineWidth = 0.8;
    data.land.forEach(function (ring) { polyline(ring.map(function (p) { return [p[1], p[0]]; })); });
    ctx.globalAlpha = 1;

    var c = data.cities, maxPop = c[0][4];
    if (result) {
      // service lines
      ctx.strokeStyle = css('--series-1'); ctx.globalAlpha = 0.28; ctx.lineWidth = 0.8;
      for (var i = 0; i < c.length; i++) {
        var pts = arc(c[i], c[result.centers[result.assign[i]]], R, cx, cy);
        ctx.beginPath(); var pen = false;
        pts.forEach(function (q) { if (q.v) { if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); pen = true; } else pen = false; });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // cities
    ctx.fillStyle = css('--series-ink'); ctx.globalAlpha = 0.6;
    for (var j = c.length - 1; j >= 0; j--) {
      var q = project(c[j][2], c[j][3], R, cx, cy); if (!q.v) continue;
      ctx.beginPath(); ctx.arc(q.x, q.y, 0.8 + 3.2 * Math.sqrt(c[j][4] / maxPop), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // centers
    if (result) {
      ctx.font = '600 12px ' + css('--font-body'); ctx.textBaseline = 'middle';
      result.centers.forEach(function (idx) {
        var q = project(c[idx][2], c[idx][3], R, cx, cy); if (!q.v) return;
        ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = css('--series-1'); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = css('--surface'); ctx.stroke();
        var t = c[idx][0], tw = ctx.measureText(t).width, tx = q.x + 10 + tw > W - 4 ? q.x - 10 - tw : q.x + 10;
        ctx.lineWidth = 4; ctx.strokeStyle = css('--surface'); ctx.strokeText(t, tx, q.y);
        ctx.fillStyle = css('--text'); ctx.fillText(t, tx, q.y);
      });
    }
  }

  function fillTable() {
    var rows = result.centers.map(function (idx, m) { return { idx: idx, share: result.share[m] }; })
      .sort(function (a, b) { return b.share - a.share; });
    var max = rows[0].share;
    $('sites').querySelector('tbody').innerHTML = rows.map(function (r) {
      var ci = data.cities[r.idx], locked = state.locked.indexOf(r.idx) >= 0;
      return '<tr><td>' + ci[0] + (locked ? '<span class="lock-tag">locked</span>' : '') + '</td><td>' + ci[1] + '</td>' +
        '<td><div class="bar"><span class="track"><span class="fill" style="width:' + (r.share / max * 100).toFixed(1) + '%"></span></span><b>' + fmt(r.share * 100, 1) + '%</b></div></td></tr>';
    }).join('');
  }

  // drag to rotate
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var s = 180 / (canvas.clientWidth || 400);
    view.lon = drag.lon - (e.clientX - drag.x) * s; view.lat = Math.max(-80, Math.min(80, drag.lat + (e.clientY - drag.y) * s));
    requestAnimationFrame(draw);
  });
  ['pointerup', 'pointercancel'].forEach(function (t) { canvas.addEventListener(t, function () { drag = null; }); });

  new ResizeObserver(function () { draw(); }).observe(canvas);
  new MutationObserver(function () { draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var mq = window.matchMedia('(prefers-color-scheme: light)'); if (mq.addEventListener) mq.addEventListener('change', draw);

  sync(); run();
})();

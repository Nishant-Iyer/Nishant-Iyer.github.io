(function () {
  'use strict';

  var WELLS = [
    { id: '000d7d20', label: 'Well 1' },
    { id: '00bbac68', label: 'Well 2' },
    { id: '00e12e8b', label: 'Well 3' }
  ];
  // Default "known" share of each well (from the competition data).
  var DEFAULT_KNOWN = { '000d7d20': 27, '00bbac68': 20, '00e12e8b': 33 };

  var state = { well: WELLS[0].id, knownPct: DEFAULT_KNOWN[WELLS[0].id], knownExact: true, smoothSlider: 50, window: 30 };
  var result = null, reqId = 0;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('chart'), ctx = canvas.getContext('2d'), tip = $('tip'), status = $('status');
  var fmt = function (n, d) { return n.toLocaleString(undefined, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var smoothValue = function (v) { return 0.5 * Math.pow(400, v / 100); }; // 0.5 .. 200, 10 at the midpoint

  // ---------- Controls ----------
  var wellBox = $('well-buttons');
  WELLS.forEach(function (w) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = w.label; b.dataset.well = w.id; b.title = 'Well ' + w.id;
    b.setAttribute('aria-pressed', String(w.id === state.well));
    b.addEventListener('click', function () {
      state.well = w.id; state.knownPct = DEFAULT_KNOWN[w.id]; state.knownExact = true;
      syncControls(); run();
    });
    wellBox.appendChild(b);
  });
  document.querySelectorAll('#window-buttons button').forEach(function (b) {
    b.addEventListener('click', function () { state.window = +b.dataset.window; syncControls(); run(); });
  });
  $('known').addEventListener('input', function (e) { state.knownPct = +e.target.value; state.knownExact = false; syncControls(); schedule(); });
  $('smooth').addEventListener('input', function (e) { state.smoothSlider = +e.target.value; syncControls(); schedule(); });
  $('reset').addEventListener('click', function () {
    state.knownPct = DEFAULT_KNOWN[state.well]; state.knownExact = true; state.smoothSlider = 50; state.window = 30; syncControls(); run();
  });

  function syncControls() {
    wellBox.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.well === state.well)); });
    document.querySelectorAll('#window-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.window === state.window)); });
    $('known').value = state.knownPct;
    $('smooth').value = state.smoothSlider;
    $('known-out').textContent = state.knownPct + '%';
    $('smooth-out').textContent = fmt(smoothValue(state.smoothSlider), smoothValue(state.smoothSlider) < 10 ? 1 : 0);
  }

  // ---------- Worker ----------
  var worker = new Worker('wellbore-worker.js?v=1');
  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 120); }
  function run() {
    var id = ++reqId;
    status.textContent = result ? '' : 'Running the model…';
    canvas.style.opacity = result ? '0.6' : '1';
    worker.postMessage({ id: id, well: state.well, opts: {
      knownEnd: state.knownExact ? null : Math.round(state.knownPct / 100 * pointCount(state.well)),
      smoothness: smoothValue(state.smoothSlider), window: state.window
    } });
  }
  var counts = {};
  function pointCount(well) { return counts[well] || ({ '000d7d20': 5278, '00bbac68': 7559, '00e12e8b': 6384 })[well]; }

  worker.onmessage = function (e) {
    var r = e.data;
    if (r.id !== reqId) return;               // a newer run is on its way
    canvas.style.opacity = '1';
    if (r.error) { status.textContent = 'Couldn’t load the well data (' + r.error + '). Reload the page to try again.'; return; }
    status.textContent = '';
    counts[r.well] = r.md.length;
    result = r;
    $('rmse').textContent = fmt(r.rmse, 1) + ' ft';
    $('base').textContent = fmt(r.baselineRmse, 1) + ' ft';
    var gain = 1 - r.rmse / r.baselineRmse;
    $('gain').textContent = fmt(Math.abs(gain) * 100, 0) + '% ' + (gain >= 0 ? 'lower' : 'higher');
    $('gain').classList.toggle('good', gain >= 0);
    $('points').textContent = fmt(r.evalPoints) + ' ft predicted';
    draw(); fillTable();
  };
  worker.onerror = function () { status.textContent = 'The demo couldn’t start in this browser.'; };

  // ---------- Chart ----------
  var hoverIdx = null, geom = null;
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
  }

  function draw() {
    if (!result) return;
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

    var r = result, n = r.md.length, i;
    var actual = new Float64Array(n), pred = new Float64Array(n), lo = Infinity, hi = -Infinity;
    for (i = 0; i < n; i++) {
      actual[i] = r.tvt[i] - r.ref[i]; pred[i] = r.pred[i] - r.ref[i];
      lo = Math.min(lo, actual[i], pred[i], 0); hi = Math.max(hi, actual[i], pred[i], 0);
    }
    var pad = (hi - lo) * 0.08 || 5; lo -= pad; hi += pad;
    var m = { l: 48, r: 14, t: 10, b: 34 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var x0 = r.md[0], x1 = r.md[n - 1];
    var X = function (v) { return m.l + (v - x0) / (x1 - x0) * pw; };
    var Y = function (v) { return m.t + (1 - (v - lo) / (hi - lo)) * ph; };
    geom = { X: X, Y: Y, m: m, pw: pw, ph: ph, actual: actual, pred: pred, x0: x0, x1: x1 };

    var ink = css('--text-faint'), grid = css('--grid');
    ctx.font = '12px ' + (css('--font-body') || 'sans-serif'); ctx.fillStyle = ink;

    // known-data shading
    ctx.fillStyle = css('--shade');
    ctx.fillRect(m.l, m.t, X(r.md[r.knownEnd - 1]) - m.l, ph);

    // grid + y ticks
    var ys = niceStep(hi - lo, 5);
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) {
      var y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      ctx.fillText((v > 0 ? '+' : '') + fmt(v), m.l - 8, y);
    }
    // x ticks
    var xs = niceStep(x1 - x0, 6); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var xv = Math.ceil(x0 / xs) * xs; xv <= x1; xv += xs) ctx.fillText(fmt(xv), X(xv), m.t + ph + 8);
    ctx.textAlign = 'left'; ctx.fillText('Measured depth along the well (ft)', m.l, m.t + ph + 22 > H - 12 ? H - 12 : m.t + ph + 22);
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ft deeper than baseline', 0, 0); ctx.restore();

    // "prediction starts" marker
    var kx = Math.round(X(r.md[r.knownEnd - 1])) + 0.5;
    ctx.strokeStyle = ink; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(kx, m.t); ctx.lineTo(kx, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = ink; ctx.fillText('Prediction starts', kx + 6, m.t + 4);

    function line(arr, color, dash, width) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineJoin = 'round'; ctx.beginPath();
      for (var k = 0; k < n; k++) { var px = X(r.md[k]), py = Y(arr[k]); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    var zero = new Float64Array(n);
    line(zero, css('--series-2'), [6, 4], 2);
    line(actual, css('--series-ink'), null, 2);
    line(pred, css('--series-1'), null, 2);

    if (hoverIdx !== null) drawHover();
  }

  function drawHover() {
    var g = geom, r = result, i = hoverIdx, x = g.X(r.md[i]);
    ctx.strokeStyle = css('--text-faint'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, g.m.t); ctx.lineTo(Math.round(x) + 0.5, g.m.t + g.ph); ctx.stroke();
    [[g.actual[i], '--series-ink'], [g.pred[i], '--series-1'], [0, '--series-2']].forEach(function (p) {
      ctx.beginPath(); ctx.arc(x, g.Y(p[0]), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = css(p[1]); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = css('--surface'); ctx.stroke();
    });
  }

  function onMove(ev) {
    if (!result || !geom) return;
    var rect = canvas.getBoundingClientRect(), px = ev.clientX - rect.left;
    if (px < geom.m.l || px > geom.m.l + geom.pw) { onLeave(); return; }
    var md = geom.x0 + (px - geom.m.l) / geom.pw * (geom.x1 - geom.x0);
    var arr = result.md, lo = 0, hi = arr.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (arr[mid] <= md) lo = mid; else hi = mid; }
    hoverIdx = (md - arr[lo] < arr[hi] - md) ? lo : hi;
    draw();
    var i = hoverIdx, a = geom.actual[i], p = geom.pred[i], known = i < result.knownEnd;
    tip.innerHTML =
      '<div class="t-head">' + fmt(result.md[i]) + ' ft along the well' + (known ? ' (known)' : '') + '</div>' +
      row('Actual', a, '--series-ink') + row('Path matching', p, '--series-1') + row('Baseline', 0, '--series-2') +
      '<div class="t-row"><span>Error</span><span>' + fmt(Math.abs(p - a), 1) + ' ft</span></div>';
    tip.hidden = false;
    var tx = Math.min(px + 14, rect.width - tip.offsetWidth - 4);
    if (px + 14 + tip.offsetWidth > rect.width) tx = px - tip.offsetWidth - 14;
    tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = (geom.m.t + 8) + 'px';
  }
  function row(name, v, token) {
    return '<div class="t-row"><span><i class="sw" style="border-color:var(' + token + ')"></i>' + name + '</span><span>' + (v > 0 ? '+' : '') + fmt(v, 1) + ' ft</span></div>';
  }
  function onLeave() { hoverIdx = null; tip.hidden = true; draw(); }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  function fillTable() {
    var r = result, n = r.md.length, step = Math.max(1, Math.round(n / 25)), rows = [];
    for (var i = 0; i < n; i += step) {
      var a = r.tvt[i] - r.ref[i], p = r.pred[i] - r.ref[i];
      rows.push('<tr><td>' + fmt(r.md[i]) + (i < r.knownEnd ? ' (known)' : '') + '</td><td>' + fmt(a, 1) + '</td><td>' + fmt(p, 1) + '</td><td>' + fmt(Math.abs(p - a), 1) + '</td></tr>');
    }
    document.querySelector('#table tbody').innerHTML = rows.join('');
  }

  // Redraw on resize and theme changes
  var ro = new ResizeObserver(function () { draw(); }); ro.observe(canvas);
  new MutationObserver(function () { draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var mq = window.matchMedia('(prefers-color-scheme: light)');
  if (mq.addEventListener) mq.addEventListener('change', draw);

  syncControls(); run();
})();

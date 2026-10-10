(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('chart'), ctx = canvas.getContext('2d'), tip = $('tip'), status = $('status');
  var fmt = function (n, d) { return n.toLocaleString(undefined, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var money = function (n) { return '$' + fmt(Math.round(n)); };

  var model = null, data = null, rows = null, typical = null, typicalErr = 1;
  var frauds = [], legits = [];
  var state = { kind: 1, pos: 0, amount: 0, blend: 100, thrIdx: 0, review: 5 };
  var cur = null; // current sample record

  Promise.all([
    fetch('data/fraud-model.json?v=1').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
    fetch('data/fraud-data.json?v=1').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  ]).then(function (res) {
    model = new FraudEngine.Model(res[0]);
    data = res[1];
    rows = data.cost_table.rows;              // [threshold, flagged, caught, missed_amount]
    state.review = data.review_cost;
    data.sample.forEach(function (s, i) { (s.y ? frauds : legits).push(i); });
    // typical legitimate purchase: per-feature median over the legitimate sample
    var n = data.input.length, aIdx = data.input.indexOf('Amount');
    typical = [];
    for (var j = 0; j < n; j++) {
      var col = legits.map(function (i) { return data.sample[i].x[j]; }).sort(function (a, b) { return a - b; });
      typical.push(col[col.length >> 1]);
    }
    var errs = legits.map(function (i) { return model.score(data.sample[i].x).recon; }).sort(function (a, b) { return a - b; });
    typicalErr = errs[errs.length >> 1];
    typical[aIdx] = null;
    $('thr').max = rows.length - 1;
    state.thrIdx = nearestRow(data.threshold);
    state.pos = pickStart();
    status.textContent = '';
    load(); syncControls(); update();
  }).catch(function (err) {
    status.textContent = 'Couldn’t load the model (' + (err && err.message || err) + '). Reload the page to try again.';
  });

  function nearestRow(t) {
    var best = 0, bd = Infinity;
    rows.forEach(function (r, i) { var d = Math.abs(Math.log(r[0]) - Math.log(t)); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // Start on a fraud the model catches, so the first view shows a flag.
  function pickStart() {
    var a = data.input.indexOf('Amount');
    for (var k = 0; k < frauds.length; k++) { var s = data.sample[frauds[k]]; if (s.p > 0.9 && s.x[a] >= 100) return k; }
    for (k = 0; k < frauds.length; k++) if (data.sample[frauds[k]].p > 0.9) return k;
    return 0;
  }
  function list() { return state.kind ? frauds : legits; }
  function load() {
    cur = data.sample[list()[state.pos % list().length]];
    state.amount = cur.x[data.input.indexOf('Amount')];
    state.blend = 100;
  }

  function costAt(i, review) { var r = rows[i]; return review * r[1] + data.fraud_cost_factor * r[3]; }
  function cheapest(review) {
    var best = 0, bc = Infinity;
    for (var i = 0; i < rows.length; i++) { var c = costAt(i, review); if (c < bc) { bc = c; best = i; } }
    return best;
  }

  // ---------- Controls ----------
  document.querySelectorAll('#kind-buttons button[data-kind]').forEach(function (b) {
    b.addEventListener('click', function () { state.kind = +b.dataset.kind; state.pos = 0; load(); syncControls(); update(); });
  });
  $('another').addEventListener('click', function () { if (!data) return; state.pos = (state.pos + 1) % list().length; load(); syncControls(); update(); });
  $('amount').addEventListener('input', function (e) { state.amount = +e.target.value; syncControls(); update(); });
  $('blend').addEventListener('input', function (e) { state.blend = +e.target.value; syncControls(); update(); });
  $('thr').addEventListener('input', function (e) { state.thrIdx = +e.target.value; syncControls(); update(); });
  $('review').addEventListener('input', function (e) { state.review = +e.target.value; syncControls(); update(); });
  $('cheapest').addEventListener('click', function () { if (!data) return; state.thrIdx = cheapest(state.review); syncControls(); update(); });
  $('reset').addEventListener('click', function () {
    if (!data) return;
    state.kind = 1; state.pos = pickStart(); state.review = data.review_cost; state.thrIdx = nearestRow(data.threshold);
    load(); syncControls(); update();
  });

  function syncControls() {
    document.querySelectorAll('#kind-buttons button[data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.kind === state.kind)); });
    if (!data) return;
    var amt = $('amount');
    amt.max = Math.max(2500, Math.ceil(cur.x[data.input.indexOf('Amount')]));
    amt.value = state.amount;
    $('amount-out').textContent = '$' + fmt(state.amount, state.amount % 1 ? 2 : 0);
    $('blend').value = state.blend; $('blend-out').textContent = state.blend + '%';
    $('thr').value = state.thrIdx; $('thr-out').textContent = fmtThr(rows[state.thrIdx][0]);
    $('review').value = state.review; $('review-out').textContent = '$' + state.review;
    var idx = list().indexOf(data.sample.indexOf(cur));
    $('tx-info').textContent = (state.kind ? 'Fraud' : 'Legitimate') + ' example ' + (idx + 1) + ' of ' + list().length;
  }
  function fmtThr(t) { return t < 0.01 ? t.toPrecision(2) : fmt(t, t < 0.1 ? 3 : 2); }

  // ---------- Results ----------
  function currentX() {
    var x = cur.x.slice(), aIdx = data.input.indexOf('Amount'), s = state.blend / 100;
    for (var j = 0; j < x.length; j++) if (j !== aIdx) x[j] = typical[j] + s * (cur.x[j] - typical[j]);
    x[aIdx] = state.amount;
    return x;
  }

  function update() {
    if (!data) return;
    var res = model.score(currentX()), t = rows[state.thrIdx][0], flagged = res.p >= t;
    $('score').textContent = res.p < 0.001 ? '< 0.001' : fmt(res.p, 3);
    var v = $('verdict');
    v.className = 'sub flag ' + (flagged ? 'on' : 'off');
    v.textContent = flagged ? 'Flagged for review' : 'Approved';
    var ratio = res.recon / typicalErr;
    $('anomaly').textContent = (ratio >= 10 ? fmt(ratio, 0) : fmt(ratio, 1)) + '×';

    var c = costAt(state.thrIdx, state.review), none = data.test.fraud_amount * data.fraud_cost_factor;
    $('cost').textContent = money(c);
    var d = (c - none) / none;
    $('cost-sub').textContent = (d <= 0 ? fmt(-d * 100, 0) + '% less' : fmt(d * 100, 0) + '% more') + ' than no model (' + money(none) + ')';

    var r = rows[state.thrIdx], fa = r[1] - r[2];
    document.querySelector('#outcome tbody').innerHTML = [
      ['Fraud caught', fmt(r[2]) + ' of ' + fmt(data.test.frauds) + ' (' + fmt(r[2] / data.test.frauds * 100, 0) + '%)'],
      ['False alarms', fmt(fa) + ' of ' + fmt(data.test.n - data.test.frauds) + ' legitimate'],
      ['Alerts to review', fmt(r[1]) + ' × $' + state.review + ' = ' + money(r[1] * state.review)],
      ['Fraud missed', money(r[3] * data.fraud_cost_factor)]
    ].map(function (a) { return '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td></tr>'; }).join('');
    draw();
  }

  // ---------- Chart ----------
  var geom = null, hoverIdx = null;
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function draw() {
    if (!data) return;
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

    var none = data.test.fraud_amount * data.fraud_cost_factor, ymax = none * 1.6;
    var m = { l: 58, r: 14, t: 12, b: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var lx0 = Math.log10(rows[0][0]), lx1 = Math.log10(rows[rows.length - 1][0]);
    var X = function (t) { return m.l + (Math.log10(t) - lx0) / (lx1 - lx0) * pw; };
    var Y = function (v) { return m.t + (1 - Math.min(v, ymax) / ymax) * ph; };
    geom = { X: X, Y: Y, m: m, pw: pw, ph: ph, lx0: lx0, lx1: lx1 };
    var ink = css('--text-faint'), grid = css('--grid');
    ctx.font = '12px ' + (css('--font-body') || 'sans-serif');

    // y grid
    var step = niceStep(ymax, 5);
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var v = 0; v <= ymax + 1e-6; v += step) {
      var y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      ctx.fillText(v >= 1000 ? '$' + fmt(v / 1000, v % 1000 ? 1 : 0) + 'k' : '$' + fmt(v), m.l - 8, y);
    }
    // x ticks (log)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [0.0001, 0.001, 0.01, 0.1, 1].forEach(function (t) {
      if (Math.log10(t) < lx0 - 1e-9 || Math.log10(t) > lx1 + 0.01) return;
      ctx.fillText(t >= 0.01 ? String(t) : t.toExponential(0).replace('e-', 'e−'), Math.min(X(t), m.l + pw - 8), m.t + ph + 8);
    });
    ctx.textAlign = 'left'; ctx.fillText('Alert threshold (fraud score, log scale)', m.l, H - 14);

    // no-model line
    ctx.strokeStyle = css('--series-2'); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(m.l, Y(none)); ctx.lineTo(m.l + pw, Y(none)); ctx.stroke(); ctx.setLineDash([]);

    // model cost line, clipped to the plot
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    ctx.strokeStyle = css('--series-1'); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
    rows.forEach(function (r, i) { var px = X(r[0]), py = Y(costAt(i, state.review)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke(); ctx.restore();

    // cheapest point
    var ci = cheapest(state.review);
    dot(X(rows[ci][0]), Y(costAt(ci, state.review)), css('--series-1'), 4);
    ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('Cheapest', X(rows[ci][0]) - 8, Y(costAt(ci, state.review)) - 8);

    // current threshold marker
    var tx = Math.round(X(rows[state.thrIdx][0])) + 0.5;
    ctx.strokeStyle = css('--text-soft'); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(tx, m.t); ctx.lineTo(tx, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    dot(tx, Y(costAt(state.thrIdx, state.review)), css('--series-1'), 5);

    if (hoverIdx !== null) {
      var hx = X(rows[hoverIdx][0]);
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(hx) + 0.5, m.t); ctx.lineTo(Math.round(hx) + 0.5, m.t + ph); ctx.stroke();
      dot(hx, Y(costAt(hoverIdx, state.review)), css('--series-1'), 4.5);
    }
  }
  function dot(x, y, color, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = css('--surface'); ctx.stroke();
  }
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
  }

  function onMove(ev) {
    if (!geom) return;
    var rect = canvas.getBoundingClientRect(), px = ev.clientX - rect.left, g = geom;
    if (px < g.m.l || px > g.m.l + g.pw) { onLeave(); return; }
    var lt = g.lx0 + (px - g.m.l) / g.pw * (g.lx1 - g.lx0);
    hoverIdx = nearestRow(Math.pow(10, lt));
    draw();
    var r = rows[hoverIdx];
    tip.innerHTML = '<div class="t-head">Threshold ' + fmtThr(r[0]) + '</div>' +
      '<div class="t-row"><span><i class="sw" style="border-color:var(--series-1)"></i>Total cost</span><span>' + money(costAt(hoverIdx, state.review)) + '</span></div>' +
      '<div class="t-row"><span>Fraud caught</span><span>' + r[2] + ' of ' + data.test.frauds + '</span></div>' +
      '<div class="t-row"><span>Alerts</span><span>' + fmt(r[1]) + '</span></div>';
    tip.hidden = false;
    var tx = px + 14;
    if (tx + tip.offsetWidth > rect.width) tx = px - tip.offsetWidth - 14;
    tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = (g.m.t + 8) + 'px';
  }
  function onLeave() { hoverIdx = null; tip.hidden = true; draw(); }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', function () { if (hoverIdx !== null) { state.thrIdx = hoverIdx; syncControls(); update(); } });

  var ro = new ResizeObserver(function () { draw(); }); ro.observe(canvas);
  new MutationObserver(function () { draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var mq = window.matchMedia('(prefers-color-scheme: light)');
  if (mq.addEventListener) mq.addEventListener('change', draw);
  syncControls();
})();

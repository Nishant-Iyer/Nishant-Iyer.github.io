(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('chart'), ctx = canvas.getContext('2d'), tip = $('tip'), status = $('status');
  var conf = $('conf'), cctx = conf.getContext('2d'), tip2 = $('tip2');
  var fmt = function (n, d) { return n.toLocaleString(undefined, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var money = function (n) { return (n < 0 ? '−$' : '$') + fmt(Math.abs(Math.round(n))); };
  var pct = function (n, d) { return fmt(n * 100, d === undefined ? 1 : d) + '%'; };
  var BANK = 5000;
  var DEFAULTS = { edge: 3, side: 'both', size: 'flat', stake: 50, odds: -110, start: 2004 };
  var state = Object.assign({}, DEFAULTS);
  var games = null, sim = null, buckets = null;

  fetch('data/nfl-games.json?v=1').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      games = d.games.map(function (g) {
        var dt = new Date(g[0] + 'T12:00:00Z'), y = dt.getUTCFullYear();
        return { date: dt, season: dt.getUTCMonth() < 2 ? y - 1 : y, home: g[1], away: g[2], line: g[3], result: g[4], p: g[5] };
      });
      var first = games[0].season, last = games[games.length - 1].season;
      var start = $('start'); start.min = first; start.max = last - 1;
      DEFAULTS.start = state.start = first;
      status.textContent = '';
      syncControls(); update();
    })
    .catch(function (err) { status.textContent = 'Couldn’t load the games (' + (err && err.message || err) + '). Reload the page to try again.'; });

  // ---------- Controls ----------
  function seg(id, key, parse) {
    document.querySelectorAll('#' + id + ' button').forEach(function (b) {
      b.addEventListener('click', function () { state[key] = parse(b.dataset[key]); syncControls(); update(); });
    });
  }
  seg('side-buttons', 'side', String);
  seg('size-buttons', 'size', String);
  seg('odds-buttons', 'odds', Number);
  ['edge', 'stake', 'start'].forEach(function (k) {
    $(k).addEventListener('input', function (e) { state[k] = +e.target.value; syncControls(); update(); });
  });
  $('reset').addEventListener('click', function () { state = Object.assign({}, DEFAULTS); syncControls(); update(); });

  function syncControls() {
    [['side-buttons', 'side'], ['size-buttons', 'size'], ['odds-buttons', 'odds']].forEach(function (p) {
      document.querySelectorAll('#' + p[0] + ' button').forEach(function (b) { b.setAttribute('aria-pressed', String(String(state[p[1]]) === b.dataset[p[1]])); });
    });
    $('edge').value = state.edge; $('edge-out').textContent = fmt(state.edge, 1) + ' pts';
    $('stake').value = state.stake; $('stake-out').textContent = '$' + state.stake;
    $('stake-control').hidden = state.size !== 'flat';
    $('start').value = state.start; $('start-out').textContent = state.start;
    $('be-hint').textContent = 'You need to win ' + pct(breakEven(), 1) + ' of bets to break even.';
  }
  function breakEven() { var o = Math.abs(state.odds); return o / (o + 100); }

  // ---------- Simulation (same rules as scripts/export_demo.py) ----------
  function simulate() {
    var be = breakEven(), b = 100 / Math.abs(state.odds), e = state.edge / 100;
    var bank = BANK, staked = 0, bets = [], wins = 0, pushes = 0, peak = BANK, maxDd = 0;
    var path = [];
    for (var i = 0; i < games.length; i++) {
      var g = games[i];
      if (g.season < state.start) continue;
      if (!path.length) path.push({ date: g.date, bank: bank, bet: null });
      var pick = null, q = 0;
      if (state.side !== 'under' && g.p - be >= e - 1e-9) { pick = 1; q = g.p; }
      else if (state.side !== 'over' && (1 - g.p) - be >= e - 1e-9) { pick = 0; q = 1 - g.p; }
      if (pick === null || bank <= 0) continue;
      var size = state.size === 'flat' ? state.stake : Math.max(0, +state.size * (q * (b + 1) - 1) / b) * bank;
      size = Math.min(size, bank);
      if (size <= 0) continue;
      staked += size;
      var pnl = g.result === -1 ? 0 : g.result === pick ? size * b : -size;
      if (g.result === -1) pushes++; else if (pnl > 0) wins++;
      bank += pnl;
      peak = Math.max(peak, bank); maxDd = Math.max(maxDd, peak > 0 ? (peak - bank) / peak : 0);
      var rec = { date: g.date, bank: bank, bet: { g: g, pick: pick, size: size, pnl: pnl } };
      path.push(rec); bets.push(rec);
    }
    var decided = bets.length - pushes;
    return { path: path, bets: bets, wins: wins, decided: decided, staked: staked, final: bank, maxDd: maxDd, broke: bank < 1 };
  }

  function bucketize() {
    var edges = [0, 0.02, 0.04, 0.06, 0.08, 1], out = [];
    for (var k = 0; k < edges.length - 1; k++) out.push({ lo: edges[k], hi: edges[k + 1], n: 0, right: 0 });
    games.forEach(function (g) {
      if (g.season < state.start || g.result === -1) return;
      var c = Math.abs(g.p - 0.5);
      for (var k = 0; k < out.length; k++) if (c >= out[k].lo && c < out[k].hi) {
        out[k].n++; if ((g.p >= 0.5 ? 1 : 0) === g.result) out[k].right++; break;
      }
    });
    out.forEach(function (o) {
      o.acc = o.n ? o.right / o.n : NaN;
      o.se = o.n ? Math.sqrt(o.acc * (1 - o.acc) / o.n) : 0;
      o.label = o.hi >= 1 ? '≥ ' + o.lo * 100 + ' pts' : o.lo * 100 + '–' + o.hi * 100 + ' pts';
    });
    return out;
  }

  function update() {
    if (!games) return;
    sim = simulate(); buckets = bucketize();
    var be = breakEven();
    $('final').textContent = money(sim.final);
    var ch = (sim.final - BANK) / BANK;
    $('final-sub').textContent = sim.broke ? 'Bankroll wiped out' : (ch >= 0 ? '+' : '−') + pct(Math.abs(ch), 0) + ' from ' + money(BANK) + (sim.maxDd > 0 ? ', worst drop ' + pct(sim.maxDd, 0) : '');
    if (sim.decided) {
      var wr = sim.wins / sim.decided;
      $('win').textContent = pct(wr, 1);
      $('win-sub').textContent = (wr >= be ? 'above' : 'below') + ' the ' + pct(be, 1) + ' break-even, ' + fmt(sim.bets.length) + ' bets';
    } else { $('win').textContent = '–'; $('win-sub').textContent = 'No bets met the edge'; }
    $('roi').textContent = sim.staked ? (sim.final >= BANK ? '+' : '−') + pct(Math.abs(sim.final - BANK) / sim.staked, 1) : '–';
    $('roi-sub').textContent = sim.staked ? 'profit per dollar bet, on ' + money(sim.staked) + ' staked' : '–';

    document.querySelector('#bets tbody').innerHTML = sim.bets.slice(-10).reverse().map(function (r) {
      var g = r.bet.g, res = g.result === -1 ? 'Push' : (r.bet.pnl > 0 ? 'Won ' : 'Lost ') + money(Math.abs(r.bet.pnl));
      return '<tr><td>' + g.date.toISOString().slice(0, 10) + ' · ' + short(g.away) + ' at ' + short(g.home) + '</td><td>' + g.line +
        '</td><td>' + (r.bet.pick ? 'Over' : 'Under') + '</td><td>' + res + '</td></tr>';
    }).join('') || '<tr><td colspan="4">No bets placed with these settings.</td></tr>';
    document.querySelector('#conf-table tbody').innerHTML = buckets.map(function (o) {
      return '<tr><td>' + o.label + '</td><td>' + fmt(o.n) + '</td><td>' + (o.n ? pct(o.acc, 1) : '–') + '</td></tr>';
    }).join('');
    drawAll();
  }
  function short(team) { var w = team.split(' '); return w[w.length - 1]; }

  // ---------- Charts ----------
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function setup(cv, c) {
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.font = '12px ' + (css('--font-body') || 'sans-serif');
    return { W: W, H: H };
  }
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
  }
  function dot(c, x, y, color, r) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill();
    c.lineWidth = 2; c.strokeStyle = css('--surface'); c.stroke();
  }

  var geom = null, hover = null;
  function drawBank() {
    var s = setup(canvas, ctx), W = s.W, H = s.H, path = sim.path;
    var m = { l: 62, r: 14, t: 12, b: 34 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    if (!path.length) return;
    var t0 = path[0].date.getTime(), t1 = games[games.length - 1].date.getTime();
    var hi = BANK, lo = 0;
    path.forEach(function (p) { if (p.bank > hi) hi = p.bank; });
    hi *= 1.05;
    var X = function (t) { return m.l + (t - t0) / (t1 - t0) * pw; };
    var Y = function (v) { return m.t + (1 - (v - lo) / (hi - lo)) * ph; };
    geom = { X: X, Y: Y, m: m, pw: pw, ph: ph, t0: t0, t1: t1 };
    var ink = css('--text-faint');

    var step = niceStep(hi - lo, 5);
    ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1; ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var v = 0; v <= hi; v += step) {
      var y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      ctx.fillText(v >= 1000 ? '$' + fmt(v / 1000, v % 1000 ? 1 : 0) + 'k' : '$' + fmt(v), m.l - 8, y);
    }
    var y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear(), ys = Math.max(1, Math.ceil((y1 - y0) / Math.max(2, Math.floor(pw / 70))));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var yr = Math.ceil(y0 / ys) * ys; yr <= y1; yr += ys) {
      var tx = X(Date.UTC(yr, 0, 1));
      if (tx >= m.l && tx <= m.l + pw) ctx.fillText(String(yr), tx, m.t + ph + 8);
    }

    ctx.strokeStyle = css('--series-2'); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(m.l, Y(BANK)); ctx.lineTo(m.l + pw, Y(BANK)); ctx.stroke(); ctx.setLineDash([]);

    ctx.strokeStyle = css('--series-1'); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
    path.forEach(function (p, i) { var px = X(p.date.getTime()), py = Y(p.bank); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
    var lastP = path[path.length - 1];
    dot(ctx, X(lastP.date.getTime()), Y(lastP.bank), css('--series-1'), 4);

    if (hover !== null && path[hover]) {
      var hp = path[hover], hx = X(hp.date.getTime());
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(hx) + 0.5, m.t); ctx.lineTo(Math.round(hx) + 0.5, m.t + ph); ctx.stroke();
      dot(ctx, hx, Y(hp.bank), css('--series-1'), 4.5);
    }
  }

  var cgeom = null, chover = null;
  function drawConf() {
    var s = setup(conf, cctx), W = s.W, H = s.H, be = breakEven();
    var m = { l: 46, r: 14, t: 12, b: 46 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var lo = 0.40, hi = 0.64;
    buckets.forEach(function (o) { if (o.n) { lo = Math.min(lo, o.acc - 2 * o.se - 0.01); hi = Math.max(hi, o.acc + 2 * o.se + 0.01); } });
    var Y = function (v) { return m.t + (1 - (v - lo) / (hi - lo)) * ph; };
    var bw = pw / buckets.length, X = function (k) { return m.l + bw * (k + 0.5); };
    cgeom = { X: X, bw: bw, m: m, pw: pw };
    var ink = css('--text-faint');
    cctx.strokeStyle = css('--grid'); cctx.lineWidth = 1; cctx.fillStyle = ink; cctx.textAlign = 'right'; cctx.textBaseline = 'middle';
    for (var v = Math.ceil(lo * 50) / 50; v <= hi + 1e-9; v += 0.04) {
      var y = Math.round(Y(v)) + 0.5;
      cctx.beginPath(); cctx.moveTo(m.l, y); cctx.lineTo(m.l + pw, y); cctx.stroke();
      cctx.fillText(fmt(v * 100, 0) + '%', m.l - 8, y);
    }
    cctx.strokeStyle = css('--series-2'); cctx.lineWidth = 2; cctx.setLineDash([6, 4]);
    cctx.beginPath(); cctx.moveTo(m.l, Y(be)); cctx.lineTo(m.l + pw, Y(be)); cctx.stroke(); cctx.setLineDash([]);

    buckets.forEach(function (o, k) {
      var x = X(k);
      cctx.fillStyle = ink; cctx.textAlign = 'center'; cctx.textBaseline = 'top';
      cctx.fillText(o.label, x, m.t + ph + 8);
      cctx.fillText(fmt(o.n) + ' games', x, m.t + ph + 24);
      if (!o.n) return;
      cctx.strokeStyle = css('--series-1'); cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, Y(o.acc - 1.96 * o.se)); cctx.lineTo(x, Y(o.acc + 1.96 * o.se)); cctx.stroke();
      [o.acc - 1.96 * o.se, o.acc + 1.96 * o.se].forEach(function (e) { cctx.beginPath(); cctx.moveTo(x - 5, Y(e)); cctx.lineTo(x + 5, Y(e)); cctx.stroke(); });
      dot(cctx, x, Y(o.acc), css('--series-1'), chover === k ? 6 : 5);
    });
  }

  function drawAll() { if (!sim) return; drawBank(); drawConf(); }

  canvas.addEventListener('pointermove', function (ev) {
    if (!geom || !sim || !sim.path.length) return;
    var rect = canvas.getBoundingClientRect(), px = ev.clientX - rect.left, g = geom;
    if (px < g.m.l || px > g.m.l + g.pw) { leave(); return; }
    var t = g.t0 + (px - g.m.l) / g.pw * (g.t1 - g.t0), arr = sim.path, a = 0, b = arr.length - 1;
    while (b - a > 1) { var mid = (a + b) >> 1; if (arr[mid].date.getTime() <= t) a = mid; else b = mid; }
    hover = Math.abs(arr[a].date.getTime() - t) < Math.abs(arr[b].date.getTime() - t) ? a : b;
    drawBank();
    var p = arr[hover], bet = p.bet;
    tip.innerHTML = '<div class="t-head">' + p.date.toISOString().slice(0, 10) + '</div>' +
      (bet ? '<div class="t-row"><span>' + short(bet.g.away) + ' at ' + short(bet.g.home) + '</span><span>' + (bet.pick ? 'Over ' : 'Under ') + bet.g.line + '</span></div>' +
        '<div class="t-row"><span>Result</span><span>' + (bet.g.result === -1 ? 'Push' : (bet.pnl > 0 ? '+' : '−') + money(Math.abs(bet.pnl)).replace('−', '')) + '</span></div>' : '') +
      '<div class="t-row"><span><i class="sw" style="border-color:var(--series-1)"></i>Bankroll</span><span>' + money(p.bank) + '</span></div>';
    tip.hidden = false;
    var tx = px + 14; if (tx + tip.offsetWidth > rect.width) tx = px - tip.offsetWidth - 14;
    tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = (g.m.t + 8) + 'px';
  });
  function leave() { hover = null; tip.hidden = true; if (sim) drawBank(); }
  canvas.addEventListener('pointerleave', leave);

  conf.addEventListener('pointermove', function (ev) {
    if (!cgeom || !buckets) return;
    var rect = conf.getBoundingClientRect(), px = ev.clientX - rect.left, k = Math.floor((px - cgeom.m.l) / cgeom.bw);
    if (k < 0 || k >= buckets.length) { cleave(); return; }
    chover = k; drawConf();
    var o = buckets[k];
    tip2.innerHTML = '<div class="t-head">Confidence ' + o.label + ' from 50%</div>' +
      '<div class="t-row"><span><i class="sw" style="border-color:var(--series-1)"></i>Accuracy</span><span>' + (o.n ? pct(o.acc, 1) : '–') + '</span></div>' +
      '<div class="t-row"><span>95% range</span><span>' + (o.n ? pct(o.acc - 1.96 * o.se, 0) + '–' + pct(o.acc + 1.96 * o.se, 0) : '–') + '</span></div>' +
      '<div class="t-row"><span>Games</span><span>' + fmt(o.n) + '</span></div>';
    tip2.hidden = false;
    var tx = cgeom.X(k) + 14; if (tx + tip2.offsetWidth > rect.width) tx = cgeom.X(k) - tip2.offsetWidth - 14;
    tip2.style.left = Math.max(4, tx) + 'px'; tip2.style.top = '8px';
  });
  function cleave() { chover = null; tip2.hidden = true; if (buckets) drawConf(); }
  conf.addEventListener('pointerleave', cleave);

  var ro = new ResizeObserver(drawAll); ro.observe(canvas); ro.observe(conf);
  new MutationObserver(drawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var mq = window.matchMedia('(prefers-color-scheme: light)');
  if (mq.addEventListener) mq.addEventListener('change', drawAll);
  syncControls();
})();

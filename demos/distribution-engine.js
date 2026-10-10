// Distribution-center placement, ported from Global-Distribution-Optimization-Center
// (gdoc_opt/models/kmedoids.py and gdoc_opt/transport.py).
//   * p-median: greedy start, then best-swap local search over all 1,000 cities.
//   * Optional running cost per site (price level x a cost the user sets); when the number of
//     centers is left open, add and drop moves let the costs decide how many to open.
//   * Optional capacity per center: capacity-aware assignment (largest regret first) and a
//     swap search around the current sites.
//   * Distances: straight line over the globe, or road and sea freight distance.
(function (root) {
  'use strict';
  var R = 6371.0, RAD = Math.PI / 180;
  // city row: 0 name, 1 country, 2 lat, 3 lon, 4 population, 5 gdp/capita, 6 lpi, 7 price level,
  //           8 landmass, 9 port, 10 road km to port, 11 circuity x100

  function decodeSea(b64, P) {
    var bin = atob(b64), n = bin.length >> 1, tri = new Uint16Array(n);
    for (var i = 0; i < n; i++) tri[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    var M = new Float32Array(P * P), k = 0;
    for (var a = 0; a < P; a++) for (var b = a + 1; b < P; b++) { M[a * P + b] = M[b * P + a] = tri[k++]; }
    return M;
  }

  function greatCircle(cities) {
    var n = cities.length, D = new Float32Array(n * n), i, j;
    var lat = new Float64Array(n), lon = new Float64Array(n), cl = new Float64Array(n);
    for (i = 0; i < n; i++) { lat[i] = cities[i][2] * RAD; lon[i] = cities[i][3] * RAD; cl[i] = Math.cos(lat[i]); }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var s1 = Math.sin((lat[j] - lat[i]) / 2), s2 = Math.sin((lon[j] - lon[i]) / 2);
      var d = 2 * R * Math.asin(Math.min(1, Math.sqrt(s1 * s1 + cl[i] * cl[j] * s2 * s2)));
      D[i * n + j] = d; D[j * n + i] = d;
    }
    return D;
  }

  // Road on the same landmass (great circle x circuity), else road to port + sea + road.
  function freight(cities, GC, sea, P) {
    var n = cities.length, D = new Float32Array(n * n), i, j;
    for (i = 0; i < n; i++) {
      var ci = cities[i], pi = ci[9];
      for (j = i + 1; j < n; j++) {
        var cj = cities[j], pj = cj[9];
        var inter = ci[10] + (pi === pj ? 0 : sea[pi * P + pj]) + cj[10];
        var d = inter;
        if (ci[8] === cj[8]) { var road = GC[i * n + j] * (ci[11] + cj[11]) / 200; if (road < d) d = road; }
        D[i * n + j] = d; D[j * n + i] = d;
      }
    }
    return D;
  }

  function Solver(data) {
    this.cities = data.cities;
    this.n = data.cities.length;
    this.GC = greatCircle(this.cities);
    this.P = data.ports;
    this.sea = data.sea ? decodeSea(data.sea, data.ports) : null;
    this.FR = null;
  }
  Solver.prototype.matrix = function (kind) {
    if (kind !== 'freight' || !this.sea) return this.GC;
    if (!this.FR) this.FR = freight(this.cities, this.GC, this.sea, this.P);
    return this.FR;
  };

  // opts: { k, autoK, weighting, lpiFactor, locked, distance, siteKm, capacity }
  Solver.prototype.solve = function (opts) {
    var n = this.n, c = this.cities, D = this.matrix(opts.distance), i, j, m;
    var locked = (opts.locked || []).filter(function (x, p, a) { return a.indexOf(x) === p; });
    var w = new Float64Array(n), pen = new Float64Array(n), f = new Float64Array(n), W = 0;
    for (i = 0; i < n; i++) {
      w[i] = opts.weighting === 'purchasing' ? c[i][4] * c[i][5] : c[i][4];
      W += w[i];
      pen[i] = 1 + (opts.lpiFactor || 0) * (5 - c[i][6]);     // logistics penalty on the site j
    }
    var siteKm = opts.siteKm || 0;
    for (j = 0; j < n; j++) f[j] = siteKm * c[j][7] * W;     // running cost in weight x km
    var passes = 0;

    function nearest(meds) {
      var best = new Float64Array(n).fill(Infinity);
      for (var q = 0; q < meds.length; q++) {
        var mj = meds[q], pj = pen[mj];
        for (var a = 0; a < n; a++) { var d = D[a * n + mj] * pj; if (d < best[a]) best[a] = d; }
      }
      return best;
    }
    function addCosts(best) {         // total cost if each j is added to the set behind `best`
      var out = new Float64Array(n);
      for (var b = 0; b < n; b++) {
        var s = f[b], pj = pen[b];
        for (var a = 0; a < n; a++) { var d = D[a * n + b] * pj; s += w[a] * (d < best[a] ? d : best[a]); }
        out[b] = s;
      }
      return out;
    }
    function total(meds) {
      var best = nearest(meds), s = 0;
      for (var a = 0; a < n; a++) s += w[a] * best[a];
      for (var q = 0; q < meds.length; q++) s += f[meds[q]];
      return s;
    }
    function fixedOf(meds) { var s = 0; for (var q = 0; q < meds.length; q++) s += f[meds[q]]; return s; }

    // ---- 1. starts: greedy (locked first), plus a spread-out random start when k is fixed
    var kMax = Math.min(15, n), auto = !!opts.autoK;
    var k = auto ? kMax : Math.max(1, Math.min(opts.k, n));
    function greedyStart() {
      var meds = locked.slice(0, k), current = meds.length ? total(meds) : Infinity;
      while (meds.length < k) {
        var cost = addCosts(meds.length ? nearest(meds) : new Float64Array(n).fill(1e30)), arg = -1, bv = Infinity;
        var fixed = fixedOf(meds);
        for (j = 0; j < n; j++) if (meds.indexOf(j) < 0 && cost[j] + fixed < bv) { bv = cost[j] + fixed; arg = j; }
        if (auto && meds.length >= Math.max(1, locked.length) && bv >= current - 1e-6) break;   // adding no longer pays
        meds.push(arg); current = bv;
      }
      return meds;
    }
    function spreadStart(seed) {        // k-means++ style: far, heavy cities are likely picks
      var rnd = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      var meds = locked.slice(0, k);
      if (!meds.length) { var big = 0; for (j = 1; j < n; j++) if (w[j] > w[big]) big = j; meds.push(big); }
      while (meds.length < k) {
        var best = nearest(meds), tot = 0, p = new Float64Array(n);
        for (j = 0; j < n; j++) { p[j] = best[j] * w[j]; tot += p[j]; }
        var r = rnd() * tot, acc = 0, pick = n - 1;
        for (j = 0; j < n; j++) { acc += p[j]; if (acc >= r) { pick = j; break; } }
        if (meds.indexOf(pick) < 0) meds.push(pick);
      }
      return meds;
    }

    // ---- 2. local search: best swap (and, when k is free, add / drop) until nothing helps
    function localSearch(meds) {
      var current = total(meds), lp = 0;
      while (lp++ < 100) {
        passes++;
        var bestMove = null, bestCost = current;
        for (m = 0; m < meds.length; m++) {
          if (locked.indexOf(meds[m]) >= 0) continue;
          var others = meds.slice(0, m).concat(meds.slice(m + 1));
          var fo = fixedOf(others);
          var costs = addCosts(others.length ? nearest(others) : new Float64Array(n).fill(1e30));
          for (j = 0; j < n; j++) if (meds.indexOf(j) < 0 && costs[j] + fo < bestCost - 1e-6) { bestCost = costs[j] + fo; bestMove = ['swap', m, j]; }
          if (auto && others.length >= 1) {
            var dc = total(others);
            if (dc < bestCost - 1e-6) { bestCost = dc; bestMove = ['drop', m]; }
          }
        }
        if (auto && meds.length < kMax) {
          var ac = addCosts(nearest(meds)), fm = fixedOf(meds);
          for (j = 0; j < n; j++) if (meds.indexOf(j) < 0 && ac[j] + fm < bestCost - 1e-6) { bestCost = ac[j] + fm; bestMove = ['add', j]; }
        }
        if (!bestMove) break;
        if (bestMove[0] === 'swap') meds[bestMove[1]] = bestMove[2];
        else if (bestMove[0] === 'drop') meds.splice(bestMove[1], 1);
        else meds.push(bestMove[1]);
        current = bestCost;
      }
      return { meds: meds, cost: current };
    }
    var run = localSearch(greedyStart());
    if (!auto) {
      var alt = localSearch(spreadStart(7));
      if (alt.cost < run.cost - 1e-6) run = alt;
    }
    var meds = run.meds;
    k = meds.length;

    // ---- 3. capacity: capacity-aware assignment plus a swap search near the current sites
    var cap = opts.capacity ? Math.max(opts.capacity, 1.02 / k) : 0, capUsed = cap;
    var assign;
    if (cap) {
      var capW = cap * W;
      // Capacity-aware assignment: cities that would lose the most by not getting their nearest
      // site go first; each takes the nearest site that still has room.
      var order = Array.from({ length: n }, function (_, a) { return a; });
      var assignCap = function (S) {
        var K = S.length, load = new Float64Array(K), asg = new Int32Array(n), s = 0, a, q;
        var dd = new Float64Array(n * K), regret = new Float64Array(n);
        for (a = 0; a < n; a++) {
          var b1 = Infinity, b2 = Infinity;
          for (q = 0; q < K; q++) { var d = D[a * n + S[q]] * pen[S[q]]; dd[a * K + q] = d; if (d < b1) { b2 = b1; b1 = d; } else if (d < b2) b2 = d; }
          regret[a] = (b2 - b1) * w[a];
        }
        order.sort(function (x, y) { return regret[y] - regret[x]; });
        for (var t = 0; t < n; t++) {
          a = order[t];
          var bq = -1, bd = Infinity, lq = 0;
          for (q = 0; q < K; q++) {
            if (load[q] < load[lq]) lq = q;
            if (load[q] + w[a] <= capW + 1e-6 && dd[a * K + q] < bd) { bd = dd[a * K + q]; bq = q; }
          }
          if (bq < 0) { bq = lq; bd = dd[a * K + lq]; s += 1e15; }   // no room anywhere: heavily penalised
          asg[a] = bq; load[bq] += w[a]; s += w[a] * bd;
        }
        for (q = 0; q < K; q++) s += f[S[q]];
        return { cost: s, asg: asg, load: load };
      };
      var nbr = {}, per = k > 8 ? 8 : 20;
      var near = function (site) {          // the closest cities to a site
        if (!nbr[site]) {
          var idx = Array.from({ length: n }, function (_, a) { return a; });
          idx.sort(function (x, y) { return D[x * n + site] - D[y * n + site]; });
          nbr[site] = idx.slice(1, per + 1);
        }
        return nbr[site];
      };
      var big = Array.from({ length: n }, function (_, a) { return a; }).sort(function (x, y) { return w[y] - w[x]; }).slice(0, 30);
      var res = assignCap(meds), cpass = 0, t0 = Date.now();
      // best swap per pass: any site may move next to any other site, or to one of the biggest cities
      while (cpass < 40 && Date.now() - t0 < 4000) {
        cpass++; passes++;
        var pool = big.slice();
        meds.forEach(function (s) { near(s).forEach(function (x) { if (pool.indexOf(x) < 0) pool.push(x); }); });
        var bm = null;
        for (m = 0; m < meds.length; m++) {
          if (locked.indexOf(meds[m]) >= 0) continue;
          for (var t = 0; t < pool.length; t++) {
            if (meds.indexOf(pool[t]) >= 0) continue;
            var S2 = meds.slice(); S2[m] = pool[t];
            var r2 = assignCap(S2);
            if (r2.cost < (bm ? bm[1].cost : res.cost) - 1e-6) bm = [S2, r2];
          }
        }
        if (!bm) break;
        meds = bm[0]; res = bm[1];
      }
      assign = res.asg;
    } else {
      assign = new Int32Array(n);
      for (i = 0; i < n; i++) {
        var bi = 0, bd2 = Infinity;
        for (m = 0; m < k; m++) { var d2 = D[i * n + meds[m]] * pen[meds[m]]; if (d2 < bd2) { bd2 = d2; bi = m; } }
        assign[i] = bi;
      }
    }

    // ---- 4. report physical distances (no logistics penalty)
    var phys = 0, served = new Float64Array(k), far = 0;
    for (i = 0; i < n; i++) {
      var pd = D[i * n + meds[assign[i]]];
      phys += w[i] * pd; served[assign[i]] += w[i];
      if (pd > 3000) far += w[i];
    }
    return {
      centers: meds, assign: assign, passes: passes, k: k, capacity: capUsed,
      avgKm: phys / W, share: Array.from(served, function (s) { return s / W; }),
      farShare: far / W, runningKm: fixedOf(meds) / W
    };
  };

  var api = { Solver: Solver };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DistributionEngine = api;
})(this);

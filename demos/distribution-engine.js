// Distribution-center placement (p-median), ported from gdoc_opt/models/kmedoids.py
// (Global-Distribution-Optimization-Center). Greedy start + best-swap local search over
// all cities as candidates, with an optional logistics (LPI) penalty and locked cities.
(function (root) {
  'use strict';
  var R = 6371.0, RAD = Math.PI / 180;

  function distanceMatrix(cities) {
    var n = cities.length, D = new Float32Array(n * n), i, j;
    var lat = new Float64Array(n), lon = new Float64Array(n), cl = new Float64Array(n);
    for (i = 0; i < n; i++) { lat[i] = cities[i][2] * RAD; lon[i] = cities[i][3] * RAD; cl[i] = Math.cos(lat[i]); }
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var s1 = Math.sin((lat[j] - lat[i]) / 2), s2 = Math.sin((lon[j] - lon[i]) / 2);
        var d = 2 * R * Math.asin(Math.sqrt(s1 * s1 + cl[i] * cl[j] * s2 * s2));
        D[i * n + j] = d; D[j * n + i] = d;
      }
    }
    return D;
  }

  function Solver(cities) {
    this.cities = cities;
    this.n = cities.length;
    this.D = distanceMatrix(cities);
  }

  // opts: { k, weighting: 'population'|'purchasing', lpiFactor: 0..1, locked: [cityIndex] }
  Solver.prototype.solve = function (opts) {
    var n = this.n, D = this.D, c = this.cities, i, j, m;
    var k = Math.max(1, Math.min(opts.k, n));
    var locked = (opts.locked || []).filter(function (x, p, a) { return a.indexOf(x) === p; }).slice(0, k);
    var w = new Float64Array(n), pen = new Float64Array(n), wsum = 0;
    for (i = 0; i < n; i++) {
      w[i] = opts.weighting === 'purchasing' ? c[i][4] * c[i][5] : c[i][4];
      wsum += w[i];
      pen[i] = 1 + (opts.lpiFactor || 0) * (5 - c[i][6]);     // penalty applies to the DC site j
    }
    // nearest distance to the current medoid set (penalized), and cost of adding candidate j
    function addCosts(best) {
      var out = new Float64Array(n);
      for (j = 0; j < n; j++) {
        var s = 0, pj = pen[j];
        for (i = 0; i < n; i++) { var d = D[i * n + j] * pj; s += w[i] * (d < best[i] ? d : best[i]); }
        out[j] = s;
      }
      return out;
    }
    function nearest(meds) {
      var best = new Float64Array(n).fill(Infinity);
      for (var q = 0; q < meds.length; q++) {
        var mj = meds[q], pj = pen[mj];
        for (i = 0; i < n; i++) { var d = D[i * n + mj] * pj; if (d < best[i]) best[i] = d; }
      }
      return best;
    }

    // 1. Greedy start: locked cities first, then add whichever city lowers cost most.
    var meds = locked.slice();
    while (meds.length < k) {
      var cost = addCosts(nearest(meds)), arg = -1, bv = Infinity;
      for (j = 0; j < n; j++) if (meds.indexOf(j) < 0 && cost[j] < bv) { bv = cost[j]; arg = j; }
      meds.push(arg);
    }

    // 2. Best-swap local search; locked cities never move.
    var current = totalCost(nearest(meds)), passes = 0;
    function totalCost(best) { var s = 0; for (i = 0; i < n; i++) s += w[i] * best[i]; return s; }
    while (passes < 100) {
      passes++;
      var bestSwap = null, bestCost = current;
      for (m = 0; m < meds.length; m++) {
        if (locked.indexOf(meds[m]) >= 0) continue;
        var others = meds.slice(0, m).concat(meds.slice(m + 1));
        var costs = addCosts(nearest(others));
        for (j = 0; j < n; j++) if (meds.indexOf(j) < 0 && costs[j] < bestCost - 1e-6) { bestCost = costs[j]; bestSwap = [m, j]; }
      }
      if (!bestSwap) break;
      meds[bestSwap[0]] = bestSwap[1]; current = bestCost;
    }

    // 3. Assign each city to its nearest (penalized) center; report physical distances.
    var assign = new Int32Array(n), phys = 0, served = new Float64Array(k), far = 0;
    for (i = 0; i < n; i++) {
      var bi = 0, bd = Infinity;
      for (m = 0; m < k; m++) { var d2 = D[i * n + meds[m]] * pen[meds[m]]; if (d2 < bd) { bd = d2; bi = m; } }
      assign[i] = bi;
      var pd = D[i * n + meds[bi]];
      phys += w[i] * pd; served[bi] += w[i];
      if (pd > 3000) far += w[i];
    }
    return {
      centers: meds, assign: assign, passes: passes,
      avgKm: phys / wsum, share: Array.from(served, function (s) { return s / wsum; }),
      farShare: far / wsum
    };
  };

  var api = { Solver: Solver };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DistributionEngine = api;
})(this);

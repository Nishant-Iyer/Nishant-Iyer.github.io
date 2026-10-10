// Wellbore TVT prediction, ported from src/predict.py (Rogii-Wellbore-Geology-Prediction).
// Steps: regional plane baseline -> damped bias correction -> Viterbi path matching on gamma ray.
// Works in the browser (window.WellboreEngine) and in Node (module.exports) for testing.
(function (root) {
  'use strict';

  function interpolator(xs, ys) {
    var n = xs.length;
    return function (x) {
      if (x <= xs[0]) return ys[0] + (ys[1] - ys[0]) * (x - xs[0]) / (xs[1] - xs[0]);
      if (x >= xs[n - 1]) return ys[n - 2] + (ys[n - 1] - ys[n - 2]) * (x - xs[n - 2]) / (xs[n - 1] - xs[n - 2]);
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
      return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]);
    };
  }

  // Baseline from the regional plane, plus a linear bias fit on the known section that
  // fades back to the mean bias over ~1,000 ft past the end of the known section.
  function baseline(w, knownEnd) {
    var n = w.md.length, i, tops = 0;
    for (i = 0; i < knownEnd; i++) tops += w.tvt[i] + w.z[i] - w.pz[i];
    tops /= knownEnd;
    var base = new Float64Array(n);
    for (i = 0; i < n; i++) base[i] = tops - (w.z[i] - w.pz[i]);
    var sx = 0, sy = 0, sxx = 0, sxy = 0, bias;
    for (i = 0; i < knownEnd; i++) {
      bias = w.tvt[i] - base[i];
      sx += w.md[i]; sy += bias; sxx += w.md[i] * w.md[i]; sxy += w.md[i] * bias;
    }
    var mx = sx / knownEnd, my = sy / knownEnd;
    var slope = (sxy / knownEnd - mx * my) / (sxx / knownEnd - mx * mx || 1);
    var intercept = my - slope * mx;
    var mdEnd = w.md[knownEnd - 1];
    var ref = new Float64Array(n);
    for (i = 0; i < n; i++) {
      var lam = 1 / (1 + Math.exp((w.md[i] - mdEnd) / 1000));
      ref[i] = base[i] + lam * (intercept + slope * w.md[i]) + (1 - lam) * my;
    }
    return ref;
  }

  function predict(w, opts) {
    var knownEnd = Math.max(10, Math.min(opts.knownEnd, w.md.length - 1));
    var wSmooth = opts.smoothness, half = opts.window, step = 0.5;
    var n = w.md.length, S = Math.round(2 * half / step) + 1, i, j, k;
    var off = new Float64Array(S);
    for (j = 0; j < S; j++) off[j] = -half + j * step;
    var ref = baseline(w, knownEnd);
    var twGr = interpolator(w.twTvt, w.twGr);

    var trans = new Float64Array(S * S);
    for (k = 0; k < S; k++) for (j = 0; j < S; j++) { var d = off[k] - off[j]; trans[k * S + j] = wSmooth * d * d; }

    var dp = new Float64Array(S), next = new Float64Array(S), ptr = new Int16Array(n * S);
    var o0 = w.tvt[0] - ref[0];
    for (j = 0; j < S; j++) dp[j] = (off[j] - o0) * (off[j] - o0) * 1000;

    for (i = 1; i < n; i++) {
      var known = i < knownEnd, trueOff = known ? w.tvt[i] - ref[i] : 0;
      for (j = 0; j < S; j++) {
        var best = Infinity, arg = 0;
        for (k = 0; k < S; k++) { var c = dp[k] + trans[k * S + j]; if (c < best) { best = c; arg = k; } }
        var dc;
        if (known) { dc = (off[j] - trueOff) * (off[j] - trueOff) * 1000; }
        else { var g = (w.gr[i] - twGr(ref[i] + off[j])) / 30, r = off[j] / 15; dc = g * g + 0.01 * r * r; }
        next[j] = best + dc; ptr[i * S + j] = arg;
      }
      var t = dp; dp = next; next = t;
    }

    var pred = new Float64Array(n), s = 0;
    for (j = 1; j < S; j++) if (dp[j] < dp[s]) s = j;
    pred[n - 1] = ref[n - 1] + off[s];
    for (i = n - 2; i >= 0; i--) { s = ptr[(i + 1) * S + s]; pred[i] = ref[i] + off[s]; }

    var se = 0, seb = 0, m = 0;
    for (i = knownEnd; i < n; i++) {
      var e = pred[i] - w.tvt[i], eb = ref[i] - w.tvt[i];
      se += e * e; seb += eb * eb; m++;
    }
    return { pred: pred, ref: ref, knownEnd: knownEnd, rmse: Math.sqrt(se / m), baselineRmse: Math.sqrt(seb / m), evalPoints: m };
  }

  var api = { predict: predict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WellboreEngine = api;
})(this);

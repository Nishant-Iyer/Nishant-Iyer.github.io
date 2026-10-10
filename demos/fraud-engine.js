// Scores a transaction with the exported fraud model (Credit-Card-Fraud-Detection,
// scripts/export_demo.py): robust-scaled Amount -> autoencoder reconstruction error ->
// XGBoost + LightGBM -> logistic-regression stacker. Same logic as the export's parity check.
(function (root) {
  'use strict';

  function packTrees(trees) {
    return trees.map(function (t) {
      return { f: Int16Array.from(t.f), t: Float64Array.from(t.t), l: Int32Array.from(t.l), r: Int32Array.from(t.r), v: Float64Array.from(t.v) };
    });
  }

  // XGBoost: float32 comparison, left when x < split. LightGBM: double comparison, left when x <= split.
  function treeSum(trees, x, xgb) {
    var s = 0, fr = Math.fround;
    for (var k = 0; k < trees.length; k++) {
      var t = trees[k], n = 0;
      while (t.f[n] >= 0) {
        var v = x[t.f[n]];
        var left = xgb ? fr(v) < fr(t.t[n]) : v <= t.t[n];
        n = left ? t.l[n] : t.r[n];
      }
      s += t.v[n];
    }
    return s;
  }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  function Model(json) {
    this.input = json.input;
    this.amountIdx = json.input.indexOf('Amount');
    this.scaler = json.scaler;
    this.ae = json.autoencoder;
    this.xgb = { offset: json.xgb.offset, trees: packTrees(json.xgb.trees) };
    this.lgb = { offset: json.lgb.offset, trees: packTrees(json.lgb.trees) };
    this.meta = json.meta;
    this.threshold = json.threshold;
  }

  // raw: array in `input` order (V1..V28, Amount in dollars)
  Model.prototype.score = function (raw) {
    var n = raw.length, x = new Float64Array(n + 1), i, j;
    for (i = 0; i < n; i++) x[i] = raw[i];
    x[this.amountIdx] = (x[this.amountIdx] - this.scaler.center) / this.scaler.scale;
    var h = Array.prototype.slice.call(x, 0, n);
    for (var L = 0; L < this.ae.length; L++) {
      var layer = this.ae[L], out = new Array(layer.b.length);
      for (j = 0; j < out.length; j++) {
        var s = layer.b[j], w = layer.w[j];
        for (i = 0; i < h.length; i++) s += w[i] * h[i];
        out[j] = layer.relu && s < 0 ? 0 : s;
      }
      h = out;
    }
    var err = 0;
    for (i = 0; i < n; i++) { var d = x[i] - h[i]; err += d * d; }
    err /= n;
    x[n] = err;
    var pX = sigmoid(treeSum(this.xgb.trees, x, true) + this.xgb.offset);
    var pL = sigmoid(treeSum(this.lgb.trees, x, false) + this.lgb.offset);
    var p = sigmoid(this.meta.coef[0] * pX + this.meta.coef[1] * pL + this.meta.intercept);
    return { p: p, pXgb: pX, pLgb: pL, recon: err };
  };

  var api = { Model: Model };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FraudEngine = api;
})(this);

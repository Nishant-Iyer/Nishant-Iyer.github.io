// Runs the wellbore model off the main thread so sliders stay smooth.
importScripts('wellbore-engine.js?v=1');

var wells = null;
var ready = fetch('data/wellbore.json?v=1')
  .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function (d) { wells = d; });

self.onmessage = function (e) {
  var msg = e.data;
  ready.then(function () {
    var w = wells[msg.well];
    var opts = Object.assign({}, msg.opts);
    if (opts.knownEnd == null) opts.knownEnd = w.knownEnd;   // exact cut-off from the competition data
    var res = self.WellboreEngine.predict(w, opts);
    self.postMessage({
      id: msg.id, well: msg.well,
      md: w.md, tvt: w.tvt, gr: w.gr,
      pred: Array.from(res.pred), ref: Array.from(res.ref),
      knownEnd: res.knownEnd, originalKnownEnd: w.knownEnd,
      rmse: res.rmse, baselineRmse: res.baselineRmse, evalPoints: res.evalPoints
    });
  }).catch(function (err) {
    self.postMessage({ id: msg.id, error: String(err && err.message || err) });
  });
};

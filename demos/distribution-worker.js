// Solves off the main thread; the distance matrix is built once and reused.
importScripts('distribution-engine.js?v=1');

var solver = null, cities = null;
var ready = fetch('data/distribution.json?v=1')
  .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function (d) { cities = d.cities; solver = new self.DistributionEngine.Solver(cities); });

self.onmessage = function (e) {
  var msg = e.data;
  ready.then(function () {
    var t = Date.now();
    var res = solver.solve(msg.opts);
    self.postMessage({ id: msg.id, centers: res.centers, assign: Array.from(res.assign), avgKm: res.avgKm,
      share: res.share, farShare: res.farShare, passes: res.passes, ms: Date.now() - t });
  }).catch(function (err) { self.postMessage({ id: msg.id, error: String(err && err.message || err) }); });
};

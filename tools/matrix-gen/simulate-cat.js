// simulate-cat.js — Monte-Carlo CAT validity study for js/irt-engine.js.
// 5,000 virtual test takers, true theta ~ N(0,1), each takes a 20-item adaptive
// test (Maximum Fisher Information selection + EAP estimation). Responses are
// simulated from the 2PL model: P = 1 / (1 + exp(-a*(theta - b))).
// Reports Pearson r(true, estimated); validity criterion r > 0.85.
// Exit code: 0 = PASS, 1 = FAIL.
// Usage: node simulate-cat.js --n=5000 --len=20 --seed=20260928 --bank=itemBank.json --gridstep=0.05
const fs = require('fs');
const path = require('path');
const engineMod = require('../../js/irt-engine.js');
const IrtEngine = engineMod.IrtEngine || engineMod;
const { makeRng } = require('./lib/rng');

function args() {
  const o = { n: 5000, len: 20, seed: 20260928, bank: 'itemBank.json', gridstep: 0.05 };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) o[m[1]] = m[2];
  }
  o.n = parseInt(o.n, 10) || 5000;
  o.len = parseInt(o.len, 10) || 20;
  o.seed = parseInt(o.seed, 10) || 20260928;
  o.gridstep = parseFloat(o.gridstep) || 0.05;
  return o;
}

/** Standard-normal draw via Box-Muller on the seeded stream (with spare). */
function makeRandn(rng) {
  let spare = null;
  return function () {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u1 = 0;
    while (u1 <= 0) u1 = rng(); // avoid log(0)
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  };
}

function pearson(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function sd(a, m) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - m; s += d * d; }
  return Math.sqrt(s / a.length);
}

function main() {
  const o = args();
  const bankPath = path.join(__dirname, o.bank);
  if (!fs.existsSync(bankPath)) {
    console.error('Item bank not found: ' + bankPath);
    console.error('Run first: node build-bank.js --count=100 --seed=7 --out=' + o.bank);
    process.exit(2);
  }
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  if (!Array.isArray(bank) || bank.length < o.len) {
    console.error('Bank has ' + (bank && bank.length) + ' items but test length is ' + o.len + '. Generate a bigger bank.');
    process.exit(2);
  }
  const eng = new IrtEngine({ gridStep: o.gridstep });
  const rng = makeRng(o.seed);
  const randn = makeRandn(rng);
  const t0 = Date.now();

  const trueT = new Array(o.n);
  const estT = new Array(o.n);
  const estSE = new Array(o.n);
  let sumBias = 0, sumSE2 = 0, inCI = 0;

  for (let s = 0; s < o.n; s++) {
    const truth = randn();
    trueT[s] = truth;
    let thetaHat = 0; // CAT always starts at the population mean
    const used = new Set();
    const items = [];
    const resps = [];
    for (let t = 0; t < o.len; t++) {
      const item = eng.selectNextCATItem(thetaHat, bank, used);
      if (!item) break;
      used.add(item.id);
      items.push(item);
      // 2PL response: c = 0 by construction of the bank.
      let z = item.a * (truth - item.b);
      if (z > 30) z = 30; else if (z < -30) z = -30;
      const p = 1 / (1 + Math.exp(-z));
      resps.push(rng() < p ? 1 : 0);
      // Live CAT update: re-estimate EAP after each response.
      const e = eng.estimateThetaEAP(resps, items);
      thetaHat = e.theta;
    }
    const fin = eng.estimateThetaEAP(resps, items);
    estT[s] = fin.theta;
    estSE[s] = fin.se;
    sumBias += fin.theta - truth;
    sumSE2 += fin.se * fin.se;
    if (Math.abs(truth - fin.theta) <= 1.96 * fin.se) inCI++;
    if ((s + 1) % 1000 === 0) console.log('... ' + (s + 1) + '/' + o.n + ' simulated');
  }

  const r = pearson(trueT, estT);
  const mT = mean(trueT), mE = mean(estT);
  const rmse = Math.sqrt(trueT.reduce(function (s, t, i) { const d = estT[i] - t; return s + d * d; }, 0) / o.n);
  const bias = sumBias / o.n;
  const meanSE = Math.sqrt(sumSE2 / o.n);
  const cover = 100 * inCI / o.n;
  const secs = (Date.now() - t0) / 1000;

  console.log('==============================================================');
  console.log(' CAT SIMULATION — EAP validity study');
  console.log('--------------------------------------------------------------');
  console.log(' sims      : ' + o.n);
  console.log(' test len  : ' + o.len + ' items (adaptive, max Fisher info)');
  console.log(' bank      : ' + bank.length + ' 2PL items (seed-bank independent stream)');
  console.log(' true th   : mean=' + mT.toFixed(3) + ' sd=' + sd(trueT, mT).toFixed(3));
  console.log(' est th    : mean=' + mE.toFixed(3) + ' sd=' + sd(estT, mE).toFixed(3));
  console.log('--------------------------------------------------------------');
  console.log(' Pearson r : ' + r.toFixed(4) + '   (criterion: r > 0.85)');
  console.log(' RMSE      : ' + rmse.toFixed(4) + ' theta units');
  console.log(' bias      : ' + bias.toFixed(4) + ' (mean est - true; EAP shrinks mildly to 0)');
  console.log(' mean SE   : ' + meanSE.toFixed(4) + ' (posterior SD, ~RMSE when calibrated)');
  console.log(' 95% cover : ' + cover.toFixed(1) + '% of true thetas inside EAP 95% CI');
  console.log(' time      : ' + secs.toFixed(1) + 's');
  console.log('--------------------------------------------------------------');
  if (r > 0.85) { console.log(' RESULT: PASS — engine meets the r > 0.85 validity criterion.'); process.exit(0); }
  else { console.log(' RESULT: FAIL — r <= 0.85. Inspect bank spread / test length.'); process.exit(1); }
}

main();

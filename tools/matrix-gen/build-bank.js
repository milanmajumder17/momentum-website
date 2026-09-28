// build-bank.js — synthetic 2PL calibration bank for CAT simulation.
// Carpenter-Just-Shell (1990) banding: difficulty bands map to the 5 matrix
// rules (complexity 1..5). Seeded via lib/rng for reproducibility.
// Usage: node build-bank.js --count=100 --seed=7 --out=itemBank.json
const fs = require('fs');
const path = require('path');
const { makeRng } = require('./lib/rng');

function args() {
  const o = { count: 100, seed: 7, out: 'itemBank.json' };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) o[m[1]] = m[2];
  }
  o.count = parseInt(o.count, 10) || 100;
  o.seed = parseInt(o.seed, 10) || 7;
  return o;
}

// Difficulty bands mirror tools/matrix-gen IRT mapping (b -3..+3, wider than
// the -2.5..+2.5 generator range so CAT has items at the ability extremes).
const BANDS = [
  { rule: 'constant',     complexity: 1, lo: -3.0, hi: -1.8 },
  { rule: 'progression',  complexity: 2, lo: -1.8, hi: -0.6 },
  { rule: 'xor',          complexity: 3, lo: -0.6, hi:  0.6 },
  { rule: 'distribution', complexity: 4, lo:  0.6, hi:  1.8 },
  { rule: 'rotation',     complexity: 5, lo:  1.8, hi:  3.0 },
];

function main() {
  const o = args();
  const rng = makeRng(o.seed);
  const bank = [];
  for (let i = 0; i < o.count; i++) {
    const band = BANDS[i % BANDS.length]; // round-robin => balanced bank
    const b = band.lo + rng() * (band.hi - band.lo);
    const a = 0.7 + rng() * 1.1; // discrimination 0.7..1.8 (typical 2PL range)
    bank.push({
      id: 'ITM' + String(i + 1).padStart(3, '0'),
      a: Math.round(a * 1000) / 1000,
      b: Math.round(b * 1000) / 1000,
      c: 0, // 2PL: no guessing parameter
      rule: band.rule,
      complexity: band.complexity,
    });
  }
  // Shuffle so bank order carries no difficulty signal.
  for (let i = bank.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = bank[i]; bank[i] = bank[j]; bank[j] = t;
  }
  const outPath = path.join(__dirname, o.out);
  fs.writeFileSync(outPath, JSON.stringify(bank, null, 2), 'utf8');
  const bs = bank.map(function (x) { return x.b; });
  console.log('Wrote ' + bank.length + ' 2PL items -> ' + outPath);
  console.log('b range: [' + Math.min.apply(null, bs).toFixed(2) + ', ' + Math.max.apply(null, bs).toFixed(2) + ']');
}

main();

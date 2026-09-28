// Rule 2: Quantitative pairwise progression — dot count increases across row.
// Complexity 2 -> b=-1.25. Row pattern: n, n+step, n+2*step.
const { dotGrid } = require('./svg');
function generate(rng, cell) {
  const cx = cell / 2, cy = cell / 2, spread = 20;
  const start = 1 + Math.floor(rng() * 2); // 1..2
  const step = rng() < 0.5 ? 1 : 2;
  const grid = [];
  for (let r = 0; r < 3; r++) {
    grid[r] = [];
    for (let c = 0; c < 3; c++) {
      const n = start + c * step;
      grid[r][c] = { svg: dotGrid(n, cx, cy, spread), count: n };
    }
  }
  const correctCount = start + 2 * step;
  const cand = [correctCount - 1, correctCount, correctCount + 1, correctCount + 2].filter(n => n >= 1 && n <= 8);
  while (cand.length < 4) cand.push(correctCount + cand.length + 1);
  const options = cand.slice(0, 4);
  const order = options.map((v, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const optCell = 70;
  const { dotGrid: dg } = require('./svg');
  const optionSvgs = order.map(i => dg(options[i], optCell / 2, optCell / 2, 18));
  const key = order.indexOf(options.indexOf(correctCount));
  return { grid, missing: [2, 2], optionSvgs, key, optionKinds: order.map(i => 'n=' + options[i]) };
}
module.exports = { generate };

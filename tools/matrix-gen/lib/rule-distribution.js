// Rule 4: Distribution of 3 values — each row is a permutation of {A,B,C}.
// Complexity 4 -> b=+1.25. Latin-square style; answer completes row 3.
const { shapeSVG } = require('./svg');
function generate(rng, cell) {
  const cx = cell / 2, cy = cell / 2, size = 34;
  const kinds = ['circle', 'triangle', 'square'];
  function perm(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  const grid = [];
  const rows = [perm(kinds), perm(kinds), perm(kinds)];
  for (let r = 0; r < 3; r++) { grid[r] = []; for (let c = 0; c < 3; c++) grid[r][c] = { svg: shapeSVG(rows[r][c], cx, cy, size), kind: rows[r][c] }; }
  const correct = rows[2][2];
  const options = [correct].concat(kinds.filter(k => k !== correct));
  // need 4 options: add a size-variant distractor of correct
  options.push(correct + '*');
  const order = options.map((v, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const optionSvgs = order.map(i => {
    const k = options[i];
    const base = k.replace('*', '');
    const sz = k.endsWith('*') ? size * 0.55 : size;
    return shapeSVG(base, 35, 35, sz);
  });
  const key = order.indexOf(0);
  return { grid, missing: [2, 2], optionSvgs, key, optionKinds: order.map(i => options[i]) };
}
module.exports = { generate };

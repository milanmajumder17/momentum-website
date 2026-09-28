// Rule 3: Figure addition/subtraction (XOR) — row3 = row1 XOR row2 element-wise.
// Complexity 3 -> b=0.0. Bits: circle bit + square bit per cell.
const { shapeSVG } = require('./svg');
function bitsToSVG(bits, cx, cy, size) {
  // bits: 0..3 -> circle if bit0, square if bit1
  let s = '';
  if (bits & 1) s += shapeSVG('circle', cx, cy - (bits & 2 ? 8 : 0), size * 0.8);
  if (bits & 2) s += shapeSVG('square', cx, cy + (bits & 1 ? 8 : 0), size * 0.8);
  if (bits === 0) s += '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#8a6d47"/>';
  return s;
}
function generate(rng, cell) {
  const cx = cell / 2, cy = cell / 2, size = 30;
  const grid = [];
  const rowPairs = [];
  for (let r = 0; r < 3; r++) {
    const a = Math.floor(rng() * 4), b = Math.floor(rng() * 4);
    const c = a ^ b;
    rowPairs.push([a, b, c]);
    grid[r] = [{ svg: bitsToSVG(a, cx, cy, size), bits: a }, { svg: bitsToSVG(b, cx, cy, size), bits: b }, { svg: bitsToSVG(c, cx, cy, size), bits: c }];
  }
  const correct = rowPairs[2][2];
  const candSet = [correct];
  for (let v = 0; v < 4 && candSet.length < 4; v++) if (candSet.indexOf(v) < 0) candSet.push(v);
  const order = candSet.map((v, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const optCell = 70;
  const optionSvgs = order.map(i => bitsToSVG(candSet[i], optCell / 2, optCell / 2, 28));
  const key = order.indexOf(0);
  return { grid, missing: [2, 2], optionSvgs, key, optionKinds: order.map(i => 'bits=' + candSet[i]) };
}
module.exports = { generate };

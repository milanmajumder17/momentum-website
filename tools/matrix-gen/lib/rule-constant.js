// Rule 1: Constant in a row — same shape across each row (vary per row).
// Complexity 1 -> b=-2.5. Easiest: correspondence/identity only.
const { shapeSVG } = require('./svg');
const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
function generate(rng, cell) {
  const cx = cell / 2, cy = cell / 2, size = 34;
  const rowShapes = [0, 1, 2].map(() => SHAPES[Math.floor(rng() * SHAPES.length)]);
  const grid = [];
  for (let r = 0; r < 3; r++) {
    grid[r] = [];
    for (let c = 0; c < 3; c++) grid[r][c] = { svg: shapeSVG(rowShapes[r], cx, cy, size) };
  }
  // answer = row 3 shape; distractors = other shapes
  const correct = rowShapes[2];
  const distract = SHAPES.filter(s => s !== correct);
  const options = [correct].concat(distract.slice(0, 3));
  // shuffle but track key
  const order = options.map((s, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const optionSvgs = order.map(i => shapeSVG(options[i], cell / 2, cell / 2, size));
  const key = order.indexOf(0);
  return { grid, missing: [2, 2], optionSvgs, key, optionKinds: order.map(i => options[i]) };
}
module.exports = { generate };

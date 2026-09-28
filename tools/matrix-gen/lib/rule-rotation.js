// Rule 5: Spatial rotation — arrow rotates 90 deg across each row.
// Complexity 5 -> b=+2.5. Row: 0,90,180 (missing 180 -> answer).
function arrowSVG(cx, cy, size, deg) {
  const s = size / 2;
  return '<g transform="translate(' + cx + ',' + cy + ') rotate(' + deg + ')" fill="none" stroke="#3b2a1a" stroke-width="3" stroke-linejoin="round">'
    + '<polygon points="0,' + (-s) + ' ' + s + ',' + s + ' 0,' + (s * 0.35) + ' ' + (-s) + ',' + s + '"/></g>';
}
function generate(rng, cell) {
  const cx = cell / 2, cy = cell / 2, size = 40;
  const starts = [0, 1, 2].map(() => Math.floor(rng() * 4) * 90);
  const grid = [];
  for (let r = 0; r < 3; r++) {
    grid[r] = [];
    for (let c = 0; c < 3; c++) {
      const deg = (starts[r] + c * 90) % 360;
      grid[r][c] = { svg: arrowSVG(cx, cy, size, deg), deg };
    }
  }
  const correct = (starts[2] + 180) % 360;
  const options = [0, 90, 180, 270];
  const order = options.map((v, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const optionSvgs = order.map(i => arrowSVG(35, 35, 36, options[i]));
  const key = order.indexOf(options.indexOf(correct));
  return { grid, missing: [2, 2], optionSvgs, key, optionKinds: order.map(i => options[i] + 'deg') };
}
module.exports = { generate };

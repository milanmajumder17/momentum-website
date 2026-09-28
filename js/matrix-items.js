/* ============================================================================
 * matrix-items.js — Browser-side matrix stimulus renderer + item generator.
 * Companion to tools/matrix-gen (Node). Same 5 Carpenter-Just-Shell (1990)
 * rules, re-implemented dependency-free for the browser. Each generator
 * returns a 3x3 grid (missing cell = index 8) plus SIX shuffled SVG options.
 * Theme-aware: strokes use currentColor, so classic/dark themes just work.
 * Browser: <script src="js/matrix-items.js"> -> window.MatrixItems
 * Node (tests): require() works via the export guard at the bottom.
 * ========================================================================== */
'use strict';

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shapeSVG(kind, cx, cy, size, fill, stroke) {
  const f = fill || 'none';
  const st = stroke || 'currentColor';
  const sw = 2.5;
  if (kind === 'circle') return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (size / 2) + '" fill="' + f + '" stroke="' + st + '" stroke-width="' + sw + '"/>';
  if (kind === 'square') return '<rect x="' + (cx - size / 2) + '" y="' + (cy - size / 2) + '" width="' + size + '" height="' + size + '" fill="' + f + '" stroke="' + st + '" stroke-width="' + sw + '"/>';
  if (kind === 'triangle') {
    const h = size * 0.866;
    return '<polygon points="' + cx + ',' + (cy - h / 2) + ' ' + (cx - size / 2) + ',' + (cy + h / 2) + ' ' + (cx + size / 2) + ',' + (cy + h / 2) + '" fill="' + f + '" stroke="' + st + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
  }
  if (kind === 'diamond') {
    return '<polygon points="' + cx + ',' + (cy - size / 2) + ' ' + (cx + size / 2) + ',' + cy + ' ' + cx + ',' + (cy + size / 2) + ' ' + (cx - size / 2) + ',' + cy + '" fill="' + f + '" stroke="' + st + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
  }
  if (kind === 'arrow') {
    const s = size / 2;
    return '<g transform="translate(' + cx + ',' + cy + ')" fill="' + f + '" stroke="' + st + '" stroke-width="' + sw + '" stroke-linejoin="round"><polygon points="0,' + (-s) + ' ' + s + ',' + s + ' 0,' + (s * 0.35) + ' ' + (-s) + ',' + s + '"/></g>';
  }
  if (kind === 'L') {
    const s = size / 2;
    return '<g transform="translate(' + cx + ',' + cy + ')" fill="none" stroke="' + st + '" stroke-width="' + (sw + 1) + '" stroke-linecap="round"><path d="M ' + (-s) + ' ' + (-s) + ' L ' + (-s) + ' ' + s + ' L ' + s + ' ' + s + '"/></g>';
  }
  return '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + st + '"/>';
}

function dotGrid(n, cx, cy, spread, color) {
  const col = color || 'currentColor';
  let s = '';
  const cols = n <= 3 ? n : 3;
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const x = cx + (c - (inRow - 1) / 2) * spread;
    const y = cy + (r - (rows - 1) / 2) * spread;
    s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" fill="' + col + '"/>';
  }
  return s;
}

function arrowSVG(cx, cy, size, deg) {
  const s = size / 2;
  return '<g transform="translate(' + cx + ',' + cy + ') rotate(' + deg + ')" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><polygon points="0,' + (-s) + ' ' + s + ',' + s + ' 0,' + (s * 0.35) + ' ' + (-s) + ',' + s + '"/></g>';
}

function bitsToSVG(bits, cx, cy, size) {
  let s = '';
  if (bits & 1) s += shapeSVG('circle', cx, cy - ((bits & 2) ? 7 : 0), size * 0.8);
  if (bits & 2) s += shapeSVG('square', cx, cy + ((bits & 1) ? 7 : 0), size * 0.8);
  if (bits === 0) s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="currentColor"/>';
  return s;
}

/** Wrap inner SVG content in a square cell canvas. */
function cellSVG(inner) {
  return '<svg viewBox="0 0 60 60" width="100%" height="100%" aria-hidden="true">' + inner + '</svg>';
}

function shuffledIdx(rng, n) {
  const o = [];
  for (let i = 0; i < n; i++) o.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = o[i]; o[i] = o[j]; o[j] = t;
  }
  return o;
}


/* ---- 5 rule generators: each returns {cells:[9 svg strings, idx8='?'], options:[6 svg strings], key} ---- */

function genConstant(rng) {
  const SH = ['circle', 'square', 'triangle', 'diamond', 'arrow', 'L'];
  const rowKind = [0, 1, 2].map(function () { return SH[Math.floor(rng() * SH.length)]; });
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    cells.push(c === 2 && r === 2 ? '?' : cellSVG(shapeSVG(rowKind[r], 30, 30, 30)));
  }
  const correct = rowKind[2];
  const distract = shuffledIdx(rng, SH.length).map(function (i) { return SH[i]; }).filter(function (k) { return k !== correct; }).slice(0, 5);
  const kinds = [correct].concat(distract);
  const order = shuffledIdx(rng, 6);
  return { cells: cells, options: order.map(function (i) { return cellSVG(shapeSVG(kinds[i], 30, 30, 30)); }), key: order.indexOf(0) };
}

function genProgression(rng) {
  const start = 1 + Math.floor(rng() * 2); // 1..2
  const step = rng() < 0.5 ? 1 : 2;
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const n = start + c * step;
    cells.push(c === 2 && r === 2 ? '?' : cellSVG(dotGrid(n, 30, 30, 15)));
  }
  const correct = start + 2 * step;
  const pool = [];
  for (let d = -2; d <= 3 && pool.length < 10; d++) {
    const v = correct + d;
    if (v >= 1 && v <= 8 && v !== correct) pool.push(v);
  }
  const distract = shuffledIdx(rng, pool.length).map(function (i) { return pool[i]; }).slice(0, 5);
  const counts = [correct].concat(distract);
  const order = shuffledIdx(rng, 6);
  return { cells: cells, options: order.map(function (i) { return cellSVG(dotGrid(counts[i], 30, 30, 14)); }), key: order.indexOf(0) };
}

function genXor(rng) {
  const cells = [];
  let correct = 0;
  for (let r = 0; r < 3; r++) {
    const a = Math.floor(rng() * 4), b = Math.floor(rng() * 4), c = a ^ b;
    const row = [a, b, c];
    for (let col = 0; col < 3; col++) {
      if (r === 2 && col === 2) { cells.push('?'); correct = c; }
      else cells.push(cellSVG(bitsToSVG(row[col], 30, 30, 26)));
    }
  }
  const pool = [0, 1, 2, 3, 4, 5].map(function (v) { return v === 4 ? 'circle-big' : (v === 5 ? 'square-big' : v); });
  const distract = shuffledIdx(rng, 6).map(function (i) { return pool[i]; }).filter(function (v) { return v !== correct; }).slice(0, 5);
  const vals = [correct].concat(distract);
  const order = shuffledIdx(rng, 6);
  const opt = order.map(function (i) {
    const v = vals[i];
    if (v === 'circle-big') return cellSVG(shapeSVG('circle', 30, 30, 34));
    if (v === 'square-big') return cellSVG(shapeSVG('square', 30, 30, 34));
    return cellSVG(bitsToSVG(v, 30, 30, 24));
  });
  return { cells: cells, options: opt, key: order.indexOf(0) };
}

function genDistribution(rng) {
  const kinds = ['circle', 'triangle', 'square'];
  function perm() {
    const a = kinds.slice(), o = [];
    while (a.length) o.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
    return o;
  }
  const rows = [perm(), perm(), perm()];
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    cells.push(c === 2 && r === 2 ? '?' : cellSVG(shapeSVG(rows[r][c], 30, 30, 30)));
  }
  const correct = rows[2][2];
  // 5 distractors: other 2 shapes (2 sizes each) + rotated L
  const others = kinds.filter(function (k) { return k !== correct; });
  const distractSvgs = [
    cellSVG(shapeSVG(others[0], 30, 30, 30)),
    cellSVG(shapeSVG(others[1], 30, 30, 30)),
    cellSVG(shapeSVG(others[0], 30, 30, 17)),
    cellSVG(shapeSVG(others[1], 30, 30, 17)),
    cellSVG('<g transform="translate(30,30) rotate(90)"> ' + shapeSVG('L', 0, 0, 30).replace('translate(0,0)', 'translate(0,0)') + ' </g>')
  ];
  const opts = [cellSVG(shapeSVG(correct, 30, 30, 30))].concat(distractSvgs);
  const order = shuffledIdx(rng, 6);
  return { cells: cells, options: order.map(function (i) { return opts[i]; }), key: order.indexOf(0) };
}

// (legacy duplicate genRotation with broken key expression removed — canonical version below)


function genRotation(rng) {
  const starts = [0, 1, 2].map(function () { return Math.floor(rng() * 4) * 90; });
  const cells = [];
  let correct = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const deg = (starts[r] + c * 90) % 360;
    if (r === 2 && c === 2) { cells.push('?'); correct = deg; }
    else cells.push(cellSVG(arrowSVG(30, 30, 34, deg)));
  }
  // distractors: other 3 rotations + 45deg-off + small-size twin of correct
  const others = [0, 90, 180, 270].filter(function (d) { return d !== correct; });
  const pool = [cellSVG(arrowSVG(30, 30, 34, correct))];
  others.forEach(function (d) { pool.push(cellSVG(arrowSVG(30, 30, 34, d))); });
  pool.push(cellSVG(arrowSVG(30, 30, 34, (correct + 45) % 360)));
  pool.push(cellSVG(arrowSVG(30, 30, 24, correct)));
  const order = shuffledIdx(rng, 6);
  return { cells: cells, options: order.map(function (i) { return pool[i]; }), key: order.indexOf(0) };
}

/**
 * Main entry: build a live stimulus for a bank item.
 * @param {Object} bankItem {id,a,b,c,rule}
 * @param {number} seedInt integer seed (e.g. Date.now()%100000 + questionIndex*7919)
 * @returns {{cells, options, key, rule, id}}
 */
function generateForItem(bankItem, seedInt) {
  const rng = mulberry32((seedInt >>> 0) || 1);
  const rule = (bankItem && bankItem.rule) || 'xor';
  let g;
  if (rule === 'constant') g = genConstant(rng);
  else if (rule === 'progression') g = genProgression(rng);
  else if (rule === 'distribution') g = genDistribution(rng);
  else if (rule === 'rotation') g = genRotation(rng);
  else g = genXor(rng);
  g.rule = rule;
  g.id = bankItem ? bankItem.id : 'ITM?';
  return g;
}

var MatrixItems = {
  generateForItem: generateForItem,
  genConstant: genConstant, genProgression: genProgression, genXor: genXor,
  genDistribution: genDistribution, genRotation: genRotation,
  cellSVG: cellSVG, shapeSVG: shapeSVG, dotGrid: dotGrid, mulberry32: mulberry32
};
// Browser global + CommonJS export (matches irt-engine.js / tools style).
(function (root, mod) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = mod; }
  if (typeof root !== 'undefined') { try { root.MatrixItems = mod.MatrixItems || mod; } catch (e) {} }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), { MatrixItems: MatrixItems });

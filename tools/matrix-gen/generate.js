// Matrix Reasoning SVG generator — Carpenter, Just & Shell (1990).
// Usage: node generate.js --rule=all|constant|progression|xor|distribution|rotation --count=N --seed=S
const fs = require('fs');
const path = require('path');
const { makeRng } = require('./lib/rng');
const { RULES } = require('./lib/irt');
const { renderMatrixSVG, renderOptionsSVG } = require('./lib/svg');

const RULE_MODS = {
  constant: require('./lib/rule-constant'),
  progression: require('./lib/rule-progression'),
  xor: require('./lib/rule-xor'),
  distribution: require('./lib/rule-distribution'),
  rotation: require('./lib/rule-rotation'),
};

function args() {
  const o = { rule: 'all', count: 2, seed: 42 };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) o[m[1]] = m[2];
  }
  o.count = parseInt(o.count, 10) || 2;
  o.seed = parseInt(o.seed, 10) || 42;
  return o;
}

function main() {
  const o = args();
  const rules = o.rule === 'all' ? Object.keys(RULE_MODS) : [o.rule];
  for (const r of rules) if (!RULE_MODS[r]) { console.error('Unknown rule: ' + r); process.exit(1); }
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const meta = [];
  let n = 0;
  for (const r of rules) {
    for (let i = 0; i < o.count; i++) {
      const rng = makeRng(o.seed * 100003 + n * 1009 + r.length * 77);
      const cell = 90;
      const g = RULE_MODS[r].generate(rng, cell);
      const matrix = renderMatrixSVG(g.grid, { cell, missing: g.missing });
      const opts = renderOptionsSVG(g.optionSvgs, { cell: 70 });
      const id = r.slice(0, 3).toUpperCase() + String(i + 1).padStart(3, '0');
      fs.writeFileSync(path.join(outDir, 'matrix_' + id + '.svg'), matrix, 'utf8');
      fs.writeFileSync(path.join(outDir, 'matrix_' + id + '_options.svg'), opts, 'utf8');
      meta.push({
        item_id: id, rule: r,
        complexity: RULES[r].complexity, irt_b: RULES[r].b,
        correct_answer_position: g.key, options: g.optionKinds,
        missing: g.missing, seed: o.seed,
      });
      n++;
    }
  }
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('Generated ' + n + ' items -> ' + outDir);
  for (const m of meta) console.log(m.item_id + ' rule=' + m.rule + ' c=' + m.complexity + ' b=' + m.irt_b + ' key=' + m.correct_answer_position);
}
main();

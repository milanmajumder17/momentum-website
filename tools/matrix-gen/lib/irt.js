// IRT mapping: Cognitive Complexity (1-5) -> difficulty b (-2.5..+2.5)
// Carpenter, Just & Shell (1990): difficulty ~= number of rules + working-memory load.
// Linear map: b = -2.5 + (c - 1) * 1.25
function complexityToB(c) { return -2.5 + (c - 1) * 1.25; }
const RULES = {
  constant:     { complexity: 1, b: complexityToB(1) }, // -2.5
  progression:  { complexity: 2, b: complexityToB(2) }, // -1.25
  xor:          { complexity: 3, b: complexityToB(3) }, //  0.0
  distribution: { complexity: 4, b: complexityToB(4) }, // +1.25
  rotation:     { complexity: 5, b: complexityToB(5) }, // +2.5
};
module.exports = { complexityToB, RULES };

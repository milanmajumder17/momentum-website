// ============================================================
// Memorizer Engine Tests — Node.js test runner
// Run: node --test tests/engine.test.mjs
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const enginePath = join(__dirname, '../js/memorizer/engine.js');
const engineCode = readFileSync(enginePath, 'utf-8');

// Polyfill for UMD
globalThis.self = globalThis;
global.self = global;

// Execute the UMD code
const fn = new Function('module', 'exports', engineCode + '\nreturn typeof MemorizerEngine !== "undefined" ? MemorizerEngine : module.exports;');
const moduleObj = { exports: {} };
const MemorizerEngine = fn(moduleObj, moduleObj.exports) || moduleObj.exports;

const SAMPLE_DATA = {
  chunks: [{
    id: 1, title: "Test", text: "Sample", highlights: ["Sample"], complexity: "medium",
    lines: [{ line_id: "1-1", text: "L1" }, { line_id: "1-2", text: "L2" }],
    questions: [
      { id: "q1", line_id: "1-1", type: "mcq", q: "Q1?", options: ["A", "B", "C", "D"], answer: 0, explanation: "A" },
      { id: "q2", line_id: "1-1", type: "mcq", q: "Q2?", options: ["A", "B", "C", "D"], answer: 1, explanation: "B" },
      { id: "q3", line_id: "1-2", type: "mcq", q: "Q3?", options: ["A", "B", "C", "D"], answer: 2, explanation: "C" }
    ]
  }],
  key_notes: ["Note"]
};

test('Engine initializes correctly', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  assert.strictEqual(engine.chunks.length, 1);
  assert.strictEqual(engine.questionBank[1].length, 3);
  assert.strictEqual(engine.state, 'home');
});

test('startChunk sets current chunk', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  assert.strictEqual(engine.currentChunk, 1);
  assert.strictEqual(engine.state, 'reading');
});

test('startRound generates questions', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  const round = engine.startRound();
  assert(round !== null);
  assert(round.questions.length > 0);
  assert.strictEqual(engine.state, 'round');
});

test('submitAnswer records responses', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  engine.startRound();
  engine.submitAnswer(0, engine.currentRound.questions[0].answer);
  assert.strictEqual(engine.currentRound.responses.length, 1);
});

test('finishRound calculates score', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  engine.startRound();
  for (let i = 0; i < engine.currentRound.questions.length; i++) {
    engine.submitAnswer(i, engine.currentRound.questions[i].answer);
  }
  const result = engine.finishRound();
  assert.strictEqual(result.score, 1.0);
  assert.strictEqual(result.passed, true);
});

test('serialize and deserialize work', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  const serialized = engine.serialize();
  const engine2 = new MemorizerEngine();
  assert.strictEqual(engine2.deserialize(serialized), true);
  assert.strictEqual(engine2.currentChunk, 1);
});

test('getWrongAnswers returns UI-ready shape', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  engine.startRound();
  // answer first question wrong on purpose
  const q0 = engine.currentRound.questions[0];
  const wrongPick = (q0.answer + 1) % 4;
  engine.submitAnswer(0, wrongPick);
  for (let i = 1; i < engine.currentRound.questions.length; i++) {
    engine.submitAnswer(i, engine.currentRound.questions[i].answer);
  }
  const result = engine.finishRound();
  assert(result.wrongAnswers.length >= 1);
  const w = result.wrongAnswers[0];
  assert.strictEqual(typeof w.q, 'string');
  assert(Array.isArray(w.options) && w.options.length === 4);
  assert(typeof w.answer === 'number');
});

test('flagQuestion marks question', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.flagQuestion('q1');
  assert.strictEqual(engine.flaggedQuestions['q1'], true);
});

test('mastery progress tracks best score', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  engine.startRound();
  for (let i = 0; i < engine.currentRound.questions.length; i++) {
    engine.submitAnswer(i, engine.currentRound.questions[i].answer);
  }
  engine.finishRound();
  const prog = engine.getMasteryProgress();
  assert.strictEqual(prog.length, 1);
  assert.strictEqual(prog[0].bestScore, 1.0);
});

test('startNextChunk returns null when single chunk not mastered', () => {
  const engine = new MemorizerEngine();
  engine.init(SAMPLE_DATA);
  engine.startChunk(1);
  engine.startRound();
  // answer everything wrong -> score 0
  for (let i = 0; i < engine.currentRound.questions.length; i++) {
    engine.submitAnswer(i, (engine.currentRound.questions[i].answer + 1) % 4);
  }
  engine.finishRound();
  const nxt = engine.startNextChunk();
  assert.strictEqual(nxt, null);
});

console.log('✅ All tests passed!');

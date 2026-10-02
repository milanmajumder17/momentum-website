// ============================================================
// Memorizer Engine — Pure Logic (UMD pattern for browser + Node)
// No DOM, no AI calls — just the state machine, round generation,
// scoring, persistence, and mastery tracking.
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MemorizerEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ========== CONFIG ==========
  var CONFIG = {
    ROUND_SIZE: { easy: 10, medium: 15, hard: 20 },
    MASTERY_THRESHOLD: 0.95,
    WRONG_WEIGHT: 3,
    CORRECT_WEIGHT: 1,
    OLD_CHUNK_QUESTION_RATIO: 0.125, // 10-15% of new chunk rounds
    MIN_ADJACENT_LINE_GAP: 1 // avoid back-to-back same line_id
  };

  // ========== UTILITY ==========
  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
  }

  function sample(arr, n) {
    if (arr.length <= n) return shuffle(arr);
    var copy = arr.slice();
    var result = [];
    for (var i = 0; i < n && copy.length; i++) {
      var idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  function weightedSample(arr, weights, n) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i];
    var result = [];
    var used = {};
    var attempts = 0;
    while (result.length < n && attempts < n * 10) {
      attempts++;
      var r = Math.random() * total;
      var sum = 0;
      for (var j = 0; j < arr.length; j++) {
        sum += weights[j];
        if (r <= sum && !used[j]) {
          result.push(arr[j]);
          used[j] = true;
          break;
        }
      }
    }
    // fill remainder if needed
    for (var k = 0; k < arr.length && result.length < n; k++) {
      if (!used[k]) result.push(arr[k]);
    }
    return result;
  }

  // ========== ENGINE CLASS ==========
  function MemorizerEngine() {
    this.chunks = [];
    this.questionBank = {}; // chunkId -> array of questions
    this.stats = {}; // questionId -> { correct: n, wrong: n, lastResult: bool }
    this.chunkProgress = {}; // chunkId -> { rounds: n, bestScore: 0-1, mastered: bool }
    this.currentChunk = null;
    this.currentRound = null;
    this.currentRoundIndex = 0;
    this.masteredChunks = [];
    this.flaggedQuestions = {}; // questionId -> true
    this.state = 'home'; // home | processing | reading | round | result | mixed | success
    this.history = [];
  }

  MemorizerEngine.prototype.init = function (data) {
    // data: { chunks: [{id, title, text, highlights, complexity, lines, questions}], key_notes }
    this.chunks = data.chunks || [];
    this.questionBank = {};
    this.stats = {};
    this.chunkProgress = {};
    this.masteredChunks = [];
    this.flaggedQuestions = {};
    this.currentChunk = null;
    this.currentRound = null;
    this.currentRoundIndex = 0;
    this.state = 'home';
    this.history = [];
    this.keyNotes = data.key_notes || [];

    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      this.questionBank[chunk.id] = (chunk.questions || []).filter(function (q) {
        return q.id && q.q && q.options && q.options.length === 4 && typeof q.answer === 'number';
      });
      this.chunkProgress[chunk.id] = { rounds: 0, bestScore: 0, mastered: false };
      for (var j = 0; j < this.questionBank[chunk.id].length; j++) {
        var qid = this.questionBank[chunk.id][j].id;
        this.stats[qid] = { correct: 0, wrong: 0, lastResult: null };
      }
    }
  };

  MemorizerEngine.prototype.startChunk = function (chunkId) {
    this.currentChunk = chunkId;
    this.currentRoundIndex = 0;
    this.state = 'reading';
  };

  MemorizerEngine.prototype.startRound = function () {
    if (!this.currentChunk) return null;
    var chunk = this.chunks.find(function (c) { return c.id === this.currentChunk; }.bind(this));
    if (!chunk) return null;

    var roundSize = CONFIG.ROUND_SIZE[chunk.complexity] || CONFIG.ROUND_SIZE.medium;
    var questions = this.generateRound(this.currentChunk, roundSize);
    
    this.currentRound = {
      chunkId: this.currentChunk,
      questions: questions,
      responses: [],
      startTime: Date.now()
    };
    this.state = 'round';
    return this.currentRound;
  };

  MemorizerEngine.prototype.generateRound = function (chunkId, size) {
    var pool = this.questionBank[chunkId] || [];
    var progress = this.chunkProgress[chunkId] || { rounds: 0 };
    var isFirstRound = progress.rounds === 0;
    pool = pool.filter(function (q) { return !this.flaggedQuestions[q.id]; }.bind(this));
    if (pool.length === 0) return [];
    var questions = [];
    var oldChunkCount = 0;
    if (this.masteredChunks.length > 0 && !isFirstRound) {
      oldChunkCount = Math.ceil(size * CONFIG.OLD_CHUNK_QUESTION_RATIO);
      var oldPool = [];
      for (var i = 0; i < this.masteredChunks.length; i++) {
        var oldChunkId = this.masteredChunks[i];
        var oldQuestions = (this.questionBank[oldChunkId] || []).filter(function (q) {
          return !this.flaggedQuestions[q.id];
        }.bind(this));
        oldPool = oldPool.concat(oldQuestions);
      }
      if (oldPool.length > 0) {
        questions = questions.concat(sample(oldPool, Math.min(oldChunkCount, oldPool.length)));
      }
    }
    var currentChunkSize = size - questions.length;
    if (isFirstRound) {
      var lineMap = {};
      for (var j = 0; j < pool.length; j++) {
        var lid = pool[j].line_id || 'unknown';
        if (!lineMap[lid]) lineMap[lid] = [];
        lineMap[lid].push(pool[j]);
      }
      var lines = Object.keys(lineMap);
      var perLine = Math.ceil(currentChunkSize / lines.length);
      for (var k = 0; k < lines.length && questions.length < size; k++) {
        var lineQuestions = shuffle(lineMap[lines[k]]);
        questions = questions.concat(lineQuestions.slice(0, perLine));
      }
      questions = questions.slice(0, size);
    } else {
      var weights = pool.map(function (q) {
        var stat = this.stats[q.id] || { correct: 0, wrong: 0 };
        var wrongWeight = stat.wrong * CONFIG.WRONG_WEIGHT;
        var correctWeight = stat.correct * CONFIG.CORRECT_WEIGHT;
        return Math.max(1, wrongWeight + correctWeight);
      }.bind(this));
      var sampled = weightedSample(pool, weights, currentChunkSize);
      questions = questions.concat(sampled);
    }
    questions = this.minimizeAdjacentLines(questions);
    questions = questions.map(function (q) {
      var shuffled = shuffle(q.options);
      var newAnswer = shuffled.indexOf(q.options[q.answer]);
      return {
        id: q.id, line_id: q.line_id, type: q.type, q: q.q,
        options: shuffled, answer: newAnswer, originalAnswer: q.answer,
        explanation: q.explanation
      };
    });
    return shuffle(questions);
  };

  MemorizerEngine.prototype.minimizeAdjacentLines = function (questions) {
    if (questions.length < 2) return questions;
    var result = [questions[0]];
    var remaining = questions.slice(1);
    while (remaining.length > 0) {
      var lastLine = result[result.length - 1].line_id;
      var bestIdx = -1, bestScore = -1;
      for (var i = 0; i < remaining.length; i++) {
        var score = remaining[i].line_id !== lastLine ? 1 : 0;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx === -1) bestIdx = 0;
      result.push(remaining.splice(bestIdx, 1)[0]);
    }
    return result;
  };

  MemorizerEngine.prototype.submitAnswer = function (questionIndex, selectedOption) {
    if (!this.currentRound || this.state !== 'round') return;
    var question = this.currentRound.questions[questionIndex];
    if (!question) return;
    var isCorrect = selectedOption === question.answer;
    this.currentRound.responses.push({
      questionId: question.id, selected: selectedOption,
      correct: question.answer, isCorrect: isCorrect
    });
    var stat = this.stats[question.id];
    if (isCorrect) { stat.correct++; stat.lastResult = true; }
    else { stat.wrong++; stat.lastResult = false; }
  };

  MemorizerEngine.prototype.finishRound = function () {
    if (!this.currentRound) return null;
    var responses = this.currentRound.responses;
    var correct = responses.filter(function (r) { return r.isCorrect; }).length;
    var total = this.currentRound.questions.length;
    var score = total > 0 ? correct / total : 0;
    var chunkId = this.currentRound.chunkId;
    var progress = this.chunkProgress[chunkId];
    progress.rounds++;
    progress.bestScore = Math.max(progress.bestScore, score);
    var result = {
      chunkId: chunkId, score: score, correct: correct, total: total,
      passed: score >= CONFIG.MASTERY_THRESHOLD,
      wrongAnswers: this.getWrongAnswers()
    };
    this.history.push({
      type: 'round', chunkId: chunkId,
      roundIndex: this.currentRoundIndex, score: score, timestamp: Date.now()
    });
    this.currentRoundIndex++;
    this.state = 'result';
    return result;
  };

  MemorizerEngine.prototype.getWrongAnswers = function () {
    if (!this.currentRound) return [];
    var wrong = [];
    for (var i = 0; i < this.currentRound.responses.length; i++) {
      var resp = this.currentRound.responses[i];
      if (!resp.isCorrect) {
        var question = null;
        for (var k = 0; k < this.currentRound.questions.length; k++) {
          if (this.currentRound.questions[k].id === resp.questionId) { question = this.currentRound.questions[k]; break; }
        }
        if (question) {
          wrong.push({
            id: question.id, q: question.q, options: question.options,
            answer: question.answer, picked: resp.selected,
            explanation: question.explanation || '', line_id: question.line_id || 'unknown'
          });
        }
      }
    }
    return wrong;
  };

  MemorizerEngine.prototype.checkChunkMastery = function (chunkId) {
    var progress = this.chunkProgress[chunkId];
    if (!progress) return false;
    var mastered = progress.bestScore >= CONFIG.MASTERY_THRESHOLD;
    if (mastered && !progress.mastered) {
      progress.mastered = true;
      if (this.masteredChunks.indexOf(chunkId) === -1) {
        this.masteredChunks.push(chunkId);
      }
    }
    return mastered;
  };

  MemorizerEngine.prototype.getNextChunk = function () {
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      if (!this.chunkProgress[chunk.id].mastered) return chunk.id;
    }
    return null;
  };
  MemorizerEngine.prototype.startNextChunk = function () {
    if (this.currentChunk) this.checkChunkMastery(this.currentChunk);
    var prog = this.currentChunk ? this.chunkProgress[this.currentChunk] : null;
    if (this.currentChunk && (!prog || !prog.mastered)) return null;
    var nxt = this.getNextChunk();
    if (nxt) { this.startChunk(nxt); return nxt; }
    if (this.shouldStartMixedRound()) return 'mixed';
    return null;
  };


  MemorizerEngine.prototype.shouldStartMixedRound = function () {
    return this.masteredChunks.length >= 2 && this.getNextChunk() === null;
  };

  MemorizerEngine.prototype.startMixedRound = function () {
    var allQuestions = [];
    for (var i = 0; i < this.masteredChunks.length; i++) {
      var chunkId = this.masteredChunks[i];
      var questions = (this.questionBank[chunkId] || []).filter(function (q) {
        return !this.flaggedQuestions[q.id];
      }.bind(this));
      allQuestions = allQuestions.concat(questions);
    }
    if (allQuestions.length === 0) { this.state = 'success'; return null; }
    var roundSize = Math.min(20, allQuestions.length);
    var questions = sample(allQuestions, roundSize);
    questions = this.minimizeAdjacentLines(questions);
    questions = questions.map(function (q) {
      var shuffled = shuffle(q.options);
      var newAnswer = shuffled.indexOf(q.options[q.answer]);
      return {
        id: q.id, line_id: q.line_id, type: q.type, q: q.q,
        options: shuffled, answer: newAnswer, originalAnswer: q.answer,
        explanation: q.explanation,
        chunkId: this.masteredChunks.find(function (cid) {
          return (this.questionBank[cid] || []).some(function (bq) { return bq.id === q.id; });
        }.bind(this))
      };
    }.bind(this));
    this.currentRound = {
      chunkId: 'mixed', questions: shuffle(questions), responses: [], startTime: Date.now()
    };
    this.state = 'round';
    return this.currentRound;
  };

  MemorizerEngine.prototype.finishMixedRound = function () {
    if (!this.currentRound || this.currentRound.chunkId !== 'mixed') return null;
    var responses = this.currentRound.responses;
    var correct = responses.filter(function (r) { return r.isCorrect; }).length;
    var total = this.currentRound.questions.length;
    var score = total > 0 ? correct / total : 0;
    var result = {
      chunkId: 'mixed', score: score, correct: correct, total: total,
      passed: score >= CONFIG.MASTERY_THRESHOLD, wrongAnswers: this.getWrongAnswers()
    };
    this.history.push({ type: 'mixed', score: score, timestamp: Date.now() });
    if (result.passed) this.state = 'success';
    else this.state = 'result';
    return result;
  };

  MemorizerEngine.prototype.flagQuestion = function (questionId) {
    this.flaggedQuestions[questionId] = true;
  };

  MemorizerEngine.prototype.getChunkData = function (chunkId) {
    return this.chunks.find(function (c) { return c.id === chunkId; });
  };

  MemorizerEngine.prototype.getMasteryProgress = function () {
    var progress = [];
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      var prog = this.chunkProgress[chunk.id];
      progress.push({
        chunkId: chunk.id, title: chunk.title,
        bestScore: prog.bestScore, mastered: prog.mastered, rounds: prog.rounds
      });
    }
    return progress;
  };

  MemorizerEngine.prototype.serialize = function () {
    return JSON.stringify({
      chunks: this.chunks, keyNotes: this.keyNotes, stats: this.stats,
      chunkProgress: this.chunkProgress, masteredChunks: this.masteredChunks,
      flaggedQuestions: this.flaggedQuestions, currentChunk: this.currentChunk,
      currentRoundIndex: this.currentRoundIndex, state: this.state, history: this.history
    });
  };

  MemorizerEngine.prototype.deserialize = function (json) {
    try {
      var data = JSON.parse(json);
      this.chunks = data.chunks || [];
      this.keyNotes = data.keyNotes || [];
      this.stats = data.stats || {};
      this.chunkProgress = data.chunkProgress || {};
      this.masteredChunks = data.masteredChunks || [];
      this.flaggedQuestions = data.flaggedQuestions || {};
      this.currentChunk = data.currentChunk || null;
      this.currentRoundIndex = data.currentRoundIndex || 0;
      this.state = data.state || 'home';
      this.history = data.history || [];
      this.questionBank = {};
      for (var i = 0; i < this.chunks.length; i++) {
        var chunk = this.chunks[i];
        this.questionBank[chunk.id] = chunk.questions || [];
      }
      return true;
    } catch (e) { return false; }
  };

  return MemorizerEngine;
}));


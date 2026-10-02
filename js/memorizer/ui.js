// ============================================================
// Memorizer UI - DOM rendering + user interactions (classic script)
// Depends on: MemorizerEngine (engine.js), MemorizerAI (ai.js),
//             MOCK_DATA (mock-data.js, only for ?mock=1 testing)
// Usage: var ui = new MemorizerUI('memorizerApp', engine, ai); ui.init();
// Single quotes + concatenation only (no template literals).
// ============================================================
(function (root) {
  'use strict';

  var STORE_KEY = 'memorizer_state';
  var RESULT_KEY = 'memorizer_result';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function el(id) { return document.getElementById(id); }

  function MemorizerUI(containerId, engine, ai) {
    this.c = el(containerId);
    this.e = engine;
    this.ai = ai;
    this.qi = 0;
    this.timerOn = true;
    this.secs = 0;
    this.timer = null;
    var _q = '';
    try { _q = window.location.search || ''; } catch (eQ) {}
    this.mockMode = _q.indexOf('mock=1') > -1;
    this.directMode = _q.indexOf('direct=1') > -1;
    this.lastResult = null;
  }

  MemorizerUI.prototype.init = function () {
    if (!this.c) return;
    this.load();
    var st = this.e.state;
    if (st === 'reading') this.showReading();
    else if (st === 'round') this.resumeRound();
    else if (st === 'result') this.showResult(this.loadResult());
    else if (st === 'success') this.showSuccess();
    else this.showHome();
  };

  /* ---------- persistence ---------- */

  MemorizerUI.prototype.save = function () {
    try { localStorage.setItem(STORE_KEY, this.e.serialize()); } catch (err) {}
  };

  MemorizerUI.prototype.load = function () {
    try {
      var s = localStorage.getItem(STORE_KEY);
      if (s) this.e.deserialize(s);
    } catch (err) {}
  };

  MemorizerUI.prototype.clearSave = function () {
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(RESULT_KEY); } catch (err) {}
    this.lastResult = null;
  };

  MemorizerUI.prototype.storeResult = function (r) {
    this.lastResult = r;
    try { localStorage.setItem(RESULT_KEY, JSON.stringify(r)); } catch (err) {}
  };

  MemorizerUI.prototype.loadResult = function () {
    if (this.lastResult) return this.lastResult;
    try {
      var s = localStorage.getItem(RESULT_KEY);
      return s ? JSON.parse(s) : null;
    } catch (err) { return null; }
  };

  /* ---------- timer ---------- */

  MemorizerUI.prototype.stopTimer = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  };

  MemorizerUI.prototype.startTimer = function () {
    var self = this;
    this.stopTimer();
    if (!this.timerOn) return;
    this.timer = setInterval(function () {
      self.secs++;
      var t = el('memTimer');
      if (t) t.textContent = 'timer ' + Math.floor(self.secs / 60) + ':' + ('0' + (self.secs % 60)).slice(-2);
    }, 1000);
  };

  /* ---------- home / upload ---------- */

  MemorizerUI.prototype.showHome = function () {
    var self = this;
    this.stopTimer();
    this.e.state = 'home';
    var html = ''
      + '<div class="mem-screen"><h2>Upload a Page</h2>'
      + '<p>Take a photo of a textbook page or upload an image. AI will extract the text and generate questions.</p>'
      + '<input type="file" accept="image/*" capture="environment" id="memCapture" style="display:none">'
      + '<input type="file" accept="image/*" id="memUpload" style="display:none">'
      + '<div><button class="btn" id="memCaptureBtn">Take a Photo</button> '
      + '<button class="btn" id="memUploadBtn">Upload</button></div>';
    if (this.mockMode) {
      html += '<div style="margin-top:16px"><button class="btn ghost" id="memMockBtn">Test with MOCK data</button></div>';
    }
    html += '</div>';
    this.c.innerHTML = html;
    el('memCaptureBtn').onclick = function () { el('memCapture').click(); };
    el('memUploadBtn').onclick = function () { el('memUpload').click(); };
    el('memCapture').onchange = function (ev) { self.handleFile(ev.target.files[0]); };
    el('memUpload').onchange = function (ev) { self.handleFile(ev.target.files[0]); };
    var mb = el('memMockBtn');
    if (mb) mb.onclick = function () { self.loadMock(); };
  };

  MemorizerUI.prototype.handleFile = function (file) {
    if (!file) return;
    if (this.mockMode && typeof window.MOCK_DATA !== 'undefined') {
      this.loadMock();
      return;
    }
    var self = this;
    this.showProcessing('Processing image...');
    this.ai.compressImage(file, function (err, blob) {
      if (err) { alert(err.message); self.showHome(); return; }
      self.ai.extractText(blob,
        function (msg) { self.showProcessing(msg); },
        function (err2, data) {
          if (err2) { alert(err2.message); self.showHome(); return; }
          self.beginData(data);
        });
    });
  };

  MemorizerUI.prototype.loadMock = function () {
    var data = window.MOCK_DATA;
    if (!data) { alert('MOCK data not found.'); return; }
    this.showProcessing('Loading MOCK data...');
    var self = this;
    setTimeout(function () { self.beginData(data); }, 400);
  };

  MemorizerUI.prototype.beginData = function (data) {
    if (!data.chunks || data.chunks.length === 0) {
      alert('No text found. Please take a clearer photo.');
      this.showHome();
      return;
    }
    this.clearSave();
    this.e.init(data);
    this.save();
    this.e.startChunk(data.chunks[0].id);
    this.save();
    this.showReading();
  };

  MemorizerUI.prototype.showProcessing = function (msg) {
    this.c.innerHTML = '<div class="mem-screen"><div class="mem-spinner"></div><p>' + esc(msg) + '</p></div>';
  };

  MemorizerUI.prototype.highlightText = function (text, highlights) {
    var out = esc(text);
    if (!highlights) return out;
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      if (!h) continue;
      var eh = esc(h);
      if (out.indexOf(eh) > -1) out = out.split(eh).join('<mark>' + eh + '</mark>');
    }
    return out;
  };

  MemorizerUI.prototype.showReading = function () {
    var self = this;
    this.stopTimer();
    this.e.state = 'reading';
    this.save();
    var ch = this.e.getChunkData(this.e.currentChunk);
    if (!ch) { this.showHome(); return; }
    var html = ''
      + '<div class="mem-screen mem-reading"><h2>' + esc(ch.title) + '</h2>'
      + '<div class="mem-text">' + this.highlightText(ch.text, ch.highlights) + '</div>'
      + '<div class="mem-timer-toggle"><label><input type="checkbox" id="memTimerOn"'
      + (this.timerOn ? ' checked' : '') + '> timer</label> '
      + '<span class="mem-timer" id="memTimer"></span></div>'
      + '<div style="text-align:center"><button class="btn btn-large" id="memStartRound">Quiz</button></div>'
      + '<div style="text-align:center;margin-top:10px"><button class="btn ghost" id="memBackHome">Home</button></div></div>';
    this.c.innerHTML = html;
    var tgl = el('memTimerOn');
    if (tgl) tgl.onchange = function () { self.timerOn = tgl.checked; };
    el('memStartRound').onclick = function () {
      self.secs = 0;
      self.e.startRound();
      self.save();
      self.qi = 0;
      self.startTimer();
      self.showQuestion();
    };
    el('memBackHome').onclick = function () { self.showHome(); };
  };

  MemorizerUI.prototype.resumeRound = function () {
    if (!this.e.currentRound) { this.showReading(); return; }
    this.qi = this.e.currentRound.responses.length || 0;
    if (this.qi >= this.e.currentRound.questions.length) { this.finishAndShow(); return; }
    this.startTimer();
    this.showQuestion();
  };

  MemorizerUI.prototype.showQuestion = function () {
    var self = this;
    var round = this.e.currentRound;
    if (!round) { this.showReading(); return; }
    if (this.qi >= round.questions.length) { this.finishAndShow(); return; }
    var q = round.questions[this.qi];
    var pct = Math.round((this.qi / round.questions.length) * 100);
    var html = ''
      + '<div class="mem-screen mem-round">'
      + '<div class="mem-progress"><div class="mem-progress-bar" style="width:' + pct + '%"></div></div>'
      + '<div class="mem-qnum">' + (this.qi + 1) + ' / ' + round.questions.length + '</div>'
      + '<div class="mem-timer" id="memTimer"></div>'
      + '<div class="mem-question">' + esc(q.q) + '</div>'
      + '<div class="mem-options" id="memOpts"></div>'
      + '<div style="margin-top:14px"><button class="btn ghost" id="memFlag">flag</button> '
      + '<button class="btn ghost" id="memQuit">quit</button></div></div>';
    this.c.innerHTML = html;
    var box = el('memOpts');
    for (var i = 0; i < q.options.length; i++) {
      (function (idx) {
        var b = document.createElement('button');
        b.className = 'mem-option';
        b.textContent = q.options[idx];
        b.onclick = function () { self.answer(idx); };
        box.appendChild(b);
      })(i);
    }
    el('memFlag').onclick = function () {
      self.e.flagQuestion(q.id);
      self.save();
    };
    el('memQuit').onclick = function () { self.stopTimer(); self.showReading(); };
  };

  MemorizerUI.prototype.answer = function (idx) {
    this.e.submitAnswer(this.qi, idx);
    this.save();
    this.qi++;
    if (this.qi >= this.e.currentRound.questions.length) this.finishAndShow();
    else this.showQuestion();
  };

  MemorizerUI.prototype.finishAndShow = function () {
    this.stopTimer();
    var res = null;
    if (this.e.currentRound && this.e.currentRound.chunkId === 'mixed') res = this.e.finishMixedRound();
    else res = this.e.finishRound();
    this.save();
    if (res) this.storeResult(res);
    if (this.e.state === 'success') this.showSuccess();
    else this.showResult(res);
  };

  MemorizerUI.prototype.showResult = function (res) {
    var self = this;
    this.stopTimer();
    this.e.state = 'result';
    this.save();
    if (!res) res = this.loadResult();
    if (!res) { this.showHome(); return; }
    var pct = Math.round(res.score * 100);
    var prog = this.e.getMasteryProgress();
    var html = '<div class="mem-screen mem-result"><h2>Result</h2>'
      + '<div class="mem-score">' + pct + '%</div>'
      + '<p>' + res.correct + ' / ' + res.total + (res.passed ? ' - passed!' : ' - 95% to master') + '</p><div class="mem-mastery">';
    for (var i = 0; i < prog.length; i++) {
      html += '<div class="mem-mastery-item"><span>' + esc(prog[i].title) + '</span><span>'
        + Math.round(prog[i].bestScore * 100) + '%' + (prog[i].mastered ? ' ok' : '') + '</span></div>';
    }
    html += '</div><div><button class="btn" id="memRetry">Retry</button> ';
    if (res.passed) html += '<button class="btn" id="memNext">Next</button>';
    if (res.wrongAnswers && res.wrongAnswers.length) {
      html += '<div class="mem-notes" style="text-align:left"><h3>Mistakes Review</h3><ul>';
      var _wn = Math.min(res.wrongAnswers.length, 10);
      for (var _wi = 0; _wi < _wn; _wi++) {
        var _w = res.wrongAnswers[_wi];
        var _opt = (_w.options || [])[_w.answer];
        html += '<li><b>' + esc(_w.q) + '</b><br>Correct: ' + esc(_opt) + '<br><span style="color:var(--muted)">' + esc(_w.explanation || '') + '</span></li>';
      }
      html += '</ul></div>';
    }
    html += '</div><div style="margin-top:10px"><button class="btn ghost" id="memGoRead">Read</button> '
      + '<button class="btn ghost" id="memGoHome">New</button></div></div>';
    this.c.innerHTML = html;
    el('memRetry').onclick = function () {
      self.e.startRound();
      self.save();
      self.qi = 0;
      self.secs = 0;
      self.startTimer();
      self.showQuestion();
    };
    var nx = el('memNext');
    if (nx) nx.onclick = function () {
      var nxt = self.e.startNextChunk();
      self.save();
      if (nxt === 'mixed') {
        self.e.startMixedRound();
        self.save();
        self.qi = 0;
        self.secs = 0;
        self.startTimer();
        self.showQuestion();
      } else if (nxt) { self.showReading(); }
      else { self.showSuccess(); }
    };
    el('memGoRead').onclick = function () { self.showReading(); };
    el('memGoHome').onclick = function () {
      self.clearSave();
      self.e = new root.MemorizerEngine();
      self.showHome();
    };
  };

  MemorizerUI.prototype.showSuccess = function () {
    var self = this;
    this.stopTimer();
    var notes = this.e.keyNotes || [];
    var html = '<div class="mem-screen mem-success"><h2>Done</h2><div class="mem-notes"><ul>';
    for (var i = 0; i < notes.length; i++) html += '<li>' + esc(notes[i]) + '</li>';
    html += '</ul></div><div><button class="btn" id="memAgain">New</button></div></div>';
    this.c.innerHTML = html;
    el('memAgain').onclick = function () {
      self.clearSave();
      self.e = new root.MemorizerEngine();
      self.showHome();
    };
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemorizerUI;
  } else {
    root.MemorizerUI = MemorizerUI;
  }
})(typeof self !== 'undefined' ? self : this);

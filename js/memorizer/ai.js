// ============================================================
// Memorizer AI Module - Image compression + Gemini API call
// Validates/repairs JSON, handles MOCK mode, friendly errors
// ============================================================
(function(root){
  'use strict';
  var CONFIG = {
    WORKER_URL: 'https://memorizer-proxy.milanmajumder17.workers.dev',
    GEMINI_MODEL: 'gemini-3.1-flash-lite',
    MAX_IMAGE_SIZE: 1600,
    JPEG_QUALITY: 0.8,
    MOCK_MODE: false
  };

  function MemorizerAI(config){
    this.config = Object.assign({}, CONFIG, config || {});
    var qs = '';
    try { qs = window.location.search || ''; } catch (e) {}
    if (qs.indexOf('mock=1') > -1) this.config.MOCK_MODE = true;
  }

  MemorizerAI.prototype.compressImage = function(file, callback){
    var maxSize = this.config.MAX_IMAGE_SIZE;
    var quality = this.config.JPEG_QUALITY;
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var w = img.width, h = img.height;
        if(w > maxSize || h > maxSize){
          if(w > h){ h = (h / w) * maxSize; w = maxSize; }
          else{ w = (w / h) * maxSize; h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob){
          callback(null, blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = function(){ callback(new Error('Could not load the image')); };
      img.src = e.target.result;
    };
    reader.onerror = function(){ callback(new Error('Could not read the file')); };
    reader.readAsDataURL(file);
  };

  MemorizerAI.prototype.extractText = function(imageBlob, progressCallback, callback){
    var self = this;
    if(this.config.MOCK_MODE){
      if(progressCallback) progressCallback('Running in MOCK mode...');
      setTimeout(function(){
        var mockData = null;
        try { mockData = window.MOCK_DATA || {chunks:[], key_notes:[]}; } catch (e) {
          mockData = {chunks:[], key_notes:[]};
        }
        callback(null, self.validateAndRepair(mockData));
      }, 400);
      return;
    }
    // Secure Worker-only routing: frontend never holds the Gemini key.
    // The Worker (memorizer-proxy) holds GEMINI_API_KEY as a secret.
    this.extractTextViaWorker(imageBlob, progressCallback, callback);
  };

  MemorizerAI.prototype.blobToBase64 = function (blob, callback) {
    try {
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        var idx = dataUrl.indexOf(',');
        callback(null, idx > -1 ? dataUrl.slice(idx + 1) : dataUrl);
      };
      reader.onerror = function () { callback(new Error('Could not read the image')); };
      reader.readAsDataURL(blob);
    } catch (e) {
      callback(e);
    }
  };

  MemorizerAI.PROMPT = 'You are a Bengali/English OCR and question generator. '
    + 'Extract text from this textbook page image and create a question bank. '
    + 'Rules: Split text into 4-5 semantic chunks (5-7 lines each). '
    + 'Generate AS MANY MCQs AS POSSIBLE for each chunk to ensure deep memorization. '
    + 'You MUST generate a MINIMUM of 5 tricky MCQs per chunk. Do not generate just 1 or 2 questions. '
    + 'Extract every possible detail to test the user. Aim for 30-50 questions PER CHUNK (many questions per line). '
    + 'Questions in Bengali if text is Bengali, English if English. '
    + '4 options per question, exactly one correct. '
    + 'Distractors must be confusing: similar names, swapped numbers, near-synonyms, dates off by 1. '
    + 'Highlight key terms (exact substrings from text). '
    + 'If image is unreadable, return {"error":"unreadable"}. '
    + 'Return ONLY JSON: {"chunks":[{"id":1,"title":"...","text":"...","highlights":["..."],'
    + '"complexity":"easy|medium|hard","lines":[{"line_id":"1-1","text":"..."}],'
    + '"questions":[{"id":"q1","line_id":"1-1","type":"mcq","q":"...","options":["a","b","c","d"],'
    + '"answer":0,"explanation":"..."}]}],"key_notes":["..."]}';

  MemorizerAI.prototype.parseJsonLoose = function (text) {
    var s = String(text || '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var f1 = s.indexOf('```');
    if (f1 > -1) {
      var m2 = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (m2 && m2[1]) {
        try { return JSON.parse(m2[1].trim()); } catch (eF) {}
      }
    }
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start > -1 && end > start) {
      try { return JSON.parse(s.slice(start, end + 1)); } catch (e2) {}
    }
    throw new Error('Could not understand the AI response. Please try again.');
  };

  MemorizerAI.prototype.extractTextViaWorker = function(imageBlob, progressCallback, callback){
    var self = this;
    if(progressCallback) progressCallback('Uploading image...');
    var formData = new FormData();
    formData.append('image', imageBlob, 'page.jpg');
    fetch(this.config.WORKER_URL, { method: 'POST', body: formData }).then(function(res){
      if(!res.ok) return res.text().then(function(txt){
        var m = 'Server error: ' + res.status;
        if(res.status === 429) m = 'Too many requests, please try again later';
        throw new Error(m + ' ' + txt);
      });
      return res.json();
    }).then(function(data){
      if(data.error){
        if(data.error === 'unreadable') throw new Error('Image is unreadable. Please take a clearer photo.');
        throw new Error(data.error);
      }
      callback(null, self.validateAndRepair(data));
    }).catch(function(err){ callback(err); });
  };

  MemorizerAI.prototype.validateAndRepair = function(data){
    if(!data.chunks || !Array.isArray(data.chunks)) return {chunks:[], key_notes:[]};
    var validChunks = [];
    for(var i = 0; i < data.chunks.length; i++){
      var chunk = data.chunks[i];
      if(!chunk.id || !chunk.questions || !Array.isArray(chunk.questions)) continue;
      chunk.title = chunk.title || 'Part ' + (i+1);
      chunk.text = chunk.text || '';
      chunk.complexity = chunk.complexity || 'medium';
      chunk.highlights = Array.isArray(chunk.highlights) ? chunk.highlights : [];
      chunk.lines = Array.isArray(chunk.lines) ? chunk.lines : [];
      var validQuestions = [];
      for(var j = 0; j < chunk.questions.length; j++){
        var q = chunk.questions[j];
        if(!q.id || !q.q || !q.options || !Array.isArray(q.options) || q.options.length !== 4) continue;
        if(typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) continue;
        q.line_id = q.line_id || 'unknown';
        q.type = q.type || 'mcq';
        q.explanation = q.explanation || '';
        validQuestions.push(q);
      }
      chunk.questions = validQuestions;
      if(chunk.questions.length > 0) validChunks.push(chunk);
    }
    return {
      chunks: validChunks,
      key_notes: Array.isArray(data.key_notes) ? data.key_notes : []
    };
  };

  if(typeof module !== 'undefined' && module.exports){
    module.exports = MemorizerAI;
  } else {
    root.MemorizerAI = MemorizerAI;
  }
})(typeof self !== 'undefined' ? self : this);

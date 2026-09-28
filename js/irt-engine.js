/* ============================================================================
 * irt-engine.js — Pure-JavaScript Item Response Theory (IRT) engine
 * ----------------------------------------------------------------------------
 * Model      : 3PL (three-parameter logistic), dichotomous items
 * Estimation : Expected A Posteriori (EAP) for theta, standard-normal prior
 *              N(0,1). Uses dense-grid (trapezoid) quadrature — deliberately
 *              NOT Newton-Raphson MLE, which is unstable / unbounded for the
 *              perfect/zero scores common in short CAT sessions.
 * CAT        : next-item selection by Maximum Fisher Information.
 * Scoring    : theta -> IQ via IQ = 100 + 15*theta, with 95% CI from the
 *              posterior standard error (SE_IQ = 15 * SE_theta).
 * Compat     : ES6 class, zero dependencies. Browser global (`window.IrtEngine`)
 *              + CommonJS export (matches tools/matrix-gen style), so the same
 *              file runs in <script> tags and under Node.js.
 * Usage (browser):  <script src="js/irt-engine.js"></script>
 *                   const eng = new IrtEngine();
 * Usage (node):     const { IrtEngine } = require('./js/irt-engine.js');
 * ========================================================================== */
'use strict';

class IrtEngine {
  /**
   * @param {Object} [options]
   * @param {number} [options.thetaMin=-4]   Lower bound of quadrature grid.
   * @param {number} [options.thetaMax=4]    Upper bound of quadrature grid.
   * @param {number} [options.gridStep=0.05] Grid resolution (smaller = slower
   *   but more precise; 0.05 gives 161 points, plenty for EAP).
   * @param {number} [options.priorMean=0]   Prior mean (standard normal -> 0).
   * @param {number} [options.priorSD=1]     Prior SD (standard normal -> 1).
   * @param {number} [options.iqMean=100]    IQ scale mean.
   * @param {number} [options.iqSD=15]       IQ scale standard deviation.
   * @param {number} [options.z95=1.96]      z for the 95% confidence interval.
   */
  constructor(options) {
    const o = options || {};
    this.thetaMin = (o.thetaMin !== undefined) ? o.thetaMin : -4;
    this.thetaMax = (o.thetaMax !== undefined) ? o.thetaMax : 4;
    this.gridStep = (o.gridStep !== undefined) ? o.gridStep : 0.05;
    this.priorMean = (o.priorMean !== undefined) ? o.priorMean : 0;
    this.priorSD = (o.priorSD !== undefined) ? o.priorSD : 1;
    this.iqMean = (o.iqMean !== undefined) ? o.iqMean : 100;
    this.iqSD = (o.iqSD !== undefined) ? o.iqSD : 15;
    this.z95 = (o.z95 !== undefined) ? o.z95 : 1.96;
    // Quadrature grid + prior density (built once; reused by every estimate).
    this.thetaGrid = this._makeGrid(this.thetaMin, this.thetaMax, this.gridStep);
    this.priorDensity = this._normalPdf(this.thetaGrid, this.priorMean, this.priorSD);
  }

  /** Build a uniform grid [min..max] with the given step. @private */
  _makeGrid(min, max, step) {
    const n = Math.max(2, Math.floor((max - min) / step) + 1);
    const g = new Array(n);
    for (let i = 0; i < n; i++) g[i] = min + i * step;
    return g;
  }

  /** Normal PDF evaluated at each grid point. @private */
  _normalPdf(xs, mean, sd) {
    const out = new Array(xs.length);
    const denom = sd * Math.sqrt(2 * Math.PI);
    for (let i = 0; i < xs.length; i++) {
      const z = (xs[i] - mean) / sd;
      out[i] = Math.exp(-0.5 * z * z) / denom;
    }
    return out;
  }

  /**
   * Validate + normalise an item {a, b, c}. Missing c defaults to 0 (2PL).
   * @param {Object} item Item parameters.
   * @returns {{a:number,b:number,c:number,id:(string|number|undefined)}}
   */
  static validateItem(item) {
    if (!item || typeof item.b !== 'number' || !isFinite(item.b)) {
      throw new Error('IrtEngine: item must have a numeric difficulty "b".');
    }
    const a = (item.a === undefined) ? 1.0 : item.a;
    const c = (item.c === undefined) ? 0.0 : item.c;
    if (!(a > 0) || !isFinite(a)) throw new Error('IrtEngine: item "a" must be positive finite.');
    if (!(c >= 0 && c < 1)) throw new Error('IrtEngine: item "c" must be in [0,1).');
    return { a: a, b: item.b, c: c, id: item.id };
  }

  /**
   * 3PL probability of a correct response: P(u=1|theta) = c + (1-c)*logit(a(th-b)).
   * @param {number} theta Latent ability.
   * @param {Object} item {a,b,c}.
   * @returns {number} Probability in (0,1).
   */
  probCorrect(theta, item) {
    const it = IrtEngine.validateItem(item);
    // Clamp exponent for numerical safety at extreme thetas.
    let z = it.a * (theta - it.b);
    if (z > 30) z = 30; else if (z < -30) z = -30;
    const L = 1 / (1 + Math.exp(-z));
    return it.c + (1 - it.c) * L;
  }

  /**
   * Posterior density p(theta | responses) on the grid via Bayes rule:
   * posterior ~ prior * product_i P_i^u_i (1-P_i)^(1-u_i).
   * Computed in log-space with a max-subtraction for stability.
   * @param {number[]} responses Binary (0/1).
   * @param {Object[]} items Parallel item array.
   * @returns {number[]} Normalised posterior weights (sum ~ 1/step before norm).
   */
  posteriorDensity(responses, items) {
    if (!Array.isArray(responses) || !Array.isArray(items) || responses.length !== items.length) {
      throw new Error('IrtEngine.posteriorDensity: responses and items must be parallel arrays.');
    }
    if (responses.length === 0) return this.priorDensity.slice();
    const n = this.thetaGrid.length;
    const logPost = new Array(n);
    for (let j = 0; j < n; j++) logPost[j] = Math.log(this.priorDensity[j] + 1e-300);
    for (let i = 0; i < items.length; i++) {
      const it = IrtEngine.validateItem(items[i]);
      const u = responses[i] ? 1 : 0;
      for (let j = 0; j < n; j++) {
        let z = it.a * (this.thetaGrid[j] - it.b);
        if (z > 30) z = 30; else if (z < -30) z = -30;
        const L = 1 / (1 + Math.exp(-z));
        let p = it.c + (1 - it.c) * L;
        if (p < 1e-12) p = 1e-12; else if (p > 1 - 1e-12) p = 1 - 1e-12;
        logPost[j] += u ? Math.log(p) : Math.log(1 - p);
      }
    }
    let mx = -Infinity;
    for (let j = 0; j < n; j++) if (logPost[j] > mx) mx = logPost[j];
    const w = new Array(n);
    let sum = 0;
    for (let j = 0; j < n; j++) { w[j] = Math.exp(logPost[j] - mx); sum += w[j]; }
    if (!(sum > 0) || !isFinite(sum)) return this.priorDensity.slice();
    for (let j = 0; j < n; j++) w[j] /= sum;
    return w;
  }

  /**
   * EAP estimate: posterior mean + posterior SD via trapezoid quadrature.
   * @param {number[]} responses Binary (0/1).
   * @param {Object[]} items Parallel item array.
   * @returns {{theta:number, se:number}} EAP estimate and posterior SD (SE).
   */
  estimateThetaEAP(responses, items) {
    const w = this.posteriorDensity(responses, items);
    const h = this.gridStep;
    let mean = 0, m2 = 0, norm = 0;
    for (let j = 0; j < this.thetaGrid.length; j++) {
      const edge = (j === 0 || j === this.thetaGrid.length - 1) ? 0.5 : 1.0;
      const wt = w[j] * edge;
      norm += wt;
      mean += wt * this.thetaGrid[j];
      m2 += wt * this.thetaGrid[j] * this.thetaGrid[j];
    }
    mean /= norm; m2 /= norm;
    let v = m2 - mean * mean;
    if (!(v > 0) || !isFinite(v)) v = 1.0; // no info -> prior variance
    void h;
    return { theta: mean, se: Math.sqrt(v) };
  }

  /**
   * Fisher information for one 3PL item at theta:
   * I = a^2 * (P-c)^2 (1-P) / [(1-c)^2 P]. Reduces to a^2 P(1-P) for 2PL/1PL.
   * @param {number} theta Ability point.
   * @param {Object} item {a,b,c}.
   * @returns {number} Non-negative information.
   */
  fisherInfo(theta, item) {
    const it = IrtEngine.validateItem(item);
    const p = this.probCorrect(theta, it);
    if (p <= 1e-12 || p >= 1 - 1e-12) return 0;
    if (it.c === 0) return it.a * it.a * p * (1 - p);
    const d = (p - it.c) / (1 - it.c);
    return it.a * it.a * d * d * (1 - p) / p;
  }

  /**
   * CAT item selection: Maximum Fisher Information at the current estimate.
   * Skips administered ids; ties broken by first-seen (deterministic).
   * @param {number} thetaHat Current EAP estimate.
   * @param {Object[]} pool Full item bank (each with unique `id` ideally).
   * @param {Array} [administeredIds=[]] Already-seen ids (array or Set).
   * @returns {Object|null} Best item, or null when the pool is exhausted.
   */
  selectNextCATItem(thetaHat, pool, administeredIds) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    let seen = null;
    if (administeredIds instanceof Set) seen = administeredIds;
    else if (Array.isArray(administeredIds)) seen = new Set(administeredIds);
    let best = null, bestInfo = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const it = pool[i];
      if (seen && it && it.id !== undefined && seen.has(it.id)) continue;
      let info;
      try { info = this.fisherInfo(thetaHat, it); }
      catch (e) { continue; }
      if (info > bestInfo) { bestInfo = info; best = it; }
    }
    return best;
  }

  /**
   * Convert theta to the IQ metric: IQ = iqMean + iqSD * theta.
   * @param {number} theta Latent ability.
   * @returns {number} IQ score.
   */
  thetaToIQ(theta) { return this.iqMean + this.iqSD * theta; }

  /**
   * Convert posterior SE(theta) to SE(IQ): SE_IQ = iqSD * SE_theta.
   * @param {number} seTheta Posterior SD of theta.
   * @returns {number} Standard error on the IQ scale.
   */
  seToIQ(seTheta) { return this.iqSD * seTheta; }

  /**
   * 95% CI on the IQ scale: IQ_hat +/- z95 * SE_IQ (default z=1.96).
   * @param {number} theta EAP estimate.
   * @param {number} seTheta Posterior SD.
   * @returns {{iq:number, seIQ:number, lo:number, hi:number}}
   */
  iqConfidenceInterval(theta, seTheta) {
    const iq = this.thetaToIQ(theta);
    const seIQ = this.seToIQ(seTheta);
    return { iq: iq, seIQ: seIQ, lo: iq - this.z95 * seIQ, hi: iq + this.z95 * seIQ };
  }

  /**
   * One-call report: EAP -> IQ + 95% CI.
   * @param {number[]} responses Binary (0/1).
   * @param {Object[]} items Parallel item array.
   * @returns {{theta:number,se:number,iq:number,seIQ:number,lo:number,hi:number,n:number}}
   */
  scoreReport(responses, items) {
    const e = this.estimateThetaEAP(responses, items);
    const ci = this.iqConfidenceInterval(e.theta, e.se);
    return { theta: e.theta, se: e.se, iq: ci.iq, seIQ: ci.seIQ, lo: ci.lo, hi: ci.hi, n: responses.length };
  }

  /**
   * Build an item bank from matrix-gen metadata ({irt_b} -> b; a,c defaults).
   * Lets the generator output plug straight into this engine.
   * @param {Object[]} meta e.g. [{item_id, irt_b, ...}], or [{id, b}].
   * @param {Object} [defaults] e.g. {a:1.0, c:1/6} for 6-option MCQ.
   * @returns {Object[]} Bank of {id,a,b,c}.
   */
  static bankFromMetadata(meta, defaults) {
    const d = defaults || {};
    const a = (d.a !== undefined) ? d.a : 1.0;
    const c = (d.c !== undefined) ? d.c : 1 / 6; // 6 options -> guessing 1/6
    return (meta || []).map(function (m, i) {
      const b = (m.irt_b !== undefined) ? m.irt_b : m.b;
      const id = (m.item_id !== undefined) ? m.item_id : ((m.id !== undefined) ? m.id : ('item' + (i + 1)));
      return { id: id, a: (m.a !== undefined ? m.a : a), b: b, c: (m.c !== undefined ? m.c : c) };
    });
  }
}

// Browser global + CommonJS export (same pattern as tools/matrix-gen libs).
(function (root, engine) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
    try { module.exports.IrtEngine = engine.IrtEngine; } catch (e) {}
  }
  if (typeof root !== 'undefined') {
    try { root.IrtEngine = engine.IrtEngine; } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), { IrtEngine: IrtEngine });

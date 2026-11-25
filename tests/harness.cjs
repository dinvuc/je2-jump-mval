// Run with: node tests/game.test.cjs
// Exercises the real fixed-step game code without a browser or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = new Map(), events = {}, surfaces = [];
let displayWidth = 960;
function makeCanvas() {
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: s => ({ width: String(s).length * 7.8 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    setTransform(...args) { this.transform = args; },
    drawImage(...args) {
      assert(args.slice(1).every(Number.isFinite), 'drawImage has finite coordinates');
      if (args.length === 9) {
        assert(args[1] >= -1 && args[2] >= -1, 'cache crop starts inside its image');
        assert(args[1] + args[3] <= args[0].width + 2, 'cache crop fits its width');
        assert(args[2] + args[4] <= args[0].height + 2, 'cache crop fits its height');
      }
    },
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const canvas = { width: 960, height: 544, handlers: {}, getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: displayWidth, height: displayWidth * 544 / 960 }),
    addEventListener(name, fn) { this.handlers[name] = fn; } };
  surfaces.push(canvas); return canvas;
}
const mainCanvas = makeCanvas();
const touch = { hidden: true, querySelectorAll: () => [], querySelector: () => null };
const controls = Object.fromEntries(['run-settings', 'difficulty', 'difficulty-value', 'difficulty-help'].map(id => [id, {
  hidden: false, value: '100', textContent: '', handlers: {}, attributes: {},
  addEventListener(name, fn) { this.handlers[name] = fn; },
  setAttribute(name, value) { this.attributes[name] = value; },
}]));
const sandbox = vm.createContext({
  console, Math, Set, Map, Number, Array, Object, JSON, structuredClone,
  performance: { now: () => 1000 }, requestAnimationFrame() {},
  addEventListener: (name, fn) => { events[name] = fn; },
  matchMedia: () => ({ matches: false }), window: { devicePixelRatio: 2 },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
  document: { createElement: makeCanvas, addEventListener() {},
    getElementById: id => id === 'game' ? mainCanvas : id === 'touch' ? touch : controls[id] || null },
});
const run = code => vm.runInContext(code, sandbox);
for (const file of ['facts', 'levels', 'runtime', 'game']) {
  const filename = path.join(__dirname, '..', 'js', `${file}.js`);
  new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }).runInContext(sandbox);
}

const reset = (level = 0, strain = 'anc', difficulty = 100) => run("for (const key in keys) keys[key] = false; G.studySeen = {}; G.studyReview = null; G.difficulty = " + difficulty + "; G.strain = '" + strain + "'; G.levelIdx = " + level + "; loadLevel(" + level + "); setState('play');");
module.exports = { run, reset, storage, events, mainCanvas, sandbox, controls,
  setDisplayWidth(value) { displayWidth = value; events.resize(); } };

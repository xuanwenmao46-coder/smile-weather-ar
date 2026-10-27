/* Physics and resource-budget checks only. This Canvas stub cannot assess visuals. */
'use strict';

const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const MODULE_PATH = path.join(__dirname, '..', 'dist', 'cinematic-effects.js');
const CAPACITY = 600;
let seed = 0x1eaf2027;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function finiteArgs(method, values) {
  for (const value of values) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${method}: non-finite argument`);
  }
}

function makeCanvas(width = 800, height = 600) {
  const ctx = {};
  for (const method of [
    'save', 'restore', 'beginPath', 'closePath', 'stroke', 'fill', 'fillRect', 'clearRect',
    'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'rect',
    'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'drawImage',
  ]) ctx[method] = (...args) => finiteArgs(method, args);
  for (const method of ['createLinearGradient', 'createRadialGradient']) {
    ctx[method] = (...args) => {
      finiteArgs(method, args);
      return { addColorStop: (offset) => {
        assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1, 'invalid gradient offset');
      } };
    };
  }
  return {
    width, height,
    getContext: (kind) => { assert.equal(kind, '2d'); return ctx; },
    ownerDocument: { createElement: (tag) => { assert.equal(tag, 'canvas'); return makeCanvas(); } },
  };
}

function checkState(fx, label) {
  const { active, collisions, pending, capacity } = fx.stats();
  assert.equal(capacity, CAPACITY, `${label}: fixed capacity`);
  assert.ok(Number.isInteger(active) && active >= 0 && active <= CAPACITY, `${label}: active budget`);
  assert.ok(Number.isInteger(fx.freeCount) && fx.freeCount >= 0, `${label}: free count`);
  assert.equal(active + fx.freeCount, CAPACITY, `${label}: pool conservation`);
  assert.ok(Number.isInteger(pending) && pending >= 0 && pending <= 9, `${label}: pending budget`);
  assert.ok(Number.isInteger(collisions) && collisions >= 0, `${label}: collision counter`);
  assert.equal(fx.pool.length, CAPACITY, `${label}: pool storage`);
  const seen = new Set();
  const speedLimit = Math.max(fx.w, fx.h) * 1.42;
  for (let i = 0; i < active; i++) {
    const index = fx.active[i];
    assert.ok(index >= 0 && index < CAPACITY && !seen.has(index), `${label}: duplicate active index`);
    seen.add(index);
    const particle = fx.pool[index];
    for (const [key, value] of Object.entries(particle)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label}: ${key} is non-finite`);
    }
    assert.ok(particle.life > 0 && particle.maxLife > 0, `${label}: active lifetime`);
    assert.ok(Math.hypot(particle.vx, particle.vy) <= speedLimit + 1e-7, `${label}: speed cap`);
    for (const value of [...particle.trailX, ...particle.trailY]) {
      assert.ok(Number.isFinite(value), `${label}: non-finite trail`);
    }
  }
  for (let i = 0; i < fx.freeCount; i++) {
    const index = fx.free[i];
    assert.ok(index >= 0 && index < CAPACITY && !seen.has(index), `${label}: duplicate free index`);
    assert.equal(fx.pool[index].life, 0, `${label}: free particle remains alive`);
    seen.add(index);
  }
  assert.equal(seen.size, CAPACITY, `${label}: all slots accounted for`);
  for (const event of [...fx.shells, ...fx.contacts]) {
    for (const [key, value] of Object.entries(event)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label}: event ${key} is non-finite`);
    }
  }
  return fx.stats();
}

function checkEmpty(fx, label) {
  checkState(fx, label);
  assert.equal(fx.stats().active, 0, `${label}: live particles`);
  assert.equal(fx.stats().pending, 0, `${label}: pending shells`);
  assert.ok(fx.pool.every((p) => p.life === 0), `${label}: particle lifetime remains`);
  assert.ok(fx.contacts.every((c) => c.life === 0), `${label}: contact lifetime remains`);
  assert.equal(fx.rainCarry, 0, `${label}: remaining rain emission`);
}

async function main() {
  // Import the actual checked-in implementation. No source extraction or physics copy.
  const { CinematicEffects } = await import(pathToFileURL(MODULE_PATH).href);
  assert.equal(typeof CinematicEffects, 'function');
  const create = (style = 'opal', width = 800, height = 600) => {
    const canvas = makeCanvas(width, height);
    const fx = new CinematicEffects({ canvas, ctx: canvas.getContext('2d') });
    fx.setStyle(style);
    checkEmpty(fx, 'new instance');
    return fx;
  };
  const headFor = (fx) => ({ x: fx.w * .5, y: fx.h * .47, rx: fx.w * .16, ry: fx.h * .25 });
  const results = [];

  for (const style of ['opal', 'nova']) {
    const fx = create(style);
    const head = headFor(fx);
    for (let i = 0; i < 180; i++) {
      fx.frame(1 / 60, i * 1000 / 60, { mode: 'rain', head, velocity: { x: 5000, y: -5000 } });
      checkState(fx, `${style} rain ${i}`);
    }
    assert.ok(fx.stats().active > 0, `${style}: rain must emit particles`);
    assert.equal(fx.stats().collisions, 0, `${style}: rain must ignore head collisions`);
    assert.ok(Array.from(fx.active.subarray(0, fx.activeCount)).every((i) => fx.pool[i].type === 0));
    const rainActive = fx.stats().active;
    fx.clear();
    assert.equal(fx.launch(head, 0), true);
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      fx.frame(1 / 60, i * 1000 / 60, { mode: 'bloom', head });
      peak = Math.max(peak, checkState(fx, `${style} bloom ${i}`).active);
    }
    assert.ok(fx.stats().collisions > 0, `${style}: sparks must collide with the head`);
    checkEmpty(fx, `${style}: bloom naturally expired`);
    results.push({ check: `${style}: rain / bloom`, rainActive, bloomPeak: peak, collisions: fx.stats().collisions });
  }

  const fx = create('nova', 1080, 1920);
  const head = headFor(fx);
  assert.equal(fx.launch(head, 0, { intensity: 1.5 }), true);
  assert.equal(fx.launch(head, 100), false, 'launch cooldown');
  assert.equal(fx.launch(head, 1300, { intensity: 1.5 }), true);
  assert.equal(fx.launch(head, 2600, { intensity: 1.5 }), true);
  assert.equal(fx.stats().pending, 9, 'pending shells reach the budget');
  assert.equal(fx.launch(head, 3900), false, 'reject a launch beyond the shell budget');
  fx.frame(1 / 60, 3900, { mode: 'bloom', head });
  assert.equal(checkState(fx, 'saturated pool').active, CAPACITY, 'exercise a completely full pool');
  let peak = fx.activeCount;
  let now = 3900;
  let accepted = 0;
  for (let i = 0; i < 900; i++) {
    now += 50;
    const movingHead = { ...head, x: head.x + Math.sin(i * .11) * fx.w * .15, y: head.y + Math.cos(i * .07) * fx.h * .1 };
    if (fx.launch(movingHead, now, { intensity: 1.5, quality: 1 })) accepted++;
    fx.frame(.05, now, {
      mode: i % 120 < 60 ? 'rain' : 'bloom', head: movingHead,
      velocity: { x: Math.sin(i) * 1e7, y: Math.cos(i) * 1e7 }, intensity: 1.5,
    });
    peak = Math.max(peak, checkState(fx, `stress ${i}`).active);
  }
  assert.ok(accepted > 20, 'stress must repeatedly launch');
  assert.ok(fx.stats().collisions > 0, 'stress must exercise moving-head collisions');
  for (let i = 0; i < 360; i++) {
    now += 1000 / 30;
    fx.frame(1 / 30, now, { mode: 'still', head });
    checkState(fx, `drain ${i}`);
  }
  checkEmpty(fx, 'all particles and shell/contact events naturally expired');
  results.push({ check: 'portrait stress / natural expiration', peak, accepted, collisions: fx.stats().collisions });

  for (const action of ['clear', 'resize', 'setStyle']) {
    fx.clear();
    assert.equal(fx.launch(head, 0), true);
    fx.frame(.05, 350, { mode: 'rain', head });
    assert.ok(fx.activeCount > 0 && fx.shells.length > 0, `${action}: must clean populated state`);
    if (action === 'clear') fx.clear();
    if (action === 'resize') fx.resize(640, 360);
    if (action === 'setStyle') fx.setStyle('opal');
    checkEmpty(fx, action);
    assert.equal(fx.collisions, 0, `${action}: clear collision counter`);
    assert.equal(fx.launch(null, 0), true, `${action}: reset launch cooldown`);
    fx.clear();
  }
  assert.equal(fx.w, 640);
  assert.equal(fx.h, 360);
  results.push({ check: 'clear / resize / style reset', passed: true });

  function densitySample(reduced) {
    seed = 0xcafe2027;
    const sample = create();
    const sampleHead = headFor(sample);
    sample.frame(1 / 60, 0, { mode: 'rain', head: sampleHead, reduced });
    const rain = checkState(sample, 'density sample rain').active;
    sample.clear();
    sample.launch(sampleHead, 0, { reduced });
    let burst = 0;
    for (let i = 0; i < 180; i++) {
      sample.frame(1 / 60, i * 1000 / 60, { mode: 'bloom', head: sampleHead, reduced });
      burst = Math.max(burst, checkState(sample, 'density sample bloom').active);
    }
    return { rain, burst };
  }
  const regular = densitySample(false);
  const reduced = densitySample(true);
  assert.ok(reduced.rain > 0 && reduced.rain < regular.rain, 'reduced motion lowers rain density');
  assert.ok(reduced.burst > 0 && reduced.burst < regular.burst, 'reduced motion lowers burst density');
  results.push({ check: 'reduced motion particle count', regular, reduced });

  const unusual = create();
  unusual.launch(headFor(unusual), 0);
  const abnormalDt = [NaN, undefined, null, 0, -1, Infinity, -Infinity, 1e9, 'invalid', '0.016'];
  now = 500;
  for (const dt of abnormalDt) {
    now += 50;
    unusual.frame(dt, now, { mode: 'rain', head: headFor(unusual), velocity: { x: Infinity, y: NaN } });
    checkState(unusual, `abnormal dt ${String(dt)}`);
  }
  for (let i = 0; i < 240; i++) {
    now += 50;
    unusual.frame(.05, now, { mode: 'still' });
    checkState(unusual, `abnormal dt recovery ${i}`);
  }
  checkEmpty(unusual, 'abnormal dt recovery');
  results.push({ check: 'abnormal dt and recovery', cases: abnormalDt.map(String) });
  console.log(JSON.stringify({ passed: true, module: MODULE_PATH, scope: 'Physics/resource budgets only; Canvas stub does not validate visual appearance.', results }, null, 2));
}

const originalRandom = Math.random;
Math.random = random;
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => { Math.random = originalRandom; });

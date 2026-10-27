import {shapeFirework} from './firework-styles.js?v=14';
/**
 * Original, procedural optical rain and aerial fireworks.
 * The host owns the canvas, background and animation clock. Coordinates are
 * backing-store pixels, dt is seconds, and now is monotonic milliseconds.
 */
const TAU = Math.PI * 2;
const CAPACITY = 600;
const TRAIL = 20;
const MAX_SHELLS = 9;
const MAX_CONTACTS = 18;
const MAX_REPLIES = 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const cubic = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const PRESETS = {
  opal: {
    colors: ['#ecc582', '#86cbb8', '#b19bd5', '#f4dfb8'],
    rain: ['#c2e2d7', '#f0e2bb', '#c2b5df'],
    wind: -.025,
    glow: 1,
  },
  nova: {
    colors: ['#efb75d', '#ec967d', '#ae91d4', '#f5d49c'],
    rain: ['#cdb5de', '#edcc9e', '#e9ae91'],
    wind: -.018,
    glow: 1,
  },
};

function rgb(hex) {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
}

function surface(w, h, owner) {
  const c = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : (owner?.ownerDocument || document).createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Fixed pool. No particle objects or trail buffers are allocated in frame(). */
export class CinematicEffects {
  constructor({ canvas, ctx }) {
    this.canvas = canvas;
    this.ctx = ctx || canvas.getContext('2d');
    this.w = canvas.width || 800;
    this.h = canvas.height || 600;
    this.pool = Array.from({ length: CAPACITY }, (_, index) => ({
      index, type: 0, life: 0, maxLife: 0, age: 0,
      x: 0, y: 0, vx: 0, vy: 0, ax: 0, gravity: 0, drag: 0,
      size: 0, length: 0, depth: 0, color: 0, opacity: 0,
      phase: 0, glint: 0, hero: false, blurred: false, hit: 0,
      trailX: new Float32Array(TRAIL), trailY: new Float32Array(TRAIL),
      trailN: 0, trailClock: 0,
    }));
    this.active = new Uint16Array(CAPACITY);
    this.free = new Uint16Array(CAPACITY);
    this.activeCount = 0;
    this.freeCount = 0;
    this.shells = [];
    this.replies = [];
    this.replySerial = 0;
    this.replyPhase = 'idle';
    this.contacts = Array.from({ length: MAX_CONTACTS }, () => ({
      life: 0, x: 0, y: 0, nx: 0, ny: 0, length: 0,
    }));
    this.contactCursor = 0;
    this.collisions = 0;
    this.rainCarry = 0;
    this.previousMode = 'still';
    this.lastLaunch = -Infinity;
    this.sprites = new Map();
    this.setStyle('opal');
  }

  resize(w, h) {
    const nextW = Math.max(1, Number(w) || 1);
    const nextH = Math.max(1, Number(h) || 1);
    if (nextW !== this.w || nextH !== this.h) {
      this.w = nextW;
      this.h = nextH;
      this.clear();
    }
  }

  setStyle(name) {
    // Older callers can transition from the original two directions safely.
    this.style = name === 'nova' || name === 'orbit' ? 'nova' : 'opal';
    this.preset = PRESETS[this.style];
    this.clear();
    this.sprites.clear();
    for (const color of new Set([...this.preset.colors, ...this.preset.rain])) {
      this._sprite(color, 'point');
      this._sprite(color, 'rain');
      this._sprite(color, 'glint');
    }
  }

  clear() {
    this.activeCount = 0;
    this.freeCount = CAPACITY;
    for (let i = 0; i < CAPACITY; i++) {
      this.pool[i].life = 0;
      this.free[i] = CAPACITY - i - 1;
    }
    this.shells.length = 0;
    this.replies.length = 0;
    this.replySerial = 0;
    this.replyPhase = 'idle';
    for (const contact of this.contacts) contact.life = 0;
    this.contactCursor = 0;
    this.collisions = 0;
    this.rainCarry = 0;
    this.previousMode = 'still';
    this.lastLaunch = -Infinity;
  }

  stats() {
    return {
      active: this.activeCount, collisions: this.collisions,
      pending: this.shells.length, capacity: CAPACITY,
      replyPhase: this.replyPhase, returns: this.replies.length,
    };
  }

  /** Optional origin binds the outgoing light and its return to one comment. */
  launch(head, now, { reduced = false, intensity = .7, quality = 1, origin = null } = {}) {
    if (!Number.isFinite(now) || now - this.lastLaunch < (reduced ? 2300 : 1250)) return false;
    if (this.shells.length > MAX_SHELLS - 3) return false;
    const attached = origin && Number.isFinite(origin.x) && Number.isFinite(origin.y);
    if (attached && this.replies.length >= MAX_REPLIES) return false;
    this.lastLaunch = now;
    const w = this.w, h = this.h;
    const valid = head && Number.isFinite(head.x) && Number.isFinite(head.y);
    const hx = valid ? head.x : w * .5;
    const hy = valid ? head.y : h * .48;
    const rx = valid ? Math.max(w * .08, head.rx || w * .2) : w * .2;
    const ry = valid ? Math.max(h * .1, head.ry || h * .23) : h * .23;
    const density = clamp(intensity, .15, 1.5);
    const fidelity = clamp(quality, .3, 1);
    const originX = attached ? clamp(origin.x, 0, w) : 0;
    const originY = attached ? clamp(origin.y, 0, h) : 0;
    if (attached) {
      this.replyPhase = 'launch';
      this.replies.push({
        id: ++this.replySerial, start: now, at: now + 2300, end: now + 3200,
        originX, originY, reduced, hx, hy, rx, ry, ready: false,
        x: 0, y: 0, c1x: 0, c1y: 0, c2x: 0, c2y: 0,
      });
    }
    const centers = [
      [clamp(hx - rx * 1.32, w * .13, w * .29), clamp(hy - ry * 1.40, h * .085, h * .18)],
      [clamp(hx + rx * 1.34, w * .71, w * .87), clamp(hy - ry * 1.51, h * .075, h * .16)],
      [clamp(hx + w * .015, w * .40, w * .60), clamp(hy - ry * 1.48, h * .085, h * .135)],
    ];
    // A blossom is born in open air, with room for its initial radial spread.
    // In unusually close camera framing it can begin above the visible canvas.
    for (const center of centers) {
      const dx = center[0] - hx, dy = center[1] - hy;
      const distance = Math.hypot(dx / rx, dy / ry);
      if (distance < 1.48) {
        const scale = 1.48 / Math.max(.001, distance);
        center[0] = hx + dx * scale;
        center[1] = hy + dy * scale;
      }
    }
    for (let i = 0; i < 3; i++) {
      // The larger central shell is the second beat so it is already legible
      // in the first second; the smaller side shells frame its growing volume.
      const start = now + (reduced ? [0, 420, 210][i] : [0, 280, 110][i]);
      const side = i === 0 ? -1 : i === 1 ? 1 : originX < hx ? -1 : 1;
      const edgeX = hx + side * (rx + w * .21);
      this.shells.push({
        start, at: start + (reduced ? 410 : 320), x: centers[i][0], y: centers[i][1],
        fromX: attached ? originX + w * [-.004, .004, 0][i] : w * [.10, .89, .43][i],
        fromY: attached ? originY + w * [.0015, -.0015, 0][i] : h * [.86, .91, .88][i],
        attached: !!attached,
        c1x: edgeX, c1y: Math.max(originY - h * .055, hy + ry * 1.22),
        c2x: edgeX, c2y: hy - ry * .95,
        curve: w * [.035, -.026, -.022][i],
        color: i === 2 ? 0 : i + 1, major: i === 2,
        density, fidelity, reduced, exploded: false,
        dustClock: 0, seed: Math.random() * TAU,
      });
    }
    return true;
  }

  /** Render over the host's frame; no clearRect, background fill, or RAF. */
  frame(dt, now, {
    mode = 'still', head = null, velocity = null, intensity = .7,
    quality = 1, reduced = false, preview = false,
  } = {}) {
    dt = clamp(Number(dt) || 0, 0, .05);
    now = Number(now) || 0;
    const density = clamp(Number(intensity) || 0, 0, 1.5);
    const fidelity = clamp(Number(quality) || 1, .3, 1);
    const validHead = head && Number.isFinite(head.x) && Number.isFinite(head.y)
      && head.rx > 0 && head.ry > 0 ? head : null;
    const hx = clamp(Number(velocity?.x) || 0, -this.w * 1.35, this.w * 1.35);
    const hy = clamp(Number(velocity?.y) || 0, -this.h * 1.35, this.h * 1.35);

    if (mode === 'rain' && density > 0) {
      const amount = (reduced ? 31 : 92) * density * fidelity;
      if (this.previousMode !== 'rain') {
        // A restrained, spatially distributed warm start makes previews legible.
        const count = Math.round(amount * (reduced ? .72 : 1.10));
        for (let i = 0; i < count; i++) this._rain(true, reduced, i / Math.max(count, 1));
      }
      this.rainCarry += amount * dt;
      while (this.rainCarry >= 1) {
        this.rainCarry--;
        this._rain(false, reduced);
      }
    } else {
      this.rainCarry = 0;
    }
    this.previousMode = mode;

    const g = this.ctx;
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    this._shellFrame(dt, now, validHead, reduced, preview);
    this._advance(dt, validHead, hx, hy, reduced);

    // Render the three depth planes without a per-frame sort.
    for (let depth = 0; depth < 3; depth++) {
      for (let i = 0; i < this.activeCount; i++) {
        const p = this.pool[this.active[i]];
        if (p.type === 0 && p.depth === depth) this._drawRain(p, validHead, now, reduced, preview);
      }
    }
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pool[this.active[i]];
      if (p.type !== 0) this._drawSpark(p, validHead, now, reduced, preview);
    }
    this._drawContacts(dt, reduced);
    this._replyFrame(now, validHead, reduced);
    g.restore();
  }

  _alloc(type) {
    if (!this.freeCount) return null;
    const index = this.free[--this.freeCount];
    const p = this.pool[index];
    this.active[this.activeCount++] = index;
    p.type = type;
    p.age = p.hit = p.trailN = p.trailClock = 0;
    p.glint = 0;
    p.hero = false;
    p.blurred = false;
    p.ax = p.drag = 0;
    return p;
  }

  _release(position) {
    const index = this.active[position];
    this.pool[index].life = 0;
    this.free[this.freeCount++] = index;
    this.active[position] = this.active[--this.activeCount];
  }

  _rain(prefill, reduced, distribution = Math.random()) {
    // Leave ample pool space for the three simultaneous aerial blooms.
    if (this.activeCount >= (reduced ? 250 : 350)) return;
    const p = this._alloc(0);
    if (!p) return;
    const w = this.w, h = this.h;
    const r = Math.random();
    p.depth = r < .44 ? 0 : r < .90 || reduced ? 1 : 2;
    p.x = Math.random() * w * 1.13;
    p.y = prefill ? distribution * h : -h * .12;
    p.vy = h * [.34, .59, .91][p.depth] * (.80 + Math.random() * .40) * (reduced ? .72 : 1);
    p.vx = w * this.preset.wind * (.75 + p.depth * .30);
    p.gravity = 0;
    p.length = h * [.024, .049, .086][p.depth] * (.63 + Math.random() * .65);
    p.size = Math.max(.64, w * [.0009, .00170, .00210][p.depth]);
    p.opacity = [.61, .93, .66][p.depth] * (.84 + Math.random() * .16);
    p.phase = Math.random() * TAU;
    p.color = Math.random() < .68 ? 0 : Math.random() < .65 ? 1 : 2;
    p.blurred = p.depth === 2 && Math.random() < .26;
    p.maxLife = p.life = (h * 1.3 - p.y) / p.vy;
  }

  _burst(shell) {
    const w = this.w, h = this.h;
    const count = Math.round((shell.reduced ? (shell.major ? 31 : 20) : (shell.major ? 110 : 62)) * (.45 + shell.density * .64) * shell.fidelity);
    const rotation = shell.seed;
    for (let i = 0; i < count; i++) {
      const p = this._alloc(1);
      if (!p) break;
      // Base radial distribution; the selected profile reshapes initial velocities.
      // Every profile subsequently shares the physical particle integrator.
      const angle = rotation + (i + (Math.random() - .5) * .44) / count * TAU;
      const band = i % 5 === 0 ? .72 : 1;
      const speed = w * (shell.major ? .47 + Math.random() * .11 : .255 + Math.random() * .105) * band * (shell.reduced ? .68 : 1);
      p.x = shell.x + (Math.random() - .5) * 2;
      p.y = shell.y + (Math.random() - .5) * 2;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = h * .052;
      p.drag = shell.major ? .72 : .89;
      p.maxLife = p.life = (2.10 + Math.random() * .55) * (shell.reduced ? .85 : 1);
      p.hero = !shell.reduced && i % 11 === 0;
      p.size = Math.max(.9, w * (.00125 + Math.random() * .00055)) * (p.hero ? 2.35 : 1) * (shell.major ? 1.08 : 1);
      p.opacity = .89 + Math.random() * .11;
      p.color = Math.random() < .89 ? shell.color : 3;
      p.glint = !shell.reduced && i % 19 === 0 ? 1 : 0;
      p.phase = Math.random() * TAU;
      shapeFirework(p,shell.shape,i,count,w,h,rotation);
      if(shell.reduced){p.hero=false;p.glint=0;}
    }
    // Small warm embers have a longer fall and a shorter trail than the spokes.
    const emberCount = Math.round((shell.reduced ? 3 : 13) * shell.fidelity * shell.density);
    for (let i = 0; i < emberCount; i++) {
      const p = this._alloc(2);
      if (!p) break;
      const angle = Math.random() * TAU;
      const speed = w * (.12 + Math.random() * .20);
      p.x = shell.x;
      p.y = shell.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = h * .20;
      p.drag = 1.17;
      p.maxLife = p.life = 1.8 + Math.random() * 1.0;
      p.size = Math.max(.55, w * .00085);
      p.opacity = .72;
      p.color = Math.random() < .7 ? 0 : 3;
      p.phase = Math.random() * TAU;
    }
  }

  _shellFrame(dt, now, head, reduced, preview) {
    const g = this.ctx;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      if (now < s.start) continue;
      if (!s.exploded && now >= s.at) {
        s.exploded = true;
        this._burst(s);
      }
      const color = this.preset.colors[s.color];
      if (s.exploded) {
        const age = (now - s.at) / 1000;
        if (age >= .36) { this.shells.splice(i, 1); continue; }
        // A local optical bloom gently decays; it never lights up the canvas.
        const envelope = Math.sin(Math.min(1, age / .06) * Math.PI / 2) * Math.pow(1 - age / .36, 2);
        const radius = this.w * (s.reduced || reduced ? .033 : .055);
        g.globalAlpha = envelope * (s.reduced || reduced ? .17 : .25) * this._safety(s.x, s.y, head);
        g.drawImage(this._sprite(color, 'point'), s.x - radius, s.y - radius, radius * 2, radius * 2);
        continue;
      }
      const progress = clamp((now - s.start) / (s.at - s.start), 0, 1);
      const tail = Math.max(0, progress - (s.reduced || reduced ? .13 : .20));
      const ease = t => 1 - (1 - t) ** 1.18;
      const xAt = t => s.attached
        ? cubic(s.fromX, s.c1x, s.c2x, s.x, ease(t))
        : mix(s.fromX, s.x, ease(t)) + Math.sin(t * Math.PI) * s.curve;
      const yAt = t => s.attached
        ? cubic(s.fromY, s.c1y, s.c2y, s.y, ease(t))
        : mix(s.fromY, s.y, ease(t));
      const x = xAt(progress), y = yAt(progress);
      const safe = Math.min(this._safety(x, y, head), this._safety(xAt((progress + tail) * .5), yAt((progress + tail) * .5), head));
      const alpha = Math.min(1, progress * 6) * safe * (s.reduced || reduced ? .65 : .94);
      g.strokeStyle = color;
      for (let pass = 0; pass < 2; pass++) {
        g.globalAlpha = alpha * (pass ? .86 : .15);
        g.lineWidth = Math.max(.8, this.w * (pass ? .0012 : .0045));
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const t = mix(tail, progress, k / 8);
          if (k) g.lineTo(xAt(t), yAt(t)); else g.moveTo(xAt(t), yAt(t));
        }
        g.stroke();
      }
      const radius = Math.max(4, this.w * .008);
      g.globalAlpha = alpha;
      g.drawImage(this._sprite(color, 'point'), x - radius, y - radius, radius * 2, radius * 2);
      s.dustClock += dt;
      if (s.dustClock > (s.reduced || reduced ? .08 : .033)) {
        s.dustClock = 0;
        const p = this._alloc(2);
        if (p) {
          p.x = x; p.y = y;
          p.vx = (Math.random() - .5) * this.w * .04;
          p.vy = this.h * (.07 + Math.random() * .06);
          p.gravity = this.h * .12;
          p.drag = 1.3;
          p.maxLife = p.life = .24 + Math.random() * .18;
          p.size = Math.max(.5, this.w * .0007);
          p.opacity = .58;
          p.color = 0;
          p.phase = s.seed;
        }
      }
    }
  }

  _replyFrame(now, head, reduced) {
    const g = this.ctx, w = this.w, h = this.h;
    const color = this.preset.colors[0];
    const glow = this._sprite(color, 'point');
    for (let i = this.replies.length - 1; i >= 0; i--) {
      const reply = this.replies[i];
      const age = now - reply.start;
      const calm = reply.reduced || reduced;
      if (reply.id === this.replySerial) {
        this.replyPhase = age < (reply.reduced ? 410 : 320) ? 'launch'
          : now < reply.at ? 'bloom' : now < reply.end ? 'return' : 'done';
      }
      if (now >= reply.end + 260) {
        this.replies.splice(i, 1);
        continue;
      }
      if (age < 0) continue;

      // The same quiet champagne point identifies the selected comment at
      // departure and arrival. No rings, labels or full-screen illumination.
      if (now < reply.at) {
        const fade = 1 - smooth(400, 1100, age);
        const radius = Math.max(5, w * (calm ? .012 : .016));
        g.globalAlpha = (.27 + fade * .45) * (calm ? .76 : 1);
        g.drawImage(glow, reply.originX - radius, reply.originY - radius, radius * 2, radius * 2);
        continue;
      }

      if (!reply.ready) {
        // Freeze a route when the light begins to return. It starts outside the
        // side of the head, curves farther out, then descends to the comment.
        // This narrative light never enters the particle pool or collision code.
        const hx = head ? head.x : reply.hx;
        const hy = head ? head.y : reply.hy;
        const rx = head ? head.rx : reply.rx;
        const ry = head ? head.ry : reply.ry;
        const side = reply.originX < hx - w * .03 ? -1 : 1;
        const edgeX = hx + side * (rx + w * .17);
        reply.x = hx + side * (rx + w * .055);
        reply.y = hy - ry * .06;
        reply.c1x = edgeX;
        reply.c1y = hy + ry * .55;
        reply.c2x = mix(edgeX, reply.originX, .12);
        reply.c2y = Math.max(hy + ry * 1.32, reply.originY - h * .075);
        reply.ready = true;
      }

      const progress = clamp((now - reply.at) / (reply.end - reply.at), 0, 1);
      // Near-constant progress preserves the visible act of travelling back;
      // the small easing shoulder only softens departure and arrival.
      const travel = progress * progress * (3 - 2 * progress);
      const x = cubic(reply.x, reply.c1x, reply.c2x, reply.originX, travel);
      const y = cubic(reply.y, reply.c1y, reply.c2y, reply.originY, travel);
      const fadeIn = smooth(0, .085, progress);
      const fadeOut = 1 - smooth(reply.end + 35, reply.end + 260, now);
      const alpha = fadeIn * fadeOut * (calm ? .73 : .98);
      const tail = Math.max(0, travel - (calm ? .11 : .17));
      g.strokeStyle = color;
      for (let pass = 0; pass < 2; pass++) {
        g.globalAlpha = alpha * (pass ? .79 : .17);
        g.lineWidth = Math.max(pass ? .8 : 2, w * (pass ? .0018 : .0065));
        g.beginPath();
        for (let k = 0; k <= 12; k++) {
          const t = mix(tail, travel, k / 12);
          const px = cubic(reply.x, reply.c1x, reply.c2x, reply.originX, t);
          const py = cubic(reply.y, reply.c1y, reply.c2y, reply.originY, t);
          if (k) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.stroke();
      }
      const radius = Math.max(5, w * (calm ? .012 : .019));
      g.globalAlpha = alpha;
      g.drawImage(glow, x - radius, y - radius, radius * 2, radius * 2);
      // The core settles onto the exact origin, then fades in place. The host
      // can retain its acknowledgement text after replyPhase becomes 'done'.
      if (progress === 1) {
        const settle = 1 - smooth(reply.end + 20, reply.end + 260, now);
        const landingRadius = radius * 1.24;
        g.globalAlpha = settle * (calm ? .27 : .45);
        g.drawImage(glow, reply.originX - landingRadius, reply.originY - landingRadius, landingRadius * 2, landingRadius * 2);
      }
    }
  }

  _advance(dt, head, hvx, hvy, reduced) {
    const w = this.w, h = this.h;
    const sub = dt / 3;
    const speedLimit = Math.max(w, h) * 1.42;
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const p = this.pool[this.active[i]];
      p.life -= dt;
      p.age += dt;
      p.hit = Math.max(0, p.hit - dt);
      if (p.life <= 0 || p.y > h * 1.17 || p.y < -h * .42 || p.x < -w * .25 || p.x > w * 1.25) {
        this._release(i);
        continue;
      }
      if (p.type === 0) {
        if(this._advanceRain){this._advanceRain(p,dt);continue;}
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        continue;
      }
      const drag = Math.exp(-p.drag * sub);
      for (let step = 0; step < 3; step++) {
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * sub;
        p.x += p.vx * sub;
        p.y += p.vy * sub;
        if (head) {
          // The ellipse is interpolated across the three integration substeps.
          // Reflect velocity relative to the moving head, then cap total speed.
          const remaining = dt - sub * (step + 1);
          const cx = head.x - hvx * remaining;
          const cy = head.y - hvy * remaining;
          const rx = Math.max(8, head.rx + p.size * 1.4);
          const ry = Math.max(8, head.ry + p.size * 1.4);
          let dx = p.x - cx, dy = p.y - cy;
          let q = dx * dx / (rx * rx) + dy * dy / (ry * ry);
          if (q < 1) {
            if (q < .000001) { dx = 0; dy = -ry; q = 1; }
            const inv = 1 / Math.sqrt(q);
            const rawNx = dx / (rx * rx), rawNy = dy / (ry * ry);
            const normalLength = Math.hypot(rawNx, rawNy) || 1;
            const nx = rawNx / normalLength, ny = rawNy / normalLength;
            p.x = cx + dx * inv + nx * 2;
            p.y = cy + dy * inv + ny * 2;
            const inward = (p.vx - hvx) * nx + (p.vy - hvy) * ny;
            if (inward < 0) {
              p.vx -= 2.12 * inward * nx;
              p.vy -= 2.12 * inward * ny;
              const outward = (p.vx - hvx) * nx + (p.vy - hvy) * ny;
              const kick = Math.max(0, w * .48 - outward);
              p.vx += nx * kick;
              p.vy += ny * kick;
              if (p.hit <= 0) {
                this.collisions++;
                if (!reduced || this.collisions % 3 === 0) this._contact(p.x, p.y, nx, ny);
              }
              p.hit = .48;
            }
          }
        }
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > speedLimit) {
          p.vx *= speedLimit / speed;
          p.vy *= speedLimit / speed;
        }
        p.trailClock += sub;
        if (p.trailClock >= .015) {
          p.trailClock %= .015;
          const n = Math.min(TRAIL - 1, p.trailN);
          for (let j = n; j > 0; j--) {
            p.trailX[j] = p.trailX[j - 1];
            p.trailY[j] = p.trailY[j - 1];
          }
          p.trailX[0] = p.x;
          p.trailY[0] = p.y;
          p.trailN = Math.min(TRAIL, p.trailN + 1);
        }
      }
    }
  }

  _contact(x, y, nx, ny) {
    const c = this.contacts[this.contactCursor];
    this.contactCursor = (this.contactCursor + 1) % MAX_CONTACTS;
    c.life = .45;
    c.x = x; c.y = y; c.nx = nx; c.ny = ny;
    c.length = this.w * (.028 + Math.random() * .018);
  }

  _safety(x, y, head) {
    let alpha = 1;
    if (head) {
      const dx = (x - head.x) / Math.max(1, head.rx);
      const dy = (y - head.y) / Math.max(1, head.ry);
      const distance = Math.sqrt(dx * dx + dy * dy);
      // A soft shoulder avoids an obvious cutout around a live face.
      alpha = .075 + .925 * smooth(.70, 1.42, distance);
    }
    // Preserve caption/chat legibility without hard horizontal clipping.
    alpha *= 1 - .63 * smooth(.69 * this.h, .92 * this.h, y);
    alpha *= .62 + .38 * smooth(.025 * this.h, .17 * this.h, y);
    return alpha;
  }

  _drawRain(p, head, now, reduced, preview) {
    const g = this.ctx;
    const vx = p.vx / p.vy;
    const midx = p.x - vx * p.length * .5;
    const midy = p.y - p.length * .5;
    const safe = Math.min(this._safety(p.x, p.y, head), this._safety(midx, midy, head));
    const fade = Math.min(1, p.life / .22) * Math.min(1, (p.age + .10) / .20);
    const alpha = p.opacity * safe * fade * (preview ? 1.08 : 1) * (reduced ? .81 : 1);
    if (alpha < .009) return;
    const color = this.preset.rain[p.color];
    if (p.blurred) {
      // Rare out-of-focus foreground droplets: diffuse lenses, never disks.
      const radius = this.w * (.009 + .003 * Math.sin(p.phase));
      g.globalAlpha = alpha * .31;
      g.drawImage(this._sprite(color, 'point'), p.x - radius, p.y - radius * 1.5, radius * 2, radius * 3);
      return;
    }
    g.save();
    g.translate(p.x, p.y);
    g.rotate(-Math.atan2(p.vx, p.vy));
    g.globalAlpha = Math.min(1, alpha);
    const width = p.size * 20;
    g.drawImage(this._sprite(color, 'rain'), -width * .5, -p.length, width, p.length);
    g.restore();
  }

  _drawSpark(p, head, now, reduced, preview) {
    const g = this.ctx;
    const life = clamp(p.life / p.maxLife, 0, 1);
    const fade = smooth(0, p.type === 2 ? .28 : .35, p.life) * smooth(0, .042, p.age);
    const safe = this._safety(p.x, p.y, head);
    const alpha = p.opacity * fade * safe * (preview ? 1.08 : 1) * (reduced ? .80 : 1);
    if (alpha < .006) return;
    const color = p.hit>0 ? '#ffffff' : this.preset.colors[p.color];
    const n = Math.min(p.trailN, p.type === 2 ? 4 : p.hit>0 ? TRAIL : p.hero ? TRAIL : 14);
    const width = p.size * (.60 + .40 * life) * (p.hit>0?1.7:1);
    if (n > 1) {
      if (p.hero) {
        // A subdued colored edge keeps the larger cinders readable on daylight
        // camera images; the warm core and glow still carry the visual weight.
        g.strokeStyle = this.style === 'nova' ? '#865879' : '#607d84';
        g.globalAlpha = alpha * .16;
        g.lineWidth = width * 1.65;
        g.beginPath(); g.moveTo(p.x, p.y);
        for (let j = 0; j < n; j++) g.lineTo(p.trailX[j], p.trailY[j]);
        g.stroke();
      }
      g.strokeStyle = color;
      // Three contiguous tapered trail sections retain the actual bounce path.
      for (let section = 2; section >= 0; section--) {
        const a = Math.floor(section * n / 3);
        const b = Math.min(n - 1, Math.ceil((section + 1) * n / 3));
        g.globalAlpha = alpha * [.98, .71, .34][section] * (p.type === 2 ? .62 : 1);
        g.lineWidth = Math.max(.45, width * [1, .78, .46][section]);
        g.beginPath();
        if (a === 0) g.moveTo(p.x, p.y);
        else g.moveTo(p.trailX[a - 1], p.trailY[a - 1]);
        for (let j = a; j <= b; j++) g.lineTo(p.trailX[j], p.trailY[j]);
        g.stroke();
      }
    }
    const radius = Math.max(3.1, width * (reduced ? 4.2 : p.hero ? 7.2 : 8.2));
    g.globalAlpha = Math.min(1, alpha * (p.type === 2 ? .69 : .94) * this.preset.glow);
    g.drawImage(this._sprite(color, 'point'), p.x - radius, p.y - radius, radius * 2, radius * 2);
    if (p.glint && !reduced && p.age > .13 && life > .27) {
      const envelope = Math.sin(clamp((p.age - .13) / 1.8, 0, 1) * Math.PI);
      const size = width * 11.5;
      g.globalAlpha = alpha * envelope * .64;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(.28 + p.phase * .07);
      g.drawImage(this._sprite(color, 'glint'), -size * .5, -size * .5, size, size);
      g.restore();
    }
  }

  _drawContacts(dt, reduced) {
    const g = this.ctx;
    g.strokeStyle = this.preset.colors[3];
    for (const c of this.contacts) {
      if (c.life <= 0) continue;
      c.life = Math.max(0, c.life - dt);
      const t = 1 - c.life / .45;
      const alpha = Math.sin(Math.PI * Math.min(1, t * 1.8)) * (1 - t) * (reduced ? .38 : .70);
      if (alpha <= 0) continue;
      const length = c.length * (.75 + t * .38);
      const tx = -c.ny, ty = c.nx;
      g.globalAlpha = alpha;
      g.lineWidth = Math.max(.75, this.w * .0032);
      g.beginPath();
      g.moveTo(c.x - tx * length, c.y - ty * length);
      g.quadraticCurveTo(c.x + c.nx * length * .43, c.y + c.ny * length * .43, c.x + tx * length, c.y + ty * length);
      g.stroke();
    }
  }

  _sprite(color, kind) {
    const key = `${color}:${kind}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const c = surface(kind === 'rain' ? 32 : 64, kind === 'rain' ? 192 : 64, this.canvas);
    const g = c.getContext('2d');
    const triplet = rgb(color);
    if (kind === 'rain') {
      const edge = g.createLinearGradient(0, 0, 0, 192);
      edge.addColorStop(0, 'rgba(53,76,91,0)');
      edge.addColorStop(.38, 'rgba(53,76,91,.16)');
      edge.addColorStop(.85, 'rgba(53,76,91,.40)');
      edge.addColorStop(1, 'rgba(53,76,91,0)');
      g.strokeStyle = edge;
      g.lineWidth = 3.1;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(14.4, 6); g.lineTo(14.4, 185); g.stroke();
      const halo = g.createLinearGradient(0, 0, 0, 192);
      halo.addColorStop(0, `rgba(${triplet},0)`);
      halo.addColorStop(.34, `rgba(${triplet},.15)`);
      halo.addColorStop(.80, `rgba(${triplet},.33)`);
      halo.addColorStop(.96, `rgba(${triplet},.23)`);
      halo.addColorStop(1, `rgba(${triplet},0)`);
      g.strokeStyle = halo;
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(16, 6); g.lineTo(16, 186); g.stroke();
      const core = g.createLinearGradient(0, 0, 0, 192);
      core.addColorStop(0, `rgba(${triplet},0)`);
      core.addColorStop(.18, `rgba(${triplet},.26)`);
      core.addColorStop(.65, `rgba(${triplet},.90)`);
      core.addColorStop(.91, `rgba(${triplet},.98)`);
      core.addColorStop(1, `rgba(${triplet},0)`);
      g.strokeStyle = core;
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(16.4, 3); g.lineTo(16.4, 188); g.stroke();
    } else if (kind === 'point') {
      const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, `rgba(${triplet},1)`);
      glow.addColorStop(.095, `rgba(${triplet},.96)`);
      glow.addColorStop(.22, `rgba(${triplet},.61)`);
      glow.addColorStop(.47, `rgba(${triplet},.20)`);
      glow.addColorStop(1, `rgba(${triplet},0)`);
      g.fillStyle = glow;
      g.fillRect(0, 0, 64, 64);
    } else {
      // Sparse four-point diffraction, with fine horizontal/vertical needles.
      g.translate(32, 32);
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      glow.addColorStop(0, 'rgba(255,253,245,.95)');
      glow.addColorStop(.20, `rgba(${triplet},.67)`);
      glow.addColorStop(1, `rgba(${triplet},0)`);
      g.fillStyle = glow;
      g.beginPath();
      g.moveTo(0, -30); g.quadraticCurveTo(1.3, -2, 23, 0);
      g.quadraticCurveTo(1.3, 2, 0, 30);
      g.quadraticCurveTo(-1.3, 2, -23, 0);
      g.quadraticCurveTo(-1.3, -2, 0, -30);
      g.fill();
    }
    this.sprites.set(key, c);
    return c;
  }
}

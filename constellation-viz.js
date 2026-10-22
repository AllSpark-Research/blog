/**
 * AllSpark Research — Unit-Distance Graph Visualization
 *
 * Based on the configuration that disproves Erdős's unit distance conjecture,
 * constructed with the help of ChatGPT 5.5 Thinking (Alvaro Lozano-Robledo, 2025).
 *
 * Point set: z = a + b·i + c·ρ + d·i·ρ,  where a,b,c,d ∈ {-2,-1,0,1,2}
 * and ρ = e^(iπ/3) (primitive 6th root of unity).
 * Edges connect pairs of points at distance EXACTLY 1.
 *
 * 625 points, 2800 unit-distance edges.
 */

(function () {
  'use strict';

  const CFG = {
    vals: [-2, -1, 0, 1, 2],
    unitEps: 1e-4,
    // rendering
    baseLineAlpha: 0.2,      // faint full graph
    baseNodeAlpha: 0.46,
    nodeColor: [78, 200, 255],   // ice blue
    edgeColor: [78, 200, 255],
    accentColor: [90, 160, 255], // electric blue accent for wave/spotlight
    // interaction
    spotlightRadius: 1.0,     // in graph units — highlights nodes within this radius of mouse
    // motion (kept calm/restrained)
    rotationSpeed: 0.00005,   // radians per ms — very slow, barely perceptible drift
    breathAmp: 0.012,
    breathSpeed: 0.0004,
    // auto pulse wave (subtle ambient life without mouse)
    waveSpeed: 0.0011,        // graph-units per ms of expanding radius
    waveWidth: 0.75,          // thickness of the pulse ring in graph units
    waveMaxR: 6.0,            // max radius before wave resets
    wavePeriodGap: 2200,      // ms gap between waves (longer = calmer)
  };

  function buildGraph(cfg) {
    const rho = { re: Math.cos(Math.PI / 3), im: Math.sin(Math.PI / 3) };
    const map = new Map();
    const pts = [];
    for (const a of cfg.vals)
      for (const b of cfg.vals)
        for (const c of cfg.vals)
          for (const d of cfg.vals) {
            // z = a + b i + c ρ + d i ρ
            // real = a + c*rho.re - d*rho.im   (i*ρ = i*(re+im i) = -im + re i)
            // imag = b + c*rho.im + d*rho.re
            const re = a + c * rho.re - d * rho.im;
            const im = b + c * rho.im + d * rho.re;
            const key = re.toFixed(5) + ',' + im.toFixed(5);
            if (!map.has(key)) {
              map.set(key, pts.length);
              pts.push({ x: re, y: im });
            }
          }

    // Build unit-distance edges using spatial hashing
    const cell = 1.0;
    const grid = new Map();
    const gkey = (gx, gy) => gx + '_' + gy;
    pts.forEach((p, idx) => {
      const gx = Math.floor(p.x / cell);
      const gy = Math.floor(p.y / cell);
      const k = gkey(gx, gy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(idx);
    });

    const edges = [];
    const eps = cfg.unitEps;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const gx = Math.floor(p.x / cell);
      const gy = Math.floor(p.y / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const arr = grid.get(gkey(gx + dx, gy + dy));
          if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue;
            const ddx = p.x - pts[j].x;
            const ddy = p.y - pts[j].y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (Math.abs(dist - 1.0) < eps) edges.push([i, j]);
          }
        }
      }
    }

    return { pts, edges };
  }

  class UnitDistanceViz {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = Object.assign({}, CFG, opts);
      this.mouse = { x: null, y: null, active: false };
      this.t0 = performance.now();
      this.animFrame = null;

      const g = buildGraph(this.cfg);
      this.pts = g.pts;
      this.edges = g.edges;

      // Precompute adjacency for spotlight edge lookup
      this.adj = this.pts.map(() => []);
      this.edges.forEach(([i, j], ei) => {
        this.adj[i].push(ei);
        this.adj[j].push(ei);
      });

      this._resize();
      this._bind();
      this._tick = this._tick.bind(this);
      this.animFrame = requestAnimationFrame(this._tick);
    }

    _resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.w = rect.width;
      this.h = rect.height;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Graph spans roughly [-4.73, 4.73]; fit with margin
      const span = 9.8;
      const fit = Math.min(this.w, this.h) / span;
      // Scale up so it fills width nicely on wide heroes.
      // Larger factor = bigger, more spacious lattice (less dense).
      this.scale = fit * 1.7;
      this.cx = this.w * 0.66;   // center slightly right (content on left)
      this.cy = this.h * 0.5;
    }

    _bind() {
      const move = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.mouse.active = true;
      };
      // Bind to the OUTERMOST hero/section container so pointer over overlaid
      // content (which sits above .hero-bg) still drives the spotlight.
      const host =
        this.canvas.closest('.hero') ||
        this.canvas.closest('.sub-hero') ||
        this.canvas.closest('.article-hero') ||
        this.canvas.closest('[data-udg-host]') ||
        this.canvas.parentElement ||
        this.canvas;
      this._host = host;
      host.addEventListener('mousemove', move);
      host.addEventListener('mouseleave', () => { this.mouse.active = false; });
      window.addEventListener('resize', () => this._resize());
    }

    _themeColors() {
      const isLight = document.documentElement.classList.contains('light');
      if (isLight) {
        return {
          node: [59, 104, 255],
          edge: [59, 104, 255],
          accent: [37, 90, 224],
          baseLineAlpha: 0.16,
          baseNodeAlpha: 0.42,
        };
      }
      return {
        node: this.cfg.nodeColor,
        edge: this.cfg.edgeColor,
        accent: this.cfg.accentColor,
        baseLineAlpha: this.cfg.baseLineAlpha,
        baseNodeAlpha: this.cfg.baseNodeAlpha,
      };
    }

    // graph coords -> screen, with rotation + breathing
    _project(p, cosT, sinT, breath) {
      const rx = p.x * cosT - p.y * sinT;
      const ry = p.x * sinT + p.y * cosT;
      return {
        x: this.cx + rx * this.scale * breath,
        y: this.cy + ry * this.scale * breath,
      };
    }

    _tick() {
      const now = performance.now();
      const t = now - this.t0;
      const ctx = this.ctx;
      const col = this._themeColors();

      const theta = t * this.cfg.rotationSpeed;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const breath = 1 + Math.sin(t * this.cfg.breathSpeed) * this.cfg.breathAmp;

      ctx.clearRect(0, 0, this.w, this.h);

      // Project all points once
      const proj = this.pts.map((p) => this._project(p, cosT, sinT, breath));

      // Determine spotlight set (graph-space distance from mouse)
      let hotNodes = null;
      if (this.mouse.active && this.mouse.x != null) {
        const mx = (this.mouse.x - this.cx) / (this.scale * breath);
        const my = (this.mouse.y - this.cy) / (this.scale * breath);
        const gx = mx * cosT + my * sinT;
        const gy = -mx * sinT + my * cosT;
        const r2 = this.cfg.spotlightRadius * this.cfg.spotlightRadius;
        hotNodes = new Set();
        for (let i = 0; i < this.pts.length; i++) {
          const dx = this.pts[i].x - gx;
          const dy = this.pts[i].y - gy;
          if (dx * dx + dy * dy < r2) hotNodes.add(i);
        }
      }

      // ─── Auto pulse wave: expands from center, always visible ───
      const wavePeriod = this.cfg.waveMaxR / this.cfg.waveSpeed + this.cfg.wavePeriodGap;
      const wavePhase = (t % wavePeriod) * this.cfg.waveSpeed; // current radius
      const waveW = this.cfg.waveWidth;
      const nodeEnergy = new Float32Array(this.pts.length);
      for (let i = 0; i < this.pts.length; i++) {
        const rr = Math.sqrt(this.pts[i].x * this.pts[i].x + this.pts[i].y * this.pts[i].y);
        const d = Math.abs(rr - wavePhase);
        if (d < waveW) nodeEnergy[i] = 1 - d / waveW;
      }

      // 1) Faint base edges (full unit-distance graph)
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${col.edge[0]},${col.edge[1]},${col.edge[2]},${col.baseLineAlpha})`;
      ctx.beginPath();
      for (const [i, j] of this.edges) {
        ctx.moveTo(proj[i].x, proj[i].y);
        ctx.lineTo(proj[j].x, proj[j].y);
      }
      ctx.stroke();

      // 1b) Wave-lit edges (edges whose endpoints carry wave energy)
      for (let ei = 0; ei < this.edges.length; ei++) {
        const [a, b] = this.edges[ei];
        const e = Math.max(nodeEnergy[a], nodeEnergy[b]);
        if (e <= 0.02) continue;
        ctx.strokeStyle = `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},${(e * 0.6).toFixed(3)})`;
        ctx.lineWidth = 1 + e * 0.8;
        ctx.beginPath();
        ctx.moveTo(proj[a].x, proj[a].y);
        ctx.lineTo(proj[b].x, proj[b].y);
        ctx.stroke();
      }

      // 2) Spotlight edges (edges incident to hot nodes) — brighter
      if (hotNodes && hotNodes.size) {
        const drawn = new Set();
        ctx.lineWidth = 1.2;
        for (const i of hotNodes) {
          for (const ei of this.adj[i]) {
            if (drawn.has(ei)) continue;
            drawn.add(ei);
            const [a, b] = this.edges[ei];
            const both = hotNodes.has(a) && hotNodes.has(b);
            const alpha = both ? 0.7 : 0.35;
            ctx.strokeStyle = `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},${alpha})`;
            ctx.beginPath();
            ctx.moveTo(proj[a].x, proj[a].y);
            ctx.lineTo(proj[b].x, proj[b].y);
            ctx.stroke();
          }
        }
      }

      // 3) Base nodes (+ wave glow)
      for (let i = 0; i < proj.length; i++) {
        if (hotNodes && hotNodes.has(i)) continue; // hot drawn later
        const p = proj[i];
        const e = nodeEnergy[i];
        if (e > 0.05) {
          const gr = 3 + e * 7;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
          grad.addColorStop(0, `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},${(e * 0.55).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${col.node[0]},${col.node[1]},${col.node[2]},${Math.min(1, col.baseNodeAlpha + e * 0.6).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.1 + e * 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${col.node[0]},${col.node[1]},${col.node[2]},${col.baseNodeAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4) Hot nodes with glow (mouse spotlight)
      if (hotNodes) {
        for (const i of hotNodes) {
          const p = proj[i];
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
          grad.addColorStop(0, `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},0.6)`);
          grad.addColorStop(1, `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(${col.accent[0]},${col.accent[1]},${col.accent[2]},1)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      this.animFrame = requestAnimationFrame(this._tick);
    }

    pause() {
      this.paused = true;
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    resume() {
      if (!this.paused) return;
      this.paused = false;
      this.animFrame = requestAnimationFrame(this._tick);
    }

    destroy() {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
  }

  // ─── Interference Visualization ────────────────────────────────────
  // Two symmetric wave sources emit expanding concentric ripples over the
  // unit-distance graph. Node/edge brightness = superposition of both waves.
  // Constructive interference (crest+crest) → bright; destructive → dark.
  // A ripple in mathematical space.
  class InterferenceViz {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = Object.assign({}, CFG, {
        wavelength: 1.15,       // graph units between crests
        waveSpeedIF: 0.0024,    // phase advance per ms
        sourceSep: 4.2,         // half-distance between the two sources (graph units) — pulled apart
        baseLineAlpha: 0.03,    // static lattice almost invisible — the WAVES are the subject
        baseNodeAlpha: 0.07,
        litLineAlpha: 0.9,
        litNodeAlpha: 1.0,
      }, opts);
      this.mouse = { x: null, y: null, active: false };
      this.t0 = performance.now();
      this.animFrame = null;

      const g = buildGraph(this.cfg);
      this.pts = g.pts;
      this.edges = g.edges;

      this._resize();
      this._bind();
      this._tick = this._tick.bind(this);
      this.animFrame = requestAnimationFrame(this._tick);
    }

    _resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.w = rect.width;
      this.h = rect.height;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const span = 12.5;
      const fitY = this.h / span;
      this.scaleY = fitY * 1.25;
      // stretch horizontally so the field fills the wide canvas and the two
      // sources sit toward bottom-left / top-right corners
      this.scaleX = this.scaleY * 1.7;
      this.cx = this.w * 0.5;
      this.cy = this.h * 0.5;
    }

    _bind() {
      const move = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.mouse.active = true;
      };
      const host =
        this.canvas.closest('.sub-hero') ||
        this.canvas.closest('.hero') ||
        this.canvas.closest('[data-udg-host]') ||
        this.canvas.parentElement || this.canvas;
      host.addEventListener('mousemove', move);
      host.addEventListener('mouseleave', () => { this.mouse.active = false; });
      window.addEventListener('resize', () => this._resize());
    }

    _themeColors() {
      const isLight = document.documentElement.classList.contains('light');
      if (isLight) {
        return { c: [59, 104, 255], baseLineAlpha: 0.04, baseNodeAlpha: 0.08 };
      }
      // electric blue — matches the hero page
      return { c: [59, 104, 255], baseLineAlpha: this.cfg.baseLineAlpha, baseNodeAlpha: this.cfg.baseNodeAlpha };
    }

    _tick() {
      const now = performance.now();
      const t = now - this.t0;
      const ctx = this.ctx;
      const col = this._themeColors();
      const c = col.c;

      ctx.clearRect(0, 0, this.w, this.h);

      // Two sources on a diagonal: bottom-left ↔ top-right (graph space; +y is down).
      // Mouse gently nudges them along the anti-diagonal.
      const sep = this.cfg.sourceSep;
      const diag = Math.SQRT1_2; // 1/√2 to split sep across x and y
      let nudge = 0;
      if (this.mouse.active && this.mouse.x != null) {
        const mgx = (this.mouse.x - this.cx) / this.scaleX;
        nudge = Math.max(-1.5, Math.min(1.5, mgx * 0.2));
      }
      // src1 bottom-left (−x, +y), src2 top-right (+x, −y)
      const src1 = { x: -sep * diag - nudge, y:  sep * diag };
      const src2 = { x:  sep * diag + nudge, y: -sep * diag };

      const k = (Math.PI * 2) / this.cfg.wavelength; // wave number
      const phase = t * this.cfg.waveSpeedIF;

      // amplitude at a graph-space point from the two sources (superposition).
      // Gentle decay so ripples travel across the whole field and stay visible.
      const amp = (gx, gy) => {
        const d1 = Math.sqrt((gx - src1.x) ** 2 + (gy - src1.y) ** 2);
        const d2 = Math.sqrt((gx - src2.x) ** 2 + (gy - src2.y) ** 2);
        const a1 = Math.cos(k * d1 - phase) / (1 + d1 * 0.12);
        const a2 = Math.cos(k * d2 - phase) / (1 + d2 * 0.12);
        return a1 + a2; // -2..2
      };

      // Precompute node litness from interference (0..1).
      // Only wave CRESTS (positive superposition) light up → you see two sets of
      // expanding concentric rings; where crests meet crests → extra bright
      // (constructive), where crest meets trough → cancels to dark (destructive).
      const lit = new Float32Array(this.pts.length);
      for (let i = 0; i < this.pts.length; i++) {
        const a = amp(this.pts[i].x, this.pts[i].y);   // -2..2
        const crest = Math.max(0, a) / 2;              // 0..1, only crests
        lit[i] = Math.pow(crest, 0.8);                 // slight boost of mid values
      }

      const project = (p) => ({ x: this.cx + p.x * this.scaleX, y: this.cy + p.y * this.scaleY });
      const proj = this.pts.map(project);

      const baseL = col.baseLineAlpha, litL = this.cfg.litLineAlpha;
      const baseN = col.baseNodeAlpha, litN = this.cfg.litNodeAlpha;

      // 1) Edges
      for (let ei = 0; ei < this.edges.length; ei++) {
        const [a, b] = this.edges[ei];
        const l = Math.max(lit[a], lit[b]);
        const bri = baseL + l * (litL - baseL);
        if (bri <= 0.02) continue;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${bri.toFixed(3)})`;
        ctx.lineWidth = 0.9 + l * 0.9;
        ctx.beginPath();
        ctx.moveTo(proj[a].x, proj[a].y);
        ctx.lineTo(proj[b].x, proj[b].y);
        ctx.stroke();
      }

      // 2) Nodes
      for (let i = 0; i < proj.length; i++) {
        const p = proj[i];
        const l = lit[i];
        const bri = baseN + l * (litN - baseN);
        if (l > 0.55) {
          const gr = 2.5 + l * 6;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
          grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(l * 0.45).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${bri.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1 + l * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3) Mark the two wave sources with a soft pulsing dot
      const pulse = 0.6 + 0.4 * Math.sin(phase * 1.3);
      for (const s of [src1, src2]) {
        const sp = project(s);
        const grad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 16);
        grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(0.4 * pulse).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      this.animFrame = requestAnimationFrame(this._tick);
    }

    destroy() {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
  }
  function createFacetIcon(container, size = 64) {
    const isLight = document.documentElement.classList.contains('light');
    const color = isLight ? '#3B68FF' : '#4EC8FF';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 64 64');
    const cx = 32, cy = 32, r = size * 0.35;
    const N = 6; // hexagonal to echo the ρ = 6th-root symmetry
    const pts = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    for (let i = 0; i < N; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % N];
      const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l1.setAttribute('x1', p1.x); l1.setAttribute('y1', p1.y);
      l1.setAttribute('x2', p2.x); l1.setAttribute('y2', p2.y);
      l1.setAttribute('stroke', color); l1.setAttribute('stroke-width', '1.5'); l1.setAttribute('opacity', '0.6');
      svg.appendChild(l1);
      const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l2.setAttribute('x1', cx); l2.setAttribute('y1', cy);
      l2.setAttribute('x2', p1.x); l2.setAttribute('y2', p1.y);
      l2.setAttribute('stroke', color); l2.setAttribute('stroke-width', '1'); l2.setAttribute('opacity', '0.4');
      svg.appendChild(l2);
    }
    // second rotated hexagon for facet feel
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2 + Math.PI / N;
      const x = cx + Math.cos(ang) * r * 0.55;
      const y = cy + Math.sin(ang) * r * 0.55;
      const nx = cx + Math.cos(ang + Math.PI * 2 / N) * r * 0.55;
      const ny = cy + Math.sin(ang + Math.PI * 2 / N) * r * 0.55;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x); l.setAttribute('y1', y);
      l.setAttribute('x2', nx); l.setAttribute('y2', ny);
      l.setAttribute('stroke', color); l.setAttribute('stroke-width', '0.8'); l.setAttribute('opacity', '0.3');
      svg.appendChild(l);
    }
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('cx', cx); glow.setAttribute('cy', cy); glow.setAttribute('r', 7);
    glow.setAttribute('fill', color); glow.setAttribute('opacity', '0.25');
    svg.appendChild(glow);
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', cx); center.setAttribute('cy', cy); center.setAttribute('r', 2.5);
    center.setAttribute('fill', color);
    svg.appendChild(center);
    container.appendChild(svg);
  }

  // Render a small static unit-distance graph into an SVG placeholder (blog cards, figures)
  function renderMiniGraph(svg) {
    const isLight = document.documentElement.classList.contains('light');
    const color = isLight ? '59,104,255' : '78,200,255';
    // Use a reduced point set {-1,0,1} for a cleaner small motif
    const rho = { re: Math.cos(Math.PI / 3), im: Math.sin(Math.PI / 3) };
    const vals = [-1, 0, 1];
    const map = new Map();
    const pts = [];
    for (const a of vals) for (const b of vals) for (const c of vals) for (const d of vals) {
      const re = a + c * rho.re - d * rho.im;
      const im = b + c * rho.im + d * rho.re;
      const key = re.toFixed(4) + ',' + im.toFixed(4);
      if (!map.has(key)) { map.set(key, pts.length); pts.push({ x: re, y: im }); }
    }
    const edges = [];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        if (Math.abs(Math.sqrt(dx * dx + dy * dy) - 1) < 1e-4) edges.push([i, j]);
      }
    // fit into 0..100 viewBox
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const pad = 12;
    const sc = (100 - pad * 2) / span;
    const proj = pts.map(p => ({
      x: pad + (p.x - minX) * sc + (100 - pad * 2 - (maxX - minX) * sc) / 2,
      y: pad + (p.y - minY) * sc + (100 - pad * 2 - (maxY - minY) * sc) / 2,
    }));
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    let inner = '';
    for (const [i, j] of edges)
      inner += `<line x1="${proj[i].x.toFixed(2)}" y1="${proj[i].y.toFixed(2)}" x2="${proj[j].x.toFixed(2)}" y2="${proj[j].y.toFixed(2)}" stroke="rgba(${color},0.28)" stroke-width="0.5"/>`;
    for (const p of proj)
      inner += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="0.9" fill="rgba(${color},0.7)"/>`;
    svg.innerHTML = inner;
  }

  const _heroInstances = [];

  function initAll() {
    document.querySelectorAll('canvas[data-interference-viz]').forEach((canvas) => {
      new InterferenceViz(canvas);
    });
    document.querySelectorAll('canvas[data-constellation-viz]').forEach((canvas) => {
      _heroInstances.push(new UnitDistanceViz(canvas));
    });
    document.querySelectorAll('svg[data-constellation-viz]').forEach((svg) => {
      renderMiniGraph(svg);
    });
    document.querySelectorAll('[data-facet-icon]').forEach((el) => {
      const size = parseInt(el.getAttribute('data-facet-icon')) || 64;
      createFacetIcon(el, size);
    });
  }

  // Toggle hero animation on/off (used by the hero anim switch button)
  function setHeroAnimation(on) {
    _heroInstances.forEach((v) => { on ? v.resume() : v.pause(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.AllSparkViz = { UnitDistanceViz, InterferenceViz, createFacetIcon, buildGraph, setHeroAnimation };
})();

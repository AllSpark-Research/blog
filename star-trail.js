/**
 * AllSpark Research — Star Trail Visualization
 *
 * Dense stars, each trailing a faint arc, rotating around a central
 * Polaris (north star). Cold, precise, tech aesthetic. Electric-blue palette
 * consistent with the site (#3B68FF / #4EC8FF), no color-shift — brightness only.
 *
 * This module is fully independent from constellation-viz.js. It never touches
 * the existing geometry animation.
 */

(function () {
  'use strict';

  const CFG = {
    starCount: 200,       // denser mid/outer rings, center kept sparse via radius bias
    rotationSpeed: 0.00003, // radians per ms — very slow, calm
    trailArc: 2.0,         // radians of trailing arc per star (~115°, roughly a third of the circle)
    trailSteps: 64,        // more segments for a smoother long streak
    minR: 0.08,            // inner radius (fraction of maxR) — keep center clear
    maxRFactor: 0.62,      // outer radius as fraction of min(w,h)
    starBase: [180, 205, 255],  // cool white-blue for stars
    accent: [56, 102, 255],     // brand blue (#3866FF) for bright star-trails
    polaris: [120, 170, 255],   // Polaris glow (electric-ish)
    twinkleSpeed: 0.002,
    trailWidth: 1.7,       // base multiplier for trail thickness (smoother arcs)
    headScale: 0.22,       // head dot size relative to old value (much smaller → arcs, not dots)
  };

  class StarTrailViz {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = Object.assign({}, CFG, opts);
      this.t0 = performance.now();
      this.animFrame = null;
      this.paused = false;
      this.stars = [];

      this._resize();
      this._makeStars();
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
      // Polaris sits slightly right of center so it clears the hero text on the left
      this.cx = this.w * 0.62;
      this.cy = this.h * 0.46;
      this.maxR = Math.min(this.w, this.h) * this.cfg.maxRFactor;
    }

    _makeStars() {
      const n = this.cfg.starCount;
      this.stars = [];
      // deterministic pseudo-random for stable layout
      let seed = 20260724;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < n; i++) {
        // Push most stars toward the mid/outer rings so added density lands there
        // while the center stays sparse.
        const u = rand();
        const rr = this.cfg.minR + Math.pow(u, 0.7) * (1 - this.cfg.minR);
        const bright = rand();
        this.stars.push({
          angle: rand() * Math.PI * 2,
          radius: rr,                    // 0..1 fraction of maxR
          size: 0.5 + bright * 1.6,      // px
          bright,                        // 0..1
          twinklePhase: rand() * Math.PI * 2,
          isAccent: rand() < 0.18,       // brand-blue bright trails (a bit more visible)
          sparkle: bright > 0.6,         // brighter stars get a radiant sparkle head
        });
      }
    }

    _bind() {
      window.addEventListener('resize', () => this._resize());
    }

    _themeColors() {
      const isLight = document.documentElement.classList.contains('light');
      if (isLight) {
        return {
          star: [70, 110, 200],
          accent: [56, 102, 255],
          polaris: [59, 104, 255],
          bgAlpha: 0.9,
        };
      }
      return {
        star: this.cfg.starBase,
        accent: [56, 102, 255],
        polaris: this.cfg.polaris,
        bgAlpha: 1,
      };
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

    _tick() {
      const now = performance.now();
      const t = now - this.t0;
      const ctx = this.ctx;
      const col = this._themeColors();

      ctx.clearRect(0, 0, this.w, this.h);

      const globalAngle = t * this.cfg.rotationSpeed;
      const arc = this.cfg.trailArc;
      const steps = this.cfg.trailSteps;

      // Draw each star's trailing arc + head
      for (let s = 0; s < this.stars.length; s++) {
        const star = this.stars[s];
        const r = star.radius * this.maxR;
        // trail arc length: inner stars slightly shorter, outer stars fuller
        const localArc = arc * (0.55 + star.radius * 0.45);
        const headAngle = star.angle + globalAngle;

        const c = star.isAccent ? col.accent : col.star;
        const twinkle = 0.75 + 0.25 * Math.sin(t * this.cfg.twinkleSpeed + star.twinklePhase);
        const headAlpha = (0.25 + star.bright * 0.65) * twinkle;

        // Trail: one continuous arc drawn as a few butt-capped sub-arcs with a
        // head→tail alpha gradient. Using native arc() (not round-capped line
        // segments) eliminates the "beading" dots along the trail.
        const grpSteps = 5;                 // few sub-arcs = smooth, no beads
        const dir = -1;                     // trail goes behind the head
        ctx.lineCap = 'butt';
        for (let k = 0; k < grpSteps; k++) {
          const f0 = k / grpSteps;
          const f1 = (k + 1) / grpSteps;
          const seg = 1 - f0;               // 1 near head → 0 at tail
          const a = headAlpha * Math.pow(seg, 1.25) * 0.7;
          if (a < 0.005) continue;
          const a0 = headAngle + dir * localArc * f0;
          const a1 = headAngle + dir * localArc * f1;
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
          ctx.lineWidth = this.cfg.trailWidth * star.size * (0.6 + seg * 0.55);
          ctx.beginPath();
          // arc() with anticlockwise flag depending on direction
          ctx.arc(this.cx, this.cy, r, a1, a0, false);
          ctx.stroke();
        }

        // Head star — radiant sparkle: soft glow halo + fine cross flare.
        const hx = this.cx + Math.cos(headAngle) * r;
        const hy = this.cy + Math.sin(headAngle) * r;
        const twk = 0.8 + 0.2 * Math.sin(t * this.cfg.twinkleSpeed * 1.6 + star.twinklePhase);

        if (star.sparkle) {
          const baseA = Math.min(1, headAlpha + 0.1);
          // small, soft circular glow — low-key radiance, no cross flare
          const gr = (2.4 + star.bright * 2.6) * twk;
          const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, gr);
          grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(baseA * 0.45).toFixed(3)})`);
          grad.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${(baseA * 0.12).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(hx, hy, gr, 0, Math.PI * 2);
          ctx.fill();

          // small bright core
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, baseA + 0.2).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(hx, hy, Math.max(0.6, star.size * 0.42), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // faint stars: just a tiny soft point, keeps the field subtle
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, headAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(hx, hy, star.size * this.cfg.headScale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Central Polaris — a steady, bright north star with a soft glow and a faint cross flare
      const pr = 2.6;
      const glowR = 26 + 3 * Math.sin(t * 0.0012);
      const pg = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, glowR);
      pg.addColorStop(0, `rgba(${col.polaris[0]},${col.polaris[1]},${col.polaris[2]},0.45)`);
      pg.addColorStop(0.4, `rgba(${col.polaris[0]},${col.polaris[1]},${col.polaris[2]},0.12)`);
      pg.addColorStop(1, `rgba(${col.polaris[0]},${col.polaris[1]},${col.polaris[2]},0)`);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // subtle cross flare
      const flare = 14;
      const fg = ctx.createLinearGradient(this.cx - flare, this.cy, this.cx + flare, this.cy);
      ctx.strokeStyle = `rgba(${col.polaris[0]},${col.polaris[1]},${col.polaris[2]},0.35)`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(this.cx - flare, this.cy); ctx.lineTo(this.cx + flare, this.cy);
      ctx.moveTo(this.cx, this.cy - flare); ctx.lineTo(this.cx, this.cy + flare);
      ctx.stroke();

      // Polaris core
      ctx.fillStyle = `rgba(255,255,255,0.95)`;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${col.polaris[0]},${col.polaris[1]},${col.polaris[2]},0.9)`;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, pr + 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,1)`;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, pr * 0.55, 0, Math.PI * 2);
      ctx.fill();

      this.animFrame = requestAnimationFrame(this._tick);
    }

    destroy() {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
  }

  window.StarTrailViz = StarTrailViz;
})();

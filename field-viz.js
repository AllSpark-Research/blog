/**
 * AllSpark Research — Field Visualization
 * Generates the vector field / equipotential lines SVG effect
 */

(function() {
  'use strict';

  // Config
  const CFG = {
    numLines: 52,
    lineSteps: 60,
    stepSize: 4,
    lineOpacity: 0.28,
    lineWidth: 0.5,
    lineColor: '#B8B8B0',
    dotColor: '#C8102E',
    dotRadius: 4.5,
    dotGlow: 14,
    mouseInfluence: 0.18,
    mouseRadius: 200,
    animSpeed: 0.0006,
  };

  class FieldViz {
    constructor(svgEl, options = {}) {
      this.svg = svgEl;
      this.cfg = Object.assign({}, CFG, options);
      this.mouse = { x: 0.5, y: 0.5 };
      this.time = 0;
      this.w = 0;
      this.h = 0;
      this.cx = 0;
      this.cy = 0;
      this.paths = [];
      this.animFrame = null;
      this.lines = [];

      this._init();
    }

    _init() {
      this.svg.innerHTML = '';
      this._measure();
      this._buildDefs();
      this._buildLines();
      this._buildDot();
      this._bindEvents();
      this._tick();
    }

    _measure() {
      const rect = this.svg.getBoundingClientRect();
      this.w = rect.width || this.svg.clientWidth || 600;
      this.h = rect.height || this.svg.clientHeight || 500;
      this.cx = this.w * 0.5;
      this.cy = this.h * 0.48;
      this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    }

    _buildDefs() {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${this.cfg.dotColor}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${this.cfg.dotColor}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bgFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#F0EFE8" stop-opacity="0"/>
          <stop offset="100%" stop-color="#FAFAF8" stop-opacity="0"/>
        </radialGradient>
      `;
      this.svg.appendChild(defs);
    }

    _buildLines() {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'field-lines');

      this.lines = [];
      const n = this.cfg.numLines;

      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', this.cfg.lineColor);
        path.setAttribute('stroke-width', this.cfg.lineWidth);
        path.setAttribute('opacity', this.cfg.lineOpacity);
        path.setAttribute('stroke-linecap', 'round');
        g.appendChild(path);
        this.lines.push({ path, baseAngle: angle });
      }

      this.linesGroup = g;
      this.svg.appendChild(g);
    }

    _buildDot() {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'spark-dot');

      // Glow
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', this.cx);
      glow.setAttribute('cy', this.cy);
      glow.setAttribute('r', this.cfg.dotGlow);
      glow.setAttribute('fill', 'url(#dotGlow)');
      g.appendChild(glow);

      // Dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', this.cx);
      dot.setAttribute('cy', this.cy);
      dot.setAttribute('r', this.cfg.dotRadius);
      dot.setAttribute('fill', this.cfg.dotColor);
      g.appendChild(dot);

      this.dotGroup = g;
      this.svg.appendChild(g);
    }

    _bindEvents() {
      const parent = this.svg.closest('.hero-right') || this.svg.parentElement;
      if (!parent) return;

      parent.addEventListener('mousemove', (e) => {
        const rect = this.svg.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / rect.width;
        this.mouse.y = (e.clientY - rect.top) / rect.height;
      });

      parent.addEventListener('mouseleave', () => {
        this.mouse.x = 0.5;
        this.mouse.y = 0.5;
      });

      // Resize
      const ro = new ResizeObserver(() => {
        this._measure();
      });
      ro.observe(this.svg);
    }

    // Compute field direction at point (x,y) given source at (cx,cy)
    // with mouse perturbation
    _field(x, y) {
      const dx = x - this.cx;
      const dy = y - this.cy;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;

      // Base: radial outward
      let fx = dx / dist;
      let fy = dy / dist;

      // Add subtle curl (makes lines curve slightly)
      const curlStrength = 0.28;
      fx += -dy / dist * curlStrength;
      fy += dx / dist * curlStrength;

      // Mouse perturbation
      const mx = this.mouse.x * this.w;
      const my = this.mouse.y * this.h;
      const mdx = x - mx;
      const mdy = y - my;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy) + 0.001;
      const mInfluence = this.cfg.mouseInfluence * Math.exp(-mdist / this.cfg.mouseRadius);
      fx += (mdx / mdist) * mInfluence;
      fy += (mdy / mdist) * mInfluence;

      // Normalize
      const len = Math.sqrt(fx * fx + fy * fy) + 0.001;
      return { fx: fx / len, fy: fy / len };
    }

    _updateLines() {
      const startRadius = 18;
      const steps = this.cfg.lineSteps;
      const step = this.cfg.stepSize;
      const t = this.time;

      for (let i = 0; i < this.lines.length; i++) {
        const { path, baseAngle } = this.lines[i];

        // Slight angular wobble over time
        const wobble = Math.sin(t * 0.8 + i * 0.4) * 0.018;
        const angle = baseAngle + wobble;

        let x = this.cx + Math.cos(angle) * startRadius;
        let y = this.cy + Math.sin(angle) * startRadius;

        let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;

        for (let s = 0; s < steps; s++) {
          const { fx, fy } = this._field(x, y);
          x += fx * step;
          y += fy * step;

          // Stop if out of bounds
          if (x < -10 || x > this.w + 10 || y < -10 || y > this.h + 10) break;

          d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }

        path.setAttribute('d', d);
      }
    }

    _tick() {
      this.time += this.cfg.animSpeed * 16; // ~60fps
      this._updateLines();
      this.animFrame = requestAnimationFrame(() => this._tick());
    }

    destroy() {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
  }

  // ─── Spark Mini SVG (for field cards) ───────────────────────────
  function createSparkMini(container, size = 60) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    const cx = size / 2;
    const cy = size / 2;

    // Rings of dots
    const rings = [
      { r: 8, count: 5, dotR: 1.5, opacity: 0.25 },
      { r: 14, count: 8, dotR: 1.2, opacity: 0.18 },
      { r: 20, count: 11, dotR: 1.0, opacity: 0.12 },
      { r: 26, count: 14, dotR: 0.8, opacity: 0.08 },
    ];

    rings.forEach(ring => {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2;
        const x = cx + Math.cos(angle) * ring.r;
        const y = cy + Math.sin(angle) * ring.r;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x.toFixed(2));
        dot.setAttribute('cy', y.toFixed(2));
        dot.setAttribute('r', ring.dotR);
        dot.setAttribute('fill', '#888880');
        dot.setAttribute('opacity', ring.opacity);
        svg.appendChild(dot);
      }
    });

    // Center dot
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', cx);
    center.setAttribute('cy', cy);
    center.setAttribute('r', 3);
    center.setAttribute('fill', '#C8102E');
    svg.appendChild(center);

    container.appendChild(svg);
  }

  // ─── Instrument Pipeline SVG ─────────────────────────────────────
  function createInstrumentPipeline(container) {
    const steps = ['Observe', 'Record', 'Measure', 'Store', 'Analyze'];
    const icons = [
      // Eye
      `<circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>`,
      // Document
      `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
      // Ruler/scale
      `<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="8" x2="4" y2="16"/><line x1="20" y1="8" x2="20" y2="16"/><line x1="12" y1="10" x2="12" y2="14"/>`,
      // Database
      `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
      // Bar chart
      `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>`,
    ];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;';

    steps.forEach((step, i) => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';

      const iconWrapper = document.createElement('div');
      iconWrapper.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;';
      iconWrapper.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8A8A84" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</svg>`;

      const label = document.createElement('div');
      label.style.cssText = 'font-size:11px;color:#8A8A84;letter-spacing:0.04em;font-family:Inter,system-ui,sans-serif;';
      label.textContent = step;

      item.appendChild(iconWrapper);
      item.appendChild(label);
      wrapper.appendChild(item);

      if (i < steps.length - 1) {
        const arrow = document.createElement('div');
        arrow.style.cssText = 'color:#C8C8C0;font-size:16px;margin-top:-12px;';
        arrow.textContent = '→';
        wrapper.appendChild(arrow);
      }
    });

    container.appendChild(wrapper);
  }

  // ─── Scatter Plot SVG ────────────────────────────────────────────
  function createScatterPlot(container, w = 340, h = 180) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // Axes
    const axisStyle = 'stroke:#D4D4CE;stroke-width:1;';
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '30'); xAxis.setAttribute('y1', h - 20);
    xAxis.setAttribute('x2', w - 10); xAxis.setAttribute('y2', h - 20);
    xAxis.setAttribute('style', axisStyle);
    svg.appendChild(xAxis);

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '30'); yAxis.setAttribute('y1', '10');
    yAxis.setAttribute('x2', '30'); yAxis.setAttribute('y2', h - 20);
    yAxis.setAttribute('style', axisStyle);
    svg.appendChild(yAxis);

    // Points — pseudo-random but deterministic
    const pts = [];
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

    for (let i = 0; i < 60; i++) {
      const x = 35 + rand() * (w - 50);
      const y = 15 + rand() * (h - 40);
      pts.push({ x, y, isRed: rand() < 0.06 });
    }

    pts.forEach(({ x, y, isRed }) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', y.toFixed(1));
      c.setAttribute('r', isRed ? 3.5 : 2);
      c.setAttribute('fill', isRed ? '#C8102E' : '#B0B0A8');
      c.setAttribute('opacity', isRed ? '0.9' : '0.45');
      svg.appendChild(c);
    });

    container.appendChild(svg);
  }

  // ─── Loop Diagram SVG ────────────────────────────────────────────
  function createLoopDiagram(container, w = 340, h = 180) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const cx = w / 2, cy = h / 2 - 5;
    const rx = w * 0.28, ry = h * 0.32;

    // Ellipse path
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', cx); ellipse.setAttribute('cy', cy);
    ellipse.setAttribute('rx', rx); ellipse.setAttribute('ry', ry);
    ellipse.setAttribute('fill', 'none');
    ellipse.setAttribute('stroke', '#C8C8C0');
    ellipse.setAttribute('stroke-width', '1');
    ellipse.setAttribute('stroke-dasharray', '4 3');
    svg.appendChild(ellipse);

    // Nodes
    const nodes = [
      { angle: -90, label: 'Hypothesize', isTop: true },
      { angle: 30, label: 'Deploy', isTop: false },
      { angle: 150, label: 'Deploy', isTop: false },
    ];

    const labelStyle = 'font:11px Inter,sans-serif;fill:#8A8A84;';
    nodes.forEach(({ angle, label, isTop }) => {
      const rad = angle * Math.PI / 180;
      const nx = cx + Math.cos(rad) * rx;
      const ny = cy + Math.sin(rad) * ry;

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', nx.toFixed(1));
      dot.setAttribute('cy', ny.toFixed(1));
      dot.setAttribute('r', isTop ? 4 : 3);
      dot.setAttribute('fill', isTop ? '#C8102E' : '#C8C8C0');
      svg.appendChild(dot);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', nx.toFixed(1));
      text.setAttribute('y', (isTop ? ny - 10 : ny + 16).toFixed(1));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('style', labelStyle);
      text.textContent = label;
      svg.appendChild(text);
    });

    // Red dot "signal" on loop
    const sigRad = (220 * Math.PI / 180);
    const sx = cx + Math.cos(sigRad) * rx;
    const sy = cy + Math.sin(sigRad) * ry;
    const sig = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sig.setAttribute('cx', sx.toFixed(1));
    sig.setAttribute('cy', sy.toFixed(1));
    sig.setAttribute('r', 3.5);
    sig.setAttribute('fill', '#C8102E');
    svg.appendChild(sig);

    container.appendChild(svg);
  }

  // ─── Public Init ─────────────────────────────────────────────────
  function initAll() {
    // Main field viz
    document.querySelectorAll('[data-field-viz]').forEach(svgEl => {
      new FieldViz(svgEl);
    });

    // Spark minis
    document.querySelectorAll('[data-spark-mini]').forEach(el => {
      const size = parseInt(el.getAttribute('data-spark-mini')) || 60;
      createSparkMini(el, size);
    });

    // Instrument pipeline
    document.querySelectorAll('[data-instrument-pipeline]').forEach(el => {
      createInstrumentPipeline(el);
    });

    // Scatter plot
    document.querySelectorAll('[data-scatter-plot]').forEach(el => {
      createScatterPlot(el);
    });

    // Loop diagram
    document.querySelectorAll('[data-loop-diagram]').forEach(el => {
      createLoopDiagram(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.AllSparkViz = { FieldViz, createSparkMini };
})();

/**
 * AllSpark Research — Main JS
 * TOC scroll spy, interactions, filter tabs
 */

(function() {
  'use strict';

  // ─── TOC Scroll Spy ──────────────────────────────────────────────
  function initTOC() {
    const tocItems = document.querySelectorAll('.toc-item');
    if (!tocItems.length) return;

    const headings = [];
    tocItems.forEach(item => {
      const link = item.querySelector('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (target) headings.push({ item, target });
    });

    if (!headings.length) return;

    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY + navH + 80;
        let active = headings[0];

        headings.forEach(h => {
          if (h.target.offsetTop <= scrollY) active = h;
        });

        tocItems.forEach(item => item.classList.remove('active'));
        if (active) active.item.classList.add('active');

        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─── Copy BibTeX ─────────────────────────────────────────────────
  function initCopyBibTeX() {
    document.querySelectorAll('.cite-link').forEach(link => {
      link.addEventListener('click', () => {
        const citeText = link.closest('.toc-sidebar')?.querySelector('.cite-text')?.textContent || '';
        const bibtex = `@article{allspark2026itw,\n  title={Intelligence in the Wild},\n  author={AllSpark Research},\n  year={2026},\n  journal={AllSpark Research Journal},\n  volume={1},\n  number={1},\n  note={AS-RJ-2026-001}\n}`;

        navigator.clipboard.writeText(bibtex).then(() => {
          const orig = link.textContent;
          link.textContent = 'Copied!';
          setTimeout(() => { link.textContent = orig; }, 2000);
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = bibtex;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          const orig = link.textContent;
          link.textContent = 'Copied!';
          setTimeout(() => { link.textContent = orig; }, 2000);
        });
      });
    });
  }

  // ─── Filter Tabs ─────────────────────────────────────────────────
  function initFilterTabs() {
    const tabs = document.querySelectorAll('.filter-tab');
    const rows = document.querySelectorAll('.note-row[data-field]');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.getAttribute('data-filter');
        rows.forEach(row => {
          if (filter === 'all' || row.getAttribute('data-field') === filter) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  }

  // ─── Nav highlight ───────────────────────────────────────────────
  function initNavHighlight() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  // ─── Smooth scroll for internal links ───────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        const navH = 60;
        const y = target.getBoundingClientRect().top + window.scrollY - navH - 24;
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });
  }

  // ─── Open Problem items expand ───────────────────────────────────
  function initOpenProblems() {
    document.querySelectorAll('.problem-item').forEach(item => {
      item.style.cursor = 'pointer';
    });
  }

  // ─── Theme Toggle ────────────────────────────────────────────────
  function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // Load saved preference
    const saved = localStorage.getItem('allspark-theme');
    if (saved !== 'dark') { // default: Light
      document.documentElement.classList.add('light');
      toggle.textContent = 'Dark';
    }

    toggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('light');
      const isLight = document.documentElement.classList.contains('light');
      toggle.textContent = isLight ? 'Dark' : 'Light';
      localStorage.setItem('allspark-theme', isLight ? 'light' : 'dark');
    });
  }

  // ─── Hero background: mode switch (Geometry ↔ Star Trails) + animation on/off ──
  var _heroState = { mode: 'geometry', animOn: true, starViz: null };

  function _applyHeroState() {
    var geoCanvas = document.getElementById('constellation-canvas');
    var starCanvas = document.getElementById('startrail-canvas');
    if (!geoCanvas || !starCanvas) return;

    var geometryMode = _heroState.mode === 'geometry';
    geoCanvas.style.display = geometryMode ? '' : 'none';
    starCanvas.style.display = geometryMode ? 'none' : 'block';

    // Geometry animation (existing UnitDistanceViz) — never modified, just paused/resumed
    if (window.AllSparkViz && window.AllSparkViz.setHeroAnimation) {
      window.AllSparkViz.setHeroAnimation(geometryMode && _heroState.animOn);
    }

    // Star trail visualization — lazy-create on first use
    if (!geometryMode) {
      if (!_heroState.starViz && window.StarTrailViz) {
        _heroState.starViz = new window.StarTrailViz(starCanvas);
      }
      if (_heroState.starViz) {
        _heroState.animOn ? _heroState.starViz.resume() : _heroState.starViz.pause();
      }
    } else if (_heroState.starViz) {
      _heroState.starViz.pause();
    }

    // When the background animation is OFF the right side is blank, so switch the
    // hero to a centered, single-column layout and hide the animation caption.
    var hero = document.querySelector('.hero');
    var caption = document.querySelector('.udg-caption');
    if (hero) hero.classList.toggle('hero-centered', !_heroState.animOn);
    if (caption) caption.style.display = _heroState.animOn ? '' : 'none';
  }

  function _updateCaption() {
    var title = document.getElementById('udg-title');
    var note = document.getElementById('udg-note');
    if (!title || !note) return;
    var isZh = document.documentElement.lang === 'zh';
    if (_heroState.mode === 'geometry') {
      title.textContent = 'Unit-Distance Graph';
      note.textContent = isZh
        ? "625 个顶点 · 2800 条单位边 — 一个证伪 Erdős 单位距离猜想的构型，由 AI 发现。"
        : "625 points · 2800 unit edges — a configuration disproving Erdős' unit-distance conjecture, found with AI.";
    } else {
      title.textContent = 'Star Trails';
      note.textContent = isZh
        ? "细密的星辰拖着轨迹，围绕中心的北极星缓缓旋转。"
        : "Dense stars trailing arcs, rotating slowly around a central Polaris.";
    }
  }

  function initHeroControls() {
    var animBtn = document.getElementById('anim-toggle');
    var modeBtn = document.getElementById('mode-toggle');
    var modeLabel = document.getElementById('mode-label');

    // ── Apply presets from URL params (used by brand story buttons) ──
    // e.g. index.html?logo=2&anim=geometry&theme=dark
    try {
      var params = new URLSearchParams(window.location.search);
      var pLogo = params.get('logo');
      var pAnim = params.get('anim');
      var pTheme = params.get('theme');
      if (pLogo && ['1','2','3'].indexOf(pLogo) !== -1) {
        localStorage.setItem('allspark-logo', pLogo);
        // logos.js may have already run; re-apply if its API is available
        if (window.AllSparkApplyLogo) window.AllSparkApplyLogo(pLogo);
      }
      if (pTheme === 'dark' || pTheme === 'light') {
        localStorage.setItem('allspark-theme', pTheme);
        document.documentElement.classList.toggle('light', pTheme === 'light');
        var tt = document.getElementById('theme-toggle');
        if (tt) tt.textContent = pTheme === 'light' ? 'Dark' : 'Light';
      }
      if (pAnim === 'startrail' || pAnim === 'geometry') {
        _heroState.mode = pAnim;
        if (modeLabel) modeLabel.textContent = pAnim === 'geometry' ? 'Geometry' : 'Star Trails';
      }
    } catch (e) { /* no-op */ }

    if (animBtn) {
      var animLabel = animBtn.querySelector('.anim-label');
      animBtn.addEventListener('click', function () {
        _heroState.animOn = !_heroState.animOn;
        animBtn.setAttribute('aria-pressed', _heroState.animOn ? 'true' : 'false');
        if (animLabel) animLabel.textContent = _heroState.animOn ? 'Animation On' : 'Animation Off';
        _applyHeroState();
      });
    }

    if (modeBtn) {
      modeBtn.addEventListener('click', function () {
        _heroState.mode = _heroState.mode === 'geometry' ? 'startrail' : 'geometry';
        if (modeLabel) modeLabel.textContent = _heroState.mode === 'geometry' ? 'Geometry' : 'Star Trails';
        _applyHeroState();
        _updateCaption();
      });
    }

    // Apply the (possibly URL-preset) hero mode on load
    _applyHeroState();
    _updateCaption();
  }

  // ─── Publications: sort by date desc + filter (All / Conference / Journal) ───
  function initPubFilter() {
    const tabs = document.querySelectorAll('.pub-tab');
    const body = document.querySelector('.pub-body');
    if (!tabs.length || !body) return;

    // sort rows by data-sort descending (newest first)
    const rows = Array.from(body.querySelectorAll('.pub-row'));
    rows.sort((a, b) => (b.getAttribute('data-sort') || '').localeCompare(a.getAttribute('data-sort') || ''));
    rows.forEach((r) => body.appendChild(r));

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.getAttribute('data-filter');
        rows.forEach((r) => {
          r.style.display = (filter === 'all' || r.getAttribute('data-type') === filter) ? '' : 'none';
        });
      });
    });
  }

  // ─── Init ────────────────────────────────────────────────────────
  function init() {
    initNavHighlight();
    initSmoothScroll();
    initTOC();
    initCopyBibTeX();
    initFilterTabs();
    initOpenProblems();
    initThemeToggle();
    initHeroControls();
    initPubFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

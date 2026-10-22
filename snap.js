/**
 * AllSpark Research — Homepage scroll-snap (Apple-style)
 * Enables full-screen section snapping, dot navigation, and scroll hint.
 * Gracefully disabled on small screens / reduced-motion (handled in CSS + guard here).
 */
(function () {
  'use strict';

  var container = document.getElementById('snap-container');
  if (!container) return;

  var mqSmall = window.matchMedia('(max-width: 768px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Only engage snap mode on larger screens without reduced-motion preference.
  function snapEnabled() {
    return !mqSmall.matches && !mqReduce.matches;
  }

  var sections = Array.prototype.slice.call(container.querySelectorAll('.snap-section'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.snap-dot'));
  var hint = document.querySelector('.snap-scroll-hint');

  function setActive(idx) {
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === idx);
    }
    // Hide the scroll hint once we leave the first screen
    if (hint) hint.style.opacity = idx === 0 ? '' : '0';
  }

  function enable() {
    document.body.classList.add('snap-mode');

    // Track which section is centered using IntersectionObserver on the container.
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          var idx = sections.indexOf(entry.target);
          if (idx !== -1) setActive(idx);
        }
      });
    }, { root: container, threshold: [0.55] });

    sections.forEach(function (s) { observer.observe(s); });

    // Dot click -> scroll to section
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var idx = parseInt(dot.getAttribute('data-index'), 10) || 0;
        if (sections[idx]) {
          sections[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Keyboard support: arrow up/down / page up/down move between sections
    var current = 0;
    container.addEventListener('scroll', function () {
      // derive current index from scroll position
      var pos = container.scrollTop + container.clientHeight * 0.5;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= pos) current = i;
      }
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!snapEnabled()) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (current < sections.length - 1) {
          e.preventDefault();
          sections[current + 1].scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (current > 0) {
          e.preventDefault();
          sections[current - 1].scrollIntoView({ behavior: 'smooth' });
        }
      }
    });

    setActive(0);
  }

  function disable() {
    document.body.classList.remove('snap-mode');
  }

  function sync() {
    if (snapEnabled()) enable();
    else disable();
  }

  // Initial
  if (snapEnabled()) {
    enable();
  }

  // Re-evaluate on resize (e.g., rotating a tablet). We only add snap-mode once;
  // toggling class is enough for CSS to switch behavior.
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (snapEnabled()) document.body.classList.add('snap-mode');
      else document.body.classList.remove('snap-mode');
    }, 150);
  });
})();

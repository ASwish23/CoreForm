/* ============================================================
   CoreForm Prints — Focus Carousel Logic
   3-slot peek carousel: [Left] [Center] [Right] with loop.
   Each .carousel-stage is independent.
   ============================================================ */

(function () {
  'use strict';

  /**
   * A single 3-slot focus carousel instance.
   * Slots: card-left · card-center · card-right
   * All other cards have no slot class (opacity: 0, off-stage).
   * Navigation loops: last → first, first → last.
   *
   * @param {HTMLElement} stage  — .carousel-stage element
   */
  function Carousel(stage) {
    const id      = stage.dataset.carousel;
    const track   = stage.querySelector('.carousel-track');
    const cards   = Array.from(track.querySelectorAll('.carousel-card'));
    const btnPrev = stage.querySelector('.carousel-btn--prev');
    const btnNext = stage.querySelector('.carousel-btn--next');
    const dotsWrap = document.querySelector('[data-dots="' + id + '"]');

    const total = cards.length;
    let   center = 0; // index of the center card
    let   dots   = [];
    const SLOT_CLASSES = ['card-left', 'card-center', 'card-right'];

    /* ── Modulo helper that handles negatives ──────────── */
    function mod(n, m) {
      return ((n % m) + m) % m;
    }

    /* ── Build dot indicators ──────────────────────────── */
    function buildDots() {
      dotsWrap.innerHTML = '';
      dots = cards.map(function (_, i) {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', 'Mergi la cardul ' + (i + 1));
        dot.addEventListener('click', function () { goTo(i); });
        dotsWrap.appendChild(dot);
        return dot;
      });
    }

    /* ── Apply slot classes ────────────────────────────── */
    function update() {
      const leftIdx  = mod(center - 1, total);
      const rightIdx = mod(center + 1, total);

      cards.forEach(function (card, i) {
        // Remove all slot classes first
        SLOT_CLASSES.forEach(function (cls) { card.classList.remove(cls); });

        if (i === center)    { card.classList.add('card-center'); }
        else if (i === leftIdx)  { card.classList.add('card-left');   }
        else if (i === rightIdx) { card.classList.add('card-right');  }
        // All other cards: no slot class → opacity 0, off-stage (via CSS)
      });

      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === center);
      });

      // No disabled state — we loop, so buttons always work.
      // Hide prev/next visually when only 1 card exists.
      const alone = total === 1;
      btnPrev.disabled = alone;
      btnNext.disabled = alone;
    }

    /* ── Navigation (with loop) ────────────────────────── */
    function goTo(index) {
      center = mod(index, total);
      update();
    }

    function prev() { goTo(center - 1); }
    function next() { goTo(center + 1); }

    /* ── Button listeners ──────────────────────────────── */
    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);

    /* ── Click on a peek card to bring it to center ────── */
    cards.forEach(function (card, i) {
      card.addEventListener('click', function () {
        if (i !== center) goTo(i);
      });
    });

    /* ── Keyboard support (scoped to focused stage) ────── */
    stage.setAttribute('tabindex', '0');
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { prev(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
    });

    /* ── Touch / swipe support ─────────────────────────── */
    let touchStartX = null;

    stage.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    stage.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      const delta = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(delta) > 40) {
        delta > 0 ? next() : prev();
      }
      touchStartX = null;
    }, { passive: true });

    /* ── Init ──────────────────────────────────────────── */
    buildDots();
    update();
  }

  /* ── Initialise all carousels on the page ──────────────── */
  function initCarousels() {
    document.querySelectorAll('.carousel-stage').forEach(function (stage) {
      new Carousel(stage);
    });
  }

  // Expose globally so dynamic-render pages (e.g. produse.html) can call
  // initCarousels() after appending cards from an async data source.
  window.initCarousels = initCarousels;

  document.addEventListener('DOMContentLoaded', initCarousels);

  /* ── Scroll-triggered section animations ──────────────────
     Uses a readyState guard: if DOMContentLoaded already fired
     (possible when the script loads late / after the inline
     scripts), we run immediately instead of waiting forever.   */
  function initScrollAnimations() {
    var elements = document.querySelectorAll('.scroll-animate');
    console.log('Intersection Observer inițializat. Elemente găsite: ' + elements.length);

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // Run immediately if DOM is ready, otherwise wait for the event.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
  } else {
    initScrollAnimations();
  }

}());

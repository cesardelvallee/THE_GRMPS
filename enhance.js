/* ============================================================
   THE GRAMPS — ENHANCEMENT INTERACTIONS  (v4)
   Pure progressive enhancement. Every feature is guarded:
   if a dependency or element is missing it silently no-ops.
   Never interferes with the hero pin or click targets.
   ============================================================ */
(function () {
  'use strict';

  // Confirm JS is live so reveal styles can safely hide content.
  document.documentElement.classList.add('enh');

  const RM    = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hasGsap = typeof window.gsap !== 'undefined';
  const ST = window.ScrollTrigger;
  if (hasGsap && ST) gsap.registerPlugin(ST);

  /* Native scrolling only — no scroll hijacking. Anchor links use the
     CSS `scroll-behavior: smooth` already defined in styles.css. */

  /* ---------- Scroll progress bar ---------- */
  const bar = $('#scroll-progress');
  if (bar) {
    let ticking = false;
    const paint = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      ticking = false;
    };
    addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(paint); ticking = true; }
    }, { passive: true });
    paint();
  }

  /* ---------- 3. Nav glass on scroll ---------- */
  const nav = $('#nav');
  if (nav) {
    const toggle = () => nav.classList.toggle('scrolled', scrollY > 40);
    addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ---------- 4. Subtle magnetic pull (capped, only safe targets) ---------- */
  if (!TOUCH && hasGsap) {
    const CAP = 8;                       // px — gentle, never clips or looks extreme
    const clamp = v => Math.max(-CAP, Math.min(CAP, v));
    $$('.pd-cta, .nav-burger').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: clamp((e.clientX - r.left - r.width / 2) * .3),
          y: clamp((e.clientY - r.top - r.height / 2) * .3),
          duration: .4, ease: 'power3.out'
        });
      });
      el.addEventListener('mouseleave', () =>
        gsap.to(el, { x: 0, y: 0, duration: .55, ease: 'elastic.out(1,.4)' }));
    });
  }

  /* ---------- 5. FAQ accordion (accessible) ---------- */
  $$('.faq-item').forEach(item => {
    const q = $('.faq-q', item);
    const a = $('.faq-a', item);
    if (!q || !a) return;
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0px';
    });
  });
  // keep open answers sized correctly on resize
  addEventListener('resize', () => {
    $$('.faq-item.open .faq-a').forEach(a => { a.style.maxHeight = a.scrollHeight + 'px'; });
  }, { passive: true });

  /* ---------- 6. Reveal-on-scroll + stat underline ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add(en.target.classList.contains('stat') ? 'in-view' : 'in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.2 });
    $$('.reveal, .stat').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------- 7. Interactive 3D showcase ---------- */
  const showMV = $('#showcase-mv');
  if (showMV) {
    // Reuse the exact model the hero already loads (model-viewer caches by src,
    // so this does not download or parse the GLB a second time).
    const hero = $('#hero-mv');
    const applySrc = () => {
      const src = hero && hero.getAttribute('src');
      if (src) { showMV.setAttribute('src', src); return true; }
      return false;
    };
    if (!applySrc()) {
      let tries = 0;
      const id = setInterval(() => { if (applySrc() || ++tries > 80) clearInterval(id); }, 100);
    }
    // Fade the "drag to rotate" hint after the first interaction.
    const hint = $('#showcase-hint');
    if (hint) {
      const hide = () => hint.classList.add('hide');
      showMV.addEventListener('pointerdown', hide, { once: true });
      showMV.addEventListener('camera-change', e => {
        if (e.detail && e.detail.source === 'user-interaction') hide();
      });
    }
  }

  /* ---------- 8. Scrollspy — highlight the active nav link ---------- */
  const navMap = {};
  $$('.nav-links a[href^="#"]').forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (id) navMap[id] = a;
  });
  const spyTargets = Object.keys(navMap)
    .map(id => document.getElementById(id)).filter(Boolean);
  if (spyTargets.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        Object.values(navMap).forEach(a => a.classList.remove('active'));
        navMap[en.target.id]?.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    spyTargets.forEach(t => spy.observe(t));
  }

  /* ---------- 9. Back-to-top button ---------- */
  const toTop = document.createElement('button');
  toTop.id = 'to-top';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(toTop);
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  const toggleTop = () => toTop.classList.toggle('show', scrollY > innerHeight * 0.9);
  addEventListener('scroll', toggleTop, { passive: true });
  toggleTop();

  /* ---------- 10. Contextual cursor label ---------- */
  if (!TOUCH) {
    const cl = document.createElement('div');
    cl.id = 'cursor-label';
    document.body.appendChild(cl);
    addEventListener('mousemove', e => {
      cl.style.left = e.clientX + 'px';
      cl.style.top  = (e.clientY + 30) + 'px';
    }, { passive: true });
    $$('[data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cl.textContent = el.dataset.cursor; cl.classList.add('show');
      });
      el.addEventListener('mouseleave', () => cl.classList.remove('show'));
    });
  }

  /* ---------- 11. Auto-update footer year ---------- */
  $$('.ft-copy').forEach(el => {
    el.textContent = el.textContent.replace(/\d{4}/, new Date().getFullYear());
  });

  /* ---------- 12. Keep ScrollTrigger accurate after full load ---------- */
  if (hasGsap && ST) addEventListener('load', () => ST.refresh());
})();

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

  /* ---------- 0. Lenis smooth scroll (premium inertia) ----------
     Drives ScrollTrigger so pinned sections stay perfectly in sync.
     Silently skipped when the lib is missing or motion is reduced. */
  let lenis = null;
  if (!RM && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, lerp: .1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.6 });
    window.__lenis = lenis;
    if (hasGsap && ST) {
      lenis.on('scroll', ST.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* Smoothly route in-page anchor links through Lenis (falls back to native).
     Negative offset leaves room for the fixed nav. */
  const scrollToEl = (target, offset = -90) => {
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.2 });
    else target.scrollIntoView({ behavior: 'smooth' });
  };
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollToEl(target);
    });
  });

  /* ---------- Branded page transition (cover-wipe between pages) ----------
     The reveal on load is pure CSS (.pt-cover) so it can never get stuck;
     here we only own the cover-out when navigating to another page. */
  let ptEl = $('#page-transition');
  if (!ptEl) {
    ptEl = document.createElement('div');
    ptEl.id = 'page-transition';
    ptEl.innerHTML = '<img class="pt-logo" src="IMG/GRMPS_LOGO.svg" alt="" />';
    document.body.appendChild(ptEl);          // parked off-screen by CSS (home)
  }

  function pageOut(href) {
    if (!href) return;
    if (RM || !hasGsap) { location.href = href; return; }
    ptEl.classList.remove('pt-cover');
    ptEl.style.animation = 'none';
    let done = false;
    const go = () => { if (!done) { done = true; location.href = href; } };
    setTimeout(go, 1000);                      // guaranteed navigation
    gsap.timeline()
      .set(ptEl, { yPercent: -100, display: 'flex' })
      .set('#page-transition .pt-logo', { opacity: 0, scale: .9 })
      .to(ptEl, { yPercent: 0, duration: .55, ease: 'power3.inOut' }, 0)
      .to('#page-transition .pt-logo', { opacity: 1, scale: 1, duration: .35, ease: 'power2.out' }, .15)
      .call(go, null, .6);
  }

  const isPageLink = href =>
    !!href && href[0] !== '#' && !/^(https?:|mailto:|tel:)/.test(href) && /\.html(\?|#|$)/.test(href);

  $$('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!isPageLink(href) || a.target === '_blank') return;
    a.addEventListener('click', e => { e.preventDefault(); pageOut(href); });
  });
  $$('[data-nav]').forEach(el => {
    el.addEventListener('click', () => pageOut(el.getAttribute('data-nav')));
  });

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

  /* ---------- 3. Nav: subtle scrolled state + hide-on-scroll-down ---------- */
  const nav = $('#nav');
  if (nav) {
    let lastY = scrollY, navTick = false;
    const update = () => {
      const y = scrollY;
      nav.classList.toggle('scrolled', y > 40);
      if (y > 150 && y > lastY + 5) nav.classList.add('nav-hidden');        // going down
      else if (y < lastY - 5 || y < 150) nav.classList.remove('nav-hidden'); // going up / near top
      lastY = y; navTick = false;
    };
    addEventListener('scroll', () => { if (!navTick) { requestAnimationFrame(update); navTick = true; } }, { passive: true });
    update();
  }

  /* ---------- 4. Subtle magnetic pull (capped, only safe targets) ---------- */
  if (!TOUCH && hasGsap) {
    const CAP = 8;                       // px — gentle, never clips or looks extreme
    const clamp = v => Math.max(-CAP, Math.min(CAP, v));
    $$('.pd-cta, .nav-burger, .mf-cta, .wl-form button').forEach(el => {
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

  /* ---------- 6b. Heading line reveal (clip-mask rise) ----------
     Splits a heading into its <br> lines, wraps each in a clip box,
     and lifts them in on scroll. Falls back to plain text if no GSAP. */
  const lineEls = $$('.r-lines');
  lineEls.forEach(el => {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts
      .map(p => `<span class="r-line"><span class="r-line-i">${p.trim()}</span></span>`)
      .join('');
    el.classList.add('r-ready');
  });
  if (lineEls.length && hasGsap && ST && !RM) {
    lineEls.forEach(el => {
      gsap.from($$('.r-line-i', el), {
        yPercent: 118, duration: 1.05, ease: 'power4.out', stagger: .11,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  } else {
    $$('.r-line-i').forEach(i => { i.style.transform = 'none'; });
  }

  /* ---------- 6c. Velocity-reactive marquees ----------
     Replace the CSS loop with a JS one that speeds up with scroll velocity.
     Only the on-screen tracks are advanced, so it stays cheap. */
  const mTracks = $$('.mf-track, .pd-marquee-track');
  if (mTracks.length && !RM && hasGsap) {
    const items = mTracks.map(track => {
      track.style.animation = 'none';
      return { track, x: 0, w: 0, vis: true };
    });
    if ('IntersectionObserver' in window) {
      const mio = new IntersectionObserver(es => es.forEach(e => {
        const it = items.find(i => i.track === e.target); if (it) it.vis = e.isIntersecting;
      }), { rootMargin: '120px' });
      items.forEach(i => { i.vis = false; mio.observe(i.track); });
    }
    const resetW = () => items.forEach(i => { i.w = 0; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resetW);
    addEventListener('resize', resetW, { passive: true });
    let vel = 0;
    if (lenis) lenis.on('scroll', e => { vel = e.velocity || 0; });
    gsap.ticker.add(() => {
      const boost = Math.min(9, Math.abs(vel) * 0.18);
      for (const it of items) {
        if (!it.vis) continue;
        if (!it.w) it.w = (it.track.scrollWidth / 2) || 1;   // content is duplicated
        it.x -= (0.6 + boost);
        if (it.x <= -it.w) it.x += it.w;
        it.track.style.transform = `translateX(${it.x}px)`;
      }
    });
  }

  /* ---------- 6d. Clip-path heading reveal + scroll parallax ---------- */
  if (hasGsap && ST && !RM) {
    /* Gradient-safe heading reveal: a rack-focus (blur→sharp) + clip wipe + rise.
       (Doesn't split text, so background-clip:text headings stay intact.) */
    $$('.r-clip').forEach(el => {
      gsap.fromTo(el,
        { clipPath: 'inset(0 0 100% 0)', y: 52, filter: 'blur(18px)' },
        { clipPath: 'inset(0 0 0% 0)', y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });
    /* Depth parallax for decorative elements via data-speed (% of own height). */
    $$('[data-speed]').forEach(el => {
      const sp = parseFloat(el.dataset.speed) || 0;
      gsap.fromTo(el, { yPercent: -sp }, {
        yPercent: sp, ease: 'none',
        scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  } else {
    $$('.r-clip').forEach(el => { el.style.clipPath = 'none'; el.style.filter = 'none'; });
  }

  /* ---------- 6e. Scroll-scrubbed word illumination ----------
     Big statements light up word-by-word as they scroll through view.
     Splits text nodes into words, keeps <br> breaks and inline <em> whole. */
  const wordEls = $$('.r-words');
  wordEls.forEach(el => {
    const frag = document.createDocumentFragment();
    [...el.childNodes].forEach(node => {
      if (node.nodeType === 3) {                          // text → split into words
        node.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span');
          s.className = 'rw'; s.textContent = tok;
          frag.appendChild(s);
        });
      } else if (node.nodeName === 'BR') {
        frag.appendChild(document.createElement('br'));
      } else {                                            // inline element (em) → one unit
        const clone = node.cloneNode(true);
        if (clone.classList) clone.classList.add('rw');
        frag.appendChild(clone);
      }
    });
    el.innerHTML = '';
    el.appendChild(frag);
    el.classList.add('r-ready');
  });
  if (wordEls.length && hasGsap && ST && !RM) {
    wordEls.forEach(el => {
      const words = $$('.rw', el);
      gsap.set(words, { opacity: .12 });
      gsap.to(words, {
        opacity: 1, ease: 'none', stagger: .5,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 60%', scrub: true }
      });
    });
  }

  /* ---------- 6f. Collection card image parallax (drift inside the frame) ---------- */
  if (hasGsap && ST && !RM) {
    $$('.cc-img').forEach(img => {
      gsap.fromTo(img, { yPercent: -6, scale: 1.16 }, {
        yPercent: 6, scale: 1.16, ease: 'none',
        scrollTrigger: { trigger: img.closest('.card') || img, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------- 7. Interactive 3D showcase ----------
     The GLB src is assigned by script.js; here we only manage the hint. */
  const showMV = $('#showcase-mv');
  if (showMV) {
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

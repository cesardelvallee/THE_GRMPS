import * as THREE from 'three';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }     from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* The model is loaded as a real .glb file (not the 4.6MB base64 in assets.js)
   so the browser can stream/cache it and we skip a huge JS parse. */
const MODEL_URL = './ASSETS/GRMP_optimized.glb';

gsap.registerPlugin(ScrollTrigger);

const RM    = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;
/* Quality budget — scale heavy effects down on weaker / mobile devices. */
const LOW   = RM || TOUCH ||
              (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
              (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const DPR   = Math.min(devicePixelRatio || 1, LOW ? 1.25 : 1.5);

/* ============================================================
   CUSTOM CURSOR
   ============================================================ */
const curEl  = document.getElementById('cursor');
const curRng = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  gsap.set(curEl, { x: mx, y: my });
});
(function tick() {
  rx += (mx - rx) * .11;
  ry += (my - ry) * .11;
  gsap.set(curRng, { x: rx, y: ry });
  requestAnimationFrame(tick);
})();

document.querySelectorAll('a,button,.card').forEach(el => {
  el.addEventListener('mouseenter', () => { curEl.classList.add('on'); curRng.classList.add('on'); });
  el.addEventListener('mouseleave', () => { curEl.classList.remove('on'); curRng.classList.remove('on'); });
});

/* Normalised pointer (-1..1) used for parallax across 3D scenes. */
const pointer = { x: 0, y: 0, lx: 0, ly: 0 };
window.addEventListener('mousemove', e => {
  pointer.x = (e.clientX / innerWidth)  * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

/* ============================================================
   PRELOADER
   ============================================================ */
function runPreloader() {
  const pre     = document.getElementById('preloader');
  const counter = document.getElementById('pre-counter');
  const fill    = document.getElementById('pre-bar-fill');

  if (RM) {                                  // reduced motion: no show
    if (pre) pre.style.display = 'none';
    gsap.delayedCall(0.01, revealHero);      // defer so heroCtx is set first
    return;
  }

  const tl = gsap.timeline({ onComplete: finishPreloader });
  /* the wordmark prints in left→right, then the meta + bar settle under it */
  tl.to('#pre-logo', { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power3.out' }, .15);
  tl.from('.pl-meta', { opacity: 0, y: 18, duration: .6, ease: 'power2.out' }, .35);
  tl.from('.pre-bar', { opacity: 0, scaleX: .5, transformOrigin: '50% 50%', duration: .55, ease: 'power2.out' }, .4);
  /* the count-up drives both the number and the loading bar */
  const obj = { v: 0 };
  tl.to(obj, {
    v: 100, duration: 1.9, ease: 'power1.inOut',
    onUpdate() {
      const v = Math.floor(obj.v);
      counter.textContent = String(v).padStart(3, '0');
      fill.style.width = v + '%';
    }
  }, .55);
  tl.to({}, { duration: .2 });               // small beat at 100
}

/* The curtain: content lifts away, a seam of light draws across, then the
   two panels part — top up, bottom down — uncovering the hero behind. */
function finishPreloader() {
  const pre = document.getElementById('preloader');
  if (RM) { if (pre) pre.style.display = 'none'; revealHero(); return; }

  const tl = gsap.timeline({ onComplete() { if (pre) pre.style.display = 'none'; } });
  tl.to('#pre-logo', { y: -36, scale: .92, opacity: 0, duration: .55, ease: 'power2.in' }, 0);
  tl.to(['.pl-meta', '.pre-bar'], { opacity: 0, y: -16, duration: .45, ease: 'power2.in' }, 0);
  tl.fromTo('.pl-seam', { scaleX: 0, opacity: 0 },
    { scaleX: 1, opacity: 1, duration: .55, ease: 'power3.inOut' }, .2);
  tl.to('.pl-seam', { opacity: 0, duration: .5, ease: 'power2.out' }, .85);
  tl.to('.pl-top',    { yPercent: -100, duration: 1.05, ease: 'expo.inOut' }, .6);
  tl.to('.pl-bottom', { yPercent:  100, duration: 1.05, ease: 'expo.inOut' }, .6);
  tl.add(revealHero, .78);                    // hero materialises as the curtains open
}
runPreloader();

/* ============================================================
   SHARED 3D HELPERS
   ============================================================ */
function makeRenderer(canvas, opts = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: !LOW, alpha: true, powerPreference: 'high-performance', ...opts });
  r.setPixelRatio(DPR);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping      = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  return r;
}

/* Image-based lighting — generated once per renderer for crisp PBR reflections. */
const _envCache = new WeakMap();
function getEnv(renderer) {
  if (_envCache.has(renderer)) return _envCache.get(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  _envCache.set(renderer, env);
  return env;
}

function applyEnv(model, intensity = 1) {
  model.traverse(n => {
    if (!n.isMesh) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    mats.forEach(m => {
      if (m.color !== undefined) {
        if (m.attributes && m.attributes.color) m.vertexColors = true;
        if ('envMapIntensity' in m) m.envMapIntensity = intensity;
      }
      if (n.geometry && n.geometry.attributes && n.geometry.attributes.color) m.vertexColors = true;
      m.needsUpdate = true;
    });
    n.castShadow = n.receiveShadow = false;
  });
}

/* Lets a render loop idle while its section is off-screen (saves GPU). */
function visibilityFlag(el) {
  const f = { on: true };
  if ('IntersectionObserver' in window && el) {
    new IntersectionObserver(es => { f.on = es[0].isIntersecting; }, { rootMargin: '150px' }).observe(el);
  }
  return f;
}

function scaleToFit(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const c   = box.getCenter(new THREE.Vector3());
  const s   = box.getSize(new THREE.Vector3());
  const sc  = targetSize / Math.max(s.x, s.y, s.z);
  model.scale.setScalar(sc);
  model.position.set(-c.x * sc, -c.y * sc, -c.z * sc);
  return { sc, height: s.y * sc };
}

/* Soft radial sprite — reused for contact shadows and coloured glows. */
function radialTexture(inner, outer, stops) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, inner, 128, 128, outer);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================
   HERO — clean studio scene (direct render, MSAA, flat backdrop)
   ============================================================ */
function setupHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return null;

  const renderer = makeRenderer(canvas);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMappingExposure = .82;

  /* Transparent canvas — the flat backdrop lives in CSS, so DOM text can sit
     both behind (big word) and in front (side labels) of the figure. */
  const scene = new THREE.Scene();
  scene.environment = getEnv(renderer);

  const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, .1, 100);
  cam.position.set(0, .15, 3.2);
  cam.lookAt(0, .55, 0);

  /* Clean studio rig — soft and even, just enough rim to give it form. */
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x10141c, .42));

  const key = new THREE.DirectionalLight(0xfff4e6, 1.2);
  key.position.set(3, 5, 4); scene.add(key);

  const rimTeal = new THREE.DirectionalLight(0x2aa4cf, 1.05);
  rimTeal.position.set(-5, 1.6, -3.5); scene.add(rimTeal);

  const rimGold = new THREE.DirectionalLight(0xffcf8c, .55);
  rimGold.position.set(4.5, .4, -3); scene.add(rimGold);

  const fill = new THREE.DirectionalLight(0xcfe0ff, .28);
  fill.position.set(-1, -1, 4); scene.add(fill);

  /* Group holds the model so intro / scroll / parallax transform it cleanly. */
  const group = new THREE.Group();
  scene.add(group);

  /* Subtle contact shadow under the feet for grounding. */
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2),
    new THREE.MeshBasicMaterial({
      map: radialTexture(0, 120, [[0, 'rgba(0,0,0,.5)'], [.55, 'rgba(0,0,0,.16)'], [1, 'rgba(0,0,0,0)']]),
      transparent: true, depthWrite: false, opacity: 0
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const state = { scrollP: 0, ready: false, introY: 0, introScale: 1, introActive: false };
  let modelBottom = -1.3;
  let lastP = null;                       // dirty-flag: only redraw on change
  const vis = visibilityFlag(document.getElementById('hero'));

  function render() {
    if (!vis.on) return;
    const p = state.scrollP;
    /* Skip the draw entirely when nothing moved (idle) — keeps the main
       thread free so the cursor and the rest of the page stay snappy. */
    if (p === lastP && !state.introActive) return;
    lastP = p;

    /* Still when idle — starts slightly turned, only rotates while scrolling. */
    group.rotation.y = -.4 + p * Math.PI * 2.5;
    group.position.y = state.introY;
    group.scale.setScalar(state.introScale);

    /* Scroll zoom-out: starts framed waist-up & large, settles to the full
       figure by ~60% of the scroll (camera dolly only — no sideways motion). */
    const zp = Math.min(1, p / .6);
    const ze = zp * zp * (3 - 2 * zp);
    cam.position.set(0, .15, 3.2 + ze * 2.4);
    cam.lookAt(0, .55 + ze * -.6, 0);

    shadow.position.y = modelBottom - .02;
    renderer.render(scene, cam);
  }
  /* One shared ticker (GSAP) drives scroll + figure on the same frame. */
  gsap.ticker.add(render);

  addEventListener('resize', () => {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    lastP = null;                          // force one redraw after resize
  }, { passive: true });

  return {
    addModel(gltf) {
      const model = gltf.scene.clone(true);
      applyEnv(model, .55);
      const { height } = scaleToFit(model, 2.55);
      modelBottom = -height / 2;
      group.add(model);
      state.ready = true;
      lastP = null;                        // make sure the new model paints
      maybeHeroIntro();
    },
    state, shadow
  };
}

let heroCtx = null;
let heroTextDone = false;
let heroIntroPlayed = false;

/* Text + UI reveal — fires the instant the preloader lifts. */
function revealHero() {
  const tl = gsap.timeline();

  tl.to(['#nav-logo', '#nav-links'], { opacity: 1, duration: .7, ease: 'power2.out', stagger: .08 }, 0);
  tl.fromTo('#hero-bgword', { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, .1);
  tl.fromTo('.hero-lead', { opacity: 0 },
    { opacity: 1, duration: .8, ease: 'power2.out', stagger: .07 }, .4);

  heroTextDone = true;
  maybeHeroIntro();
  setupHeroScroll();
}

/* Figure rise + camera settle — waits for preloader AND model. */
function maybeHeroIntro() {
  if (heroIntroPlayed || !heroCtx || !heroCtx.state.ready || !heroTextDone) return;
  heroIntroPlayed = true;
  const st = heroCtx.state;

  if (RM) {
    st.introY = 0; st.introScale = 1;
    heroCtx.shadow.material.opacity = .85;
    return;
  }
  st.introActive = true;                   // keep drawing through the intro
  gsap.fromTo(st, { introY: -1.1, introScale: .82 },
    { introY: 0, introScale: 1, duration: 1.8, ease: 'power3.out',
      onComplete: () => { st.introActive = false; } });
  gsap.fromTo(heroCtx.shadow.material, { opacity: 0 },
    { opacity: .85, duration: 1.4, ease: 'power2.out', delay: .3 });
}

/* Pin the hero; as you scroll the figure keeps turning while the story
   text beats fly in over it, alternating from the left and the right. */
function setupHeroScroll() {
  if (!heroCtx) return;
  const canvas  = document.getElementById('hero-canvas');
  const beatEls = ['beat0', 'beat1', 'beat2', 'beat3'].map(id => document.getElementById(id));
  const sides   = [-1, 1, -1, 1];     // left, right, left, right
  beatEls.forEach(el => el && gsap.set(el, { yPercent: -50, opacity: 0 }));

  /* Reduced motion: skip the pin, reveal the beats as plain stacked text. */
  if (RM) {
    beatEls.forEach(el => el && gsap.set(el, { opacity: 1, x: 0, clearProps: 'transform' }));
    return;
  }

  const START = .14, END = .96;
  const slot  = (END - START) / beatEls.length;

  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: '+=620%',          // longer pin → each text dwells on screen longer
    pin: true,
    scrub: 1.5,
    onUpdate(self) {
      const p = self.progress;
      heroCtx.state.scrollP = p;

      /* opening labels + flat wordmark clear out as soon as you scroll
         (skipped at p==0 so they don't fight the intro reveal) */
      if (p > 0) {
        gsap.set('.hero-lead', { opacity: Math.max(0, 1 - p / .1) });
        gsap.set('#hero-bgword', { opacity: Math.max(0, 1 - p * 3) });
      }
      /* figure zooms out (render loop) and only starts fading late, reaching 0 near the end */
      gsap.set(canvas, { opacity: 1 - Math.max(0, (p - .5) / .45) });

      /* each beat fades + slides in from its side; a hold plateau keeps each
         block readable a bit longer, cross-fading with the next */
      beatEls.forEach((el, i) => {
        if (!el) return;
        const c = START + (i + .5) * slot;
        const half = slot * .9;
        const HOLD = .55;
        const d = Math.abs((p - c) / half);
        const vis = Math.min(1, Math.max(0, (1 - d) / (1 - HOLD)));
        const eased = vis * vis * (3 - 2 * vis);
        gsap.set(el, { opacity: eased, x: sides[i] * (1 - eased) * 90 });
      });
    }
  });

  ScrollTrigger.refresh();
  setTimeout(() => ScrollTrigger.refresh(), 400);
}

/* ============================================================
   COLLECTION CARDS — 3D tilt on hover
   ============================================================ */
function initCardTilt() {
  if (TOUCH) return;
  document.querySelectorAll('.card').forEach(card => {
    const scene = card.querySelector('.card-scene');
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - .5;
      const py = (e.clientY - rect.top) / rect.height - .5;
      gsap.to(card, {
        rotateY: px * 9, rotateX: -py * 9, y: -10,
        duration: .5, ease: 'power2.out', transformPerspective: 900, overwrite: 'auto'
      });
      if (scene) gsap.to(scene, { x: px * 10, y: py * 10, duration: .5, ease: 'power2.out', overwrite: 'auto' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateY: 0, rotateX: 0, y: 0, duration: .7, ease: 'elastic.out(1,.5)' });
      if (scene) gsap.to(scene, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.5)' });
    });
  });
}

/* ============================================================
   MODEL LOAD → fan out to every scene
   ============================================================ */
heroCtx = setupHero();
initCardTilt();

/* Lazy-load the interactive showcase (model-viewer) only as it nears the
   viewport — avoids creating a second WebGL context + decoding the GLB on
   the initial page load. */
const showMV = document.getElementById('showcase-mv');
if (showMV) {
  const io = new IntersectionObserver((entries, obs) => {
    if (entries[0].isIntersecting) {
      showMV.setAttribute('src', MODEL_URL);
      obs.disconnect();
    }
  }, { rootMargin: '400px' });
  io.observe(showMV);
}

/* The GLB is Draco-compressed, so the loader needs a decoder. */
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.155.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

gltfLoader.load(MODEL_URL, gltf => {
  heroCtx && heroCtx.addModel(gltf);
}, undefined, e => console.warn('GLB load error', e));

/* ============================================================
   SCROLL REVEALS
   ============================================================ */
gsap.from('.section-tag',   { opacity:0, y:14, duration:.6, scrollTrigger:{ trigger:'#collection', start:'top 75%', once:true } });
/* .section-title is revealed by the clip-reveal (.r-clip) in enhance.js */

ScrollTrigger.create({
  trigger: '#col-grid', start: 'top 80%', once: true,
  onEnter() {
    gsap.fromTo('.card',
      { opacity: 0, y: 90, scale: .9, rotateX: 16 },
      { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 1.15, ease: 'power4.out',
        stagger: .14, transformPerspective: 1000, transformOrigin: '50% 100%', clearProps: 'rotateX,scale' });
  }
});

ScrollTrigger.create({
  trigger: '#stats', start: 'top 72%', once: true,
  onEnter() {
    animateStat(document.getElementById('s0'), 100,  '100');
    animateStat(document.getElementById('s1'), 1,    '001');
    animateStat(document.getElementById('s2'), 2026, '2026', 2020);
    gsap.from('#s3', { opacity:0, scale:.6, duration:1, ease:'elastic.out(1,.55)' });
  }
});

function animateStat(el, target, display, from = 0) {
  const o = { v: from };
  gsap.to(o, {
    v: target, duration: 1.8, ease: 'power2.out',
    onUpdate() {
      const v = Math.round(o.v);
      el.textContent = display.length === 3 && display.startsWith('0')
        ? String(v).padStart(3, '0')
        : String(v);
    }
  });
}

/* .contact-title is revealed by the clip-reveal (.r-clip) in enhance.js */
gsap.from('.contact-sub',   { opacity:0, y:22, duration:.8, delay:.15, scrollTrigger:{ trigger:'#contact', start:'top 68%', once:true } });
gsap.from('.wl-form',       { opacity:0, y:20, duration:.7, delay:.3,  scrollTrigger:{ trigger:'#contact', start:'top 65%', once:true } });

/* ============================================================
   FORM + NAV
   ============================================================ */
document.getElementById('wl-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = e.target.querySelector('input[type="email"]');
  if (!input.checkValidity()) {
    gsap.to(input, { x: -8, duration: .08, ease:'bounce', repeat:5, yoyo:true });
    return;
  }
  gsap.to('.wl-form', { opacity:0, y:-12, duration:.3, onComplete() {
    document.querySelector('.wl-form').style.display = 'none';
    const ok = document.getElementById('form-ok');
    ok.style.display = 'block';
    gsap.from(ok, { opacity:0, y:10, duration:.5 });
  }});
});

document.querySelectorAll('[data-wl]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById('contact');
    if (window.__lenis) window.__lenis.scrollTo(target, { duration: 1.2 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

const burger     = document.getElementById('nav-burger');
const navMobile  = document.getElementById('nav-mobile');

function openMenu() {
  burger.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
  navMobile.classList.add('open');
  navMobile.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  burger.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  navMobile.classList.remove('open');
  navMobile.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

burger.addEventListener('click', () => {
  navMobile.classList.contains('open') ? closeMenu() : openMenu();
});

document.getElementById('nav-mobile-close').addEventListener('click', closeMenu);

navMobile.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', closeMenu);
});

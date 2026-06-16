import * as THREE from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LOGO_URL, GLB_URL } from './assets.js';

document.querySelectorAll('img[alt="THE GRAMPS"]').forEach(img => { img.src = LOGO_URL; });

gsap.registerPlugin(ScrollTrigger);

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function runPreloader() {
  const tl = gsap.timeline({ onComplete: finishPreloader });
  tl.to('#pre-logo', { opacity: 1, duration: .6, ease: 'power2.out' }, .25);
  const obj = { v: 0 };
  tl.to(obj, {
    v: 100, duration: RM ? .05 : 2.1, ease: 'power2.inOut',
    onUpdate() {
      const v = Math.floor(obj.v);
      document.getElementById('pre-counter').textContent = String(v).padStart(3,'0');
      document.getElementById('pre-bar-fill').style.width = v + '%';
    }
  }, 0);
  tl.to({}, { duration: .3 });
}

function finishPreloader() {
  gsap.to('#preloader', {
    yPercent: -100, duration: RM ? 0 : .75,
    ease: 'power2.inOut',
    onComplete() {
      document.getElementById('preloader').style.display = 'none';
      revealHero();
    }
  });
}
runPreloader();

function makeLights(scene, cfg = {}) {
  const { aI=.6, dC=0xe8e0d0, dI=1.2, rC=0x0a3144, rI=.8 } = cfg;
  scene.add(new THREE.AmbientLight(0xffffff, aI));
  const d = new THREE.DirectionalLight(dC, dI);
  d.position.set(1.2, 2, 2); scene.add(d);
  const r = new THREE.DirectionalLight(rC, rI);
  r.position.set(-2, .5, -2); scene.add(r);
}

function fixVertexColors(root) {
  root.traverse(n => {
    if (!n.isMesh || !n.geometry.attributes.color) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    mats.forEach(m => { m.vertexColors = true; m.needsUpdate = true; });
  });
}

function makeRenderer(canvas, opts = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, ...opts });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping      = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  return r;
}

function scaleToFit(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const c   = box.getCenter(new THREE.Vector3());
  const s   = box.getSize(new THREE.Vector3());
  const sc  = targetSize / Math.max(s.x, s.y, s.z);
  model.scale.setScalar(sc);
  model.position.set(-c.x * sc, -c.y * sc, -c.z * sc);
  return sc;
}

function makeParticles(scene, n = 360, spread = 9) {
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i*3]   = (Math.random()-.5)*spread;
    pos[i*3+1] = (Math.random()-.5)*spread;
    pos[i*3+2] = (Math.random()-.5)*spread*.3 - 4;
    vel[i*3]   = (Math.random()-.5)*.0018;
    vel[i*3+1] = (Math.random()-.5)*.0018;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo,
    new THREE.PointsMaterial({ color: 0xe8e0d0, size: .032, transparent: true, opacity: .55, sizeAttenuation: true })
  );
  scene.add(pts);
  return { pts, vel };
}

function tickParticles({ pts, vel }) {
  const p = pts.geometry.attributes.position, n = p.count, lim = 4.5;
  for (let i = 0; i < n; i++) {
    const nx = p.getX(i) + vel[i*3], ny = p.getY(i) + vel[i*3+1];
    if (Math.abs(nx) > lim) vel[i*3]   *= -1;
    if (Math.abs(ny) > lim) vel[i*3+1] *= -1;
    p.setXY(i, nx, ny);
  }
  p.needsUpdate = true;
}

const hCanvas = document.getElementById('hero-canvas');
const hRend   = makeRenderer(hCanvas);
hRend.setSize(innerWidth, innerHeight);

const hScene = new THREE.Scene();
const hCam   = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, .1, 100);
hCam.position.set(0, 0, 6);

const particles = makeParticles(hScene);

document.getElementById('hero-mv').setAttribute('src', GLB_URL);

let gltfSrc = null;

const loader = new GLTFLoader();
loader.load(GLB_URL, gltf => {
  gltfSrc = gltf;
  fixVertexColors(gltf.scene);
  initAbout();
  initCards();
  initContact();
},
undefined,
e => console.warn('GLB load error', e));

(function hLoop() {
  requestAnimationFrame(hLoop);
  tickParticles(particles);
  hRend.render(hScene, hCam);
})();

window.addEventListener('resize', () => {
  hCam.aspect = innerWidth / innerHeight;
  hCam.updateProjectionMatrix();
  hRend.setSize(innerWidth, innerHeight);
}, { passive: true });

function splitChars(el) {
  const t = el.textContent;
  el.innerHTML = t.split('').map(c =>
    `<span class="ch">${c===' '?'&nbsp;':c}</span>`
  ).join('');
  return [...el.querySelectorAll('.ch')];
}

function revealHero() {
  const ch1 = splitChars(document.getElementById('hl1'));
  const ch2 = splitChars(document.getElementById('hl2'));
  const tl  = gsap.timeline({ delay: .15 });

  gsap.set('.hero-content', { yPercent: -50 });

  tl.to(['#nav-logo','#nav-links'], { opacity: 1, duration: .6, ease: 'power2.out', stagger: .1 }, 0);
  tl.fromTo('#hero-eyebrow', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'power2.out' }, .2);

  if (!RM) {
    tl.to([...ch1, ...ch2], { y: 0, duration: .75, ease: 'power3.out', stagger: .035 }, .35);
  } else {
    tl.set([...ch1, ...ch2], { y: 0 });
  }

  tl.to('#hero-sub',    { opacity: 1, duration: .5, ease: 'power2.out' }, .85);
  tl.to('#scroll-hint', { opacity: 1, duration: .5, ease: 'power2.out' }, 1.1);

  const mv = document.getElementById('hero-mv');
  let autoRotating = true;

  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: '+=220%',
    pin: true,
    scrub: 2.5,
    onUpdate(self) {
      const p = self.progress;
      const e = p * p * (3 - 2 * p);

      if (p > 0.02 && autoRotating) {
        mv.removeAttribute('auto-rotate');
        autoRotating = false;
      } else if (p <= 0.02 && !autoRotating) {
        mv.setAttribute('auto-rotate', '');
        autoRotating = true;
      }

      gsap.set('#hero-mv', {
        x: e * (-window.innerWidth * 0.48),
        opacity: Math.max(0, 1 - e * 1.5)
      });

      gsap.set('#scroll-hint', { opacity: Math.max(0, 1 - p * 3) });
    }
  });
}

function initAbout() {
  const canvas = document.getElementById('about-canvas');
  if (!canvas || !gltfSrc) return;
  const w = canvas.offsetWidth || 460, h = canvas.offsetHeight || 460;
  const r = makeRenderer(canvas);
  r.setSize(w, h);
  const scene = new THREE.Scene();
  const cam   = new THREE.PerspectiveCamera(40, w/h, .1, 100);
  cam.position.set(0, 0, 5.5);
  makeLights(scene, { rI: .5 });
  const model = gltfSrc.scene.clone();
  scaleToFit(model, 2.8);
  scene.add(model);
  const ctrl = new OrbitControls(cam, canvas);
  ctrl.enableZoom = false; ctrl.enablePan = false;
  ctrl.autoRotate = true; ctrl.autoRotateSpeed = .6;
  ctrl.enableDamping = true;
  (function loop() { requestAnimationFrame(loop); ctrl.update(); r.render(scene, cam); })();
}

const CAM_POS = [
  new THREE.Vector3(0,   .4,  6),
  new THREE.Vector3(3.5, .4,  4.8),
  new THREE.Vector3(-3, -.2,  5)
];
const LIGHT_CFG = [
  { dC: 0xe8e0d0, dI: 1.2, rC: 0x0a3144, rI: .8 },
  { dC: 0xffd4a0, dI: 1.4, rC: 0x1a0a3a, rI: .7 },
  { dC: 0xa8c8ff, dI: 1.0, rC: 0x3a1200, rI: 1.0 }
];

function initCards() {
  for (let i = 0; i < 3; i++) {
    const canvas = document.getElementById(`cc${i}`);
    if (!canvas || !gltfSrc) continue;
    const w = canvas.offsetWidth || 320;
    const r = makeRenderer(canvas);
    r.setSize(w, w);
    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(40, 1, .1, 100);
    cam.position.copy(CAM_POS[i]);
    cam.lookAt(0, 0, 0);
    makeLights(scene, LIGHT_CFG[i]);
    const model = gltfSrc.scene.clone();
    scaleToFit(model, 2.6);
    scene.add(model);
    const ctrl = new OrbitControls(cam, canvas);
    ctrl.enableZoom = false; ctrl.enablePan = false;
    ctrl.autoRotate = true; ctrl.autoRotateSpeed = 1.1;
    ctrl.enableDamping = true; ctrl.dampingFactor = .06;
    ctrl.target.set(0, 0, 0);

    const card = document.querySelector(`[data-idx="${i}"]`);
    if (card) {
      card.addEventListener('mouseenter', () => { ctrl.autoRotateSpeed = 3.5; });
      card.addEventListener('mouseleave', () => { ctrl.autoRotateSpeed = 1.1; });
    }

    (function loop() { requestAnimationFrame(loop); ctrl.update(); r.render(scene, cam); })();
  }
}

function initContact() {
  const canvas = document.getElementById('contact-canvas');
  if (!canvas || !gltfSrc) return;
  const sec = document.getElementById('contact');
  const w   = sec.offsetWidth  || innerWidth;
  const h   = sec.offsetHeight || innerHeight;
  const r = makeRenderer(canvas, { antialias: false });
  r.setPixelRatio(1);
  r.setSize(w, h);
  const scene = new THREE.Scene();
  const cam   = new THREE.PerspectiveCamera(55, w/h, .1, 100);
  cam.position.set(0, 0, 3.5);
  makeLights(scene, { aI: .3, dI: .7, rI: 1.3 });
  const model = gltfSrc.scene.clone();
  scaleToFit(model, 5.5);
  scene.add(model);
  (function loop() {
    requestAnimationFrame(loop);
    model.rotation.y += .003;
    r.render(scene, cam);
  })();
}

gsap.from('.about-tag',      { opacity:0, y:18, duration:.7, scrollTrigger:{ trigger:'#about', start:'top 72%', once:true } });
gsap.from('.about-headline', { opacity:0, y:36, duration:1,  scrollTrigger:{ trigger:'#about', start:'top 65%', once:true }, ease:'power3.out' });
gsap.from('.about-body',     { opacity:0, y:24, duration:.8, delay:.18, scrollTrigger:{ trigger:'#about', start:'top 62%', once:true } });
gsap.from('.about-3d',       { opacity:0, x:30, duration:1,  scrollTrigger:{ trigger:'#about', start:'top 60%', once:true }, ease:'power3.out' });

gsap.from('.section-tag',   { opacity:0, y:14, duration:.6, scrollTrigger:{ trigger:'#collection', start:'top 75%', once:true } });
gsap.from('.section-title', { opacity:0, y:28, duration:.8, scrollTrigger:{ trigger:'#collection', start:'top 70%', once:true }, ease:'power3.out' });

ScrollTrigger.create({
  trigger: '#col-grid', start: 'top 78%', once: true,
  onEnter() {
    gsap.to('.card', { opacity: 1, y: 0, duration: .8, ease: 'power3.out', stagger: .14 });
  }
});

ScrollTrigger.create({
  trigger: '#stats', start: 'top 72%', once: true,
  onEnter() {
    animateStat(document.getElementById('s0'), 1,    '001');
    animateStat(document.getElementById('s1'), 2026, '2026', 2020);
    gsap.from('#s2', { opacity:0, scale:.6, duration:1, ease:'elastic.out(1,.55)' });
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

gsap.from('.contact-title', { opacity:0, y:36, duration:1,  scrollTrigger:{ trigger:'#contact', start:'top 70%', once:true }, ease:'power3.out' });
gsap.from('.contact-sub',   { opacity:0, y:22, duration:.8, delay:.15, scrollTrigger:{ trigger:'#contact', start:'top 68%', once:true } });
gsap.from('.wl-form',       { opacity:0, y:20, duration:.7, delay:.3,  scrollTrigger:{ trigger:'#contact', start:'top 65%', once:true } });

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
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
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

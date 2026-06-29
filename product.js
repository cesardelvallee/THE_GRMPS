gsap.registerPlugin(ScrollTrigger);

const cur  = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
(function rLoop() {
  requestAnimationFrame(rLoop);
  rx += (mx - rx) * .12; ry += (my - ry) * .12;
  cur.style.left  = mx + 'px'; cur.style.top  = my + 'px';
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
})();
document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => { cur.classList.add('on'); ring.classList.add('on'); });
  el.addEventListener('mouseleave', () => { cur.classList.remove('on'); ring.classList.remove('on'); });
});

const tl = gsap.timeline({ delay: .2 });

tl.to('#pd-back',     { opacity: 1, x: 0, duration: .5, ease: 'power2.out' }, 0);
tl.to('.pd-eyebrow',  { opacity: 1, y: 0, duration: .6, ease: 'power2.out' }, .1);
tl.to('.pd-price-row', { opacity: 1, duration: .5, ease: 'power2.out' }, .42);
tl.to('.pd-desc',      { opacity: 1, duration: .55, ease: 'power2.out' }, .56);
tl.to('.pd-specs-mini',{ opacity: 1, duration: .5, ease: 'power2.out' }, .7);
tl.to('.pd-actions',   { opacity: 1, duration: .5, ease: 'power2.out' }, .84);
tl.to('.pd-trust li',  { opacity: 1, y: 0, duration: .45, ease: 'power2.out', stagger: .07 }, .94);

gsap.from('.pd-story-img', {
  opacity: 0, x: -44, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.pd-story', start: 'top 72%', once: true }
});
gsap.from('.pd-story-text', {
  opacity: 0, x: 44, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.pd-story', start: 'top 72%', once: true }
});

gsap.from('.specs-row', {
  opacity: 0, y: 12, duration: .45, ease: 'power2.out', stagger: .055,
  scrollTrigger: { trigger: '.pd-specs-section', start: 'top 74%', once: true }
});

/* (The "Add to Waitlist" CTA navigates via the shared page-transition
   in enhance.js — it carries data-nav="index.html#contact".) */

const mainImg = document.getElementById('pd-main-img');
const thumbs  = document.querySelectorAll('.pd-thumb');

thumbs.forEach(thumb => {
  thumb.addEventListener('click', () => {
    const src = thumb.dataset.src;
    gsap.to(mainImg, {
      opacity: 0, duration: .18,
      onComplete() {
        mainImg.src = src;
        mainImg.onerror = () => { mainImg.src = thumb.dataset.fallback; };
        gsap.to(mainImg, { opacity: 1, duration: .22 });
      }
    });
    thumbs.forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
  });
});

/* Sticky purchase bar — slides in once the hero CTA scrolls out of view. */
const sticky = document.getElementById('pd-sticky');
if (sticky) {
  const toggleSticky = () => sticky.classList.toggle('show', window.scrollY > window.innerHeight * 0.85);
  window.addEventListener('scroll', toggleSticky, { passive: true });
  toggleSticky();
}

/* Lightbox — click the main image to study it full-screen. */
if (mainImg) {
  const lb = document.createElement('div');
  lb.className = 'pd-lightbox';
  lb.innerHTML = '<button class="pd-lb-close" aria-label="Close">✕</button><img alt="GRMP Classic" />';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('img');
  const open = () => {
    lbImg.src = mainImg.src;
    lb.classList.add('open');
    if (window.__lenis) window.__lenis.stop();
  };
  const close = () => {
    lb.classList.remove('open');
    if (window.__lenis) window.__lenis.start();
  };
  mainImg.addEventListener('click', open);
  lb.addEventListener('click', e => { if (e.target !== lbImg) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

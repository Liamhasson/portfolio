// Direction B inner pages: background cross-fade per section, the iOS-like glass spring on arrival, liquid stretch while scrolling.
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// overlay mode: this page is shown inside an overlay on another page (overlays.js). Its own links to Cyvore pages, Esc, and a click
// on empty space are handed to that page, which opens the next overlay, closes, or navigates.
if (new URLSearchParams(location.search).has('overlay') && parent !== window) {
  document.documentElement.classList.add('embed');
  const tell = m => parent.postMessage({ cyvore: 1, ...m }, '*');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a) { const h = a.getAttribute('href'); if (a.target === '_blank' || /^(https?:|mailto:|tel:|#)/.test(h)) return; e.preventDefault(); tell({ href: h }); return; }
    if (!e.target.closest('.glass, .card, .art, .member, .logos, .rounds, h1, h2, p, img, li, button')) tell({ close: 1 });
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') tell({ close: 1 }); });
}
function spring(n, dur, z, w, delay = 0) { const wd = w * Math.sqrt(1 - z * z), out = [];
  for (let i = 0; i <= n; i++) { const t = i / n * dur - delay; out.push(t <= 0 ? 0 : 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t))); } return out; }
const GN = 54, DUR = .9, CX = spring(GN, DUR, .78, 15), CY = spring(GN, DUR, .72, 14, .03), LX = spring(GN, DUR, .52, 15), LY = spring(GN, DUR, .36, 11, .05);
function glassIn(el, { from = 1.06, liquid = false, delay = 0 } = {}) {
  if (RM || !el) return; const fy = 1 + (from - 1) * (liquid ? 1.6 : 1), X = liquid ? LX : CX, Y = liquid ? LY : CY;
  el.animate(X.map((x, i) => ({ offset: i / GN, scale: `${Math.min(1, from + (1 - from) * x).toFixed(4)} ${Math.min(1, fy + (1 - fy) * Y[i]).toFixed(4)}` })), { duration: DUR * 1000, delay, easing: 'linear', fill: 'backwards' });
}
// elements rise in as they arrive; glass panes also spring (liquid ones flex like the agent bubbles on the home page)
const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const el = e.target; io.unobserve(el);
  const d = +(el.dataset.d || 0); setTimeout(() => el.classList.add('in'), d);
  // arrive from slightly smaller and settle: a pane never grows past its own box, so the gaps stay equal
  if (el.classList.contains('glass')) glassIn(el, { from: .94, delay: d }); }), { threshold: .18 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));
// the background that belongs to the section in the middle of the screen
const bgs = [...document.querySelectorAll('.bg > *')], secs = [...document.querySelectorAll('[data-bg]')];
function pickBg() { const mid = innerHeight / 2; let cur = secs[0]; secs.forEach(s => { if (s.getBoundingClientRect().top < mid) cur = s; });
  bgs.forEach(b => { const on = b.id === cur.dataset.bg; b.classList.toggle('on', on); if (b.tagName === 'VIDEO') on ? b.play().catch(() => {}) : b.pause(); }); }
addEventListener('scroll', pickBg, { passive: true }); pickBg();
// glass edge light leans toward the pointer; panes stretch with scroll speed and rebound
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return;
  document.documentElement.style.setProperty('--la', (Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2) * 180 / Math.PI + 270).toFixed(1) + 'deg'); }, { passive: true });
document.querySelectorAll('.glass, .navpill').forEach((el, i) => { el.classList.add('lq'); el.style.setProperty('--sd', (i * 1.7 % 9).toFixed(1) + 's'); });
if (!RM) { let ly0 = scrollY, v = 0, ly = 1, lyv = 0, lx = 1, lxv = 0; const root = document.documentElement;
  (function tick() { requestAnimationFrame(tick); const dy = scrollY - ly0; ly0 = scrollY; v += (dy - v) * .25;
    const st = Math.min(.04, Math.abs(v) * .0008);
    // squeeze, never swell: panes narrow and shorten a little while you scroll, so the space between them only ever grows;
    // the rebound is heavily damped and capped, so nothing crosses into the gap when they spring back
    lyv += (1 - st * .45 - ly) * .16; lyv *= .7; ly += lyv; lxv += (1 - st - lx) * .16; lxv *= .7; lx += lxv;
    root.style.setProperty('--lx', Math.min(1.003, lx).toFixed(4)); root.style.setProperty('--ly', Math.min(1.003, ly).toFixed(4)); })(); }
glassIn(document.querySelector('.navpill'), { from: 1.06, delay: 200 });

// phone menu
const burger = document.getElementById('burger'), menu = document.getElementById('menu');
if (burger) burger.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; document.body.style.overflow = open ? 'hidden' : ''; burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); });
addEventListener('keydown', e => { if (e.key === 'Escape' && menu && !menu.hidden) burger.click(); });

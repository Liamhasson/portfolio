// Request a meeting, Press and About us open as overlays on whatever page and section you're on: the page underneath keeps going
// (its film, its place in the story) and never scrolls or jumps. Any link to meeting.html, press.html or about.html opens its
// overlay; Esc, the close button, a click beside the content or the browser's back button close it. #meeting / #press / #about in
// the address opens it on arrival, so a link can be shared. The plain pages stay for anyone without scripts.
//  - Request a meeting is built here (the live demo page's words, form and video), on a light veil from the left.
//  - Press and About us are the real pages shown in a frame in "overlay" mode (no nav, no backdrop of their own), on a frosted veil.
// ScanMySMS, Cyvore's free link checker: paste a link or a whole text message and see if it's safe. The interface is complete;
// Cyvore connects the scanner after handoff by setting SCAN_ENDPOINT (POST {text} → {verdict: 'safe' | 'suspicious' | 'malicious',
// host, reasons: [..]}). Until then a simple in-browser check gives a preview result, and says so.
const SCAN_ENDPOINT = '';
const SCAN_HTML = `<p class="mo-kick">ScanMySMS by Cyvore</p>
  <h2 class="mo-title"><span>Got a link you're not sure about?</span> <strong>Check it before you tap.</strong></h2>
  <p class="mo-lede">Paste a link, or the whole text message. ScanMySMS tells you if it's safe.</p>
  <form class="scanbox" novalidate>
    <label class="mo-sr" for="scanIn">Link or message to check</label>
    <input id="scanIn" name="q" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste a link or a message">
    <button class="mo-submit" type="submit">Check <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </form>
  <div class="scanres" aria-live="polite" hidden></div>`;
function cyvoreScan(root) {
  const form = root.querySelector('.scanbox'), input = form.querySelector('input'), go = form.querySelector('button'), res = root.querySelector('.scanres');
  const ICON = { safe: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', suspicious: '<path d="M12 7v6M12 16.5v.5"/>', malicious: '<path d="M7 7l10 10M17 7 7 17"/>', none: '<path d="M12 8v5M12 16v.5"/>' };
  const LABEL = { safe: 'Looks safe', suspicious: 'Be careful', malicious: "Don't open this link", none: 'No link found' };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const findLink = text => { const m = text.match(/\b((?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?)/i); return m ? m[1].replace(/[.,;:!?)\]]+$/, '') : null; };
  function preview(text) {
    const link = findLink(text); if (!link) return { verdict: 'none' };
    let u; try { u = new URL(/^https?:\/\//i.test(link) ? link : 'https://' + link); } catch { return { verdict: 'none' }; }
    const host = u.hostname.toLowerCase(), reasons = [];
    const SHORT = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'ow.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'tiny.cc'];
    const BRANDS = { paypal: 'paypal.com', leumi: 'leumi.co.il', hapoalim: 'bankhapoalim.co.il', discount: 'discountbank.co.il', israelpost: 'israelpost.co.il', post: 'israelpost.co.il', delta: 'delta.com', airbnb: 'airbnb.com', apple: 'apple.com', microsoft: 'microsoft.com', amazon: 'amazon.com', netflix: 'netflix.com', gov: 'gov.il', max: 'max.co.il' };
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) reasons.push('It points to a bare number address instead of a named website.');
    if (host.includes('xn--')) reasons.push('Its name uses look-alike letters that can imitate a real brand.');
    if (SHORT.includes(host)) reasons.push('It’s a shortened link that hides where it really goes.');
    if (/\.(top|xyz|click|live|shop|icu|buzz|rest|cam|sbs|cfd|monster)$/.test(host)) reasons.push('Its ending (.' + host.split('.').pop() + ') is common in scam campaigns.');
    for (const [word, real] of Object.entries(BRANDS)) if (host.replace(/[^a-z]/g, ' ').split(' ').some(p => p.includes(word)) && !(host === real || host.endsWith('.' + real))) { reasons.push('It uses the name “' + word + '” but isn’t ' + real + '.'); break; }
    if (host.split('.').length > 4) reasons.push('It hides behind a long chain of sub-addresses.');
    if (u.username || link.includes('@')) reasons.push('It contains an “@”, a trick to disguise the real address.');
    if (/^http:\/\//i.test(link)) reasons.push('It isn’t encrypted (http, not https).');
    return { verdict: reasons.length === 0 ? 'safe' : reasons.length === 1 ? 'suspicious' : 'malicious', host, reasons };
  }
  async function check(text) {
    if (SCAN_ENDPOINT) { try { const r = await fetch(SCAN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); if (r.ok) return { ...(await r.json()), live: true }; } catch {} return { verdict: 'error' }; }
    await new Promise(r => setTimeout(r, 1500)); return preview(text);
  }
  const badge = v => `<span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ICON[v]}</svg>${LABEL[v]}</span>`;
  function show(r) {
    if (r.verdict === 'error') { res.dataset.v = 'none'; res.innerHTML = `<div class="rh"><span class="badge">Couldn’t check right now</span></div><p>Please try again in a moment.</p>`; res.hidden = false; return; }
    const v = r.verdict; res.dataset.v = v;
    const body = v === 'none' ? '<p>Paste a link, like bit.ly/…, or the whole text message it came in.</p>'
      : v === 'safe' ? '<p>We found nothing wrong with this link. Still, never share a password or a code because a message asked for it.</p>'
      : `<ul>${(r.reasons || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><p>${v === 'malicious' ? 'Don’t tap it, and don’t reply. If it claims to be your bank, call the bank on the number you know.' : 'Only open it if you were expecting it and know who sent it.'}</p>`;
    res.innerHTML = `<div class="rh">${badge(v)}${r.host ? `<span class="host">${esc(r.host)}</span>` : ''}</div>${body}<button class="again" type="button">Check another link</button>`
      + (r.live ? '' : '<p class="pv">Preview: this check runs in your browser until the ScanMySMS service is connected here.</p>');
    res.hidden = false; res.querySelector('.again').addEventListener('click', () => { res.hidden = true; input.value = ''; input.focus(); });
  }
  form.addEventListener('submit', e => {
    e.preventDefault(); const text = input.value.trim(); if (!text) { input.focus(); return; }
    res.hidden = true; form.classList.add('busy'); go.disabled = true; input.blur();
    check(text).then(r => { form.classList.remove('busy'); go.disabled = false; show(r); });
  });
  input.addEventListener('keydown', e => e.stopPropagation());   // typing never moves the page
  return { reset() { res.hidden = true; input.value = ''; }, focus() { input.focus({ preventScroll: true }); } };
}
(() => {
  if (new URLSearchParams(location.search).has('overlay')) return;   // a page shown inside an overlay doesn't open overlays itself
  const ENDPOINT = '';   // where meeting requests go isn't decided yet: with none, nothing is sent and the thank-you shows
  const here = (location.pathname.split('/').pop() || 'index.html').replace(/^index\.html$/, 'index-ui.html');
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'overlays.css'; document.head.append(css);
  const root = document.documentElement;
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  // ---------- the overlays
  function shell(name, label, veil) {
    const el = document.createElement('div');
    el.className = `mo mo-${name}`; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label); el.hidden = true;
    el.innerHTML = `<div class="mo-veil ${veil}"></div><button class="mo-x" type="button" aria-label="Close">${closeSvg}</button>`;
    document.body.append(el); return el;
  }
  const meet = shell('meeting', 'Request a meeting', 'side');
  meet.insertAdjacentHTML('beforeend', `<div class="mo-scroll"><div class="mo-in">
    <div><h2 class="mo-title"><span>Meet your</span> <strong>new doorman.</strong></h2>
      <p class="mo-lede">Book a 30-minute conversation with our team. Tell us how your organization works and what worries you. We'll look at your situation with you and show you exactly what Cyvore would do for you.</p></div>
    <div class="mo-card" id="mo-panel">
      <form class="mo-form" id="mo-form" novalidate>
        <div class="mo-field"><label for="mo-name">Full name</label><input id="mo-name" name="name" type="text" autocomplete="name" required aria-describedby="mo-e-name"><p class="mo-err" id="mo-e-name"></p></div>
        <div class="mo-field"><label for="mo-email">Work email</label><input id="mo-email" name="email" type="email" autocomplete="email" required aria-describedby="mo-e-email"><p class="mo-err" id="mo-e-email"></p></div>
        <div class="mo-field"><label for="mo-company">Company <i>(optional)</i></label><input id="mo-company" name="company" type="text" autocomplete="organization"></div>
        <div class="mo-field"><label for="mo-phone">Phone <i>(optional)</i></label><input id="mo-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="mo-field wide"><label for="mo-notes">What would you like to talk about? <i>(optional)</i></label><textarea id="mo-notes" name="notes"></textarea></div>
        <div class="mo-end">
          <p class="mo-fail" id="mo-fail" role="alert" hidden>That didn't go through. Please try again, or email <a href="mailto:info@cyvore.com">info@cyvore.com</a>.</p>
          <button class="mo-submit" type="submit">Request a meeting ${arrow}</button>
          <p class="mo-note">Cyvore Security Ltd uses these details only to answer your request. To see, correct or delete them, email <a href="mailto:info@cyvore.com">info@cyvore.com</a>. <a href="privacy.html#demo-requests">Privacy policy</a></p>
        </div>
      </form>
    </div>
    <div class="mo-card mo-media">
      <button class="mo-video" type="button" data-id="8CsUSphiCwI" aria-label="Play the Cyvore demo video"><img src="assets/company/demo-poster.jpg" width="1280" height="720" alt="">
        <span class="mo-play"><svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M2 1l9 5-9 5z"/></svg>Play the demo</span></button>
      <p class="mo-note">Takedown subject to jurisdictional availability.</p>
    </div>
  </div></div>`);
  const scanO = shell('scan', 'ScanMySMS', 'side');
  scanO.insertAdjacentHTML('beforeend', `<div class="mo-scroll"><div class="mo-in"><div class="mo-scanwrap">${SCAN_HTML}</div></div></div>`);
  const scanner = cyvoreScan(scanO);
  const page = shell('page', 'Cyvore', 'full');
  // a fresh frame for each page, so changing pages never adds steps to the browser's history (back still closes the overlay)
  let frame = null;
  function loadPage(src, label) {
    if (frame && frame.dataset.src === src) return;
    frame?.remove(); page.classList.remove('loaded');
    frame = document.createElement('iframe'); frame.className = 'mo-frame'; frame.title = label; frame.dataset.src = src;
    frame.addEventListener('load', () => page.classList.add('loaded')); frame.src = src; page.append(frame);
  }

  const PAGES = { meeting: { el: meet, file: 'meeting.html' }, scan: { el: scanO, file: 'scan.html' }, press: { el: page, file: 'press.html', label: 'Press' }, about: { el: page, file: 'about.html', label: 'About us' } };
  const nameOf = href => { const f = (href || '').split(/[?#]/)[0].split('/').pop(); return Object.keys(PAGES).find(k => PAGES[k].file === f); };

  // ---------- open / close: the page underneath stays exactly where it is
  let current = null, opener = null, pushed = false;
  const hideT = new Map();
  function open(name, fromHistory) {
    if (current === name) return;
    const P = PAGES[name]; if (!P) return;
    const menu = document.getElementById('menu'), burger = document.getElementById('burger');
    if (menu && !menu.hidden && burger) burger.click();   // the phone menu gives way to the overlay
    if (current && PAGES[current].el !== P.el) shut(current);   // one overlay at a time
    if (!current) opener = document.activeElement;
    current = name; clearTimeout(hideT.get(P.el)); P.el.hidden = false; root.style.overflow = 'hidden'; root.classList.add('mo-on'); (P.el.querySelector('.mo-scroll') || P.el).scrollTop = 0;
    if (P.el === page) {
      loadPage(`${P.file}?overlay=1`, P.label); page.setAttribute('aria-label', P.label);
    }
    requestAnimationFrame(() => { P.el.classList.add('open'); if (name === 'meeting') setTimeout(() => meet.querySelector('#mo-name')?.focus({ preventScroll: true }), 350); else if (name === 'scan') setTimeout(() => scanner.focus(), 350); else P.el.querySelector('.mo-x').focus({ preventScroll: true }); });
    if (!fromHistory) { const url = location.pathname + location.search + '#' + name; if (pushed) history.replaceState({ mo: name }, '', url); else { history.pushState({ mo: name }, '', url); pushed = true; } }
  }
  function shut(name) {
    const el = PAGES[name].el; el.classList.remove('open'); if (name === 'meeting') stopVideo();
    hideT.set(el, setTimeout(() => { el.hidden = true; }, 460));
  }
  function close(fromHistory) {
    if (!current) return;
    shut(current); current = null; root.style.overflow = ''; root.classList.remove('mo-on');
    if (!fromHistory) { if (pushed) history.back(); else history.replaceState(null, '', location.pathname + location.search); }
    pushed = false; opener?.focus?.({ preventScroll: true });
  }
  // links on this page
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const name = nameOf(a.getAttribute('href')); if (!name) return;
    e.preventDefault(); if (PAGES[name].file !== here) open(name, false);   // a link to the page you're on does nothing
  });
  // a page inside the overlay asks for things by message: another overlay, closing, or going to a page
  addEventListener('message', e => {
    const m = e.data; if (!m || m.cyvore !== 1) return;
    if (m.close) return close(false);
    if (m.href) { const name = nameOf(m.href); if (name && PAGES[name].file !== here) open(name, false); else { close(true); location.href = m.href; } }
  });
  [meet, scanO, page].forEach(el => {
    el.querySelector('.mo-x').addEventListener('click', () => close(false));
    el.addEventListener('click', e => { if (e.target === el || e.target.classList.contains('mo-veil')) close(false); });   // a click beside it
  });
  [meet, scanO].forEach(el => el.addEventListener('click', e => { if (e.target.classList.contains('mo-scroll') || e.target.classList.contains('mo-in')) close(false); }));   // empty space beside the content
  addEventListener('keydown', e => { if (e.key === 'Escape' && current) close(false); });
  addEventListener('popstate', () => { const name = location.hash.slice(1); if (PAGES[name]) open(name, true); else close(true); });
  { const name = location.hash.slice(1); if (PAGES[name] && PAGES[name].file !== here) open(name, true); }
  // keep keyboard focus inside the meeting overlay while it's open
  meet.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...meet.querySelectorAll('button, a[href], input, textarea, iframe')].filter(el => el.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---------- the meeting form, as on the live page
  const panel = meet.querySelector('#mo-panel'), formHTML = panel.innerHTML;
  const RULES = { name: v => v ? '' : 'Please enter your name.', email: v => !v ? 'Please enter your work email.' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'That email doesn\'t look right.' };
  function wire() {
    const form = meet.querySelector('#mo-form'); if (!form) return;
    const fail = meet.querySelector('#mo-fail'), submit = form.querySelector('.mo-submit'), field = n => form.elements.namedItem(n);
    const check = n => { const el = field(n), msg = RULES[n](el.value.trim()); meet.querySelector('#mo-e-' + n).textContent = msg; msg ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'); return !msg; };
    Object.keys(RULES).forEach(n => ['input', 'blur'].forEach(ev => field(n).addEventListener(ev, () => { if (field(n).hasAttribute('aria-invalid')) check(n); })));
    form.addEventListener('submit', e => {
      e.preventDefault(); fail.hidden = true;
      const bad = Object.keys(RULES).filter(n => !check(n)); if (bad.length) { field(bad[0]).focus(); return; }
      const data = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
      submit.disabled = true;
      send(data).then(ok => { submit.disabled = false; ok ? sent(data.name || '', data.email || '') : fail.hidden = false; });
    });
  }
  async function send(data) { if (!ENDPOINT) return true; try { return (await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).ok; } catch { return false; } }
  function sent(name, email) {
    const wrap = document.createElement('div'), h = document.createElement('h3'), p = document.createElement('p'), b = document.createElement('button');
    wrap.className = 'mo-sent'; h.tabIndex = -1; h.textContent = `Thanks, ${name.split(/\s+/)[0] || name}.`; p.textContent = `We'll email you at ${email} to find a time.`;
    b.type = 'button'; b.className = 'mo-back'; b.textContent = 'Back to Cyvore';
    b.addEventListener('click', () => { close(false); setTimeout(() => { panel.innerHTML = formHTML; wire(); }, 500); });   // back where you were; a fresh form next time
    wrap.append(h, p, b); panel.replaceChildren(wrap); h.focus();
  }
  wire();

  // ---------- the demo video: nothing from YouTube loads until it's asked for; closing takes it back to its poster
  const poster = meet.querySelector('.mo-video'); let playing = null;
  const play = () => { const f = document.createElement('iframe'); f.src = `https://www.youtube-nocookie.com/embed/${poster.dataset.id}?autoplay=1&rel=0`; f.title = 'Cyvore demo video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; const box = document.createElement('div'); box.className = 'mo-video'; box.append(f); poster.replaceWith(box); f.focus(); playing = box; };
  function stopVideo() { if (!playing) return; playing.replaceWith(poster); playing = null; poster.addEventListener('click', play, { once: true }); }
  poster.addEventListener('click', play, { once: true });
})();

/* D. Jassen Banze — Executive Creative Director
   GSAP + ScrollTrigger + Lenis; canvas dot field; no other dependencies.
   Emil Kowalski's rules: strong ease-out entrances, ease-in-out for things
   moving on screen, springs for pointer-driven decoration, 1:1 drag with
   momentum, instant keyboard actions, hover only on fine pointers,
   reveals fire once, reduced motion collapses to fades. Without GSAP the
   page stays fully readable. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap, ST = window.ScrollTrigger;
  const HAS_G = !!(G && ST);
  const MOTION = HAS_G && !RM;
  if (HAS_G) G.registerPlugin(ST);

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const navH = () => $('#nav').offsetHeight;
  const makeSpring = (k = 0.12, d = 0.75) => ({
    x: 0, v: 0, t: 0,
    step() { this.v = (this.v + (this.t - this.x) * k) * d; this.x += this.v; return this.x; },
    settled() { return Math.abs(this.t - this.x) < 0.05 && Math.abs(this.v) < 0.05; },
  });

  /* ───────── Smooth scroll (mouse/trackpad only) ───────── */
  let lenis = null;
  if (MOTION && FINE && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ST.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  const lockScroll = (on) => { root.classList.toggle('lock', on); if (lenis) (on ? lenis.stop() : lenis.start()); };

  /* ───────── Split text into word masks, keeping <em> accents ───────── */
  const splitRich = (el, cls) => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const parts = [];
    const pushTokens = (text, wrapEm) => text.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) parts.push({ space: true });
      else parts.push({ html: wrapEm ? `<em>${esc(tok)}</em>` : esc(tok) });
    });
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) pushTokens(n.textContent, false);
      else if (n.nodeType === 1 && n.tagName === 'BR') parts.push({ br: true });
      else if (n.nodeType === 1) pushTokens(n.textContent, n.tagName === 'EM');
    });
    const words = [];
    let cur = '';
    parts.forEach((p) => {
      if (p.space || p.br) { if (cur) { words.push(cur); cur = ''; } if (p.br) words.push(null); }
      else cur += p.html; // glue punctuation onto the word before it
    });
    if (cur) words.push(cur);
    el.innerHTML = words.map((w) => (w === null ? '<br>' : `<span class="${cls}" aria-hidden="true"><span>${w}</span></span>`)).join(' ');
    return $$(`.${cls} > span`, el);
  };

  const runCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    if (!MOTION) { el.textContent = target.toFixed(dec); return; }
    const o = { v: 0 };
    G.to(o, { v: target, duration: 1.6, ease: 'expo.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } });
  };

  /* ==================================================================
     Hero dot field — dots part around the pointer and spring back
     ================================================================== */
  (() => {
    const canvas = $('.dots');
    const hero = $('.hero');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const GAP = 26;
    let dots = [], w = 0, h = 0, dpr = 1, visible = true, raf = 0;
    const mouse = { x: -9999, y: -9999, on: false };
    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = GAP / 2; y < h; y += GAP) for (let x = GAP / 2; x < w; x += GAP) dots.push({ x, y, ox: 0, oy: 0, vx: 0, vy: 0, s: 0, vs: 0 });
      draw();
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const r = 1.1 + d.s * 2.2;
        ctx.globalAlpha = 0.16 + d.s * 0.6;
        ctx.fillStyle = d.s > 0.05 ? '#13305f' : '#0b1f44';
        ctx.beginPath(); ctx.arc(d.x + d.ox, d.y + d.oy, r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const R = 150;
    const tick = () => {
      let moving = false;
      for (const d of dots) {
        let tx = 0, ty = 0, ts = 0;
        if (mouse.on) {
          const dx = d.x - mouse.x, dy = d.y - mouse.y, dist = Math.hypot(dx, dy);
          if (dist < R) { const f = 1 - dist / R; const push = f * f * 22; tx = (dx / (dist || 1)) * push; ty = (dy / (dist || 1)) * push; ts = f; }
        }
        // spring toward target offset (k .14, damping .78)
        d.vx = (d.vx + (tx - d.ox) * 0.14) * 0.78; d.ox += d.vx;
        d.vy = (d.vy + (ty - d.oy) * 0.14) * 0.78; d.oy += d.vy;
        d.vs = (d.vs + (ts - d.s) * 0.14) * 0.78; d.s += d.vs;
        if (Math.abs(d.vx) + Math.abs(d.vy) + Math.abs(d.vs) > 0.01 || Math.abs(d.ox) > 0.05) moving = true;
      }
      draw();
      raf = (moving || mouse.on) && visible ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf && !RM) raf = requestAnimationFrame(tick); };
    build();
    addEventListener('resize', () => { clearTimeout(build._t); build._t = setTimeout(build, 150); });
    if (FINE && !RM) {
      hero.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; kick(); });
      hero.addEventListener('pointerleave', () => { mouse.on = false; kick(); });
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
    if (MOTION) G.from(canvas, { opacity: 0, duration: 1.6, ease: 'power2.out', delay: 0.2 });
  })();

  /* ==================================================================
     Hero entrance — one choreographed moment
     ================================================================== */
  const heroTitle = $('[data-hero-split]');
  const heroWords = heroTitle ? splitRich(heroTitle, 'hw') : [];
  const heroBits = $$('[data-hero]');
  const halo = $('.halo'), ring = $('.ring'), headshot = $('.headshot'), chips = $$('.chip');

  if (MOTION) {
    G.set(heroWords, { yPercent: 110 });
    G.set(heroBits, { opacity: 0, y: 18 });
    G.set(halo, { scale: 0.86, opacity: 0 });
    G.set(ring, { opacity: 0 });
    G.set(headshot, { opacity: 0, y: 40 });
    G.set(chips, { opacity: 0, scale: 0.92, y: 12 });
    const kpiCounts = $$('.kpis [data-count]');
    kpiCounts.forEach((el) => { el.textContent = '0'; });
    const tl = G.timeline({ delay: 0.15 });
    // Lead: the headline, gaps between words shrink as it goes
    tl.to(heroBits[0], { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0)
      .to(heroWords, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: { amount: 0.42, ease: 'power2.out' } }, 0.08)
      // Support: portrait arrives with the headline
      .to(halo, { scale: 1, opacity: 1, duration: 1.4, ease: 'expo.out' }, 0.15)
      .to(headshot, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out' }, 0.3)
      .to(ring, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.5)
      .to($$('.hero-copy [data-hero]').slice(1), { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.5)
      // Decoration: chips and figures last
      .to(chips, { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: { amount: 0.25 } }, 0.75)
      .to($$('.kpis [data-hero]'), { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: { amount: 0.24, ease: 'power2.out' } }, 0.85)
      .add(() => kpiCounts.forEach(runCount), 0.9);
  }

  // Chips drift with the pointer on springs (decorative, fine pointers only)
  if (MOTION && FINE) {
    const sx = makeSpring(0.07, 0.82), sy = makeSpring(0.07, 0.82);
    let raf = 0;
    const loop = () => {
      const x = sx.step(), y = sy.step();
      chips.forEach((c) => { const k = parseFloat(c.dataset.depth || '1'); c.style.translate = `${x * 14 * k}px ${y * 12 * k}px`; });
      headshot.style.translate = `${x * -6}px ${y * -4}px`;
      raf = sx.settled() && sy.settled() ? 0 : requestAnimationFrame(loop);
    };
    $('.hero').addEventListener('pointermove', (e) => {
      sx.t = e.clientX / innerWidth - 0.5; sy.t = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  }

  /* ==================================================================
     Scroll choreography
     ================================================================== */
  if (MOTION) {
    G.to('.hero-visual', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    G.to('.hero-copy', { yPercent: 8, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });

    // Band leans into scroll velocity, then settles
    const row = $('.band-row');
    const skew = G.quickTo(row, 'skewX', { duration: 0.6, ease: 'power3.out' });
    let settle;
    ST.create({ trigger: '.band', start: 'top bottom', end: 'bottom top', onUpdate: (s) => { skew(clamp(s.getVelocity() / -300, -10, 10)); clearTimeout(settle); settle = setTimeout(() => skew(0), 140); } });
    G.to(row, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // Section headings rise word by word
  $$('[data-split]').forEach((el) => {
    const words = splitRich(el, 'sw');
    if (!MOTION) return;
    G.from(words, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: { amount: 0.3, ease: 'power2.out' }, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  // Reading text brightens as you scroll through it
  $$('[data-words]').forEach((el) => {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(' ').map((w) => `<span aria-hidden="true" style="display:inline-block">${esc(w)}</span>`).join(' ');
    if (!MOTION) return;
    G.fromTo(el.children, { opacity: 0.18 }, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: true } });
  });
  if (MOTION) {
    $$('[data-reveal]').forEach((el) => G.from(el, { y: 28, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
    G.from('.cap', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: { amount: 0.3, ease: 'power2.out' }, scrollTrigger: { trigger: '.cap-grid', start: 'top 85%', once: true } });
    G.from('.tools', { opacity: 0, duration: 0.8, scrollTrigger: { trigger: '.tools', start: 'top 95%', once: true } });
    G.from('.card', { x: 90, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: { amount: 0.35, ease: 'power2.out' }, scrollTrigger: { trigger: '.carousel', start: 'top 88%', once: true } });
    G.from('.ap-frame', { clipPath: 'inset(100% 0% 0% 0% round 28px)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: '.about-photo', start: 'top 80%', once: true } });
    G.from('.ap-back', { x: -20, y: -20, opacity: 0, duration: 1.2, ease: 'expo.out', delay: 0.5, scrollTrigger: { trigger: '.about-photo', start: 'top 80%', once: true } });
    G.from('.ap-frame img', { scale: 1.25, duration: 1.9, ease: 'expo.out', scrollTrigger: { trigger: '.about-photo', start: 'top 80%', once: true } });
  }
  // Counters outside the hero
  $$('[data-count]').forEach((el) => {
    if (el.closest('.kpis')) return;
    if (!MOTION) return;
    const dec = parseInt(el.dataset.decimals || '0', 10);
    el.textContent = (0).toFixed(dec);
    ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => runCount(el) });
  });
  // Results: bars fill as each row arrives
  $$('.r-row:not(.r-head)').forEach((row) => {
    if (!HAS_G) { row.classList.add('is-in'); return; }
    ST.create({ trigger: row, start: 'top 90%', once: true, onEnter: () => row.classList.add('is-in') });
    if (MOTION) G.from(row, { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: row, start: 'top 92%', once: true } });
  });

  /* ==================================================================
     Ventures — sticky index follows the panel in view
     ================================================================== */
  const vLinks = $$('.v-index a');
  const vPanels = $$('.venture');
  const indicator = $('.v-indicator');
  const vNow = $('.vc-now');
  const setVenture = (i) => {
    vLinks.forEach((a, k) => a.classList.toggle('is-active', k === i));
    const a = vLinks[i];
    if (a && indicator) {
      const li = a.parentElement;
      indicator.style.height = `${li.offsetHeight}px`;
      indicator.style.transform = `translateY(${li.offsetTop}px)`;
    }
    if (vNow) vNow.textContent = String(i + 1).padStart(2, '0');
  };
  setVenture(0);
  addEventListener('resize', () => setVenture(Math.max(0, vLinks.findIndex((a) => a.classList.contains('is-active')))));
  if (HAS_G) {
    vPanels.forEach((p, i) => ST.create({ trigger: p, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => { if (s.isActive) setVenture(i); } }));
  }
  if (MOTION) {
    vPanels.forEach((p) => {
      G.from(p, { clipPath: 'inset(10% 5% 0% 5% round 28px)', y: 70, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
      G.from(p.children, { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: { amount: 0.35, ease: 'power2.out' }, scrollTrigger: { trigger: p, start: 'top 75%', once: true } });
    });
    G.from('.tif-mark span', { yPercent: 60, opacity: 0, rotate: -6, duration: 1.3, ease: 'expo.out', stagger: { amount: 0.25 }, scrollTrigger: { trigger: '.tif-mark', start: 'top 85%', once: true } });
  }

  // Zero → App → Viral: a signal travels the route while the panel is on screen
  (() => {
    const svg = $('.flow-svg');
    if (!svg) return;
    const path = $('.flow-line', svg), dot = $('.flow-dot', svg);
    const len = path.getTotalLength();
    const place = (p) => { const pt = path.getPointAtLength(p * len); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); };
    place(0);
    if (RM) { place(0.5); return; }
    let raf = 0, t0 = 0, on = false;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // moving on screen: ease-in-out
    const loop = (now) => {
      if (!t0) t0 = now;
      const t = ((now - t0) / 3200) % 1;
      place(ease(t));
      path.style.strokeDashoffset = String(-(now / 40) % 20);
      raf = on ? requestAnimationFrame(loop) : 0;
    };
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on && !raf) raf = requestAnimationFrame(loop); }).observe(svg);
  })();

  // Kampo network: edges draw, nodes pop, the hub keeps a slow pulse
  (() => {
    const g = $('.graph svg');
    if (!g) return;
    const hub = $('.g-hub', g);
    const pulse = hub.cloneNode();
    pulse.setAttribute('class', 'g-pulse');
    hub.parentNode.insertBefore(pulse, hub);
    if (!MOTION) return;
    const edges = $$('.g-edges line', g);
    edges.forEach((l) => { const L = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value); l.style.strokeDasharray = L; l.style.strokeDashoffset = L; });
    const nodes = $$('.g-nodes circle:not(.g-pulse)', g);
    G.set(nodes, { scale: 0.3, opacity: 0, transformOrigin: '50% 50%', transformBox: 'fill-box' });
    ST.create({
      trigger: g, start: 'top 80%', once: true,
      onEnter: () => {
        G.to(nodes, { scale: 1, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: { amount: 0.4, from: 'start' } });
        G.to(edges, { strokeDashoffset: 0, duration: 1.2, ease: 'expo.inOut', stagger: { amount: 0.5 }, delay: 0.15 });
      },
    });
  })();

  /* ==================================================================
     Carousel — drag 1:1 with momentum (mouse), native swipe on touch
     ================================================================== */
  (() => {
    const car = $('.carousel');
    if (!car) return;
    const imgs = $$('.card-img:not(.card-img--light) img', car);
    let pr = 0;
    const parallax = () => {
      pr = 0;
      const vw = innerWidth;
      imgs.forEach((im) => {
        const r = im.parentElement.getBoundingClientRect();
        const off = clamp((r.left + r.width / 2 - vw / 2) / vw, -1, 1);
        im.style.transform = `translateX(${off * -5}%)`;
      });
    };
    if (!RM) { car.addEventListener('scroll', () => { if (!pr) pr = requestAnimationFrame(parallax); }, { passive: true }); parallax(); }

    let down = false, moved = false, sx = 0, sl = 0, lastX = 0, lastT = 0, vel = 0, mom = 0;
    car.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return; // touch uses native scrolling
      down = true; moved = false; sx = e.clientX; sl = car.scrollLeft; lastX = e.clientX; lastT = performance.now(); vel = 0;
      cancelAnimationFrame(mom);
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; car.classList.add('is-dragging'); }
      if (!moved) return;
      car.scrollLeft = sl - dx; // tracks the pointer 1:1
      const now = performance.now();
      vel = (e.clientX - lastX) / Math.max(now - lastT, 1);
      lastX = e.clientX; lastT = now;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      // carry the release speed, decay with friction
      let v = -vel * 16;
      const glide = () => {
        car.scrollLeft += v; v *= 0.94;
        if (Math.abs(v) > 0.4 && !RM) mom = requestAnimationFrame(glide);
        else car.classList.remove('is-dragging');
      };
      mom = requestAnimationFrame(glide);
    });
    car.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    $$('.car-btn').forEach((b) => b.addEventListener('click', () => {
      const card = $('.card', car);
      const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle($('.car-track', car)).columnGap || '20');
      car.scrollBy({ left: step * Number(b.dataset.dir), behavior: RM ? 'auto' : 'smooth' });
    }));
  })();

  /* ───────── Tag cursor ───────── */
  if (FINE && !RM) {
    root.classList.add('has-tag');
    const tag = $('.tag-cursor'), label = $('span', tag);
    const sx = makeSpring(0.2, 0.65), sy = makeSpring(0.2, 0.65);
    let raf = 0;
    const loop = () => { tag.style.transform = `translate(${sx.step()}px, ${sy.step()}px)`; raf = sx.settled() && sy.settled() ? 0 : requestAnimationFrame(loop); };
    addEventListener('pointermove', (e) => { sx.t = e.clientX; sy.t = e.clientY; if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor]');
      const txt = t ? (e.target.closest('.card-img') ? 'View' : t.dataset.cursor) : '';
      tag.classList.toggle('is-on', !!txt);
      if (txt) label.textContent = txt;
    });
    addEventListener('pointerdown', () => tag.classList.add('is-down'));
    addEventListener('pointerup', () => tag.classList.remove('is-down'));
  }

  /* ───────── Magnetic buttons ───────── */
  if (MOTION && FINE) {
    $$('[data-magnetic]').forEach((el) => {
      const xTo = G.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
      const yTo = G.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.3); yTo((e.clientY - r.top - r.height / 2) * 0.3); });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ───────── Nav: solid once scrolled, hides going down ───────── */
  const nav = $('#nav'), prog = $('.progress i');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-solid', y > 20);
    if (y > lastY + 4 && y > innerHeight && !root.classList.contains('lock')) nav.classList.add('is-hidden');
    else if (y < lastY - 4 || y < innerHeight * 0.5) nav.classList.remove('is-hidden');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav-links a');
  const setCurrent = (id) => navLinks.forEach((a) => (a.getAttribute('href') === '#' + id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  if (HAS_G) ['ventures', 'expertise', 'design', 'about'].forEach((id) => ST.create({
    trigger: '#' + id, start: 'top 50%', end: 'bottom 50%',
    onToggle: (s) => { if (s.isActive) setCurrent(id); else if ($(`.nav-links a[href="#${id}"]`).hasAttribute('aria-current')) setCurrent(''); },
  }));

  /* ───────── Anchor navigation ───────── */
  const menuBtn = $('.menu-btn'), menu = $('#menu');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
    menu.toggleAttribute('inert', !open);
    menu.setAttribute('aria-hidden', String(!open));
    $('main').toggleAttribute('inert', open); $('.foot').toggleAttribute('inert', open);
    lockScroll(open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
  matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches && menu.classList.contains('open')) setMenu(false); });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id && id !== 'top' ? document.getElementById(id) : null;
    if (id && id !== 'top' && !el) return;
    e.preventDefault();
    if (menu.classList.contains('open')) setMenu(false);
    const y = el ? el.getBoundingClientRect().top + window.scrollY - (el.classList.contains('venture') ? navH() + 24 : 0) : 0;
    if (lenis) lenis.scrollTo(y, { duration: 1.4, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
  });

  /* ==================================================================
     Lightbox — each project is its own set
     ================================================================== */
  const lb = $('#lightbox');
  if (lb && typeof lb.showModal === 'function') {
    const stage = $('.lb-stage', lb), img = $('.lb-img', lb), cap = $('.lb-caption-text', lb), count = $('.lb-count', lb);
    let items = [], idx = 0, closing = false, suppress = false;
    const show = () => {
      const it = items[idx];
      img.src = it.src; img.alt = it.alt; cap.textContent = it.caption;
      count.textContent = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
      [-1, 1].forEach((d) => { const n = items[(idx + d + items.length) % items.length]; if (n) new Image().src = n.src; });
    };
    const open = (btn) => {
      const main = $('img', btn);
      items = [{ src: main.currentSrc || main.src, alt: main.alt, caption: btn.dataset.caption || '' }];
      const card = btn.closest('.card');
      if (card) $$('.card-extra img', card).forEach((im) => items.push({ src: im.src, alt: im.alt, caption: im.dataset.caption || '' }));
      idx = 0; closing = false; img.style.transform = ''; img.style.opacity = '';
      lb.toggleAttribute('data-single', items.length < 2);
      show(); lb.showModal(); lockScroll(true);
      requestAnimationFrame(() => requestAnimationFrame(() => lb.setAttribute('data-open', '')));
    };
    const close = () => { if (closing) return; closing = true; lb.removeAttribute('data-open'); setTimeout(() => lb.close(), RM ? 0 : 190); };
    const go = (d) => { if (items.length < 2) return; idx = (idx + d + items.length) % items.length; show(); };
    $$('[data-lightbox]').forEach((b) => b.addEventListener('click', () => open(b)));
    lb.addEventListener('close', () => lockScroll(false));
    lb.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => go(-1));
    $('.lb-next', lb).addEventListener('click', () => go(1));
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } });
    lb.addEventListener('click', (e) => { if (!suppress && (e.target === lb || e.target === stage)) close(); });
    let dragging = false, pid = null, sx = 0, dx = 0, t0 = 0;
    stage.addEventListener('pointerdown', (e) => { if (dragging || !e.isPrimary || items.length < 2) return; dragging = true; pid = e.pointerId; sx = e.clientX; dx = 0; t0 = performance.now(); stage.setPointerCapture(pid); img.classList.remove('is-settling'); img.classList.add('is-dragging'); });
    stage.addEventListener('pointermove', (e) => { if (!dragging || e.pointerId !== pid) return; dx = e.clientX - sx; img.style.transform = `translateX(${dx}px)`; });
    const end = (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false; if (stage.hasPointerCapture(pid)) stage.releasePointerCapture(pid);
      img.classList.remove('is-dragging');
      const dist = Math.abs(dx), v = dist / Math.max(performance.now() - t0, 1);
      if (dist > 6) { suppress = true; setTimeout(() => { suppress = false; }, 0); }
      if (e.type !== 'pointercancel' && (dist >= 70 || (v > 0.11 && dist > 20))) {
        const d = dx < 0 ? 1 : -1; idx = (idx + d + items.length) % items.length; show();
        img.style.transition = 'none'; img.style.transform = `translateX(${d * 48}px)`; img.style.opacity = '0'; void img.offsetWidth;
        img.classList.add('is-settling'); img.style.transition = ''; img.style.transform = ''; img.style.opacity = '';
      } else { img.classList.add('is-settling'); img.style.transform = ''; }
      setTimeout(() => img.classList.remove('is-settling'), 300);
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  /* ───────── Copy buttons ───────── */
  const status = $('#copy-status');
  $$('[data-copy]').forEach((btn) => {
    const label = $('.copy-label', btn);
    let timer;
    const swap = (t) => { label.classList.add('is-swapping'); setTimeout(() => { label.textContent = t; label.classList.remove('is-swapping'); }, 120); };
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy;
      let ok = false;
      try { await navigator.clipboard.writeText(value); ok = true; } catch (_) {
        const ta = document.createElement('textarea'); ta.value = value; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;font-size:16px';
        document.body.append(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (__) { ok = false; } ta.remove();
      }
      swap(ok ? 'Copied ✓' : 'Select it');
      status.textContent = ok ? 'Copied to clipboard' : 'Could not copy automatically; select the text instead';
      clearTimeout(timer); timer = setTimeout(() => { swap('Copy'); status.textContent = ''; }, 1800);
    });
  });

  if (HAS_G) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ST.refresh(); setVenture(Math.max(0, vLinks.findIndex((a) => a.classList.contains('is-active')))); });
    addEventListener('load', () => ST.refresh());
  }
})();

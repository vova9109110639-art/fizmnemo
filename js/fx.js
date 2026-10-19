/* МнемоФизика — движок эффектов: заставка, фон с частицами и формулами, конфетти, звук, наклон карточек, «рябь», счётчики. */
(function () {
  'use strict';
  const FX = (window.FX = {});
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  FX.reduce = reduce;
  FX.pointer = { x: 0, y: 0 };           // -1..1 — для параллакса фона
  FX.last = { x: innerWidth / 2, y: innerHeight / 3 };  // последний клик/касание — откуда лететь конфетти

  /* ---------- звук (WebAudio, по умолчанию выключен) ---------- */
  let actx = null, snd = false;
  try { snd = localStorage.getItem('fm.snd') === '1'; } catch (e) { /* ничего */ }
  FX.soundOn = () => snd;
  FX.setSound = (v) => { snd = !!v; try { localStorage.setItem('fm.snd', snd ? '1' : '0'); } catch (e) { /* ничего */ } if (snd) FX.sfx('click'); return snd; };
  function ac() {
    if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; actx = new A(); }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, t0, dur, type, vol) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.07, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  const SFX = {
    click: () => tone(880, 0, .06, 'triangle', .05),
    move: () => tone(520, 0, .04, 'sine', .03),
    ok: () => { tone(660, 0, .1, 'triangle', .08); tone(990, .09, .16, 'triangle', .08); },
    no: () => { tone(220, 0, .18, 'sawtooth', .045); tone(165, .1, .22, 'sawtooth', .045); },
    combo: (n) => { [0, 1, 2].forEach((i) => tone(660 * Math.pow(1.26, i) * (1 + Math.min(n || 3, 9) * .03), i * .07, .12, 'triangle', .07)); },
    level: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .1, .24, 'triangle', .08)); },
    done: () => { [392, 523, 659].forEach((f, i) => tone(f, i * .12, .26, 'sine', .08)); },
    tick: () => tone(1200, 0, .03, 'square', .02)
  };
  FX.sfx = (name, arg) => { if (!snd) return; try { if (SFX[name]) SFX[name](arg); } catch (e) { /* ничего */ } };

  /* ---------- конфетти ---------- */
  let cv = null, cx = null, parts = [], raf = 0;
  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.id = 'fx'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
    cx = cv.getContext('2d'); size(); addEventListener('resize', size);
  }
  function size() { if (cv) { cv.width = innerWidth; cv.height = innerHeight; } }
  const COLORS = ['#ffffff', '#7db8ff', '#ff7f8f', '#6ee7a5', '#ff9ad5', '#ffd166'];
  FX.burst = (x, y, n, opts) => {
    if (reduce) return; opts = opts || {}; ensure(); n = n || 28;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (opts.speed || 5.5) * (0.35 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 3), g: .2, r: 3 + Math.random() * 4, c: (opts.colors || COLORS)[i % (opts.colors || COLORS).length], life: 55 + Math.random() * 35, rot: Math.random() * 6, vr: (Math.random() - .5) * .45, sq: Math.random() < .5 });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  };
  FX.rain = (n) => {
    if (reduce) return; ensure();
    for (let i = 0; i < (n || 110); i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 260, vx: (Math.random() - .5) * 2.2, vy: 1.5 + Math.random() * 3, g: .045, r: 3 + Math.random() * 4, c: COLORS[i % COLORS.length], life: 230 + Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, sq: Math.random() < .65 });
    if (!raf) raf = requestAnimationFrame(loop);
  };
  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 30);
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= .992; p.rot += p.vr; p.life--;
      cx.save(); cx.globalAlpha = Math.min(1, p.life / 22); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
      if (p.sq) cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { cx.beginPath(); cx.arc(0, 0, p.r / 1.5, 0, 6.3); cx.fill(); }
      cx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(loop); else { raf = 0; cx.clearRect(0, 0, cv.width, cv.height); }
  }

  /* всплывающий текст (+10 XP, КОМБО!) */
  FX.float = (text, x, y, cls) => {
    if (reduce) return;
    const s = document.createElement('span'); s.className = 'ftxt ' + (cls || ''); s.textContent = text;
    s.style.left = Math.max(10, Math.min(innerWidth - 10, x)) + 'px'; s.style.top = y + 'px';
    document.body.appendChild(s); setTimeout(() => s.remove(), 1300);
  };

  /* ---------- плавные счётчики ---------- */
  FX.count = (el, to, dur) => {
    to = +to; if (reduce || !isFinite(to)) { el.textContent = String(to); return; }
    const t0 = performance.now(); dur = dur || 800;
    setTimeout(() => { el.textContent = String(to); }, dur + 250);   // страховка: итог виден, даже если вкладка была в фоне
    (function step(ts) {
      const k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  };
  FX.runCounters = (root) => (root || document).querySelectorAll('[data-count]').forEach((el) => FX.count(el, el.dataset.count));

  /* ---------- наклон карточек и блик ---------- */
  const TILT = '.daily, .tech, .step, .labcard';
  FX.initTilt = () => {
    if (reduce || !(window.matchMedia && matchMedia('(hover: hover)').matches)) return;
    let cur = null;
    const reset = (el) => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest ? e.target.closest(TILT) : null;
      if (cur && cur !== el) { reset(cur); cur = null; }
      if (!el) return;
      cur = el; el.classList.add('tilt-on');
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-py * 9).toFixed(2) + 'deg');
      el.style.setProperty('--mx', ((px + .5) * 100).toFixed(1) + '%'); el.style.setProperty('--my', ((py + .5) * 100).toFixed(1) + '%');
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (cur) { reset(cur); cur = null; } }, true);
  };

  /* ---------- «рябь» на кнопках и запоминание клика ---------- */
  const RIP = '.btn, .ghost, .opt, .rate, .chipb, .tchip, .mcard, .tcard, .seg button, .iconbtn, .labcard';
  FX.initRipple = () => {
    document.addEventListener('pointerdown', (e) => {
      FX.last = { x: e.clientX, y: e.clientY };
      if (reduce) return;
      const el = e.target.closest ? e.target.closest(RIP) : null; if (!el) return;
      const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.1, sp = document.createElement('span');
      sp.className = 'rip'; sp.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
      el.appendChild(sp); setTimeout(() => sp.remove(), 700);
    }, { passive: true });
    document.addEventListener('pointermove', (e) => { FX.pointer.x = (e.clientX / innerWidth) * 2 - 1; FX.pointer.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  };

  /* ---------- заставка загрузки в духе стартового экрана консоли ---------- */
  FX.boot = () => {
    let seen = false; try { seen = sessionStorage.getItem('fm.boot') === '1'; } catch (e) { /* ничего */ }
    if (seen || reduce) return;
    try { sessionStorage.setItem('fm.boot', '1'); } catch (e) { /* ничего */ }
    const b = document.createElement('div'); b.id = 'boot';
    const orb = (rot, dur) => '<g transform="rotate(' + rot + ' 100 100)"><ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/><circle r="5" fill="#fff"><animateMotion dur="' + dur + 's" repeatCount="indefinite" path="M18,100 a82,30 0 1,0 164,0 a82,30 0 1,0 -164,0"/></circle></g>';
    b.innerHTML = '<div class="boot-in"><svg viewBox="0 0 200 200" class="atom" aria-hidden="true">' + orb(0, 2.2) + orb(60, 2.8) + orb(120, 3.4) + '<circle cx="100" cy="100" r="9" fill="#fff" class="nuc"/></svg>' +
      '<div class="boot-t">' + 'МнемоФизика'.split('').map((ch, i) => '<span style="--i:' + i + '">' + ch + '</span>').join('') + '</div><div class="boot-s">физика 7–8 класс · мнемоника</div><div class="boot-bar"><i></i></div></div>';
    document.body.appendChild(b);
    const kill = () => { if (!b.isConnected) return; b.classList.add('out'); setTimeout(() => b.remove(), 650); };
    b.addEventListener('click', kill); setTimeout(kill, 2100);
    FX.sfx('level');
  };

  /* ---------- фон: шёлковые волны + искры + плавающие символы физики ---------- */
  FX.background = () => {
    const el = document.getElementById('wave'); if (!el || !el.getContext) return;
    const ctx = el.getContext('2d');
    const L = [{ a: .07, f: 1.1, s: .22, y: .40, al: .20 }, { a: .085, f: .8, s: -.16, y: .50, al: .16 }, { a: .055, f: 1.5, s: .3, y: .60, al: .15 }, { a: .1, f: .65, s: .11, y: .70, al: .11 }];
    const GL = ['ρ', 'Δ', 'η', 'λ', 'π', 'Σ', 'Ω', 'v', 'F', 'Q', 'μ', 'φ', 'α', '√', 'g', 'U', 'I', 'R', 'p', 'm'];
    let w = 0, h = 0, last = 0, px = 0, py = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const sparks = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(1.5, 5), vy: rnd(.012, .05), a: rnd(.15, .5), tw: rnd(0, 6) }));
    const glyphs = Array.from({ length: 13 }, (_, i) => ({ ch: GL[i % GL.length], x: Math.random(), y: Math.random(), s: rnd(15, 40), vy: rnd(.008, .022), a: rnd(.05, .13), rot: rnd(-.5, .5), vr: rnd(-.08, .08) }));
    function sz() { w = el.width = Math.max(320, Math.floor(innerWidth / 2)); h = el.height = Math.max(240, Math.floor(innerHeight / 2)); }
    function draw(t, dt) {
      ctx.clearRect(0, 0, w, h);
      px += (FX.pointer.x - px) * .04; py += (FX.pointer.y - py) * .04;
      ctx.globalCompositeOperation = 'source-over';
      L.forEach((l, i) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const n = x / Math.max(w, h * 1.7), y = h * (l.y + py * .02 * (i + 1) + l.a * Math.sin(n * 6.283 * l.f + t * l.s * 2 + i * 1.7 + px * .9) + l.a * .55 * Math.sin(n * 6.283 * l.f * 2.3 - t * l.s * 1.4 + i));
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,255,255,' + (l.al + .22) + ')'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, h * (l.y - l.a), 0, h); g.addColorStop(0, 'rgba(255,255,255,' + l.al + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fill();
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      glyphs.forEach((g) => {
        g.y -= g.vy * dt; g.rot += g.vr * dt; if (g.y < -.08) { g.y = 1.08; g.x = Math.random(); }
        ctx.save(); ctx.translate(g.x * w + px * 10 * (g.s / 30), g.y * h); ctx.rotate(g.rot);
        ctx.font = 'italic ' + g.s + 'px "Cambria Math","Times New Roman",serif'; ctx.fillStyle = 'rgba(255,255,255,' + g.a + ')'; ctx.fillText(g.ch, 0, 0); ctx.restore();
      });
      ctx.globalCompositeOperation = 'lighter';
      sparks.forEach((s) => {
        s.y -= s.vy * dt; if (s.y < -.05) { s.y = 1.05; s.x = Math.random(); }
        const a = s.a * (.55 + .45 * Math.sin(t * 1.6 + s.tw)), x = s.x * w + px * 14, y = s.y * h, gr = ctx.createRadialGradient(x, y, 0, x, y, s.r * 3);
        gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s.r * 3, 0, 6.283); ctx.fill();
      });
    }
    function frame(ts) {
      if (!document.hidden && ts - last > 40) { const dt = Math.min(.1, (ts - last) / 1000); last = ts; draw(ts / 1000, dt); }
      requestAnimationFrame(frame);
    }
    sz(); draw(3, .016);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { sz(); draw(3, .016); }, 150); });
    if (!reduce) requestAnimationFrame(frame);
  };
})();

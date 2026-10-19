/* МнемоФизика — «Лаборатория»: 9 интерактивных опытов. Каждый опыт: mount({stage, ctl, out}) → функция очистки. */
(function () {
  'use strict';
  const LAB = (window.LAB = { sims: [] });
  const U = () => FM.util;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dec = (step) => (String(step).split('.')[1] || '').length;
  const num = (x, d) => (+(+x).toFixed(d == null ? 2 : d)).toString().replace('.', ',');
  const rad = (d) => (d * Math.PI) / 180;

  /* ползунок: возвращает HTML */
  const slider = (id, label, min, max, step, val, unit) =>
    '<label class="sl"><span>' + label + ' <b id="' + id + '-v">' + num(val, dec(step)) + '</b> ' + unit + '</span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></label>';
  /* читает значения ползунков и подписи */
  function bind(ctl, ids, on) {
    const get = () => Object.fromEntries(ids.map((id) => [id, +ctl.querySelector('#' + id).value]));
    ids.forEach((id) => {
      const inp = ctl.querySelector('#' + id), out = ctl.querySelector('#' + id + '-v'), d = dec(inp.step);
      inp.addEventListener('input', () => { out.textContent = num(inp.value, d); on(get(), id); if (window.FX) FX.sfx('move'); });
    });
    return get;
  }
  function loop(fn) {
    let alive = true, raf = 0, last = performance.now();
    const step = (ts) => { if (!alive) return; const dt = Math.min(0.05, (ts - last) / 1000); last = ts; fn(dt, ts / 1000); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }
  const svg = (w, h, inner) => '<svg viewBox="0 0 ' + w + ' ' + h + '" class="svg" role="img" aria-label="опыт">' + inner + '</svg>';
  const defs = '<defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd4ff" stop-opacity=".75"/><stop offset="1" stop-color="#2a7fe0" stop-opacity=".85"/></linearGradient>' +
    '<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>';
  const set = (el, o) => { for (const k in o) el.setAttribute(k, o[k]); };

  const add = (s) => LAB.sims.push(s);

  /* ============ 1. Скорость и путь ============ */
  add({
    id: 'speed', icon: '⚽', name: 'Скорость и путь', fid: 'speed', formula: 's = v·t',
    tip: 'Растяни время — путь вырастет. Увеличь скорость — мячик добежит дальше за то же время. Это и есть s = v·t.',
    mount(c) {
      const W = 640, H = 280, MAXS = 200, X0 = 40, X1 = W - 40, X = (s) => X0 + (s / MAXS) * (X1 - X0);
      let ticks = '';
      for (let s = 0; s <= MAXS; s += 20) ticks += '<line x1="' + X(s) + '" y1="170" x2="' + X(s) + '" y2="184" stroke="#fff" opacity=".7"/><text x="' + X(s) + '" y="204" text-anchor="middle" fill="#fff" opacity=".8" font-size="13">' + s + '</text>';
      c.stage.innerHTML = svg(W, H, defs + '<rect x="' + (X0 - 20) + '" y="120" width="' + (X1 - X0 + 40) + '" height="50" rx="10" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.4)"/>' + ticks +
        '<text x="' + X1 + '" y="232" text-anchor="end" fill="#fff" opacity=".7" font-size="13">путь, м</text>' +
        '<line id="trail" x1="' + X(0) + '" y1="145" x2="' + X(0) + '" y2="145" stroke="#ffd166" stroke-width="4" stroke-linecap="round" opacity=".9"/>' +
        '<text id="flag" y="112" font-size="30" text-anchor="middle">🏁</text><g id="ball"><text font-size="34" text-anchor="middle" dy="12">⚽</text></g><text id="live" x="' + W / 2 + '" y="48" text-anchor="middle" fill="#fff" font-size="22" opacity=".95"></text>');
      c.ctl.innerHTML = slider('v', 'Скорость v', 1, 20, 1, 6, 'м/с') + slider('t', 'Время t', 1, 10, 1, 5, 'с') + '<button class="btn" id="go">▶ Запуск</button>';
      const q = (s) => c.stage.querySelector(s), ball = q('#ball'), trail = q('#trail'), flag = q('#flag'), live = q('#live');
      let tau = 0, run = false, el = 0, v = 6, t = 5;
      const show = () => {
        const s = v * Math.min(tau, t);
        ball.setAttribute('transform', 'translate(' + X(s) + ',145) rotate(' + (s * 9) + ')'); set(trail, { x2: X(s) });
        flag.setAttribute('x', X(v * t)); live.textContent = run || tau > 0 ? 'τ = ' + num(Math.min(tau, t), 1) + ' с   s = ' + num(s, 1) + ' м' : '';
        c.out.innerHTML = U().math('s = v·t = ' + v + '·' + t + ' = ' + v * t) + ' <span class="u">м</span>';
      };
      const get = bind(c.ctl, ['v', 't'], (g) => { v = g.v; t = g.t; tau = 0; run = false; show(); });
      c.ctl.querySelector('#go').onclick = () => { tau = 0; el = 0; run = true; };
      show();
      return loop((dt) => { if (!run) return; el += dt; const D = clamp(t * 0.5, 1.4, 4.5); tau = t * (el / D); if (tau >= t) { tau = t; run = false; } show(); });
    }
  });

  /* ============ 2. Закон Ома ============ */
  add({
    id: 'ohm', icon: '💡', name: 'Закон Ома', fid: 'ohm', formula: 'I = U/R',
    tip: 'Больше напряжение — лампа ярче и «электроны» бегут быстрее. Больше сопротивление — ток слабее. Как вода в трубе: напор и узкое место.',
    mount(c) {
      const W = 640, H = 300, x1 = 90, y1 = 60, x2 = 550, y2 = 250, w = x2 - x1, h = y2 - y1, P = 2 * (w + h);
      const at = (u) => { let d = (((u % 1) + 1) % 1) * P; if (d < w) return [x1 + d, y1]; d -= w; if (d < h) return [x2, y1 + d]; d -= h; if (d < w) return [x2 - d, y2]; d -= w; return [x1, y2 - d]; };
      let zig = 'M250,60'; for (let i = 0; i < 8; i++) zig += ' l' + 17 + ',' + (i % 2 ? 14 : -14); zig += ' L390,60';
      const dots = Array.from({ length: 30 }, (_, i) => '<circle class="el" r="4.2" cx="0" cy="0" fill="#7fd4ff"/>').join('');
      c.stage.innerHTML = svg(W, H, defs + '<rect x="' + x1 + '" y="' + y1 + '" width="' + w + '" height="' + h + '" rx="16" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>' +
        '<rect x="236" y="42" width="168" height="36" fill="#0a1f4a" opacity=".9"/><path d="' + zig + '" fill="none" stroke="#ffd166" stroke-width="4" stroke-linejoin="round"/><text x="320" y="34" text-anchor="middle" fill="#fff" font-size="15">резистор R</text>' +
        '<rect x="72" y="112" width="36" height="86" fill="#0a1f4a" opacity=".9"/><line x1="80" y1="125" x2="80" y2="185" stroke="#fff" stroke-width="4"/><line x1="100" y1="140" x2="100" y2="170" stroke="#fff" stroke-width="9"/><text x="52" y="160" text-anchor="end" fill="#fff" font-size="15">U</text>' +
        '<circle id="glow" cx="' + x2 + '" cy="155" r="62" fill="#ffd166" opacity=".3"/><circle cx="' + x2 + '" cy="155" r="30" fill="#0a1f4a" stroke="#fff" stroke-width="3"/><circle id="bulb" cx="' + x2 + '" cy="155" r="22" fill="#ffd166" opacity=".5"/><text x="' + (x2 + 46) + '" y="160" fill="#fff" font-size="15">лампа</text>' + dots +
        '<text id="amp" x="' + W / 2 + '" y="152" text-anchor="middle" fill="#fff" font-size="30" font-weight="300"></text>');
      c.ctl.innerHTML = slider('u', 'Напряжение U', 1, 24, 1, 12, 'В') + slider('r', 'Сопротивление R', 1, 50, 1, 6, 'Ом');
      const els = [...c.stage.querySelectorAll('.el')], bulb = c.stage.querySelector('#bulb'), glow = c.stage.querySelector('#glow'), amp = c.stage.querySelector('#amp');
      let U_ = 12, R_ = 6, ph = 0;
      const upd = () => {
        const I = U_ / R_, br = clamp(I / 3.5, 0.06, 1);
        bulb.setAttribute('opacity', (0.2 + br * 0.8).toFixed(2)); glow.setAttribute('opacity', (br * 0.55).toFixed(2)); glow.setAttribute('r', (30 + br * 46).toFixed(1));
        amp.textContent = 'I = ' + num(I, 2) + ' А';
        c.out.innerHTML = U().math('I = {U|R} = {' + U_ + '|' + R_ + '} = ' + num(I, 2)) + ' <span class="u">А</span><div class="mini">P = U·I = ' + num(U_ * I, 1) + ' Вт</div>';
        return I;
      };
      bind(c.ctl, ['u', 'r'], (g) => { U_ = g.u; R_ = g.r; upd(); });
      upd();
      return loop((dt) => { const I = U_ / R_; ph += dt * (0.015 + Math.min(I, 12) * 0.03); els.forEach((e, i) => { const p = at(ph + i / els.length); e.setAttribute('cx', p[0].toFixed(1)); e.setAttribute('cy', p[1].toFixed(1)); }); });
    }
  });

  /* ============ 3. Сила Архимеда ============ */
  add({
    id: 'archimedes', icon: '🛁', name: 'Плавание тел', fid: 'archimedes', formula: 'F_А = ρ_ж·g·V_т',
    tip: 'Кто легче воды — всплывает, кто тяжелее — тонет. Стрелки показывают борьбу: тяжесть вниз, Архимед вверх.',
    mount(c) {
      const W = 640, H = 320, TX = 200, TW = 240, TY = 30, TB = 290, WL = 90, B = 70;
      c.stage.innerHTML = svg(W, H, defs + '<rect id="blk" x="' + (320 - B / 2) + '" y="40" width="' + B + '" height="' + B + '" rx="8" fill="#9aa4b5" stroke="#fff" stroke-width="2.5"/><text id="blkt" x="320" y="82" text-anchor="middle" fill="#0a1f4a" font-size="15" font-weight="700"></text>' +
        '<rect id="wat" x="' + TX + '" y="' + WL + '" width="' + TW + '" height="' + (TB - WL) + '" fill="url(#gw)" opacity=".8"/><path id="surf" d="" fill="none" stroke="#fff" stroke-width="2.5" opacity=".8"/>' +
        '<path d="M' + TX + ',' + TY + ' L' + TX + ',' + TB + ' L' + (TX + TW) + ',' + TB + ' L' + (TX + TW) + ',' + TY + '" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
        '<line id="fg" x1="500" y1="150" x2="500" y2="150" stroke="#ff7f8f" stroke-width="7" marker-end="url(#ah)"/><text id="fgt" x="515" y="150" fill="#ff7f8f" font-size="15"></text>' +
        '<line id="fa" x1="570" y1="150" x2="570" y2="150" stroke="#6ee7a5" stroke-width="7" marker-end="url(#ah)"/><text id="fat" x="585" y="150" fill="#6ee7a5" font-size="15"></text>' +
        '<text x="500" y="300" fill="#ff7f8f" font-size="14">тяжесть</text><text x="555" y="300" fill="#6ee7a5" font-size="14">Архимед</text><text id="verd" x="320" y="22" text-anchor="middle" fill="#fff" font-size="20" font-weight="600"></text>');
      c.ctl.innerHTML = slider('rt', 'Плотность тела ρ_т', 200, 3000, 50, 600, 'кг/м³') +
        '<div class="presets"><button class="ghost sm" data-p="600">Дерево 600</button><button class="ghost sm" data-p="900">Лёд 900</button><button class="ghost sm" data-p="1000">Вода 1000</button><button class="ghost sm" data-p="2500">Камень 2500</button></div>' +
        slider('rl', 'Плотность жидкости ρ_ж', 700, 1400, 50, 1000, 'кг/м³');
      const q = (s) => c.stage.querySelector(s), blk = q('#blk'), blkt = q('#blkt'), wat = q('#wat'), surf = q('#surf'), fg = q('#fg'), fa = q('#fa'), fgt = q('#fgt'), fat = q('#fat'), verd = q('#verd');
      let rt = 600, rl = 1000, y = 40, tgt = 40, sub = 0.6, T = 0;
      const V = 0.002;
      const upd = () => {
        const g = 10, Fg = rt * V * g;
        let state;
        if (Math.abs(rt - rl) <= rl * 0.01) { sub = 1; tgt = (WL + TB - B) / 2 - 10; state = 'плавает внутри'; }
        else if (rt < rl) { sub = rt / rl; tgt = WL - B + B * sub; state = 'всплывает'; }
        else { sub = 1; tgt = TB - B - 2; state = 'тонет'; }
        const Fa = rl * g * V * sub;
        blk.setAttribute('fill', 'hsl(215 ' + clamp(15 + (3000 - rt) / 60, 10, 60) + '% ' + clamp(78 - rt / 60, 28, 74) + '%)'); blkt.textContent = rt;
        wat.setAttribute('fill', 'hsl(' + (205 + (rl - 1000) / 25) + ' 85% ' + (55 - (rl - 700) / 28) + '%)');
        const L1 = Fg * 1.4 + 12, L2 = Fa * 1.4 + 12;
        set(fg, { y2: 150 + L1 }); set(fa, { y2: 150 - L2 }); fgt.textContent = num(Fg, 0) + ' Н'; fat.textContent = num(Fa, 0) + ' Н'; fgt.setAttribute('y', 156 + L1); fat.setAttribute('y', 146 - L2);
        verd.textContent = state;
        c.out.innerHTML = U().math('F_(А) = ρ_(ж)·g·V_(т) = ' + rl + '·10·' + num(V * sub, 4) + ' = ' + num(Fa, 1)) + ' <span class="u">Н</span><div class="mini">F_тяж = ρ_т·V·g = ' + num(Fg, 1) + ' Н → ' + state + '</div>';
      };
      const get = bind(c.ctl, ['rt', 'rl'], (g) => { rt = g.rt; rl = g.rl; upd(); });
      c.ctl.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { const s = c.ctl.querySelector('#rt'); s.value = b.dataset.p; s.dispatchEvent(new Event('input')); }));
      upd();
      return loop((dt, ts) => {
        T = ts; y += (tgt - y) * Math.min(1, dt * 5);
        const bob = Math.abs(rt - rl) <= rl * 0.01 || rt < rl ? Math.sin(ts * 2.4) * 1.6 : 0;
        set(blk, { y: (y + bob).toFixed(1) }); blkt.setAttribute('y', (y + bob + B / 2 + 5).toFixed(1));
        let d = 'M' + TX + ',' + WL; for (let x = 0; x <= TW; x += 12) d += ' L' + (TX + x) + ',' + (WL + Math.sin(ts * 2 + x / 22) * 2.4).toFixed(1); surf.setAttribute('d', d);
      });
    }
  });

  /* ============ 4. Рычаг ============ */
  add({
    id: 'lever', icon: '⚖️', name: 'Рычаг и качели', fid: 'lever', formula: 'F₁·l₁ = F₂·l₂',
    tip: 'Равновесие, когда «сила × плечо» слева и справа поровну. Тяжёлого сажай ближе к опоре, лёгкого — дальше. Нажми «Уравновесить»!',
    mount(c) {
      const W = 640, H = 300, CX = 320, CY = 190, K = 120;
      c.stage.innerHTML = svg(W, H, defs + '<polygon points="' + CX + ',' + CY + ' ' + (CX - 38) + ',' + (CY + 80) + ' ' + (CX + 38) + ',' + (CY + 80) + '" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-width="3"/><line x1="40" y1="' + (CY + 80) + '" x2="600" y2="' + (CY + 80) + '" stroke="rgba(255,255,255,.5)" stroke-width="3"/>' +
        '<g id="beam"><rect x="' + (CX - 250) + '" y="' + (CY - 7) + '" width="500" height="14" rx="7" fill="#e8f0ff" stroke="#fff"/><g id="w1"></g><g id="w2"></g></g><circle cx="' + CX + '" cy="' + CY + '" r="8" fill="#ffd166" stroke="#fff" stroke-width="2"/><text id="verd" x="320" y="40" text-anchor="middle" fill="#fff" font-size="22" font-weight="600"></text>');
      c.ctl.innerHTML = slider('f1', 'Сила F₁', 10, 100, 5, 60, 'Н') + slider('l1', 'Плечо l₁', 0.2, 2, 0.1, 1, 'м') + slider('f2', 'Сила F₂', 10, 100, 5, 40, 'Н') + slider('l2', 'Плечо l₂', 0.2, 2, 0.1, 1.5, 'м') + '<button class="btn" id="bal">⚖️ Уравновесить</button>';
      const q = (s) => c.stage.querySelector(s), beam = q('#beam'), w1 = q('#w1'), w2 = q('#w2'), verd = q('#verd');
      let f1 = 60, l1 = 1, f2 = 40, l2 = 1.5, ang = 0, tgt = 0;
      const box = (g, x, f, lab) => { const s = 26 + f * 0.3; g.innerHTML = '<rect x="' + (x - s / 2) + '" y="' + (CY - 7 - s) + '" width="' + s + '" height="' + s + '" rx="6" fill="rgba(125,184,255,.85)" stroke="#fff" stroke-width="2"/><text x="' + x + '" y="' + (CY - 7 - s / 2 + 5) + '" text-anchor="middle" fill="#06204d" font-size="14" font-weight="700">' + lab + '</text>'; };
      const upd = () => {
        const M1 = f1 * l1, M2 = f2 * l2; tgt = clamp(((M2 - M1) / Math.max(M1, M2, 1)) * 16, -16, 16);
        box(w1, CX - l1 * K, f1, 'F₁'); box(w2, CX + l2 * K, f2, 'F₂');
        const eq = Math.abs(M1 - M2) < 0.5;
        verd.textContent = eq ? '✅ Равновесие!' : M1 > M2 ? 'Перевешивает левая сторона' : 'Перевешивает правая сторона';
        c.out.innerHTML = U().math('M_1 = F_1·l_1 = ' + f1 + '·' + num(l1, 1) + ' = ' + num(M1, 1)) + '<br>' + U().math('M_2 = F_2·l_2 = ' + f2 + '·' + num(l2, 1) + ' = ' + num(M2, 1)) + ' <span class="u">Н·м</span>';
      };
      bind(c.ctl, ['f1', 'l1', 'f2', 'l2'], (g) => { f1 = g.f1; l1 = g.l1; f2 = g.f2; l2 = g.l2; upd(); });
      c.ctl.querySelector('#bal').onclick = () => {
        const need = (f1 * l1) / f2, s = c.ctl.querySelector('#l2');
        if (need < 0.2 || need > 2) { if (window.FX) FX.float('Не получится: плечо вне 0,2–2 м', innerWidth / 2, 160, 'warn'); return; }
        s.value = (Math.round(need * 10) / 10).toFixed(1); s.dispatchEvent(new Event('input'));
        if (Math.abs(f1 * l1 - f2 * +s.value) > 0.5 && window.FX) FX.float('Почти! Подкрути ползунки', innerWidth / 2, 160, 'warn');
      };
      upd();
      return loop((dt) => { ang += (tgt - ang) * Math.min(1, dt * 4); beam.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' ' + CX + ' ' + CY + ')'); });
    }
  });

  /* ============ 5. Давление ============ */
  add({
    id: 'pressure', icon: '👠', name: 'Давление и площадь', fid: 'pressure', formula: 'p = F/S',
    tip: 'Та же сила, а давление разное! Каблучок проваливается, лыжи — нет. Чем меньше площадь опоры, тем больше давление.',
    mount(c) {
      const W = 640, H = 300, GY = 215;
      c.stage.innerHTML = svg(W, H, defs + '<rect x="0" y="0" width="640" height="' + GY + '" fill="rgba(255,255,255,.04)"/><path id="snow" d="" fill="rgba(255,255,255,.85)" stroke="#fff"/>' +
        '<g id="obj"><rect id="body" y="-70" height="70" rx="10" fill="rgba(125,184,255,.9)" stroke="#fff" stroke-width="3"/><text id="ico" text-anchor="middle" y="-26" font-size="34">🧍</text></g>' +
        '<line id="farr" x1="80" y1="40" x2="80" y2="100" stroke="#ff7f8f" stroke-width="7" marker-end="url(#ah)"/><text x="98" y="78" fill="#ff7f8f" font-size="16">F</text>' +
        '<rect x="480" y="30" width="130" height="16" rx="8" fill="rgba(255,255,255,.2)"/><rect id="pbar" x="480" y="30" width="10" height="16" rx="8" fill="#6ee7a5"/><text x="545" y="68" text-anchor="middle" fill="#fff" font-size="14">давление p</text>');
      c.ctl.innerHTML = slider('f', 'Сила F', 50, 1000, 10, 600, 'Н') + slider('s', 'Площадь опоры S', 0.005, 0.4, 0.005, 0.05, 'м²') +
        '<div class="presets"><button class="ghost sm" data-s="0.005">👠 Каблук</button><button class="ghost sm" data-s="0.03">👟 Кроссовок</button><button class="ghost sm" data-s="0.4">🎿 Лыжи</button></div>';
      const q = (s) => c.stage.querySelector(s), obj = q('#obj'), body = q('#body'), snow = q('#snow'), pbar = q('#pbar'), farr = q('#farr'), ico = q('#ico');
      let F = 600, S = 0.05, dep = 0, tgt = 0;
      const upd = () => {
        const p = F / S; tgt = 70 * clamp(Math.log10(Math.max(p, 1) / 1000) / Math.log10(200), 0, 1);
        const wd = 40 + S * 400; set(body, { x: -wd / 2, width: wd }); ico.setAttribute('x', 0);
        set(farr, { y2: 40 + 20 + F / 18 });
        const k = clamp(Math.log10(Math.max(p, 100) / 100) / Math.log10(2000), 0, 1); set(pbar, { width: 10 + k * 120, fill: 'hsl(' + (130 - k * 130) + ' 85% 60%)' });
        c.out.innerHTML = U().math('p = {F|S} = {' + F + '|' + num(S, 3) + '} = ' + (p >= 1e6 ? num(p / 1e6, 2) + '·10⁶' : p >= 1000 ? num(Math.round(p), 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : num(p, 0))) + ' <span class="u">Па</span>';
      };
      bind(c.ctl, ['f', 's'], (g) => { F = g.f; S = g.s; upd(); });
      c.ctl.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { const s = c.ctl.querySelector('#s'); s.value = b.dataset.s; s.dispatchEvent(new Event('input')); }));
      upd();
      return loop((dt) => {
        dep += (tgt - dep) * Math.min(1, dt * 5); const wd = 40 + S * 400, cx = 320, y = GY + dep;
        obj.setAttribute('transform', 'translate(' + cx + ',' + y.toFixed(1) + ')');
        const dx = wd / 2 + 6 + dep * 0.5; snow.setAttribute('d', 'M0,' + GY + ' L' + (cx - dx - 30) + ',' + GY + ' Q' + (cx - dx) + ',' + GY + ' ' + (cx - wd / 2) + ',' + (GY + dep) + ' L' + (cx + wd / 2) + ',' + (GY + dep) + ' Q' + (cx + dx) + ',' + GY + ' ' + (cx + dx + 30) + ',' + GY + ' L640,' + GY + ' L640,300 L0,300 Z');
      });
    }
  });

  /* ============ 6. Закон Гука ============ */
  add({
    id: 'hooke', icon: '🌀', name: 'Пружина (закон Гука)', fid: 'hooke', formula: 'F = k·Δl',
    tip: 'Подвесь груз потяжелее — пружина растянется сильнее. Жёсткая пружина (большое k) растягивается слабее. Сила упругости = растяжение × жёсткость.',
    mount(c) {
      const W = 640, H = 340, CX = 300, TOP = 24, L0 = 70, PX = 1.7;
      c.stage.innerHTML = svg(W, H, defs + '<rect x="' + (CX - 70) + '" y="' + (TOP - 14) + '" width="140" height="14" rx="4" fill="#e8f0ff"/><polyline id="spr" points="" fill="none" stroke="#ffd166" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<g id="mass"><rect x="-36" y="0" width="72" height="50" rx="9" fill="rgba(125,184,255,.9)" stroke="#fff" stroke-width="3"/><text id="mt" y="31" text-anchor="middle" fill="#06204d" font-size="18" font-weight="700"></text></g>' +
        '<line x1="' + (CX + 90) + '" y1="' + (TOP + L0) + '" x2="' + (CX + 90) + '" y2="' + (TOP + L0 + 180) + '" stroke="rgba(255,255,255,.55)"/><line x1="' + (CX + 82) + '" y1="' + (TOP + L0) + '" x2="' + (CX + 98) + '" y2="' + (TOP + L0) + '" stroke="#fff" stroke-width="2"/><text x="' + (CX + 106) + '" y="' + (TOP + L0 + 4) + '" fill="#fff" font-size="13">0</text>' +
        '<g id="dl"><line id="dll" x1="' + (CX + 90) + '" y1="' + (TOP + L0) + '" x2="' + (CX + 90) + '" y2="' + (TOP + L0) + '" stroke="#6ee7a5" stroke-width="5" marker-end="url(#ah)"/><text id="dlt" x="' + (CX + 106) + '" fill="#6ee7a5" font-size="16"></text></g>');
      c.ctl.innerHTML = slider('m', 'Масса груза m', 0, 5, 0.1, 2, 'кг') + slider('k', 'Жёсткость k', 50, 400, 10, 200, 'Н/м');
      const q = (s) => c.stage.querySelector(s), spr = q('#spr'), mass = q('#mass'), mt = q('#mt'), dll = q('#dll'), dlt = q('#dlt');
      let m = 2, k = 200, y = 20, vy = 0;
      const eq = () => ((m * 10) / k) * 100;
      const upd = () => {
        const dl = (m * 10) / k; mt.textContent = num(m, 1) + ' кг';
        c.out.innerHTML = U().math('F = k·Δl = ' + k + '·' + num(dl, 3) + ' = ' + num(k * dl, 1)) + ' <span class="u">Н</span><div class="mini">Δl = ' + num(dl * 100, 1) + ' см; F_тяж = m·g = ' + num(m * 10, 1) + ' Н</div>';
      };
      bind(c.ctl, ['m', 'k'], (g) => { m = g.m; k = g.k; upd(); });
      upd();
      return loop((dt) => {
        const e = eq(); const acc = -70 * (y - e) - 5.5 * vy; vy += acc * dt; y += vy * dt;
        const len = L0 + y * PX, end = TOP + len; let pts = CX + ',' + TOP + ' ' + CX + ',' + (TOP + 10);
        const n = 12; for (let i = 0; i < n; i++) pts += ' ' + (CX + (i % 2 ? 16 : -16)) + ',' + (TOP + 10 + ((i + 0.5) / n) * (len - 20)); pts += ' ' + CX + ',' + (end - 10) + ' ' + CX + ',' + end;
        spr.setAttribute('points', pts); mass.setAttribute('transform', 'translate(' + CX + ',' + end + ')');
        const eqY = TOP + L0 + e * PX; set(dll, { y2: eqY }); dlt.setAttribute('y', (TOP + L0 + eqY) / 2 + 5); dlt.textContent = 'Δl = ' + num(e, 1) + ' см';
      });
    }
  });

  /* ============ 7. Отражение и преломление ============ */
  add({
    id: 'optics', icon: '🔦', name: 'Отражение и преломление', fid: 'reflection', formula: 'α = β',
    tip: 'Угол падения равен углу отражения (от перпендикуляра!). В воде и стекле луч «прижимается» к перпендикуляру: угол преломления меньше.',
    mount(c) {
      const W = 640, H = 320, CX = 320, CY = 170, R = 190;
      c.stage.innerHTML = svg(W, H, defs + '<rect id="med" x="0" y="' + CY + '" width="640" height="150" fill="rgba(120,200,255,.22)"/><line x1="0" y1="' + CY + '" x2="640" y2="' + CY + '" stroke="#fff" stroke-width="3"/>' +
        '<line x1="' + CX + '" y1="20" x2="' + CX + '" y2="310" stroke="#fff" stroke-dasharray="6 6" opacity=".7"/><line id="ri" class="flow" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/><line id="rr" class="flow" stroke="#6ee7a5" stroke-width="5" stroke-linecap="round"/><line id="rt" class="flow" stroke="#ff9ad5" stroke-width="5" stroke-linecap="round"/>' +
        '<path id="a1" fill="none" stroke="#ffd166" stroke-width="2"/><path id="a2" fill="none" stroke="#6ee7a5" stroke-width="2"/><path id="a3" fill="none" stroke="#ff9ad5" stroke-width="2"/><text id="t1" fill="#ffd166" font-size="17"></text><text id="t2" fill="#6ee7a5" font-size="17"></text><text id="t3" fill="#ff9ad5" font-size="17"></text>' +
        '<text x="14" y="30" fill="#fff" font-size="15" opacity=".8">воздух</text><text id="mname" x="14" y="196" fill="#fff" font-size="15" opacity=".8"></text>');
      c.ctl.innerHTML = slider('a', 'Угол падения α', 0, 85, 1, 40, '°') + '<div class="presets" id="modes"><button class="ghost sm on" data-m="mirror">✨ Зеркало</button><button class="ghost sm" data-m="water">💧 Вода</button><button class="ghost sm" data-m="glass">🔷 Стекло</button></div>';
      const q = (s) => c.stage.querySelector(s), ri = q('#ri'), rr = q('#rr'), rt = q('#rt'), med = q('#med'), mname = q('#mname');
      let a = 40, mode = 'mirror';
      const arc = (id, from, to, r) => { const p = (ang) => [CX + r * Math.sin(rad(ang)), CY - r * Math.cos(rad(ang))]; const A = p(from), B = p(to); q(id).setAttribute('d', 'M' + A[0].toFixed(1) + ',' + A[1].toFixed(1) + ' A' + r + ',' + r + ' 0 0 ' + (to > from ? 1 : 0) + ' ' + B[0].toFixed(1) + ',' + B[1].toFixed(1)); };
      const upd = () => {
        const sa = Math.sin(rad(a)), ca = Math.cos(rad(a));
        set(ri, { x1: CX - R * sa, y1: CY - R * ca, x2: CX, y2: CY }); set(rr, { x1: CX, y1: CY, x2: CX + R * sa, y2: CY - R * ca });
        arc('#a1', 0, -a, 70); arc('#a2', 0, a, 90); q('#t1').setAttribute('x', CX - 60 - 20); q('#t1').setAttribute('y', CY - 82); q('#t1').textContent = 'α = ' + a + '°';
        q('#t2').setAttribute('x', CX + 60); q('#t2').setAttribute('y', CY - 104); q('#t2').textContent = 'β = ' + a + '°';
        let html = U().math('α = β = ' + a);
        if (mode === 'mirror') { set(med, { fill: 'url(#mir)' }); rt.setAttribute('opacity', 0); q('#a3').setAttribute('d', ''); q('#t3').textContent = ''; mname.textContent = 'зеркало'; html += ' <span class="u">°</span>'; }
        else {
          const n = mode === 'water' ? 1.33 : 1.5, g = (Math.asin(sa / n) * 180) / Math.PI, sg = Math.sin(rad(g)), cg = Math.cos(rad(g));
          set(med, { fill: mode === 'water' ? 'rgba(90,190,255,.30)' : 'rgba(150,220,255,.35)' }); rt.setAttribute('opacity', 1); mname.textContent = mode === 'water' ? 'вода (n = 1,33)' : 'стекло (n = 1,5)';
          set(rt, { x1: CX, y1: CY, x2: CX + R * sg, y2: CY + R * cg }); q('#a3').setAttribute('d', (() => { const p = (ang) => [CX + 80 * Math.sin(rad(ang)), CY + 80 * Math.cos(rad(ang))]; const A = p(0), B = p(g); return 'M' + A[0] + ',' + A[1] + ' A80,80 0 0 0 ' + B[0].toFixed(1) + ',' + B[1].toFixed(1); })());
          q('#t3').setAttribute('x', CX + 60); q('#t3').setAttribute('y', CY + 112); q('#t3').textContent = 'γ = ' + num(g, 1) + '°';
          html = U().math('α = ' + a + '°') + ' &nbsp; ' + U().math('β = ' + a + '°') + '<div class="mini">преломлённый луч: γ = ' + num(g, 1) + '° ' + (a === 0 ? '(луч идёт прямо)' : '< α — луч прижался к перпендикуляру') + '</div>';
        }
        c.out.innerHTML = html;
      };
      c.stage.querySelector('svg').insertAdjacentHTML('afterbegin', '<defs><linearGradient id="mir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f0ff" stop-opacity=".75"/><stop offset=".5" stop-color="#8aa0c8" stop-opacity=".55"/><stop offset="1" stop-color="#e8f0ff" stop-opacity=".7"/></linearGradient></defs>');
      bind(c.ctl, ['a'], (g) => { a = g.a; upd(); });
      c.ctl.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; c.ctl.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); upd(); }));
      upd();
      return loop(() => {});
    }
  });

  /* ============ 8. Линза ============ */
  add({
    id: 'lens', icon: '🔍', name: 'Собирающая линза', fid: 'lens', formula: '1/F = 1/d + 1/f',
    tip: 'Подвигай предмет: далеко от линзы — изображение маленькое и перевёрнутое; между F и 2F — больше; ближе фокуса — лупа (прямое, мнимое).',
    mount(c) {
      const W = 640, H = 360, LX = 320, AY = 190, h = 52;
      c.stage.innerHTML = svg(W, H, defs + '<clipPath id="cl"><rect x="0" y="0" width="640" height="360"/></clipPath><line x1="10" y1="' + AY + '" x2="630" y2="' + AY + '" stroke="rgba(255,255,255,.6)" stroke-width="2"/>' +
        '<path d="M' + LX + ',60 Q' + (LX + 26) + ',' + AY + ' ' + LX + ',320 Q' + (LX - 26) + ',' + AY + ' ' + LX + ',60 Z" fill="rgba(160,215,255,.35)" stroke="#fff" stroke-width="3"/>' +
        '<g clip-path="url(#cl)" id="rays"></g><g id="marks"></g><g id="obj"></g><g id="img"></g><text id="msg" x="320" y="30" text-anchor="middle" fill="#fff" font-size="17"></text>');
      c.ctl.innerHTML = slider('F', 'Фокус F', 30, 120, 5, 60, 'см') + slider('d', 'Расстояние до предмета d', 30, 300, 5, 150, 'см');
      const q = (s) => c.stage.querySelector(s), rays = q('#rays'), marks = q('#marks'), obj = q('#obj'), img = q('#img'), msg = q('#msg');
      let F = 60, d = 150;
      const arrow = (x, y1, y2, col, dash, wide) => '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="' + (wide || 6) + '" ' + (dash ? 'stroke-dasharray="7 5"' : '') + ' marker-end="url(#ah)"/>';
      const ext = (x, y, dx, dy) => { const t = (632 - x) / dx; return [x + dx * t, y + dy * t]; };
      const line = (a, b, col, dash) => '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="' + col + '" stroke-width="2.5" ' + (dash ? 'stroke-dasharray="6 6" opacity=".6"' : '') + '/>';
      const upd = () => {
        const O = [LX - d, AY - h], r1 = '#ffd166', r2 = '#7db8ff', r3 = '#ff9ad5';
        let rs = '', ms = '';
        [-F, F, -2 * F, 2 * F].forEach((o, i) => { const x = LX + o; if (x > 8 && x < 632) ms += '<circle cx="' + x + '" cy="' + AY + '" r="4" fill="#fff"/><text x="' + x + '" y="' + (AY + 22) + '" text-anchor="middle" fill="#fff" font-size="13">' + (i < 2 ? 'F' : '2F') + '</text>'; });
        marks.innerHTML = ms;
        obj.innerHTML = arrow(O[0], AY, O[1] + 4, '#fff', false, 6) + '<text x="' + O[0] + '" y="' + (O[1] - 10) + '" text-anchor="middle" fill="#fff" font-size="13">предмет</text>';
        const same = Math.abs(d - F) < 1.5;
        let fs = null;
        if (!same) fs = (d * F) / (d - F);
        // луч 1: параллельно оси → через правый фокус
        const P1 = [LX, O[1]]; rs += line(O, P1, r1) + line(P1, ext(P1[0], P1[1], F, h), r1);
        // луч 2: через центр
        rs += line(O, [LX, AY], r2) + line([LX, AY], ext(LX, AY, d, h), r2);
        // луч 3: через левый фокус → параллельно оси (только если d > F)
        if (d > F + 1) { const y3 = AY + (h * F) / (d - F); if (Math.abs(y3 - AY) < 118) { rs += line(O, [LX, y3], r3) + line([LX, y3], [632, y3], r3); } }
        let imgHtml = '', info = '';
        if (same) { info = 'Предмет в фокусе — лучи идут параллельно, изображения нет'; }
        else {
          const xi = LX + fs, hi = (h * fs) / d, yi = AY + hi, virt = fs < 0;
          if (virt) { rs += line([LX, O[1]], [xi, yi], r1, true) + line([LX, AY], [xi, yi], r2, true); }
          if (Math.abs(xi) < 3000) imgHtml = arrow(xi, AY, yi + (yi < AY ? 4 : -4), '#6ee7a5', virt, 6) + '<text x="' + xi + '" y="' + (yi < AY ? yi - 12 : yi + 22) + '" text-anchor="middle" fill="#6ee7a5" font-size="13">изображение</text>';
          const G = Math.abs(fs) / d;
          info = (virt ? 'мнимое, прямое, увеличенное (лупа)' : d > 2 * F ? 'действительное, перевёрнутое, уменьшенное' : Math.abs(d - 2 * F) < 1.5 ? 'действительное, перевёрнутое, равное' : 'действительное, перевёрнутое, увеличенное');
          c.out.innerHTML = U().math('{1|F} = {1|d} + {1|f}') + '<div class="mini">' + U().math('f = {d·F|d − F} = ' + num(fs, 1)) + ' см &nbsp; ' + U().math('Γ = {f|d} = ' + num(G, 2)) + '</div><div class="mini">' + info + '</div>';
        }
        if (same) c.out.innerHTML = '<div class="mini">' + info + '</div>';
        rays.innerHTML = rs; img.innerHTML = imgHtml; msg.textContent = same ? 'd = F' : '';
      };
      bind(c.ctl, ['F', 'd'], (g) => { F = g.F; d = g.d; upd(); });
      upd();
      return loop(() => {});
    }
  });

  /* ============ 9. Нагревание ============ */
  add({
    id: 'heat', icon: '☕', name: 'Нагревание воды', fid: 'heating', formula: 'Q = c·m·Δt',
    tip: 'Вода греется долго: у неё самая большая теплоёмкость (4200). Медь нагревается куда быстрее. Q растёт вместе с массой и ростом температуры.',
    mount(c) {
      const W = 640, H = 320, BX = 200, BW = 170, BY = 70, BH = 190;
      c.stage.innerHTML = svg(W, H, defs + '<clipPath id="bk"><rect x="' + BX + '" y="' + BY + '" width="' + BW + '" height="' + BH + '" rx="14"/></clipPath><rect id="liq" x="' + BX + '" y="' + (BY + 40) + '" width="' + BW + '" height="' + (BH - 40) + '" fill="url(#gw)" clip-path="url(#bk)" opacity=".85"/><g id="bub" clip-path="url(#bk)"></g>' +
        '<path d="M' + BX + ',' + (BY - 10) + ' L' + BX + ',' + (BY + BH) + ' Q' + BX + ',' + (BY + BH + 12) + ' ' + (BX + 14) + ',' + (BY + BH + 12) + ' L' + (BX + BW - 14) + ',' + (BY + BH + 12) + ' Q' + (BX + BW) + ',' + (BY + BH + 12) + ' ' + (BX + BW) + ',' + (BY + BH) + ' L' + (BX + BW) + ',' + (BY - 10) + '" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
        '<text id="flame" x="' + (BX + BW / 2) + '" y="' + (BY + BH + 62) + '" text-anchor="middle" font-size="46">🔥</text>' +
        '<rect x="440" y="50" width="26" height="210" rx="13" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="2.5"/><rect id="mer" x="447" y="258" width="12" height="2" rx="6" fill="#ff5d6c"/><circle cx="453" cy="268" r="18" fill="#ff5d6c" stroke="#fff" stroke-width="2.5"/><text id="tt" x="490" y="160" fill="#fff" font-size="30" font-weight="300"></text>' +
        '<text id="tm" x="' + (BX + BW / 2) + '" y="38" text-anchor="middle" fill="#fff" font-size="17"></text>');
      c.ctl.innerHTML = '<div class="presets" id="subs"><button class="ghost sm on" data-c="4200" data-n="Вода">💧 Вода 4200</button><button class="ghost sm" data-c="2400" data-n="Спирт">🧴 Спирт 2400</button><button class="ghost sm" data-c="1700" data-n="Масло">🌻 Масло 1700</button><button class="ghost sm" data-c="400" data-n="Медь">🟠 Медь 400</button></div>' +
        slider('m', 'Масса m', 0.2, 2, 0.1, 1, 'кг') + slider('pw', 'Мощность нагревателя', 500, 2000, 100, 1000, 'Вт') + '<div class="presets"><button class="btn" id="go">▶ Нагреть</button><button class="ghost" id="rs">↺ Сначала</button></div>';
      const q = (s) => c.stage.querySelector(s), liq = q('#liq'), mer = q('#mer'), tt = q('#tt'), tm = q('#tm'), flame = q('#flame'), bub = q('#bub');
      let cc = 4200, nm = 'Вода', m = 1, pw = 1000, Q = 0, run = false;
      const colors = { 4200: ['#7fd4ff', '#2a7fe0'], 2400: ['#d6c3ff', '#7a5cd6'], 1700: ['#ffe28a', '#d9a62a'], 400: ['#ffb27a', '#c2571a'] };
      const T = () => Math.min(100, 20 + Q / (cc * m));
      const upd = () => {
        const t = T(), dt = t - 20, col = colors[cc]; liq.setAttribute('fill', col[0]); liq.setAttribute('opacity', cc === 400 ? 0.95 : 0.8);
        set(liq, { y: cc === 400 ? BY + 110 : BY + 40, height: cc === 400 ? BH - 110 : BH - 40 });
        const hh = 18 + (t / 100) * 190; set(mer, { y: 258 - hh + 2, height: hh }); tt.textContent = num(t, 0) + ' °C';
        tm.textContent = Q > 0 ? 'нагрето за ' + num(Q / pw, 0) + ' с' : nm + ', ' + num(m, 1) + ' кг';
        c.out.innerHTML = U().math('Q = c·m·Δt = ' + cc + '·' + num(m, 1) + '·' + num(dt, 1) + ' = ' + num(cc * m * dt, 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) + ' <span class="u">Дж</span>';
      };
      bind(c.ctl, ['m', 'pw'], (g) => { m = g.m; pw = g.pw; Q = 0; run = false; upd(); });
      c.ctl.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { cc = +b.dataset.c; nm = b.dataset.n; Q = 0; run = false; c.ctl.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); upd(); }));
      c.ctl.querySelector('#go').onclick = () => { if (T() >= 100) Q = 0; run = true; };
      c.ctl.querySelector('#rs').onclick = () => { Q = 0; run = false; upd(); };
      upd();
      let bubs = [];
      return loop((dt, ts) => {
        if (run) { Q += pw * dt * 45; if (T() >= 100) { Q = (100 - 20) * cc * m; run = false; } upd(); }
        flame.setAttribute('opacity', run ? 1 : 0.25); flame.setAttribute('font-size', run ? 44 + Math.sin(ts * 14) * 5 : 40);
        if (T() > 90 && cc !== 400 && Math.random() < 0.35) bubs.push({ x: BX + 12 + Math.random() * (BW - 24), y: BY + BH - 4, r: 2 + Math.random() * 4 });
        bubs.forEach((b) => (b.y -= 90 * dt)); bubs = bubs.filter((b) => b.y > BY + 40);
        bub.innerHTML = bubs.map((b) => '<circle cx="' + b.x.toFixed(1) + '" cy="' + b.y.toFixed(1) + '" r="' + b.r.toFixed(1) + '" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>').join('');
      });
    }
  });
})();

/* МнемоФизика — приложение: роутер, карточки, тренажёры, прогресс. Без зависимостей, работает с file:// */
(function () {
  'use strict';
  const D = window.FM, FS = D.formulas, TS = D.topics, FACTS = D.facts;
  const { pick, R } = D;
  const app = document.getElementById('app');

  /* ============ утилиты ============ */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const txt = (s) => esc(s).replace(/_([\p{L}\d]+)/gu, '<sub>$1</sub>');
  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const uniq = (a) => [...new Set(a)];
  const byId = Object.fromEntries(FS.map((f) => [f.id, f]));
  const factById = Object.fromEntries(FACTS.map((f) => [f.id, f]));
  const topicById = Object.fromEntries(TS.map((t) => [t.id, t]));
  const topicOf = (f) => topicById[f.topic];

  /* ---------- математика: мини-язык → HTML ---------- */
  function M(src) {
    let i = 0;
    function seq(stop) {
      let out = '';
      while (i < src.length && !stop.includes(src[i])) {
        const c = src[i];
        if (c === '{') { i++; const n = seq('|'); i++; const d = seq('}'); i++; out += '<span class="fr"><span class="nu">' + n + '</span><span class="de">' + d + '</span></span>'; }
        else if (c === '_' || c === '^') {
          i++; let t;
          if (src[i] === '(') { const j = src.indexOf(')', i); t = src.slice(i + 1, j); i = j + 1; } else { t = src[i++]; }
          out += c === '_' ? '<sub>' + esc(t) + '</sub>' : '<sup>' + esc(t) + '</sup>';
        }
        else if (c === 'Δ' || c === 'Γ') { out += '<span class="up">' + c + '</span>'; i++; }
        else if (/\p{L}/u.test(c)) { out += '<i>' + c + '</i>'; i++; }
        else if (c === '·') { out += '<span class="op">·</span>'; i++; }
        else { out += esc(c); i++; }
      }
      return out;
    }
    return seq('');
  }
  const math = (s, cls) => '<span class="math' + (cls ? ' ' + cls : '') + '">' + M(s) + '</span>';

  function toLin(src) {
    src = src.replace(/\s+/g, '');
    let i = 0;
    const wrapN = (n) => (/[+−-]/.test(n) ? '(' + n + ')' : n);
    const wrapD = (d) => (/[+−\-·/]/.test(d) ? '(' + d + ')' : d);
    function seq(stop) {
      let out = '';
      while (i < src.length && !stop.includes(src[i])) {
        const c = src[i];
        if (c === '{') { i++; const n = seq('|'); i++; const d = seq('}'); i++; out += wrapN(n) + '/' + wrapD(d); }
        else { out += c; i++; }
      }
      return out;
    }
    return seq('');
  }
  const TOK = /Δ\p{L}(?:_\([^)]*\)|_[\p{L}\d])?|\p{L}(?:_\([^)]*\)|_[\p{L}\d])?(?:\^\d)?|\d+(?:[.,]\d+)?|[=+\-−·/()%<>√]/gu;
  const tokensOf = (dsl) => toLin(dsl).match(TOK) || [];

  function canonSide(tk) {
    let i = 0;
    function expr() {
      const terms = []; let sign = '+';
      terms.push(sign + term());
      while (tk[i] === '+' || tk[i] === '−' || tk[i] === '-') { sign = tk[i++] === '+' ? '+' : '-'; terms.push(sign + term()); }
      return terms.sort().join('');
    }
    function term() {
      const num = [], den = []; num.push(factor());
      while (tk[i] === '·' || tk[i] === '/') { const op = tk[i++]; const f = factor(); (op === '·' ? num : den).push(f); }
      return num.sort().join('·') + (den.length ? '/' + den.sort().join('·') : '');
    }
    function factor() {
      let f;
      if (tk[i] === '(') { i++; f = '(' + expr() + ')'; if (tk[i] !== ')') throw 0; i++; }
      else if (tk[i] === '√') { i++; f = '√' + factor(); }
      else if (tk[i] === undefined) throw 0;
      else f = tk[i++];
      if (tk[i] === '%') { f += '%'; i++; }
      return f;
    }
    const e = expr(); if (i < tk.length) throw 0; return e;
  }
  function canonEq(tokens) {
    try {
      const idx = tokens.indexOf('=');
      if (idx < 0) return canonSide(tokens);
      return [canonSide(tokens.slice(0, idx)), canonSide(tokens.slice(idx + 1))].sort().join('=');
    } catch (e) { return tokens.join(''); }
  }
  const canonDsl = (dsl) => canonEq(tokensOf(dsl));

  /* ---------- числа ---------- */
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
  const sup = (n) => String(n).replace(/./g, (c) => SUP[c]);
  function sci(x) {
    let e = Math.floor(Math.log10(Math.abs(x)) + 1e-12), m = +(x / Math.pow(10, e)).toPrecision(6);
    if (Math.abs(m) >= 10) { m /= 10; e++; }
    return (m === 1 ? '10' : String(m).replace('.', ',') + '·10') + sup(e);
  }
  function fmt(x) {
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e6 || a < 1e-3) return sci(x);
    const s = String(+x.toPrecision(6));
    let [ip, fp] = s.split('.');
    if (ip.replace('-', '').length >= 5) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fp ? ip + ',' + fp : ip;
  }
  function parseNum(s) {
    s = String(s).trim().replace(/[\s ]/g, '').replace(',', '.').replace('−', '-')
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^' + m.replace(/./g, (c) => '0123456789-'['⁰¹²³⁴⁵⁶⁷⁸⁹⁻'.indexOf(c)]));
    if (/^10\^-?\d+$/.test(s)) return Math.pow(10, parseFloat(s.slice(3)));
    let m = s.match(/^(-?[\d.]+)(?:[*·×x]10\^?(-?\d+)|[eE](-?\d+))$/);
    if (m) return parseFloat(m[1]) * Math.pow(10, parseFloat(m[2] !== undefined ? m[2] : m[3]));
    m = s.match(/^(-?[\d.]+)\/(-?[\d.]+)$/); if (m) return m[1] / m[2];
    const v = Number(s); return s === '' || isNaN(v) ? NaN : v;
  }
  const close = (a, b, tol) => Math.abs(a - b) <= Math.max(Math.abs(b) * (tol || 0.02), 1e-9);

  /* ---------- хранилище ---------- */
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('fm.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { try { localStorage.setItem('fm.' + k, JSON.stringify(v)); } catch (e) { mem[k] = v; } }
  };
  let prog = store.get('prog', {});
  let meta = store.get('meta', { xp: 0, days: {} });
  let mine = store.get('mine', {});
  let grade = store.get('grade', 'all');
  let xcolor = store.get('xcolor', 'auto');
  let selTopic = store.get('topic', '');
  const saveAll = () => { store.set('prog', prog); store.set('meta', meta); if (typeof refreshStatus === 'function') refreshStatus(); };

  const DAY = 864e5, INTERVALS = [0, 1, 2, 4, 8, 16];
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const pr = (id) => prog[id] || (prog[id] = { b: 0, due: 0, ok: 0, bad: 0, seen: 0 });
  function record(id, res) {
    const p = pr(id); p.seen++;
    if (res > 0) { p.ok++; if (p.b < 2 || Date.now() >= p.due - DAY / 2) p.b = Math.min(5, p.b + 1); }
    else if (res < 0) { p.bad++; p.b = Math.max(0, p.b - 2); }
    p.due = Date.now() + INTERVALS[p.b] * DAY;
    meta.days[today()] = (meta.days[today()] || 0) + 1;
    saveAll();
  }
  function addXp(n) { meta.xp = (meta.xp || 0) + n; saveAll(); }
  const RANKS = [[0, 'Новичок', '🌱'], [100, 'Лаборант', '🧪'], [300, 'Исследователь', '🔭'], [700, 'Физик', '⚛️'], [1500, 'Мастер мнемоники', '🧠']];
  function rank() { let r = RANKS[0], nxt = null; for (let i = 0; i < RANKS.length; i++) { if ((meta.xp || 0) >= RANKS[i][0]) { r = RANKS[i]; nxt = RANKS[i + 1] || null; } } return { r, nxt }; }
  function streak() {
    let n = 0, d = new Date(); const key = (dt) => new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (!meta.days[key(d)]) d = new Date(d.getTime() - DAY);
    while (meta.days[key(d)]) { n++; d = new Date(d.getTime() - DAY); }
    return n;
  }
  const mastered = (id) => prog[id] && prog[id].b >= 4;
  const gradeOk = (x) => grade === 'all' || String(x.grade) === grade;
  const factGrade = (f) => (topicById[f.topic] ? topicById[f.topic].grade : 8);
  const visFormulas = () => FS.filter(gradeOk);
  const visFacts = () => FACTS.filter((f) => grade === 'all' || String(factGrade(f)) === grade);
  const dueList = () => visFormulas().filter((f) => prog[f.id] && prog[f.id].seen > 0 && prog[f.id].due <= Date.now());

  /* ============ UI: общее ============ */
  function toast(msg) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); clearTimeout(toast.k); toast.k = setTimeout(() => t.classList.remove('show'), 1800);
  }
  /* цвет фона: «авто» — по месяцу, как у системного меню приставки */
  const COLORS = [['auto', 'авто (по месяцу)', null], ['blue', 'синий', 215], ['green', 'зелёный', 140], ['orange', 'оранжевый', 28], ['purple', 'фиолетовый', 268], ['pink', 'розовый', 325], ['red', 'красный', 355], ['teal', 'бирюзовый', 178]];
  const MONTH_HUE = [215, 300, 140, 330, 120, 45, 190, 10, 35, 268, 20, 225];
  function applyTheme() {
    const c = COLORS.find((x) => x[0] === xcolor) || COLORS[0], hue = c[2] != null ? c[2] : MONTH_HUE[new Date().getMonth()];
    document.documentElement.style.setProperty('--h', hue);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', 'hsl(' + hue + ' 80% 18%)');
  }
  function refreshStatus() {
    const d = new Date(), el = document.getElementById('clock');
    if (el) el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const bt = document.querySelector('#bat i');
    if (bt) bt.style.width = Math.max(8, Math.round((FS.filter((f) => mastered(f.id)).length / FS.length) * 100)) + '%';
  }
  function syncChrome(view) {
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === view));
    document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === grade));
  }
  const ring = (pct, size, label) => {
    const r = 42, c = 2 * Math.PI * r, o = c * (1 - Math.min(1, pct));
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px"><svg viewBox="0 0 100 100"><circle class="rb" cx="50" cy="50" r="' + r + '"/><circle class="rf" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + o.toFixed(1) + '"/></svg><b>' + label + '</b></div>';
  };
  const topicPct = (tid) => { const fs = FS.filter((f) => f.topic === tid); if (!fs.length) return 0; return fs.reduce((a, f) => a + (prog[f.id] ? prog[f.id].b / 5 : 0), 0) / fs.length; };
  const topicColor = (t) => 'style="--tc:' + t.color + '"';
  const lineHTML = (l) => '<li class="mn t-' + l.t + '"><span class="badge">' + D.types[l.t].icon + ' ' + D.types[l.t].label + '</span><p>' + txt(l.x) + '</p></li>';

  /* ============ вид: карточка формулы ============ */
  function triHTML(f) {
    const { top, l, r } = f.tri;
    return '<div class="tri" data-tri="' + esc(f.id) + '"><svg viewBox="0 0 240 200" aria-hidden="true"><polygon points="120,8 10,188 230,188"/><line x1="52" y1="124" x2="188" y2="124"/><line x1="120" y1="124" x2="120" y2="188"/></svg>' +
      '<button class="tv top" data-act="tri" data-v="' + esc(top) + '">' + math(top) + '</button>' +
      '<button class="tv l" data-act="tri" data-v="' + esc(l) + '">' + math(l) + '</button>' +
      '<button class="tv r" data-act="tri" data-v="' + esc(r) + '">' + math(r) + '</button>' +
      '<div class="tri-out" aria-live="polite"><span>Нажми на величину — «закрою пальцем» 👆</span></div></div>';
  }
  function cardHTML(f) {
    const t = topicOf(f), m = f.m || {}, mn = mine[f.id] || '';
    const forms = f.forms ? Object.values(f.forms).filter((s) => s !== f.f) : [];
    const vars = f.vars && f.vars.length ? '<table class="vars"><tbody>' + f.vars.map((v) => '<tr><td class="vs">' + math(v[0]) + '</td><td>' + esc(v[1]) + (v[3] ? ' <small>(задана)</small>' : '') + '</td><td class="vu">' + (v[2] ? esc(v[2]) : '—') + '</td></tr>').join('') + '</tbody></table>' : '';
    const p = prog[f.id];
    return '<article class="fcard" id="c-' + esc(f.id) + '" ' + topicColor(t) + '>' +
      '<header class="fc-head"><div class="fc-img" aria-hidden="true">' + (m.img || t.icon) + '</div><div><div class="chips"><span class="chip">' + f.grade + ' класс</span><a class="chip link" href="#/learn/' + t.id + '">' + t.icon + ' ' + esc(t.name) + '</a>' +
      (p && p.b >= 4 ? '<span class="chip ok">✓ освоено</span>' : '') + '</div><h3>' + esc(f.name) + '</h3></div></header>' +
      (f.f ? '<div class="fbox" data-box><div class="fbox-in">' + math(f.f, 'big') + '</div><button class="ghost sm" data-act="cover">🙈 Закрой и вспомни</button></div>' : '') +
      (f.ruleText ? '<div class="rule">' + txt(f.ruleText) + '</div>' : '') +
      (forms.length ? '<div class="forms"><span>Выразим:</span>' + forms.map((s) => '<span class="form">' + math(s) + '</span>').join('') + '</div>' : '') +
      '<div class="cols">' + (vars ? '<div>' + vars + '</div>' : '') + (f.tri ? '<div>' + triHTML(f) + '</div>' : '') + '</div>' +
      '<div class="mnemo"><h4>🧠 Как запомнить</h4><ul>' + (m.lines || []).map(lineHTML).join('') + '</ul></div>' +
      (m.story ? '<p class="story"><b>📖 Образ-история.</b> ' + txt(m.story) + '</p>' : '') +
      (m.trap ? '<p class="trap"><b>⚠️ Ловушка.</b> ' + txt(m.trap) + '</p>' : '') +
      '<div class="mine"><label for="mine-' + esc(f.id) + '">✍️ Моя мнемоника <small>(свои ассоциации запоминаются лучше всего)</small></label><textarea id="mine-' + esc(f.id) + '" data-mine="' + esc(f.id) + '" rows="2" placeholder="Придумай свой образ, фразу или рифму…">' + esc(mn) + '</textarea></div>' +
      '<footer class="fc-foot"><a class="btn sm" href="#/play/mix?ids=' + esc(f.id) + '&n=6">🎲 Потренировать</a><a class="btn ghost sm" href="#/play/recall?ids=' + esc(f.id) + '">🃏 Карточка</a></footer></article>';
  }
  function factsHTML(tid) {
    const fs = FACTS.filter((x) => x.topic === tid);
    if (!fs.length) return '';
    return '<section class="facts"><h3>🔢 Числа для запоминания</h3><div class="fgrid">' + fs.map((x) => '<div class="fact"><div><b>' + esc(x.q) + '</b><p>' + txt(x.note) + '</p></div><span class="fv">' + fmt(x.v) + ' <small>' + esc(x.u) + '</small></span></div>').join('') + '</div></section>';
  }

  /* ============ вид: главная ============ */
  function viewHome() {
    const fs = visFormulas(), total = fs.length, got = fs.filter((f) => mastered(f.id)).length;
    const due = dueList().length, rk = rank(), st = streak();
    const dayF = (() => { const arr = fs.length ? fs : FS; let h = 0; for (const c of today()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return arr[h % arr.length]; })();
    const dm = dayF.m || {};
    const lesson = TS.filter(gradeOk).map((t) => {
      const n = FS.filter((f) => f.topic === t.id).length;
      return '<a class="tcard" href="#/learn/' + t.id + '" ' + topicColor(t) + '><span class="ti">' + t.icon + '</span><div><b>' + esc(t.name) + '</b><small>' + esc(t.place) + ' · ' + n + ' карточ.</small></div><div class="pbar"><i style="width:' + Math.round(topicPct(t.id) * 100) + '%"></i></div></a>';
    }).join('');
    app.innerHTML =
      '<section class="hero"><div class="hero-copy"><span class="pill">⚛️ Физика 7–8 класс</span><h1>Формулы, которые <em>запоминаются сами</em></h1>' +
      '<p>Образы, смешные фразы, треугольники и «дворец памяти». Выучи формулу за минуту, а потом закрепи тренажёрами с интервальным повторением.</p>' +
      '<div class="cta"><a class="btn big" href="#/play/mix">🚀 Начать тренировку</a><a class="btn ghost big" href="#/learn">📚 Учить по темам</a></div></div>' +
      '<div class="daily" ' + topicColor(topicOf(dayF)) + '><span class="pill">✨ Формула дня</span><div class="daily-img">' + (dm.img || '⚛️') + '</div><h3>' + esc(dayF.name) + '</h3>' +
      (dayF.f ? '<div class="fbox-in">' + math(dayF.f, 'big') + '</div>' : '<p class="muted">' + txt(dayF.ruleText || '') + '</p>') +
      '<p class="daily-l">' + (dm.lines && dm.lines[0] ? txt(dm.lines[0].x) : '') + '</p><a class="btn sm" href="#/card/' + esc(dayF.id) + '">Открыть карточку →</a></div></section>' +
      '<section class="bento"><div class="b b-ring">' + ring(total ? got / total : 0, 96, got + '/' + total) + '<div><b>Освоено формул</b><small>из ' + total + ' в выбранном классе</small></div></div>' +
      '<div class="b"><span class="big-n">🔥 ' + st + '</span><b>Дней подряд</b><small>' + (st ? 'так держать!' : 'позанимайся сегодня') + '</small></div>' +
      '<div class="b"><span class="big-n">' + rk.r[2] + ' ' + (meta.xp || 0) + '</span><b>' + rk.r[1] + '</b><small>' + (rk.nxt ? 'до «' + rk.nxt[1] + '» ещё ' + (rk.nxt[0] - (meta.xp || 0)) + ' XP' : 'максимальный ранг!') + '</small></div>' +
      '<a class="b b-due" href="#/play/recall?due=1"><span class="big-n">⏰ ' + due + '</span><b>К повторению</b><small>' + (due ? 'нажми — повторим сейчас' : 'пока всё свежее') + '</small></a></section>' +
      '<section><div class="sec-head"><h2>Темы</h2><a href="#/learn">все →</a></div><div class="tgrid">' + lesson + '</div></section>' +
      '<section class="steps"><h2>Как это работает</h2><div class="sgrid">' +
      '<div class="step"><span>1</span><h4>Увидь образ</h4><p>Каждой формуле — своя картинка, фраза или треугольник. Не зубрим — «рисуем» в голове.</p></div>' +
      '<div class="step"><span>2</span><h4>Закрой и вспомни</h4><p>Скрой формулу и восстанови по подсказке. Так формируется настоящая память.</p></div>' +
      '<div class="step"><span>3</span><h4>Тренируйся</h4><p>10 режимов: от «собери формулу» до задач. Сайт сам вернёт тебя к слабым местам.</p></div></div>' +
      '<a class="btn ghost" href="#/tech">Все техники мнемоники и «дворец памяти» →</a></section>';
  }

  /* ============ вид: учить ============ */
  function viewLearn(tid) {
    if (!tid) {
      const grp = (g) => '<h2>' + g + ' класс</h2><div class="tgrid big">' + TS.filter((t) => t.grade === g).map((t) => {
        const n = FS.filter((f) => f.topic === t.id).length, nf = FACTS.filter((x) => x.topic === t.id).length;
        return '<a class="tcard lg" href="#/learn/' + t.id + '" ' + topicColor(t) + '><span class="ti">' + t.icon + '</span><div><b>' + esc(t.name) + '</b><small>🏛️ ' + esc(t.place) + '</small><small>' + n + ' формул' + (nf ? ' · ' + nf + ' чисел' : '') + '</small></div><div class="pbar"><i style="width:' + Math.round(topicPct(t.id) * 100) + '%"></i></div></a>';
      }).join('') + '</div>';
      app.innerHTML = '<div class="page-head"><h1>📚 Учить</h1><p>Выбери тему: в каждой — карточки с образами, фразами и ловушками, а в начале — сюжет, который связывает все формулы в одну историю.</p></div>' +
        [7, 8].filter((g) => grade === 'all' || String(g) === grade).map(grp).join('');
      return;
    }
    const t = topicById[tid]; if (!t) { location.hash = '#/learn'; return; }
    const fs = FS.filter((f) => f.topic === tid);
    const idx = TS.findIndex((x) => x.id === tid), prev = TS[idx - 1], next = TS[idx + 1];
    app.innerHTML = '<div class="topic-head" ' + topicColor(t) + '><a class="back" href="#/learn">← Все темы</a><div class="th-main"><span class="th-ico">' + t.icon + '</span><div><span class="pill">' + t.grade + ' класс · станция «Дворца памяти»</span><h1>' + esc(t.name) + '</h1><p class="place">🏛️ ' + esc(t.place) + '</p></div></div>' +
      '<div class="storybox"><b>🔗 Сюжет-цепочка</b><p>' + txt(t.story) + '</p></div><div class="cta"><a class="btn" href="#/play/mix?topic=' + t.id + '">🎲 Тренировать тему</a><a class="btn ghost" href="#/play/recall?topic=' + t.id + '">🃏 Карточки</a></div></div>' +
      '<div class="cards">' + fs.map(cardHTML).join('') + '</div>' + factsHTML(tid) +
      '<nav class="pager">' + (prev ? '<a href="#/learn/' + prev.id + '">← ' + prev.icon + ' ' + esc(prev.name) + '</a>' : '<span></span>') + (next ? '<a href="#/learn/' + next.id + '">' + next.icon + ' ' + esc(next.name) + ' →</a>' : '<span></span>') + '</nav>';
  }
  function viewCard(id) {
    const f = byId[id]; if (!f) { location.hash = '#/learn'; return; }
    app.innerHTML = '<a class="back" href="#/learn/' + f.topic + '">← К теме</a><div class="cards single">' + cardHTML(f) + '</div>';
  }

  /* ============ тренажёры: конструкторы вопросов ============ */
  const MODES = [
    { id: 'recall', icon: '🃏', name: 'Карточки с подсказками', desc: 'Образ → фраза → формула. Интервальное повторение.' },
    { id: 'pick', icon: '🎯', name: 'Выбери формулу', desc: 'Среди похожих выбери верную.' },
    { id: 'build', icon: '🧩', name: 'Собери формулу', desc: 'Собери из «кубиков»-символов.' },
    { id: 'tri', icon: '🔺', name: 'Треугольник', desc: 'Закрой пальцем — что получится?' },
    { id: 'mnemo', icon: '🎭', name: 'Образ → формула', desc: 'Узнай формулу по картинке-мнемонике.' },
    { id: 'calc', icon: '🧮', name: 'Посчитай', desc: 'Короткие задачи на каждую формулу.' },
    { id: 'sym', icon: '📏', name: 'Обозначения и единицы', desc: 'Буква ↔ величина ↔ единица.' },
    { id: 'rule', icon: '📜', name: 'Правила и законы', desc: 'Руки, линзы, соединения, плавание.' },
    { id: 'fact', icon: '🔢', name: 'Числа и константы', desc: 'Плотности, теплоёмкости, топливо…' },
    { id: 'conv', icon: '↔️', name: 'Перевод единиц', desc: 'км/ч ↔ м/с, см² ↔ м², приставки.' },
    { id: 'mix', icon: '🎲', name: 'Микс', desc: 'Всё вперемешку — как на контрольной.' }
  ];
  const modeName = (id) => (MODES.find((m) => m.id === id) || {}).name || id;

  const UNITS = uniq(FS.flatMap((f) => f.vars.map((v) => v[2]).filter(Boolean)));
  const NAMES = uniq(FS.flatMap((f) => f.vars.map((v) => v[1])));
  const capable = {
    pick: (f) => !!f.f && !!f.bad,
    build: (f) => !!f.f && tokensOf(f.f).length <= 16 && tokensOf(f.f).length >= 3,
    tri: (f) => !!f.tri,
    mnemo: (f) => !!f.f && !!f.m,
    calc: (f) => !!f.task || (!!f.gen && !!f.ask && f.ask.length > 0),
    sym: (f) => f.vars.length > 0,
    rule: (f) => !!f.bank,
    recall: () => true
  };
  const hintOf = (f) => {
    const m = f.m || {}, l = m.lines && m.lines[0];
    return '<div class="hint-in"><span class="h-img">' + (m.img || '') + '</span>' + (l ? '<div><span class="badge">' + D.types[l.t].icon + ' ' + D.types[l.t].label + '</span><p>' + txt(l.x) + '</p></div>' : '') + '</div>';
  };
  const optsFrom = (correctHtml, wrongHtmls) => {
    const arr = shuffle([{ h: correctHtml, ok: 1 }].concat(wrongHtmls.map((h) => ({ h, ok: 0 }))));
    return { opts: arr, correct: arr.findIndex((o) => o.ok) };
  };

  function mutants(s) {
    const out = [s.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, '{$2|$1}'), s.replace('·', '+'), s.replace('+', '−'), s.replace('−', '+'), s.replace(/=\s*/, '= 2·')];
    return uniq(out).filter((x) => x !== s);
  }
  function makePick(f) {
    const cc = canonDsl(f.f);
    let wrong = shuffle(f.bad).filter((b) => canonDsl(b) !== cc);
    if (wrong.length < 3) wrong = wrong.concat(mutants(f.f).filter((b) => canonDsl(b) !== cc));
    wrong = uniq(wrong).slice(0, 3);
    const o = optsFrom(math(f.f), wrong.map((w) => math(w)));
    return { type: 'pick', fid: f.id, title: 'Какая формула верна?', sub: f.name, ...o, hint: hintOf(f) };
  }
  function makeTri(f) {
    const { top, l, r } = f.tri, hide = pick(['top', 'l', 'r']);
    let ok, wr;
    if (hide === 'top') { ok = top + ' = ' + l + '·' + r; wr = [top + ' = {' + l + '|' + r + '}', top + ' = {' + r + '|' + l + '}', top + ' = ' + l + ' + ' + r]; }
    else if (hide === 'l') { ok = l + ' = {' + top + '|' + r + '}'; wr = [l + ' = ' + top + '·' + r, l + ' = {' + r + '|' + top + '}', l + ' = ' + top + ' − ' + r]; }
    else { ok = r + ' = {' + top + '|' + l + '}'; wr = [r + ' = ' + top + '·' + l, r + ' = {' + l + '|' + top + '}', r + ' = ' + top + ' − ' + l]; }
    const o = optsFrom(math(ok), wr.map((w) => math(w)));
    return { type: 'tri', fid: f.id, title: 'Закрой «?» пальцем', sub: f.name, tri: f.tri, hide, answer: ok, ...o, hint: hintOf(f) };
  }
  function makeMnemo(f) {
    const same = FS.filter((x) => x.id !== f.id && x.f && x.f !== f.f && x.topic === f.topic);
    const others = shuffle(same).concat(shuffle(FS.filter((x) => x.id !== f.id && x.f && x.f !== f.f && x.topic !== f.topic)));
    const wr = others.slice(0, 3).map((x) => math(x.f) + '<small class="oname">' + esc(x.name) + '</small>');
    const o = optsFrom(math(f.f) + '<small class="oname">' + esc(f.name) + '</small>', wr);
    return { type: 'mnemo', fid: f.id, title: 'Какую формулу «прячет» этот образ?', sub: '', ...o };
  }
  function makeBuild(f) {
    const tk = tokensOf(f.f);
    const extra = tk.includes('+') ? '−' : '+';
    const chips = shuffle(tk.map((t, i) => ({ t, k: i })).concat([{ t: extra, k: 99 }]));
    return { type: 'build', fid: f.id, title: 'Собери формулу', sub: f.name, tk, chips, built: [], hint: hintOf(f) };
  }
  function subst(form, vals) {
    const rhs = form.split('=').slice(1).join('=');
    return rhs.replace(/Δ\p{L}(?:_\([^)]*\)|_[\p{L}\d])?|\p{L}(?:_\([^)]*\)|_[\p{L}\d])?/gu, (t) => (vals[t] !== undefined ? fmt(vals[t]) : t));
  }
  function makeCalc(f) {
    if (f.task) {
      const t = f.task();
      return { type: 'calc', fid: f.id, title: 'Реши задачу', sub: f.name, text: t.text || '', given: t.given, find: t.find, ans: t.ans, unit: t.unit, sol: t.sol, warn: t.warn, hint: hintOf(f) };
    }
    const vals = f.gen(), target = pick(f.ask), tv = f.vars.find((v) => v[0] === target), form = f.forms[target];
    const given = f.vars.filter((v) => v[0] !== target && vals[v[0]] !== undefined).map((v) => [v[0], vals[v[0]], v[2]]);
    const sol = [form, target + ' = ' + subst(form, vals) + ' = ' + fmt(vals[target])];
    return { type: 'calc', fid: f.id, title: 'Реши задачу', sub: f.name, text: '', given, find: [target, tv[1]], ans: vals[target], unit: tv[2], sol, hint: hintOf(f) };
  }
  function makeSym(f) {
    const v = pick(f.vars), useUnit = v[2] && Math.random() < 0.55;
    if (useUnit) {
      const near = uniq(FS.filter((x) => x.topic === f.topic).flatMap((x) => x.vars.map((y) => y[2]))).filter((u) => u && u !== v[2]);
      const rest = UNITS.filter((u) => u !== v[2] && !near.includes(u));
      const wr = uniq(shuffle(near).slice(0, 2).concat(shuffle(rest))).slice(0, 3);
      const o = optsFrom('<span class="plain">' + esc(v[2]) + '</span>', wr.map((u) => '<span class="plain">' + esc(u) + '</span>'));
      return { type: 'sym', fid: f.id, title: 'В каких единицах измеряется ' + v[1] + '?', sub: f.name, symbol: v[0], explain: 'Величина ' + v[0] + ' («' + v[1] + '») измеряется в ' + v[2] + '.', ...o, hint: hintOf(f) };
    }
    const near = uniq(FS.filter((x) => x.topic === f.topic).flatMap((x) => x.vars.map((y) => y[1]))).filter((n) => n !== v[1]);
    const wr = uniq(shuffle(near).slice(0, 2).concat(shuffle(NAMES.filter((n) => n !== v[1])))).slice(0, 3);
    const o = optsFrom('<span class="plain">' + esc(v[1]) + '</span>', wr.map((n) => '<span class="plain">' + esc(n) + '</span>'));
    return { type: 'sym', fid: f.id, title: 'Что обозначает буква в формуле?', sub: f.name, symbol: v[0], showFormula: f.f, explain: 'Буква ' + v[0] + ' — это ' + v[1] + (v[2] ? ' (' + v[2] + ')' : '') + '.', ...o, hint: hintOf(f) };
  }
  function makeRule(f) {
    const b = pick(f.bank), idx = shuffle(b.o.map((t, i) => i)), corr = idx.findIndex((i) => i === b.a);
    return { type: 'rule', fid: f.id, title: b.q, sub: f.name, opts: idx.map((i) => ({ h: '<span class="plain">' + txt(b.o[i]) + '</span>' })), correct: corr, note: f.ruleText || (f.m && f.m.lines && f.m.lines[0] ? f.m.lines[0].x : ''), hint: hintOf(f) };
  }
  function makeFact(x) {
    const same = FACTS.filter((y) => y.id !== x.id && y.fam === x.fam && y.v !== x.v);
    let vals = uniq(shuffle(same).map((y) => y.v)).slice(0, 3);
    for (const e of [x.v * 10, x.v / 10, x.v * 2, x.v / 2]) { if (vals.length >= 3) break; if (!vals.includes(e)) vals.push(e); }
    const o = optsFrom('<span class="plain">' + fmt(x.v) + ' ' + esc(x.u) + '</span>', vals.map((v) => '<span class="plain">' + fmt(v) + ' ' + esc(x.u) + '</span>'));
    return { type: 'fact', fid: x.id, title: x.q + ' — это…', sub: '', note: x.note, ...o, hint: '<div class="hint-in"><span class="h-img">🔢</span><div><p>' + txt(x.note.split('.')[0] + '.') + '</p></div></div>' };
  }
  const PFX_NOTE = { 12: 'Три Голодных Медведя Копают: Тера 12, Гига 9, Мега 6, кило 3 — каждый шаг на три нуля меньше.', 9: 'Три Голодных Медведя Копают: Тера 12, Гига 9, Мега 6, кило 3.', 6: 'Три Голодных Медведя Копают: Тера 12, Гига 9, Мега 6, кило 3.', 3: 'Три Голодных Медведя Копают: Тера 12, Гига 9, Мега 6, кило 3.', 2: 'гекто = 100 (гектопаскаль), деци = десятая, санти = сотая.', '-1': 'деци = десятая часть (дециметр).', '-2': 'санти = сотая часть (сантиметр).', '-3': 'Мышь Мелкая, Но Наглая: милли −3, микро −6, нано −9.', '-6': 'Мышь Мелкая, Но Наглая: милли −3, микро −6, нано −9.', '-9': 'Мышь Мелкая, Но Наглая: милли −3, микро −6, нано −9.' };
  function makeConv() {
    if (Math.random() < 0.25) {
      const p = pick(D.prefixes), ps = D.prefixes.map((x) => x.p), wr = shuffle(uniq(ps).filter((x) => x !== p.p)).slice(0, 3);
      const pw = (n) => '<span class="plain">10' + sup(n) + '</span>';
      const o = optsFrom(pw(p.p), wr.map(pw));
      return { type: 'prefix', title: 'Приставка «' + p.n + '» (' + p.s + ') — это умножение на…', sub: 'Приставки СИ', note: PFX_NOTE[p.p], ...o };
    }
    const c = pick(D.convs), v = pick(c.vals);
    return { type: 'conv', title: 'Переведи единицы', sub: 'Перевод единиц', c, v, ans: R(v * c.k) };
  }
  const makers = { pick: makePick, tri: makeTri, mnemo: makeMnemo, build: makeBuild, calc: makeCalc, sym: makeSym, rule: makeRule };

  /* ---------- сборка сессии ---------- */
  let sess = null;
  const prio = (x) => (prog[x.id] ? prog[x.id].b - (prog[x.id].due <= Date.now() ? 1 : 0) : -0.5) + Math.random() * 2.2;
  function buildSession(mode, params) {
    const n = +params.n || 10;
    let pool = visFormulas(), facts = visFacts();
    if (params.topic) { pool = FS.filter((f) => f.topic === params.topic); facts = FACTS.filter((f) => f.topic === params.topic); }
    if (params.ids) { const ids = params.ids.split(','); pool = FS.filter((f) => ids.includes(f.id)); facts = FACTS.filter((f) => ids.includes(f.id)); }
    if (params.due) pool = dueList();
    const items = [];
    if (mode === 'conv') { for (let i = 0; i < n; i++) items.push(makeConv()); }
    else if (mode === 'fact') { shuffle(facts).sort((a, b) => prio(a) - prio(b)).slice(0, n).forEach((x) => items.push(makeFact(x))); }
    else if (mode === 'recall') { pool = pool.slice().sort((a, b) => prio(a) - prio(b)).slice(0, n); pool.forEach((f) => items.push({ type: 'recall', fid: f.id, step: 0 })); }
    else if (mode === 'mix') {
      const types = ['pick', 'build', 'tri', 'mnemo', 'calc', 'sym', 'rule'];
      const sorted = pool.slice().sort((a, b) => prio(a) - prio(b));
      let guard = 0, k = 0;
      while (items.length < n && sorted.length && guard++ < n * 8) {
        const f = sorted[k++ % sorted.length];
        const opts = types.filter((t) => capable[t](f));
        if (!opts.length) continue;
        const last = items.length ? items[items.length - 1].type : '';
        const t = pick(opts.filter((o) => o !== last).length ? opts.filter((o) => o !== last) : opts);
        items.push(makers[t](f));
        if (!params.ids && !params.topic && items.length % 5 === 0 && facts.length) items.push(Math.random() < 0.5 ? makeFact(pick(facts)) : makeConv());
      }
      if (params.ids) facts.forEach((x) => items.push(makeFact(x)));
      items.length = Math.min(items.length, n + 2);
    }
    else {
      const ok = pool.filter(capable[mode]).sort((a, b) => prio(a) - prio(b));
      let k = 0; while (items.length < n && ok.length) { items.push(makers[mode](ok[k % ok.length])); k++; if (k >= n) break; }
    }
    return { mode, params, items, i: 0, ok: 0, xp: 0, wrong: [], hinted: 0, answered: false, t0: Date.now() };
  }
  function startSession(mode, params) {
    const s = buildSession(mode, params || {});
    if (!s.items.length) { toast('Для этого режима пока нет подходящих заданий'); return false; }
    sess = s; return true;
  }

  /* ---------- экран сессии ---------- */
  const cur = () => sess.items[sess.i];
  function qMeta(q) {
    const f = q.fid && (byId[q.fid] || factById[q.fid]); const t = f && (f.topic ? topicById[f.topic] : null);
    return { f, t };
  }
  function bodyHTML(q) {
    const { f } = qMeta(q);
    switch (q.type) {
      case 'pick': case 'tri': case 'mnemo': case 'sym': case 'rule': case 'fact': case 'prefix': {
        let pre = '';
        if (q.type === 'tri') {
          const { top, l, r } = q.tri, lab = (k, v) => (q.hide === k ? '<span class="q">?</span>' : math(v));
          pre = '<div class="tri static"><svg viewBox="0 0 240 200" aria-hidden="true"><polygon points="120,8 10,188 230,188"/><line x1="52" y1="124" x2="188" y2="124"/><line x1="120" y1="124" x2="120" y2="188"/></svg><div class="tv top">' + lab('top', top) + '</div><div class="tv l">' + lab('l', l) + '</div><div class="tv r">' + lab('r', r) + '</div></div>';
        }
        if (q.type === 'mnemo') { const m = f.m; pre = '<div class="mnemo-q"><div class="mq-img">' + (m.img || '') + '</div>' + (m.lines[0] ? '<p>' + txt(m.lines[0].x) + '</p>' : '') + '</div>'; }
        if (q.type === 'sym') pre = '<div class="symq">' + (q.showFormula ? math(q.showFormula, 'big') + '<div class="arrow">↓</div>' : '') + '<div class="symbig">' + math(q.symbol, 'big') + '</div></div>';
        return pre + '<div class="opts">' + q.opts.map((o, i) => '<button class="opt' + (q.answered ? (i === q.correct ? ' ok' : i === q.picked ? ' no' : '') : '') + '" data-act="opt" data-i="' + i + '"' + (q.answered ? ' disabled' : '') + '><span class="k">' + ['✕', '○', '△', '□'][i] + '</span><span class="ov">' + o.h + '</span></button>').join('') + '</div>';
      }
      case 'build': {
        return '<div class="build-slot' + (q.built.length ? '' : ' empty') + '">' + (q.built.length ? q.built.map((c) => '<button class="chipb placed" data-act="unchip" data-k="' + c.k + '">' + math(c.t) + '</button>').join('') : '<span>Нажимай символы ниже, чтобы собрать формулу</span>') + '</div>' +
          '<div class="bank">' + q.chips.filter((c) => !q.built.some((b) => b.k === c.k)).map((c) => '<button class="chipb" data-act="chip" data-k="' + c.k + '">' + math(c.t) + '</button>').join('') + '</div>' +
          '<div class="mini-actions"><button class="ghost sm" data-act="clear">↺ Сбросить</button></div>';
      }
      case 'calc': {
        const g = q.given.map((x) => '<span class="gv">' + math(x[0]) + ' = <b>' + fmt(x[1]) + '</b> ' + esc(x[2] || '') + '</span>').join('');
        return (q.text ? '<p class="qtext">' + txt(q.text) + '</p>' : '') + '<div class="given"><b>Дано:</b>' + g + '</div><div class="find"><b>Найти:</b> ' + (q.find[0] === '~' ? '' : math(q.find[0]) + ' — ') + esc(q.find[1]) + '</div>' +
          '<div class="ans-row"><input id="ans" inputmode="decimal" autocomplete="off" placeholder="Ответ" value="' + esc(q.userAns || '') + '" ' + (q.answered ? 'disabled' : '') + '><span class="unit">' + esc(q.unit || '') + '</span></div>' +
          '<p class="tiny">Можно писать 0,5 или 0.5; для больших чисел — например 2,3·10^6.</p>';
      }
      case 'conv': {
        return '<div class="convq"><span class="cv">' + fmt(q.v) + ' <b>' + esc(q.c.a) + '</b></span><span class="eq">=</span><span class="cv">? <b>' + esc(q.c.b) + '</b></span></div>' +
          '<div class="ans-row"><input id="ans" inputmode="decimal" autocomplete="off" placeholder="Ответ" value="' + esc(q.userAns || '') + '" ' + (q.answered ? 'disabled' : '') + '><span class="unit">' + esc(q.c.b) + '</span></div>';
      }
      case 'recall': {
        const m = f.m || {}; const s = q.step;
        const varsLine = f.vars && f.vars.length ? '<div class="rc-vars">' + f.vars.map((v) => '<span>' + math(v[0]) + ' — ' + esc(v[1]) + '</span>').join('') + '</div>' : '';
        let h = '<div class="rc-front"><div class="rc-name">' + esc(f.name) + '</div>' + varsLine + '<p class="muted">Попробуй вспомнить ' + (f.f ? 'формулу' : 'правило') + ' сам. Подсказки открывай по одной — чем меньше, тем лучше.</p></div>';
        if (s >= 1) h += '<div class="rc-hint"><div class="h-img">' + (m.img || '') + '</div><span class="badge">🎭 Образ</span></div>';
        if (s >= 2 && m.lines && m.lines[0]) h += '<div class="rc-hint"><span class="badge">' + D.types[m.lines[0].t].icon + ' ' + D.types[m.lines[0].t].label + '</span><p>' + txt(m.lines[0].x) + '</p></div>';
        if (s >= 3) {
          h += '<div class="rc-back">' + (f.f ? '<div class="fbox-in">' + math(f.f, 'big') + '</div>' : '') + (f.ruleText ? '<div class="rule">' + txt(f.ruleText) + '</div>' : '') +
            (f.forms && Object.keys(f.forms).length > 1 ? '<div class="forms">' + Object.values(f.forms).filter((x) => x !== f.f).map((x) => '<span class="form">' + math(x) + '</span>').join('') + '</div>' : '') +
            '<ul class="mnemo-l">' + (m.lines || []).slice(s >= 3 ? 0 : 1).map(lineHTML).join('') + '</ul>' + (m.trap ? '<p class="trap"><b>⚠️</b> ' + txt(m.trap) + '</p>' : '') + (mine[f.id] ? '<p class="story"><b>✍️ Моё:</b> ' + esc(mine[f.id]) + '</p>' : '') + '</div>';
        }
        return h;
      }
    }
    return '';
  }
  function actionsHTML(q) {
    const s = sess;
    if (q.type === 'recall') {
      if (q.rated) return '<button class="btn js-primary" data-act="next">' + (s.i + 1 >= s.items.length ? 'Результаты →' : 'Дальше →') + '</button>';
      if (q.step < 3) return '<button class="ghost" data-act="rstep" data-to="1"' + (q.step >= 1 ? ' disabled' : '') + '>🎭 Образ</button><button class="ghost" data-act="rstep" data-to="2"' + (q.step >= 2 ? ' disabled' : '') + '>🔤 Фраза</button><button class="btn js-primary" data-act="rstep" data-to="3">👀 Показать</button>';
      return '<span class="rate-l">Как вспомнилось?</span><button class="rate bad" data-act="rate" data-r="-1">😵 Забыл</button><button class="rate mid" data-act="rate" data-r="0">🤔 Почти</button><button class="rate good" data-act="rate" data-r="1">😎 Помню</button>';
    }
    if (q.answered) return '<button class="btn js-primary" data-act="next">' + (s.i + 1 >= s.items.length ? 'Результаты →' : 'Дальше →') + '</button>';
    const hintBtn = q.hint && !q.hintShown ? '<button class="ghost" data-act="hint">💡 Мнемоника-подсказка</button>' : '';
    if (q.type === 'build') return hintBtn + '<button class="btn js-primary" data-act="check-build"' + (q.built.length ? '' : ' disabled') + '>Проверить</button>';
    if (q.type === 'calc' || q.type === 'conv') return hintBtn + '<button class="btn js-primary" data-act="check-num">Проверить</button>';
    return hintBtn;
  }
  function renderQ() {
    const q = cur(), { f, t } = qMeta(q), n = sess.items.length;
    const chipT = t ? '<span class="chip">' + t.icon + ' ' + esc(t.name) + '</span>' : (f && f.topic ? '' : '');
    const modeChip = '<span class="chip soft">' + (MODES.find((m) => m.id === (q.type === 'prefix' ? 'conv' : q.type)) || { icon: '🎲' }).icon + ' ' + modeName(q.type === 'prefix' ? 'conv' : q.type) + '</span>';
    const title = q.type === 'recall' ? 'Вспомни и проверь себя' : q.title;
    app.innerHTML = '<section class="play"><div class="play-top"><a class="back" href="#/train" data-act="quit">✕</a><div class="bar"><i style="width:' + Math.round((sess.i / n) * 100) + '%"></i></div><span class="cnt">' + (sess.i + 1) + '/' + n + '</span></div>' +
      '<div class="qcard" ' + (t ? topicColor(t) : '') + ' data-type="' + q.type + '"><div class="q-meta">' + modeChip + chipT + '</div>' +
      '<h2 class="q-title">' + (q.type === 'sym' ? esc(title) : q.type === 'rule' ? txt(title) : esc(title)) + '</h2>' + (q.sub && q.type !== 'recall' ? '<p class="q-sub">' + esc(q.sub) + '</p>' : '') +
      '<div class="q-body">' + bodyHTML(q) + '</div>' +
      '<div class="hintbox" id="hintbox">' + (q.hintShown ? q.hint : '') + '</div><div class="fb" id="fb"></div>' +
      '<div class="q-actions" id="qa">' + actionsHTML(q) + '</div></div></section>';
    if (q.answered && q.fbHTML) { const fb = document.getElementById('fb'); fb.innerHTML = q.fbHTML; fb.className = 'fb show ' + (q.good ? 'good' : 'bad'); }
    const inp = document.getElementById('ans'); if (inp && !q.answered) inp.focus();
  }

  /* ---------- ответы ---------- */
  function finish(q, good, hinted, fbBody) {
    q.answered = true; q.good = good;
    const res = good ? (hinted ? 0 : 1) : -1;
    if (q.fid) record(q.fid, res); else { meta.days[today()] = (meta.days[today()] || 0) + 1; saveAll(); }
    const xp = good ? (hinted ? 5 : 10) : 0; if (good) sess.ok++; else if (q.fid) sess.wrong.push(q.fid);
    if (hinted) sess.hinted++;
    sess.xp += xp; addXp(xp);
    const { f } = qMeta(q); const m = f && f.m && f.m.lines && f.m.lines[0];
    const reminder = !good && f && f.m ? '<div class="remind"><b>🧠 Запомни образ:</b> <span class="h-img">' + (f.m.img || '') + '</span> ' + (m ? txt(m.x) : '') + '</div>' : '';
    q.fbHTML = '<div class="fb-h">' + (good ? '✅ Верно!' + (xp ? ' <span class="xp">+' + xp + ' XP</span>' : '') : '❌ Не совсем') + '</div>' + (fbBody || '') + reminder;
    q.hintShown = q.hintShown || false;
    renderQ();
  }
  function answerChoice(i) {
    const q = cur(); if (q.answered) return;
    const good = i === q.correct;
    q.picked = i;
    let body = '';
    const { f } = qMeta(q);
    if (q.type === 'pick' || q.type === 'mnemo' || q.type === 'tri') body = '<p>Правильно: ' + (q.type === 'tri' ? math(q.answer) : f.f ? math(f.f) : '') + '</p>' + (q.type !== 'pick' ? '' : '');
    if (q.type === 'sym') body = '<p>' + esc(q.explain) + '</p>';
    if (q.type === 'rule') body = '<p class="note">' + txt(q.note || '') + '</p>';
    if (q.type === 'fact' || q.type === 'prefix') body = '<p class="note">' + txt(q.note) + '</p>';
    finish(q, good, !!q.hintShown, body);
  }
  function checkNum() {
    const q = cur(); if (q.answered) return;
    const inp = document.getElementById('ans'), v = parseNum(inp.value);
    q.userAns = inp.value;
    if (isNaN(v)) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); toast('Введи число'); return; }
    if (q.type === 'conv') {
      const good = close(v, q.ans, 0.01);
      finish(q, good, false, '<p>' + fmt(q.v) + ' ' + esc(q.c.a) + ' = <b>' + fmt(q.ans) + ' ' + esc(q.c.b) + '</b></p><p class="note">💡 ' + esc(q.c.tip) + '</p>');
      return;
    }
    const good = close(v, q.ans, 0.02);
    const sol = '<div class="sol">' + q.sol.map((s) => '<div>' + (s[0] === '~' ? esc(s.slice(1)) : math(s)) + '</div>').join('') + '<div class="sol-a">Ответ: <b>' + fmt(q.ans) + ' ' + esc(q.unit || '') + '</b></div></div>' + (q.warn ? '<p class="note">⚠️ ' + txt(q.warn) + '</p>' : '');
    finish(q, good, !!q.hintShown, sol);
  }
  function checkBuild() {
    const q = cur(); if (q.answered || !q.built.length) return;
    const user = canonEq(q.built.map((c) => c.t)), right = canonEq(q.tk);
    const good = user === right;
    finish(q, good, !!q.hintShown, '<p>' + (good ? 'Формула: ' : 'Правильно: ') + math(byId[q.fid].f) + '</p>');
  }
  function rate(r) {
    const q = cur(); if (q.rated) return;
    q.rated = true; q.answered = true; q.good = r > 0;
    const hinted = q.step < 3 && false;
    record(q.fid, r);
    const xp = r > 0 ? (q.usedHints ? 5 : 8) : r === 0 ? 3 : 1;
    sess.xp += xp; addXp(xp); if (r > 0) sess.ok++; else if (r < 0) sess.wrong.push(q.fid);
    renderQ(); toast('+' + xp + ' XP');
  }
  function next() {
    if (!sess) return;
    sess.i++;
    if (sess.i >= sess.items.length) return renderResult();
    renderQ(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderResult() {
    const n = sess.items.length, pct = Math.round((sess.ok / n) * 100), bonus = pct >= 80 ? 20 : 0;
    if (bonus) { addXp(bonus); sess.xp += bonus; }
    const w = uniq(sess.wrong);
    const emoji = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';
    const msg = pct === 100 ? 'Идеально! Мнемоника работает.' : pct >= 80 ? 'Отлично! Ещё чуть-чуть до мастера.' : pct >= 50 ? 'Хорошо. Загляни в карточки ошибок.' : 'Это нормально — повтори образы и попробуй снова.';
    app.innerHTML = '<section class="result"><div class="r-emoji">' + emoji + '</div><h1>' + msg + '</h1>' + ring(sess.ok / n, 140, pct + '%') +
      '<p class="muted">' + sess.ok + ' из ' + n + ' верно · подсказок: ' + sess.hinted + ' · <b>+' + sess.xp + ' XP</b>' + (bonus ? ' (бонус +20 за точность!)' : '') + '</p>' +
      (w.length ? '<div class="wrongs"><h3>Над чем поработать</h3>' + w.map((id) => { const f = byId[id] || factById[id]; const mm = f.m; return '<a class="wrong" href="#/' + (byId[id] ? 'card/' + id : 'learn/' + f.topic) + '"><span>' + ((mm && mm.img) || '🔢') + '</span><b>' + esc(f.name || f.q) + '</b></a>'; }).join('') + '</div>' : '') +
      '<div class="cta"><a class="btn" href="#/play/' + sess.mode + (sess.params.topic ? '?topic=' + sess.params.topic : '') + '" data-act="again">🔁 Ещё раз</a>' +
      (w.length ? '<a class="btn ghost" href="#/play/mix?ids=' + w.join(',') + '&n=' + Math.max(6, w.length * 2) + '">🩹 Повторить ошибки</a>' : '') + '<a class="btn ghost" href="#/train">Тренажёры</a></div></section>';
    sess = null;
  }

  /* ============ вид: тренажёр ============ */
  function viewTrain() {
    const tchips = '<button class="tchip' + (!selTopic ? ' on' : '') + '" data-act="seltopic" data-t="">Все темы</button>' + TS.filter(gradeOk).map((t) => '<button class="tchip' + (selTopic === t.id ? ' on' : '') + '" data-act="seltopic" data-t="' + t.id + '" ' + topicColor(t) + '>' + t.icon + ' ' + esc(t.name) + '</button>').join('');
    const due = dueList().length;
    app.innerHTML = '<div class="page-head"><h1>🎮 Тренажёр</h1><p>Выбери тему (или все сразу) и режим. Чем чаще ошибаешься в формуле — тем чаще она будет попадаться.</p></div>' +
      '<div class="tchips" role="group" aria-label="Тема">' + tchips + '</div>' +
      '<div class="mgrid">' + MODES.map((m) => '<a class="mcard' + (m.id === 'mix' ? ' hot' : '') + '" href="#/play/' + m.id + (selTopic ? '?topic=' + selTopic : '') + '"><span class="mi">' + m.icon + '</span><div><b>' + m.name + '</b><small>' + m.desc + '</small></div></a>').join('') + '</div>' +
      '<div class="cta center"><a class="btn big" href="#/play/recall?due=1">⏰ Повторить сегодня' + (due ? ' (' + due + ')' : '') + '</a></div>';
  }

  /* ============ вид: техники ============ */
  function viewTech() {
    app.innerHTML = '<div class="page-head"><h1>🧠 Техники мнемоники</h1><p>Мнемоника — это способы запоминать с помощью образов, слов и логики. Ниже — 8 приёмов, на которых построен весь сайт.</p></div>' +
      '<div class="tgrid2">' + D.techs.map((t) => '<article class="tech"><div class="tech-i">' + t.icon + '</div><h3>' + t.name + '</h3><p class="tech-s">' + t.short + '</p><p>' + t.how + '</p><div class="ex"><b>Пример.</b> ' + txt(t.ex) + '</div></article>').join('') + '</div>' +
      '<section class="palace"><div class="sec-head"><h2>🏛️ Дворец памяти: маршрут по школе</h2></div><p class="muted">Представь, что идёшь по школе. В каждой комнате «стоит» образ из темы. Пройди маршрут мысленно — и вспомнишь все формулы по порядку.</p>' +
      [7, 8].map((g) => '<h3 class="pal-g">' + g + ' класс</h3><ol class="route">' + TS.filter((t) => t.grade === g).map((t, i) => '<li ' + topicColor(t) + '><a href="#/learn/' + t.id + '"><span class="ti">' + t.icon + '</span><div><b>' + (i + 1) + '. ' + esc(t.place) + '</b><small>' + esc(t.name) + ' · ' + FS.filter((f) => f.topic === t.id).map((f) => (f.m && f.m.img || '').slice(0, 2)).join(' ') + '</small></div></a></li>').join('') + '</ol>').join('') + '</section>' +
      '<section class="plan"><h2>⏱️ План на 10 минут в день</h2><ol class="steps-l"><li><b>2 мин.</b> Открой тему и прочитай образ-историю.</li><li><b>3 мин.</b> «Закрой и вспомни»: скрой формулу, восстанови по подсказке.</li><li><b>4 мин.</b> Тренажёр «Микс» по этой теме.</li><li><b>1 мин.</b> Запиши свою мнемонику в карточке — свои образы работают лучше всего.</li></ol></section>' +
      '<section class="tutor"><h2>👩‍🏫 Для репетитора</h2><p>Занятие на 30 минут: 5 мин — «Формула дня» и образ-история; 10 мин — «Карточки» с подсказками; 10 мин — «Микс» по теме; 5 мин — разбор ошибок на экране результатов. Прогресс можно переносить между устройствами на странице «Прогресс» (экспорт/импорт).</p></section>';
  }

  /* ============ вид: прогресс ============ */
  function viewProgress() {
    const fs = visFormulas(), got = fs.filter((f) => mastered(f.id)).length, seen = fs.filter((f) => prog[f.id] && prog[f.id].seen).length;
    const weak = fs.filter((f) => prog[f.id] && prog[f.id].seen && prog[f.id].b <= 1).sort((a, b) => prog[a.id].b - prog[b.id].b);
    const last = []; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY), k = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); last.push([k, meta.days[k] || 0]); }
    const mx = Math.max(5, ...last.map((x) => x[1]));
    const rk = rank();
    app.innerHTML = '<div class="page-head"><h1>📈 Прогресс</h1><p>Все данные хранятся только в твоём браузере.</p></div>' +
      '<div class="bento"><div class="b b-ring">' + ring(fs.length ? got / fs.length : 0, 96, got + '/' + fs.length) + '<div><b>Освоено</b><small>уровень «4 из 5» и выше</small></div></div>' +
      '<div class="b"><span class="big-n">👀 ' + seen + '</span><b>Изучено формул</b><small>из ' + fs.length + '</small></div><div class="b"><span class="big-n">🔥 ' + streak() + '</span><b>Дней подряд</b></div><div class="b"><span class="big-n">' + rk.r[2] + ' ' + (meta.xp || 0) + '</span><b>' + rk.r[1] + '</b><small>' + (rk.nxt ? 'ещё ' + (rk.nxt[0] - (meta.xp || 0)) + ' XP до следующего' : 'максимум!') + '</small></div></div>' +
      '<section><h2>Активность за 2 недели</h2><div class="spark">' + last.map((x) => '<div class="sp"><i style="height:' + Math.round((x[1] / mx) * 100) + '%" title="' + x[0] + ': ' + x[1] + '"></i><small>' + x[0].slice(8) + '</small></div>').join('') + '</div></section>' +
      '<section><h2>По темам</h2><div class="plist">' + TS.filter(gradeOk).map((t) => '<a class="prow" href="#/learn/' + t.id + '" ' + topicColor(t) + '><span class="ti">' + t.icon + '</span><b>' + esc(t.name) + '</b><div class="pbar"><i style="width:' + Math.round(topicPct(t.id) * 100) + '%"></i></div><small>' + Math.round(topicPct(t.id) * 100) + '%</small></a>').join('') + '</div></section>' +
      '<section><h2>Все формулы</h2><div class="dots">' + fs.map((f) => { const b = prog[f.id] ? prog[f.id].b : 0, seenF = prog[f.id] && prog[f.id].seen; return '<a class="dot b' + b + (seenF ? '' : ' new') + '" href="#/card/' + f.id + '" title="' + esc(f.name) + ' — уровень ' + b + '/5">' + ((f.m && f.m.img) ? f.m.img.slice(0, 2) : '⚛') + '</a>'; }).join('') + '</div><p class="tiny">Чем ярче точка — тем крепче память (0–5).</p></section>' +
      (weak.length ? '<section><h2>🩹 Слабые места</h2><div class="plist">' + weak.slice(0, 8).map((f) => '<a class="prow two" href="#/card/' + f.id + '"><span class="ti">' + ((f.m && f.m.img) || '⚛') + '</span><b>' + esc(f.name) + '</b><small>ошибок: ' + prog[f.id].bad + '</small></a>').join('') + '</div><div class="cta"><a class="btn" href="#/play/mix?ids=' + weak.slice(0, 8).map((f) => f.id).join(',') + '&n=10">Тренировать слабые</a></div></section>' : '') +
      '<section class="io"><h2>Перенос и сброс</h2><p class="muted">Скопируй код и вставь на другом устройстве — прогресс и твои мнемоники перенесутся.</p><textarea id="io" rows="3" placeholder="Здесь будет код прогресса"></textarea><div class="cta"><button class="btn ghost sm" data-act="export">Скопировать код</button><button class="btn ghost sm" data-act="import">Загрузить код</button><button class="btn danger sm" data-act="reset">Сбросить всё</button></div></section>';
  }

  /* ============ роутер ============ */
  function parse() {
    const raw = location.hash.replace(/^#\/?/, ''), [path, qs] = raw.split('?'), parts = path.split('/').filter(Boolean), params = {};
    (qs || '').split('&').filter(Boolean).forEach((p) => { const [k, v] = p.split('='); params[k] = decodeURIComponent(v || ''); });
    return { parts, params };
  }
  function route() {
    const { parts, params } = parse(), v = parts[0] || '';
    window.scrollTo(0, 0);
    if (v !== 'play') { /* уходим с сессии — сессия остаётся, если вернутся через «✕» нет */ }
    syncChrome(v === 'card' ? 'learn' : v === 'play' ? 'train' : v);
    app.classList.remove('fade'); void app.offsetWidth; app.classList.add('fade');
    if (v === 'play') {
      const mode = parts[1] || 'mix';
      if (!sess || sess.mode !== mode || params._new !== undefined || (sess.params && JSON.stringify(sess.params) !== JSON.stringify(params))) {
        if (!startSession(mode, params)) { location.hash = '#/train'; return; }
      }
      renderQ(); return;
    }
    sess = null;
    switch (v) {
      case 'learn': return viewLearn(parts[1]);
      case 'card': return viewCard(parts[1]);
      case 'train': return viewTrain();
      case 'tech': return viewTech();
      case 'progress': return viewProgress();
      default: return viewHome();
    }
  }

  /* ============ события ============ */
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-grade]');
    if (g) { grade = g.dataset.grade; store.set('grade', grade); syncChrome(parse().parts[0] || ''); if (!sess) route(); return; }
    if (e.target.closest('#themeBtn')) { const i = COLORS.findIndex((c) => c[0] === xcolor), n = COLORS[(i + 1) % COLORS.length]; xcolor = n[0]; store.set('xcolor', xcolor); applyTheme(); toast('Цвет фона: ' + n[1]); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    switch (act) {
      case 'cover': { const box = a.closest('[data-box]'); box.classList.toggle('covered'); a.textContent = box.classList.contains('covered') ? '👀 Показать' : '🙈 Закрой и вспомни'; break; }
      case 'tri': {
        const tri = a.closest('.tri'), f = byId[tri.dataset.tri], { top, l, r } = f.tri, v = a.dataset.v;
        tri.querySelectorAll('.tv').forEach((b) => b.classList.toggle('cov', b === a));
        const out = v === top ? v + ' = ' + l + '·' + r : v === l ? l + ' = {' + top + '|' + r + '}' : r + ' = {' + top + '|' + l + '}';
        tri.querySelector('.tri-out').innerHTML = '<span>Закрыли ' + math(v) + ' →</span> ' + math(out, 'big'); break;
      }
      case 'seltopic': selTopic = a.dataset.t; store.set('topic', selTopic); viewTrain(); break;
      case 'opt': answerChoice(+a.dataset.i); break;
      case 'hint': { const q = cur(); q.hintShown = true; document.getElementById('hintbox').innerHTML = q.hint; a.remove(); break; }
      case 'check-num': checkNum(); break;
      case 'check-build': checkBuild(); break;
      case 'chip': { const q = cur(); if (q.answered) break; const c = q.chips.find((x) => x.k === +a.dataset.k); q.built.push(c); document.querySelector('.q-body').innerHTML = bodyHTML(q); document.getElementById('qa').innerHTML = actionsHTML(q); break; }
      case 'unchip': { const q = cur(); if (q.answered) break; q.built = q.built.filter((x) => x.k !== +a.dataset.k); document.querySelector('.q-body').innerHTML = bodyHTML(q); document.getElementById('qa').innerHTML = actionsHTML(q); break; }
      case 'clear': { const q = cur(); if (q.answered) break; q.built = []; document.querySelector('.q-body').innerHTML = bodyHTML(q); document.getElementById('qa').innerHTML = actionsHTML(q); break; }
      case 'rstep': { const q = cur(); q.step = Math.max(q.step, +a.dataset.to); if (q.step < 3) q.usedHints = true; renderQ(); break; }
      case 'rate': rate(+a.dataset.r); break;
      case 'next': next(); break;
      case 'quit': sess = null; break;
      case 'again': sess = null; if (location.hash === a.getAttribute('href')) route(); break;
      case 'export': { const ta = document.getElementById('io'); ta.value = btoa(unescape(encodeURIComponent(JSON.stringify({ prog, meta, mine })))); ta.select(); try { document.execCommand('copy'); toast('Код скопирован'); } catch (er) { toast('Скопируй код вручную'); } break; }
      case 'import': { const ta = document.getElementById('io'); try { const d = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim())))); prog = d.prog || {}; meta = d.meta || { xp: 0, days: {} }; mine = d.mine || {}; store.set('mine', mine); saveAll(); toast('Прогресс загружен'); viewProgress(); } catch (er) { toast('Неверный код'); } break; }
      case 'reset': if (confirm('Точно сбросить весь прогресс и свои мнемоники?')) { prog = {}; meta = { xp: 0, days: {} }; mine = {}; store.set('mine', mine); saveAll(); toast('Прогресс сброшен'); viewProgress(); } break;
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target.closest('[data-mine]'); if (!t) return;
    mine[t.dataset.mine] = t.value; clearTimeout(input.k); input.k = setTimeout(() => store.set('mine', mine), 300);
  });
  function input() {}
  /* ---------- управление как в XMB: ◀ ▶ разделы, ▲ ▼ пункты, Enter — ✕, Esc — ○ ---------- */
  const NAV_ORDER = ['', 'learn', 'train', 'tech', 'progress'];
  const navOf = (v) => (v === 'card' ? 'learn' : v === 'play' ? 'train' : v || '');
  function parentHash() {
    const { parts } = parse(), v = parts[0] || '';
    if (v === 'card' && byId[parts[1]]) return '#/learn/' + byId[parts[1]].topic;
    if (v === 'learn' && parts[1]) return '#/learn';
    return '#/';
  }
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName || '', typing = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT';
    if (e.key === 'Escape') {
      if (typing) { e.target.blur(); return; }
      if (sess) { sess = null; location.hash = '#/train'; return; }
      if (parse().parts.length) location.hash = parentHash();
      return;
    }
    if (!typing && !sess && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const i = Math.max(0, NAV_ORDER.indexOf(navOf(parse().parts[0])));
      const n = NAV_ORDER[(i + (e.key === 'ArrowRight' ? 1 : NAV_ORDER.length - 1)) % NAV_ORDER.length];
      e.preventDefault(); location.hash = n ? '#/' + n : '#/'; return;
    }
    if (!typing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const ae = document.activeElement;
      if (ae && ae !== document.body && app.contains(ae)) {
        const items = [...app.querySelectorAll('a[href], button:not([disabled]), input, textarea')].filter((x) => x.offsetParent !== null);
        const k = items.indexOf(ae);
        if (k >= 0) { e.preventDefault(); const t = items[Math.max(0, Math.min(items.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)))]; t.focus(); t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }
      return;
    }
    if (!sess) return;
    const q = cur(); if (!q) return;
    if (!typing && !q.answered && q.opts && /^[1-4]$/.test(e.key) && q.opts[+e.key - 1]) { e.preventDefault(); answerChoice(+e.key - 1); return; }
    if (!typing && (e.key === 'h' || e.key === 'H') && q.hint && !q.hintShown && !q.answered) { const b = document.querySelector('[data-act="hint"]'); if (b) b.click(); return; }
    if (e.key !== 'Enter') return;
    if (tag === 'TEXTAREA') return;
    if (q.answered) { e.preventDefault(); next(); return; }
    if (q.type === 'calc' || q.type === 'conv') { e.preventDefault(); checkNum(); }
    else if (q.type === 'build') { e.preventDefault(); checkBuild(); }
  });

  /* ---------- шёлковые волны на фоне ---------- */
  function initWave() {
    const cv = document.getElementById('wave'); if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d'), reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const L = [{ a: .07, f: 1.1, s: .22, y: .40, al: .20 }, { a: .085, f: .8, s: -.16, y: .50, al: .16 }, { a: .055, f: 1.5, s: .3, y: .60, al: .15 }, { a: .1, f: .65, s: .11, y: .70, al: .11 }];
    let w = 0, h = 0, last = 0;
    function size() { w = cv.width = Math.max(320, Math.floor(innerWidth / 2)); h = cv.height = Math.max(240, Math.floor(innerHeight / 2)); }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      L.forEach((l, i) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const n = x / Math.max(w, h * 1.7), y = h * (l.y + l.a * Math.sin(n * Math.PI * 2 * l.f + t * l.s * 2 + i * 1.7) + l.a * .55 * Math.sin(n * Math.PI * 2 * l.f * 2.3 - t * l.s * 1.4 + i));
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,255,255,' + (l.al + .22) + ')'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, h * (l.y - l.a), 0, h);
        g.addColorStop(0, 'rgba(255,255,255,' + l.al + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fill();
      });
    }
    function frame(ts) {
      if (!document.hidden && ts - last > 40) { last = ts; draw(ts / 1000); }
      requestAnimationFrame(frame);
    }
    size(); draw(3);
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); draw(3); }, 150); });
    if (!reduce) requestAnimationFrame(frame);
  }

  window.addEventListener('hashchange', route);
  D._test = { M, toLin, tokensOf, canonDsl, canonEq, makeCalc, makePick, makeTri, makeMnemo, makeBuild, makeSym, makeRule, makeFact, makeConv, capable, fmt, parseNum, subst, byId };
  applyTheme(); initWave(); refreshStatus(); setInterval(refreshStatus, 15000); route();
})();

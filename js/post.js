/* МнемоФизика — пост-обработка данных: класс, раздел и экзамены для каждой формулы, формы из треугольников, ключи ask. */
(function () {
  const FM = window.FM, tm = Object.fromEntries(FM.topics.map((t) => [t.id, t]));
  FM.formulas.forEach((f) => {
    const t = tm[f.topic] || {};
    f.grade = t.grade; f.sec = t.sec; f.ex = f.ex || t.ex;
    if (f.tri && !f.forms) {
      const { top, l, r } = f.tri;
      f.forms = {};
      f.forms[top] = top + ' = ' + l + '·' + r;
      f.forms[l] = l + ' = {' + top + '|' + r + '}';
      f.forms[r] = r + ' = {' + top + '|' + l + '}';
    }
    if (f.f && !f.forms) f.forms = {};
    if (!f.ask && f.forms) {
      const consts = new Set((f.vars || []).filter((v) => v[3]).map((v) => v[0]));
      f.ask = Object.keys(f.forms).filter((k) => !consts.has(k));
    }
  });
})();

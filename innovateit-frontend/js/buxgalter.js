// ═══════════════════════════════════════════════════
//  InnovateIT — Buxgalter To'lovlar JS
// ═══════════════════════════════════════════════════



let U         = null;   // { username, parol, ism }
let ALL_DATA  = [];     // { student, tolov } merged array
let FILTERED  = [];     // after filter
let CURRENT_OY = '';   // '2025-03'

// ─── Yordamchi ───────────────────────────────────
const g = id => document.getElementById(id);

function oyNomi(oyStr) {
  if (!oyStr) return '—';
  const [y, m] = oyStr.split('-');
  const oylar = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun',
                 'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  return `${oylar[parseInt(m)]} ${y}`;
}

function prevOy(oy) {
  const [y, m] = oy.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function nextOy(oy) {
  const [y, m] = oy.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function currentOyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatSum(n, type) {
  if (!n || n === 0) return '<span class="amount-0">—</span>';
  const formatted = n.toLocaleString('ru-RU');
  if (type === 'qildi') return `<span class="amount-qildi">${formatted} <span class="amount-currency">so'm</span></span>`;
  if (type === 'kerak') return `<span class="amount-kerak">${formatted} <span class="amount-currency">so'm</span></span>`;
  return `<span class="amount-default">${formatted} <span class="amount-currency">so'm</span></span>`;
}
function parseSum(s) {
  return parseInt((s || '0').replace(/\D/g, '')) || 0;
}

function tolovSanasi(dateStr) {
  if (!dateStr) return '—';
  // DD.MM.YYYY → "Mart 14"
  const oylar = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun',
                 'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    return `${oylar[parseInt(parts[1])]} ${parseInt(parts[0])}`;
  }
  return dateStr;
}

function tolovHolati(kerak, qildi) {
  if (!kerak || kerak === 0) return '<span class="badge-empty">—</span>';
  if (qildi > kerak) {
    const ortiqcha = qildi - kerak;
    return `<span class="badge-toliq">✅ To'liq <span class="badge-ortiqcha">+${ortiqcha.toLocaleString('ru-RU')} so'm ortiqcha</span></span>`;
  }
  if (qildi === kerak) return '<span class="badge-toliq">✅ To\'liq</span>';
  if (qildi > 0)       return `<span class="badge-qisman">⚡ ${(kerak-qildi).toLocaleString('ru-RU')} so'm qoldi</span>`;
  return `<span class="badge-qarzdor">❌ ${kerak.toLocaleString('ru-RU')} so'm</span>`;
}

// ─── Kirish ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  CURRENT_OY = currentOyStr();
  g('oy-label').textContent = oyNomi(CURRENT_OY);

  // Saved session
  try {
    const saved = localStorage.getItem('iit_bux_u');
    if (saved) {
      U = JSON.parse(saved);
      showApp();
    }
  } catch(e) { localStorage.removeItem('iit_bux_u'); }

  g('inp-parol').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
  g('inp-username').addEventListener('keydown', e => { if (e.key==='Enter') g('inp-parol').focus(); });
});

async function doLogin() {
  const username = g('inp-username').value.trim();
  const parol    = g('inp-parol').value;
  if (!username || !parol) return;

  const btn = g('login-btn');
  btn.disabled = true; btn.textContent = 'Tekshirilmoqda…';

  try {
    const r = await api.loginBuxgalter({ username, parol });
    if (r.ok) {
      U = { username, parol, ism: r.ism };
      localStorage.setItem('iit_bux_u', JSON.stringify(U));
      showApp();
    } else {
      const errEl = g('login-err');
      errEl.textContent = '❌ ' + (r.error || "Username yoki parol noto'g'ri");
      errEl.style.display = 'block';
    }
  } catch(e) {
    g('login-err').textContent = '❌ Ulanishda xatolik';
    g('login-err').style.display = 'block';
  }
  btn.disabled = false; btn.textContent = 'Kirish';
}

function doLogout() {
  U = null; ALL_DATA = []; FILTERED = [];
  localStorage.removeItem('iit_bux_u');
  window.location.href = 'index.html';
}

function showApp() {
  g('login-screen').style.display = 'none';
  g('app').style.display = 'block';
  g('bux-badge').textContent = U.ism;
  initFixedHeader();
  applyColVisibility(); // saqlangan berkitilgan ustunlarni qo'llash
  window.addEventListener('resize', fixMainMargin, { passive: true });
  setTimeout(fixMainMargin, 200);
  loadData();
}

function fixMainMargin() {
  const topbar   = document.querySelector('.topbar');
  const ctrlBar  = document.querySelector('.ctrl-bar');
  const statsBar = g('stats-bar');
  const main     = document.querySelector('.bux-main');
  if (!statsBar || !main || !ctrlBar) return;

  // ctrl-bar ning haqiqiy pastki chegarasini olamiz
  const ctrlBottom  = ctrlBar.getBoundingClientRect().bottom;
  const statsHeight = statsBar.offsetHeight;

  // stats-bar ni ctrl-bar ning pastiga dinamik qo'yamiz
  statsBar.style.top = ctrlBottom + 'px';

  // bux-main ni stats-bar pastiga qo'yamiz
  main.style.marginTop = (ctrlBottom + statsHeight + 8) + 'px';
}

// ─── Fixed header (scroll da muzlab turishi uchun) ────
let fixedHeaderEl = null;

function initFixedHeader() {
  // Oldingi clone bo'lsa o'chiramiz
  if (fixedHeaderEl) { fixedHeaderEl.remove(); fixedHeaderEl = null; }

  const wrap = document.createElement('div');
  wrap.className = 'fixed-thead-wrap';
  wrap.id = 'fixed-thead-wrap';

  const tbl = document.createElement('table');
  tbl.className = 'bux-table';
  tbl.style.minWidth = '0';
  tbl.style.margin   = '0';

  const cloneThead = document.createElement('thead');
  cloneThead.id = 'fixed-thead-clone';
  tbl.appendChild(cloneThead);
  wrap.appendChild(tbl);
  document.body.appendChild(wrap);
  fixedHeaderEl = wrap;

  window.addEventListener('scroll', syncFixedHeader, { passive: true });
  window.addEventListener('resize', syncFixedHeader, { passive: true });
}

function syncFixedHeader() {
  const origThead = g('bux-thead');
  const wrap      = g('bux-table-wrap');
  const fixedWrap = g('fixed-thead-wrap');
  const clone     = g('fixed-thead-clone');
  if (!origThead || !wrap || !fixedWrap || !clone) return;

  const theadRect = origThead.getBoundingClientRect();
  const statsBar  = g('stats-bar');
  const fixedTop  = statsBar ? statsBar.getBoundingClientRect().bottom : 154;

  if (theadRect.bottom < fixedTop + 2) {
    // Clone bir marta qurish
    if (!clone.querySelector('tr')) {
      clone.innerHTML = origThead.innerHTML;
    }

    // Ustun kengliklarini sinxronlashtirish
    const origCells  = origThead.querySelectorAll('th');
    const cloneCells = clone.querySelectorAll('th');
    origCells.forEach((th, i) => {
      if (cloneCells[i]) {
        const w = th.getBoundingClientRect().width;
        cloneCells[i].style.width    = w + 'px';
        cloneCells[i].style.minWidth = w + 'px';
        cloneCells[i].style.maxWidth = w + 'px';
      }
    });

    // Jadval eni va gorizontal scroll sinxronlashtirish
    const cloneTbl = fixedWrap.querySelector('table');
    if (cloneTbl) {
      cloneTbl.style.width     = wrap.scrollWidth + 'px';
      cloneTbl.style.minWidth  = '0';
      cloneTbl.style.transform = `translateX(-${wrap.scrollLeft}px)`;
    }

    // Viewport ga to'g'ri joylashish — wrap ning chap va o'ng chegarasini olish
    const wrapRect = wrap.getBoundingClientRect();
    fixedWrap.style.top      = fixedTop + 'px';
    fixedWrap.style.left     = wrapRect.left + 'px';
    fixedWrap.style.width    = wrapRect.width + 'px';
    fixedWrap.style.overflow = 'hidden';

    fixedWrap.classList.add('visible');
  } else {
    fixedWrap.classList.remove('visible');
  }
}

// ─── Ustun berkitish tizimi ──────────────────────
const COL_LABELS = {
  maktab: 'Maktab',
  sinf:   'Sinf',
  tel:    'Telefon',
  qayd:   'Qaydnoma',
  gap:    'Gaplashilgan',
  kerak:  "To'lov kerak",
  qildi:  "To'lov qildi",
  sana:   "To'lov sanasi",
  holat:  "To'lov holati",
  kvit:   'Kvitansiya',
};

let hiddenCols = new Set(
  JSON.parse(localStorage.getItem('bux_hidden_cols') || '[]')
);

function toggleCol(col) {
  if (hiddenCols.has(col)) {
    hiddenCols.delete(col);
  } else {
    hiddenCols.add(col);
  }
  localStorage.setItem('bux_hidden_cols', JSON.stringify([...hiddenCols]));
  applyColVisibility();
  fixMainMargin();
}

function applyColVisibility() {
  Object.keys(COL_LABELS).forEach(col => {
    const display = hiddenCols.has(col) ? 'none' : '';
    document.querySelectorAll(`th.col-${col}, td.col-${col}`).forEach(el => {
      el.style.display = display;
    });
  });
  renderHiddenChips();
  // Fixed header clone ni qayta qurish
  const clone = g('fixed-thead-clone');
  if (clone) clone.innerHTML = '';
  const cloneTbl = document.querySelector('#fixed-thead-wrap table');
  if (cloneTbl) cloneTbl.style.width = '';
  setTimeout(syncFixedHeader, 30);
}

function renderHiddenChips() {
  const bar = g('hidden-cols-bar');
  if (!bar) return;
  if (hiddenCols.size === 0) {
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = [...hiddenCols].map(col => `
    <button class="hidden-col-chip" onclick="toggleCol('${col}')" title="Ko'rsatish">
      ${COL_LABELS[col]} <span class="chip-plus">+</span>
    </button>
  `).join('');
}

// Wrapper scroll qilganda (gorizontal) ham sinxronlashsin
function initScrollSync() {
  const wrap = g('bux-table-wrap');
  if (wrap) wrap.addEventListener('scroll', syncFixedHeader, { passive: true });
}

// ─── Oy navigatsiyasi ────────────────────────────
function changeOy(dir) {
  CURRENT_OY = dir > 0 ? nextOy(CURRENT_OY) : prevOy(CURRENT_OY);
  g('oy-label').textContent = oyNomi(CURRENT_OY);
  loadData();
}

// ─── Ma'lumot yuklash ────────────────────────────
async function loadData() {
  g('bux-tbody').innerHTML = `<tr><td colspan="12" class="bux-loading">⏳ Yuklanmoqda…</td></tr>`;
  clearStats();
  setTimeout(fixMainMargin, 100);

  try {
    // Parallel: barcha o'quvchilar + bu oylik to'lovlar
    const [studRes, tolovRes] = await Promise.all([
      api.buxGetStudents({ username: U.username, parol: U.parol, oy: CURRENT_OY }),
      api.getTolovlar({ username: U.username, parol: U.parol, oy: CURRENT_OY })
    ]);

    if (!studRes.ok) { showToast('❌ ' + studRes.error, 'error'); return; }

    const students = studRes.students || [];
    const tolovMap = {};
    (tolovRes.tolovlar || []).forEach(t => {
      const key = `${t.oquvchi_ism}|${t.oquvchi_familiya}|${t.admin_username}`;
      tolovMap[key] = t;
    });

    // Merge
    ALL_DATA = students.map(s => {
      const key = `${s.ism}|${s.familiya}|${s.admin}`;
      return { student: s, tolov: tolovMap[key] || null };
    });

    applyFilters();
  } catch(e) {
    g('bux-tbody').innerHTML = `<tr><td colspan="15" class="bux-loading">❌ Xatolik: ${e.message}</td></tr>`;
  }
}

function applyFilters() {
  const maktab     = g('filter-maktab').value;
  const sinf       = g('filter-sinf').value;
  const tolovF     = g('filter-tolov').value;
  const search     = g('filter-search').value.toLowerCase().trim();

  FILTERED = ALL_DATA.filter(({student: s, tolov: t}) => {
    if (maktab && s.maktab !== maktab) return false;
    if (sinf   && s.sinf   !== sinf)   return false;
    if (search) {
      const full = `${s.ism} ${s.familiya} ${s.telefon}`.toLowerCase();
      if (!full.includes(search)) return false;
    }
    // To'lov holati filtri
    if (tolovF) {
      const kerak = t?.tolov_kerak || 0;
      const qildi = t?.tolov_qildi || 0;
      if (tolovF === 'yopgan'  && !(qildi >= kerak && kerak > 0)) return false;
      if (tolovF === 'qarzdor' && !(qildi > 0 && qildi < kerak))  return false;
      if (tolovF === 'umuman'  && !(qildi === 0 && kerak > 0))    return false;
    }
    return true;
  });

  buildFilterOptions();
  renderTable();
  updateStats();
}

function buildFilterOptions() {
  const maktabSel = g('filter-maktab');
  const sinfSel   = g('filter-sinf');
  const curM = maktabSel.value, curS = sinfSel.value;

  const maktablar = [...new Set(ALL_DATA.map(d => d.student.maktab).filter(Boolean))].sort((a,b) => +a - +b);
  const sinflar   = [...new Set(ALL_DATA.map(d => d.student.sinf).filter(Boolean))].sort();

  maktabSel.innerHTML = '<option value="">🏫 Barcha maktablar</option>'
    + maktablar.map(m => `<option value="${m}"${m===curM?' selected':''}>${m}-maktab</option>`).join('');
  sinfSel.innerHTML   = '<option value="">📚 Barcha sinflar</option>'
    + sinflar.map(s => `<option value="${s}"${s===curS?' selected':''}>${s}</option>`).join('');
}

// ─── Jadvalni chizish ────────────────────────────
function renderTable() {
  const tbody = g('bux-tbody');
  if (FILTERED.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="bux-empty">
      <span class="emoji">💼</span>
      Hozircha ma'lumot yo'q. "Oyni boshlash" tugmasini bosing.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = FILTERED.map(({student: s, tolov: t}, i) => {
    const kerak  = t?.tolov_kerak || 0;
    const qildi  = t?.tolov_qildi || 0;
    const isNofaol = s.nofaol === true;

    // Nofaol belgisi
    const nofaolBadge = isNofaol
      ? `<span class="badge-nofaol-row" title="Chiqgan sana: ${s.chiqgan || '—'}">🚫 ${s.chiqgan || 'Nofaol'}</span> `
      : '';
    const kvFayl = t?.kvitansiya_fayl || '';

    // Kvitansiya cell
    const kvitCell = kvFayl
      ? buildKvitPreview(kvFayl, i)
      : buildDropZone(i);

    return `<tr id="row-${i}" data-idx="${i}" ${isNofaol ? 'class="row-nofaol"' : ''}>
      <td class="col-num">${i+1}</td>
      <td class="col-name">${nofaolBadge}${s.familiya} ${s.ism}</td>
      <td class="col-maktab">${s.maktab || '—'}</td>
      <td class="col-sinf">${s.sinf || '—'}</td>
      <td class="col-tel">${s.telefon || '—'}</td>
      <td class="col-qayd editable" onclick="editCell(${i},'qaydnoma')">
        <span id="disp-qaydnoma-${i}">${t?.qaydnoma || '<span class="amount-0">—</span>'}</span>
      </td>
      <td class="col-gap editable" onclick="editCell(${i},'gaplashilgan_vaqt')">
        <span id="disp-gaplashilgan_vaqt-${i}">${t?.gaplashilgan_vaqt || '<span class="amount-0">—</span>'}</span>
      </td>
      <td class="col-kerak editable" onclick="editCell(${i},'tolov_kerak')">
        <span id="disp-tolov_kerak-${i}">${formatSum(kerak,'kerak')}</span>
      </td>
      <td class="col-qildi editable" onclick="editCell(${i},'tolov_qildi')">
        <span id="disp-tolov_qildi-${i}">${formatSum(qildi,'qildi')}</span>
      </td>
      <td class="col-sana" onclick="editCell(${i},'tolov_sanasi')" style="cursor:pointer;">
        <span id="disp-tolov_sanasi-${i}">${t?.tolov_sanasi ? tolovSanasi(t.tolov_sanasi) : '<span class="amount-0">—</span>'}</span>
      </td>
      <td class="col-holat" id="holat-${i}">${tolovHolati(kerak, qildi)}</td>
      <td class="col-kvit" id="kvit-cell-${i}">${kvitCell}</td>
    </tr>`;
  }).join('');

  // Fixed header clone ni yangilash
  const clone = g('fixed-thead-clone');
  if (clone) {
    const origThead = g('bux-thead');
    if (origThead) clone.innerHTML = origThead.innerHTML;
  }
  // Berkitilgan ustunlarni qo'llash
  applyColVisibility();
  initScrollSync();
  setTimeout(syncFixedHeader, 50);
  setTimeout(fixMainMargin,   50);
}

function encodeKey(s) {
  return btoa(encodeURIComponent(`${s.ism}|${s.familiya}|${s.admin}`));
}

// ─── Inline tahrirlash ───────────────────────────
let activeEdit = null;

function editCell(idx, field) {
  if (activeEdit) commitEdit(activeEdit.idx, activeEdit.field);

  const item    = FILTERED[idx];
  const tolov   = item.tolov || {};
  const dispEl  = g(`disp-${field}-${idx}`);
  const td      = dispEl?.parentElement;
  if (!td) return;

  const curVal = tolov[field] !== undefined ? String(tolov[field] || '') : '';
  const isNum  = ['tarif','tolov_kerak','tolov_qildi'].includes(field);
  const isDate = field === 'tolov_sanasi';

  let inputHtml;
  if (isDate) {
    const isoVal = dateUZtoISO(curVal);
    inputHtml = `<input type="date" class="cell-input date-input" id="cedit-${field}-${idx}"
      value="${isoVal}" max="${todayISO()}"
      style="width:100%;cursor:pointer;">`;
  } else {
    inputHtml = `<input type="${isNum?'number':'text'}" class="cell-input"
      id="cedit-${field}-${idx}"
      value="${isNum ? (parseInt(curVal)||0) : curVal}"
      ${isNum ? 'min="0" step="1000"' : ''}>`;
  }

  td.innerHTML = inputHtml;
  const inp = g(`cedit-${field}-${idx}`);
  inp.focus();

  if (isDate) {
    // Kalendar avtomatik ochilsin
    try { inp.showPicker(); } catch(e) {}
    inp.addEventListener('change', () => commitEdit(idx, field));
    inp.addEventListener('blur',   () => setTimeout(() => commitEdit(idx, field), 200));
  } else {
    inp.select();
    inp.addEventListener('blur',    () => commitEdit(idx, field));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  commitEdit(idx, field);
      if (e.key === 'Escape') cancelEdit(idx, field, dispEl.outerHTML);
    });
  }

  activeEdit = { idx, field };
  document.getElementById(`row-${idx}`)?.classList.add('editing');
}

async function commitEdit(idx, field) {
  if (!activeEdit || activeEdit.idx !== idx || activeEdit.field !== field) return;
  activeEdit = null;

  const inp = g(`cedit-${field}-${idx}`);
  if (!inp) return;

  let val = inp.value.trim();
  const isNum  = ['tarif','tolov_kerak','tolov_qildi'].includes(field);
  const isDate = field === 'tolov_sanasi';

  if (isNum)  val = parseInt(val) || 0;
  if (isDate) val = val ? dateISOtoUZ(val) : '';

  const item = FILTERED[idx];
  if (!item.tolov) item.tolov = {};
  item.tolov[field] = val;

  // Update display
  const td = inp.parentElement;
  const dispVal = isNum
    ? (field === 'tolov_qildi' ? formatSum(val,'qildi')
       : field === 'tolov_kerak' ? formatSum(val,'kerak')
       : formatSum(val))
    : isDate ? (val ? tolovSanasi(val) : '<span class="amount-0">—</span>')
    : (val || '<span class="amount-0">—</span>');
  td.innerHTML = `<span id="disp-${field}-${idx}">${dispVal}</span>`;

  // To'lov holati ni yangilash
  if (['tolov_kerak','tolov_qildi'].includes(field)) {
    const kerak = item.tolov.tolov_kerak || 0;
    const qildi = item.tolov.tolov_qildi || 0;
    const holatEl = g(`holat-${idx}`);
    if (holatEl) holatEl.innerHTML = tolovHolati(kerak, qildi);
  }

  document.getElementById(`row-${idx}`)?.classList.remove('editing');

  // Saqlash
  await saveRow(idx);
  updateStats();
}

function cancelEdit(idx, field, oldHtml) {
  activeEdit = null;
  const inp = g(`cedit-${field}-${idx}`);
  if (inp) inp.parentElement.innerHTML = oldHtml;
  document.getElementById(`row-${idx}`)?.classList.remove('editing');
}

async function saveRow(idx) {
  const item = FILTERED[idx];
  const s    = item.student;
  const t    = item.tolov || {};

  // Show saving indicator
  showToast('💾 Saqlanmoqda…');

  try {
    const r = await api.saveTolov({
      username:         U.username,
      parol:            U.parol,
      oy:               CURRENT_OY,
      oquvchi_ism:      s.ism,
      oquvchi_familiya: s.familiya,
      maktab:           s.maktab || '',
      sinf:             s.sinf   || '',
      telefon:          s.telefon || '',
      admin_username:   s.admin  || '',
      tarif:            t.tarif             || 0,
      qaydnoma:         t.qaydnoma          || '',
      gaplashilgan_vaqt: t.gaplashilgan_vaqt || '',
      tolov_kerak:      t.tolov_kerak       || 0,
      tolov_qildi:      t.tolov_qildi       || 0,
      tolov_sanasi:     t.tolov_sanasi      || '',
      kvitansiya_fayl:  t.kvitansiya_fayl   || ''
    });
    if (r.ok) showToast('✅ Saqlandi', 'success');
    else      showToast('❌ ' + r.error, 'error');
  } catch(e) {
    showToast('❌ Xatolik: ' + e.message, 'error');
  }
}

// ─── Oyni boshlash ───────────────────────────────
async function initOy() {
  const prevO = prevOy(CURRENT_OY);
  const r = await api.initOy({
    username:   U.username,
    parol:      U.parol,
    oy:         CURRENT_OY,
    oldingi_oy: prevO
  });
  if (r.ok) {
    showToast(`✅ ${r.count} ta o'quvchi uchun ${oyNomi(CURRENT_OY)} oyi boshlandi`, 'success');
    loadData();
  } else {
    showToast('❌ ' + r.error, 'error');
  }
}

// ─── Statistika ──────────────────────────────────
function updateStats() {
  let total=0, kerakSum=0, qildiSum=0;
  FILTERED.forEach(({tolov: t}) => {
    total++;
    kerakSum += t?.tolov_kerak || 0;
    qildiSum += t?.tolov_qildi || 0;
  });
  const qarzSum = Math.max(0, kerakSum - qildiSum);

  g('stat-total').textContent = total;
  g('stat-kerak').textContent = kerakSum ? kerakSum.toLocaleString('ru-RU') + " so'm" : '—';
  g('stat-qildi').textContent = qildiSum ? qildiSum.toLocaleString('ru-RU') + " so'm" : '—';
  g('stat-qarz').textContent  = qarzSum  ? qarzSum.toLocaleString('ru-RU')  + " so'm" : '✅ 0';
}
function clearStats() {
  ['stat-total','stat-kerak','stat-qildi','stat-qarz'].forEach(id => {
    const el = g(id); if (el) el.textContent = '—';
  });
}

// ─── Export Excel ────────────────────────────────
function exportExcel() {
  const rows = [
    ['№','Familiya Ismi','Maktab','Sinf','Telefon',
     'Qaydnoma','Gaplashilgan vaqt',"To'lov kerak","To'lov qildi",
     "To'lov sanasi","To'lov holati",'Kvitansiya']
  ];
  FILTERED.forEach(({student: s, tolov: t}, i) => {
    const kerak = t?.tolov_kerak || 0;
    const qildi = t?.tolov_qildi || 0;
    let holat = '—';
    if (kerak > 0) {
      if (qildi > kerak)       holat = `To'liq (+${qildi-kerak} so'm ortiqcha)`;
      else if (qildi === kerak) holat = "To'liq";
      else if (qildi > 0)      holat = `${kerak-qildi} so'm qoldi`;
      else                     holat = `${kerak} so'm qarzdor`;
    }
    rows.push([
      i+1,
      `${s.familiya} ${s.ism}`,
      s.maktab  || '',
      s.sinf    || '',
      s.telefon || '',
      t?.qaydnoma          || '',
      t?.gaplashilgan_vaqt || '',
      kerak,
      qildi,
      t?.tolov_sanasi    || '',
      holat,
      t?.kvitansiya_fayl || ''
    ]);
  });

  // CSV format (Excel tomonidan to'g'ri ochiladi)
  const csvContent = rows.map(r =>
    r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tolovlar-${CURRENT_OY}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📊 CSV yuklab olindi', 'success');
}

// ─── Yordamchi: sana konversiya ──────────────────
function dateUZtoISO(uz) {
  if (!uz) return '';
  const p = uz.split('.');
  if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
  return '';
}
function dateISOtoUZ(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
  return '';
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Toast xabar ────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  const el = g('bux-toast');
  el.textContent  = msg;
  el.className    = `bux-toast ${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2500);
}

// ─── Kvitansiya fayl yuklash (Drag & Drop + Click) ─
function uploadKvit(idx) {
  // Drop zona HTML ni render qilish
  const cell = g(`kvit-cell-${idx}`);
  if (!cell) return;
  cell.innerHTML = buildDropZone(idx);
}

function buildDropZone(idx) {
  return `<div class="kvit-drop-zone" id="kvit-dz-${idx}"
    ondragover="kvitDragOver(event,${idx})"
    ondragleave="kvitDragLeave(event,${idx})"
    ondrop="kvitDrop(event,${idx})"
    onclick="kvitDzClick(event,${idx})">
    <input type="file" accept="image/*,.pdf"
      id="kvit-file-inp-${idx}"
      onchange="kvitFileSelected(event,${idx})">
    <span class="kvit-dz-icon">📎</span>
    <span class="kvit-dz-label">Yuklash, tashlang<br>yoki Ctrl+V</span>
  </div>`;
}

// Drop zona bosilganda: agar clipboard da rasm bo'lsa — uni ol, bo'lmasa file dialog och
async function kvitDzClick(e, idx) {
  // Input o'zi ichida — uni bloklaymiz, quyida o'zimiz boshqaramiz
  if (e.target.tagName === 'INPUT') return;
  e.preventDefault();
  e.stopPropagation();

  // Paste rejimi faol bo'lsa — pasteClickHandler o'zi hal qiladi, bu yerda to'xtatamiz
  if (_pasteActive) return;

  // Clipboard API — rasm bor bo'lsa canvas orqali PNG ga o'tkazib upload
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const clipItems = await navigator.clipboard.read();
      for (const clipItem of clipItems) {
        const imgType = clipItem.types.find(t => t === 'image/png')
                     || clipItem.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const rawBlob = await clipItem.getType(imgType);
          const file    = await blobToCleanPng(rawBlob);
          if (file) { await doUploadFile(file, idx); return; }
        }
      }
    } catch(err) {
      // Ruxsat yo'q yoki rasm yo'q — file dialog ochamiz
    }
  }

  // Clipboard rasm yo'q — oddiy file dialog
  const inp = document.getElementById(`kvit-file-inp-${idx}`);
  if (inp) inp.click();
}

function kvitDragOver(e, idx) {
  e.preventDefault();
  e.stopPropagation();
  const dz = g(`kvit-dz-${idx}`);
  if (dz) dz.classList.add('drag-over');
}

function kvitDragLeave(e, idx) {
  const dz = g(`kvit-dz-${idx}`);
  if (dz) dz.classList.remove('drag-over');
}

async function kvitDrop(e, idx) {
  e.preventDefault();
  e.stopPropagation();
  const dz = g(`kvit-dz-${idx}`);
  if (dz) dz.classList.remove('drag-over');

  const dt = e.dataTransfer;

  // ── Debug: console da nima borligini ko'ramiz ──
  console.log('[kvitDrop] files:', dt?.files?.length, '| items:', dt?.items?.length, '| types:', dt?.types);
  if (dt?.items) {
    Array.from(dt.items).forEach((it, i) => console.log(`  item[${i}]: kind=${it.kind} type=${it.type}`));
  }

  // 1-usul: files array (file manager, Windows Explorer, ba'zi Telegram versiyalar)
  if (dt?.files?.length > 0) {
    const file = dt.files[0];
    console.log('[kvitDrop] file:', file.name, file.type, file.size);
    doUploadFile(file, idx);
    return;
  }

  // 2-usul: items dan getAsFile() — Telegram ba'zida items'da beradi, files'da emas
  if (dt?.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && file.size > 0) {
          console.log('[kvitDrop] item file:', file.name, file.type, file.size);
          doUploadFile(file, idx);
          return;
        }
      }
    }
  }

  // 3-usul: text/html ichidan <img src> (Telegram ayrim versiyalar)
  const html = dt?.getData('text/html') || '';
  if (html) {
    console.log('[kvitDrop] html:', html.slice(0, 200));
    const imgMatch = html.match(/src=["']([^"']+)["']/i);
    if (imgMatch) {
      const src = imgMatch[1];
      if (src.startsWith('data:image')) {
        try {
          const [meta, b64] = src.split(',');
          const mime  = meta.split(':')[1].split(';')[0];
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const blob  = new Blob([bytes], { type: mime });
          doUploadFile(new File([blob], 'kvit.png', { type: mime }), idx);
          return;
        } catch(err) { console.warn('base64 parse error', err); }
      }
      if (src.startsWith('http')) {
        try {
          showToast('⏳ Rasm yuklanmoqda…');
          const resp = await fetch(src);
          const blob = await resp.blob();
          doUploadFile(new File([blob], 'kvit.png', { type: blob.type || 'image/png' }), idx);
          return;
        } catch(err) { console.warn('fetch error', err); }
      }
    }
  }

  // 4-usul: text/uri-list (ba'zi ilovalar image URL beradi)
  const uri = dt?.getData('text/uri-list') || '';
  if (uri && uri.startsWith('http')) {
    try {
      console.log('[kvitDrop] uri:', uri);
      showToast('⏳ Rasm yuklanmoqda…');
      const resp = await fetch(uri);
      const blob = await resp.blob();
      if (blob.type.startsWith('image/')) {
        doUploadFile(new File([blob], 'kvit.png', { type: blob.type }), idx);
        return;
      }
    } catch(err) { console.warn('uri fetch error', err); }
  }

  console.warn('[kvitDrop] Hech narsa topilmadi. types:', dt?.types, 'html len:', html.length);
  showToast('❌ Faylni topa olmadi — iltimos Ctrl+V yoki "Yuklash" tugmasini ishlating', 'error');
}

function kvitFileSelected(e, idx) {
  const file = e.target?.files?.[0];
  if (file) doUploadFile(file, idx);
}

async function doUploadFile(file, idx) {
  if (!file || file.size === 0) {
    showToast('❌ Fayl bo\'sh yoki o\'qib bo\'lmadi', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('❌ Fayl 5MB dan katta bo\'lmasin', 'error');
    return;
  }
  const cell = g(`kvit-cell-${idx}`);
  if (cell) cell.innerHTML = `<span class="kvit-uploading">⏳</span>`;
  showToast('⏳ Yuklanmoqda…');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const r    = await fetch(`${BASE}/upload`, { method: 'POST', body: formData });
    const data = await r.json();
    if (data.ok) {
      if (!FILTERED[idx].tolov) FILTERED[idx].tolov = {};
      FILTERED[idx].tolov.kvitansiya_fayl = data.filename;
      await saveRow(idx);
      if (cell) cell.innerHTML = buildKvitPreview(data.filename, idx);
    } else {
      showToast('❌ ' + data.error, 'error');
      if (cell) cell.innerHTML = buildDropZone(idx);
    }
  } catch(err) {
    showToast('❌ Yuklashda xatolik', 'error');
    if (cell) cell.innerHTML = buildDropZone(idx);
  }
}

function buildKvitPreview(filename, idx) {
  const url    = `${BASE}/uploads/${filename}`;
  const isImg  = /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename);
  const isPdf  = /\.pdf$/i.test(filename);
  const thumb  = isImg
    ? `<img src="${url}" class="kvit-thumb" onclick="openKvit('${filename}',event)" title="Ko'rish">`
    : `<span class="kvit-file-icon" onclick="openKvit('${filename}',event)" title="Ko'rish">${isPdf ? '📄' : '📎'}</span>`;
  return `<div class="kvit-uploaded">
    ${thumb}
    <button class="kvit-del" onclick="deleteKvit(${idx},event)" title="O'chirish">✕</button>
  </div>`;
}

async function deleteKvit(idx, e) {
  e.stopPropagation();
  if (!confirm('Kvitansiya faylini o\'chirasizmi?')) return;

  const tolov = FILTERED[idx]?.tolov;
  const fayl  = tolov?.kvitansiya_fayl;
  if (!fayl) return;

  try { await fetch(`${BASE}/upload/${fayl}`, { method: 'DELETE' }); } catch {}

  FILTERED[idx].tolov.kvitansiya_fayl = '';
  await saveRow(idx);

  const cell = g(`kvit-cell-${idx}`);
  if (cell) cell.innerHTML = buildDropZone(idx);
  showToast('🗑️ O\'chirildi');
}

// ─── In-page Lightbox ────────────────────────────
function openKvit(filename, e) {
  e.stopPropagation();
  const url   = `${BASE}/uploads/${filename}`;
  const isImg = /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename);
  const isPdf = /\.pdf$/i.test(filename);

  const lb    = g('kvit-lightbox');
  const inner = g('kvit-lb-inner');
  const name  = g('kvit-lb-name');
  if (!lb || !inner) return;

  // Eski content tozalash
  inner.querySelectorAll('img,iframe').forEach(el => el.remove());
  name.textContent = filename;

  if (isImg) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = filename;
    inner.insertBefore(img, name);
  } else if (isPdf) {
    const fr = document.createElement('iframe');
    fr.src = url + '#toolbar=1';
    inner.insertBefore(fr, name);
  }

  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function kvitLbClose(e) {
  if (e && e.target && e.target.id !== 'kvit-lightbox' && !e.target.closest('#kvit-lb-close')) return;
  const lb = g('kvit-lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') kvitLbClose({ target: { id: 'kvit-lightbox' } });
});

// ─── Filter events ───────────────────────────────
window.changeOy       = changeOy;
window.doLogin        = doLogin;
window.doLogout       = doLogout;
window.applyFilters   = applyFilters;
window.exportExcel    = exportExcel;
window.initOy         = initOy;
window.editCell       = editCell;
window.uploadKvit     = uploadKvit;
window.deleteKvit     = deleteKvit;
window.openKvit       = openKvit;
window.toggleCol      = toggleCol;
window.kvitDragOver   = kvitDragOver;
window.kvitDragLeave  = kvitDragLeave;
window.kvitDrop       = kvitDrop;
window.kvitFileSelected = kvitFileSelected;
window.kvitLbClose    = kvitLbClose;
// ─── Ctrl+V paste → kvitansiya yuklash ──────────
// Telegram Windows'da CF_DIB (raw BMP data) clipboard'ga qo'yadi.
// e.clipboardData.getAsFile() raw bytes qaytaradi — server saqlaydi lekin brauzer ocholmaydi.
// Yechim: clipboard.read() → image/png blob olish → canvas orqali haqiqiy PNG ga konvert.
document.addEventListener('paste', async (e) => {
  const app = g('app');
  if (!app || app.style.display === 'none') return;

  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  e.preventDefault();

  let fileToUpload = null;

  // 1-usul: navigator.clipboard.read() — brauzer DIB/BMP ni PNG ga o'zi decode qiladi
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const clipItems = await navigator.clipboard.read();
      for (const clipItem of clipItems) {
        const imgType = clipItem.types.find(t => t === 'image/png')
                     || clipItem.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const rawBlob = await clipItem.getType(imgType);
          // Canvas orqali haqiqiy PNG yasaymiz (brauzer DIB → PNG decode qiladi)
          fileToUpload = await blobToCleanPng(rawBlob);
          break;
        }
      }
    } catch(err) {
      // Ruxsat rad etildi yoki API yo'q — fallback
    }
  }

  // 2-usul: e.clipboardData — oddiy screenshot/PNG uchun (Telegram uchun ishlamaydi)
  if (!fileToUpload) {
    const items = Array.from(e.clipboardData?.items || []);
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f && f.size > 0) {
          fileToUpload = await blobToCleanPng(f);
          break;
        }
      }
    }
  }

  if (!fileToUpload) return;
  await handlePasteFile(fileToUpload);
});

// Blob/File ni canvas orqali haqiqiy PNG ga o'tkazish
// createImageBitmap brauzer ichida decode qiladi — DIB, BMP, PNG, JPEG hammasi ishlaydi
async function blobToCleanPng(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise(resolve => {
      canvas.toBlob(b => {
        resolve(b ? new File([b], 'kvit.png', { type: 'image/png' }) : null);
      }, 'image/png');
    });
  } catch(e) {
    // createImageBitmap ishlamadi — original qaytaramiz
    return blob instanceof File ? blob : new File([blob], 'kvit.png', { type: blob.type || 'image/png' });
  }
}

async function handlePasteFile(file) {
  if (!file) return;
  const dropZones = document.querySelectorAll('.kvit-drop-zone');
  if (dropZones.length === 0) {
    showToast('❌ Yuklash uchun kvitansiya katakchasi kerak', 'error');
    return;
  }
  if (dropZones.length === 1) {
    const row = dropZones[0].closest('tr');
    const idx = parseInt(row?.dataset?.idx ?? '-1');
    if (idx < 0) return;
    showToast('📋 Rasm yuklanmoqda...');
    await doUploadFile(file, idx);
  } else {
    showPasteHint(file);
  }
}

let _pasteFile   = null;
let _pasteActive = false;

function showPasteHint(file) {
  if (_pasteActive) return;
  _pasteActive = true;
  _pasteFile   = file;

  showToast('Rasm tayyor — qaysi qatorga yuklashni bosing');

  document.querySelectorAll('.kvit-drop-zone').forEach(dz => {
    dz.classList.add('paste-ready');
    dz.addEventListener('click', pasteClickHandler, { once: true });
  });

  document.addEventListener('keydown', cancelPasteHint, { once: true });
}

async function pasteClickHandler(e) {
  const dz  = e.currentTarget;
  const row = dz.closest('tr');
  const idx = parseInt(row?.dataset?.idx ?? '-1');
  const fileToUpload = _pasteFile;   // cancelPasteHint dan OLDIN saqlab olamiz
  cancelPasteHint();
  if (idx >= 0 && fileToUpload) await doUploadFile(fileToUpload, idx);
}

function cancelPasteHint(e) {
  if (e && e.key !== 'Escape') return;
  _pasteActive = false;
  _pasteFile   = null;
  document.querySelectorAll('.kvit-drop-zone.paste-ready').forEach(dz => {
    dz.classList.remove('paste-ready');
    dz.removeEventListener('click', pasteClickHandler);
  });
}

window.showPasteHint  = showPasteHint;
window.cancelPasteHint = cancelPasteHint;
window.kvitDzClick     = kvitDzClick;
// ═══════════════════════════════════════════════════
//  InnovateIT School — Davomat  (davomat.js)
// ═══════════════════════════════════════════════════

const API = "/api";

const OYLAR  = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const KUNLAR = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];

const STATUSES = [
  { key: 'keldi',   emoji: '✅', title: 'Keldi'     },
  { key: 'kelmadi', emoji: '❌', title: 'Kelmadi'   },
  { key: 'sababli', emoji: '📋', title: 'Sababli'   },
  { key: 'kech',    emoji: '⏰', title: 'Kech keldi' },
];

// Foydalanuvchi ma'lumotlari (app.js dan sessionStorage orqali keladi)
let U  = null; // { username, parol, ism, isSuper, viewingUsername, viewingIsm }
let WU = null; // Haqiqiy ishlayotgan username (agar super admin boshqani ko'rsa)

// O'quvchilar va davomat holati
let STUDENTS   = []; // Barcha o'quvchilar
let attendance = {}; // { "Ism Familiya": "keldi"|"kelmadi"|"sababli"|"kech" }
let izohlar    = {}; // { "Ism Familiya": "izoh matni" }

// Joriy ko'rilayotgan sana
const TODAY = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
let currentDate = skipSunday(new Date(TODAY));

let pendingIzoh = null; // { key, btnEl }

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Session dan foydalanuvchini olish
  try {
    const saved = sessionStorage.getItem('iit_davomat_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch (e) { window.location.href = 'index.html'; return; }

  // Kimning davomati ko'rsatiladi?
  // Yangi tizimda: super admin maktab tanlagan bo'lsa, U.username = maktab admin username
  // isSuperProxy belgisi orqali aniqlaymiz
  WU = { username: U.username, ism: U.ism };

  // Badge
  const badge = g('dav-badge');
  if (U.isSuperProxy) {
    badge.textContent = '🏫 ' + U.ism;
    badge.classList.add('super');
  } else {
    badge.textContent = U.ism;
  }

  // Sana picker max = bugun
  g('date-picker').max = dateStr(TODAY);

  setDateUI(currentDate);
  updateNextBtn();

  // O'quvchilarni yuklash
  await loadStudents();
  // Shu sananing mavjud davomatini yuklash
  await loadDavomat(currentDate);
});

// ─────────────────────────────────────────────
//  NAVIGATSIYA
// ─────────────────────────────────────────────
function goBack() {
  window.location.href = 'index.html';
}

// ─────────────────────────────────────────────
//  SANA BOSHQARUVI
// ─────────────────────────────────────────────
function skipSunday(d) {
  const nd = new Date(d); nd.setHours(0,0,0,0);
  if (nd.getDay() === 0) nd.setDate(nd.getDate() - 1); // Oldinga emas, orqaga
  return nd;
}

function dateStr(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateDisplay(d) {
  return `${d.getDate()}-${OYLAR[d.getMonth()]}, ${d.getFullYear()}`;
}

function setDateUI(d) {
  g('date-display').textContent = formatDateDisplay(d);
  g('date-sub').textContent     = KUNLAR[d.getDay()];
  g('date-picker').value        = dateStr(d);
}

async function changeDate(dir) {
  const nd = new Date(currentDate);
  nd.setDate(nd.getDate() + dir);
  // Yakshanbani o'tkazib yuborish
  if (nd.getDay() === 0) nd.setDate(nd.getDate() + dir);
  if (nd > TODAY) return;

  currentDate = nd;
  attendance  = {};
  izohlar     = {};
  setDateUI(currentDate);
  updateNextBtn();
  render();
  await loadDavomat(currentDate);
}

async function onDatePick() {
  const val = g('date-picker').value;
  if (!val) return;
  const d = new Date(val + 'T00:00:00');
  if (d.getDay() === 0) {
    toast('⚠️ Yakshanba tanlash mumkin emas', 'error');
    g('date-picker').value = dateStr(currentDate); return;
  }
  if (d > TODAY) {
    toast('⚠️ Kelajak sana tanlash mumkin emas', 'error');
    g('date-picker').value = dateStr(currentDate); return;
  }
  currentDate = d;
  attendance  = {};
  izohlar     = {};
  setDateUI(currentDate);
  updateNextBtn();
  render();
  await loadDavomat(currentDate);
}

function updateNextBtn() {
  const nd = new Date(currentDate);
  nd.setDate(nd.getDate() + 1);
  if (nd.getDay() === 0) nd.setDate(nd.getDate() + 1);
  g('btn-next').disabled = nd > TODAY;
}

// ─────────────────────────────────────────────
//  MA'LUMOT YUKLASH
// ─────────────────────────────────────────────
async function loadStudents() {
  g('loading-ov').style.display = 'flex';
  try {
    const d = await req({ action: 'getStudents', username: U.username, parol: U.parol });
    if (d.ok) {
      // Yangi tizimda U.username = maktab admin username, shuning uchun d.students faqat shu admining o'quvchilari
      STUDENTS = d.students;
      render();
    } else {
      toast('❌ ' + d.error, 'error');
    }
  } catch (e) { toast("❌ Yuklashda xatolik", 'error'); }
  g('loading-ov').style.display = 'none';
}

async function loadDavomat(date) {
  try {
    const params = {
      action:   'getDavomat',
      username: U.username,
      parol:    U.parol,
      sana:     dateStr(date)
    };
    const d = await req(params);
    if (d.ok && d.records.length) {
      // Mavjud davomatni attendance obyektiga yuklash
      d.records.forEach(r => {
        attendance[r.ism] = r.status;
        if (r.izoh) izohlar[r.ism] = r.izoh;
      });
      render();
      toast(`✅ ${d.records.length} ta yozuv yuklandi`, 'success');
    }
  } catch (e) {}
}

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
function render() {
  const grid   = g('sinf-grid');
  const groups = {};

  STUDENTS.forEach(s => {
    if (!groups[s.sinf]) groups[s.sinf] = [];
    groups[s.sinf].push(s);
  });

  if (!Object.keys(groups).length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">👨‍🎓</div>
      <p>O'quvchilar topilmadi</p>
    </div>`;
    updateStats();
    return;
  }

  const sorted = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));

  grid.innerHTML = sorted.map((sinf, si) => {
    const list = groups[sinf];
    const c    = countStatuses(list);
    return `
    <div class="sinf-card" style="animation-delay:${si * 0.05}s">
      <div class="sinf-header">
        <div class="sinf-title">
          <span class="sinf-badge">${sinf}</span>
          <span style="font-size:12px;color:var(--muted);font-weight:400">${list.length} o'quvchi</span>
        </div>
        <div class="sinf-mini-stats">
          <span class="mini-s k">✅ ${c.keldi}</span>
          <span class="mini-s x">❌ ${c.kelmadi}</span>
          <span class="mini-s s">📋 ${c.sababli}</span>
          <span class="mini-s l">⏰ ${c.kech}</span>
        </div>
      </div>
      <div class="student-list">
        ${list.map((s, i) => {
          const key = s.ism + ' ' + s.familiya;
          const cur = attendance[key] || '';
          return `
          <div class="student-row${cur ? ' done' : ''}" id="row-${safeId(key)}">
            <span class="student-num">${i + 1}</span>
            <span class="student-name" title="${s.ism} ${s.familiya}">${s.ism} ${s.familiya}</span>
            <div class="status-btns">
              ${STATUSES.map(st => `
                <button class="s-btn${cur === st.key ? ' active-' + st.key : ''}"
                  title="${st.title}"
                  onclick="setStatus('${esc(key)}','${st.key}',this)"
                >${st.emoji}</button>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  updateStats();
}

function countStatuses(list) {
  const c = { keldi: 0, kelmadi: 0, sababli: 0, kech: 0 };
  list.forEach(s => {
    const key = s.ism + ' ' + s.familiya;
    const st  = attendance[key];
    if (st && c[st] !== undefined) c[st]++;
  });
  return c;
}

// ─────────────────────────────────────────────
//  STATUS BELGILASH
// ─────────────────────────────────────────────
function setStatus(key, status, btn) {
  if (status === 'sababli') {
    pendingIzoh = { key, btn };
    g('izoh-input').value = izohlar[key] || '';
    g('izoh-modal').style.display = 'flex';
    setTimeout(() => g('izoh-input').focus(), 100);
    return;
  }
  applyStatus(key, status, btn);
}

function applyStatus(key, status, btn) {
  const row  = btn.closest('.student-row');
  const btns = row.querySelectorAll('.s-btn');

  if (attendance[key] === status) {
    // Ikkinchi marta bossanda — o'chirish (toggle)
    delete attendance[key];
    if (status === 'sababli') delete izohlar[key];
    btns.forEach(b => b.className = 's-btn');
    row.classList.remove('done');
  } else {
    attendance[key] = status;
    btns.forEach(b => b.className = 's-btn');
    btn.className = `s-btn active-${status}`;
    row.classList.add('done');
  }

  updateCardStats(btn);
  updateStats();
}

// ─────────────────────────────────────────────
//  IZOH MODAL
// ─────────────────────────────────────────────
function confirmIzoh() {
  if (!pendingIzoh) return;
  const { key, btn } = pendingIzoh;
  const izoh = g('izoh-input').value.trim();
  izohlar[key] = izoh;
  closeIzoh();
  applyStatus(key, 'sababli', btn);
}
function closeIzoh() {
  g('izoh-modal').style.display = 'none';
  pendingIzoh = null;
}

// ─────────────────────────────────────────────
//  STATISTIKA
// ─────────────────────────────────────────────
function updateCardStats(el) {
  const card  = el.closest('.sinf-card');
  const rows  = card.querySelectorAll('.student-row');
  const c     = { keldi: 0, kelmadi: 0, sababli: 0, kech: 0 };
  rows.forEach(row => {
    const a = row.querySelector('[class*="active-"]');
    if (a) { const m = a.className.match(/active-(\w+)/); if (m && c[m[1]] !== undefined) c[m[1]]++; }
  });
  card.querySelector('.mini-s.k').textContent = '✅ ' + c.keldi;
  card.querySelector('.mini-s.x').textContent = '❌ ' + c.kelmadi;
  card.querySelector('.mini-s.s').textContent = '📋 ' + c.sababli;
  card.querySelector('.mini-s.l').textContent = '⏰ ' + c.kech;
}

function updateStats() {
  const c = { keldi: 0, kelmadi: 0, sababli: 0, kech: 0 };
  Object.values(attendance).forEach(s => { if (s && c[s] !== undefined) c[s]++; });
  g('st-keldi').textContent   = c.keldi;
  g('st-kelmadi').textContent = c.kelmadi;
  g('st-sababli').textContent = c.sababli;
  g('st-kech').textContent    = c.kech;
  g('st-total').textContent   = STUDENTS.length;
}

// ─────────────────────────────────────────────
//  SAQLASH
// ─────────────────────────────────────────────
function confirmSave() {
  const total  = STUDENTS.length;
  const marked = Object.keys(attendance).filter(k => attendance[k]).length;

  if (!marked) { toast('⚠️ Hech narsa belgilanmadi', 'error'); return; }
  if (marked < total) {
    toast(`⚠️ Hali ${total - marked} ta o'quvchi belgilanmadi`, 'error');
    return;
  }

  const c = { keldi: 0, kelmadi: 0, sababli: 0, kech: 0 };
  Object.values(attendance).forEach(s => { if (s && c[s] !== undefined) c[s]++; });

  g('modal-desc').innerHTML = `
    <span style="font-weight:600">${formatDateDisplay(currentDate)}</span> — ${KUNLAR[currentDate.getDay()]}<br>
    <span style="color:var(--muted);font-size:12px">${marked} / ${total} o'quvchi belgilangan</span>`;

  g('modal-stats').innerHTML = `
    <span class="dav-modal-stat k">✅ Keldi: ${c.keldi}</span>
    <span class="dav-modal-stat x">❌ Kelmadi: ${c.kelmadi}</span>
    <span class="dav-modal-stat s">📋 Sababli: ${c.sababli}</span>
    <span class="dav-modal-stat l">⏰ Kech: ${c.kech}</span>`;

  g('confirm-modal').style.display = 'flex';
}

function closeModal() { g('confirm-modal').style.display = 'none'; }

async function doSave() {
  // Records yig'ish
  const records = STUDENTS.map(s => {
    const key    = s.ism + ' ' + s.familiya;
    const status = attendance[key] || '';
    return { sinf: s.sinf, ism: key, status, izoh: izohlar[key] || '' };
  }).filter(r => r.status); // Faqat belgilanganlari

  bl('btn-confirm', 'save-spinner', 'save-txt', true, 'Saqlanmoqda…');
  try {
    const r = await req({
      action:   'saveDavomat',
      username: U.username,
      parol:    U.parol,
      sana:     dateStr(currentDate),
      records:  JSON.stringify(records)
    });
    if (r.ok) {
      closeModal();
      toast(`✅ ${r.saved} ta yozuv saqlandi!`, 'success');
    } else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik yuz berdi', 'error'); }
  bl('btn-confirm', 'save-spinner', 'save-txt', false, 'Ha, saqlash');
}

// ─────────────────────────────────────────────
//  YORDAMCHI FUNKSIYALAR
// ─────────────────────────────────────────────
async function req(body) {
  const qs = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return (await fetch(`${API}?${qs}`)).json();
}

function bl(btnId, spId, txtId, loading, txt) {
  g(btnId).disabled           = loading;
  g(spId).style.display       = loading ? 'inline-block' : 'none';
  g(txtId).textContent        = txt;
}

function g(id)      { return document.getElementById(id); }
function esc(s)     { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function safeId(s)  { return s.replace(/[^a-zA-Z0-9]/g, '_'); }

let toastT;
function toast(msg, type = '') {
  const t = g('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, 3000);
}

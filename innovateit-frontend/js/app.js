// ═══════════════════════════════════════════════════
//  InnovateIT School — Frontend JS  (v3.0)
//  + Boshlagan sana
//  + Nofaol o'quvchilar tizimi
// ═══════════════════════════════════════════════════

const API = (window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname === '')
  ? 'http://127.0.0.1:3001/api'
  : '/api';

let U      = null;
let S      = [];
let ADMINS = [];
let viewingAdmin = null;

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Bugungi sana — max qilib o'rnatish
  const today = todayStr();
  ['f-boshlagan', 'e-boshlagan', 'nofaol-chiqgan'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.max = today;
  });
  // Nofaol chiqgan sana default = bugun
  const nc = document.getElementById('nofaol-chiqgan');
  if (nc) nc.value = today;

  try {
    const saved = localStorage.getItem('iit_u');
    if (saved) { U = JSON.parse(saved); await showApp(); }
  } catch (e) { localStorage.removeItem('iit_u'); }

  g('inp-parol').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  g('inp-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') g('inp-parol').focus();
  });
});

// ─────────────────────────────────────────────
//  LOGIN / LOGOUT
// ─────────────────────────────────────────────
async function doLogin() {
  const username = g('inp-username').value.trim();
  const parol    = g('inp-parol').value;
  if (!username || !parol) return;

  const btn = g('login-btn');
  btn.disabled = true; btn.textContent = 'Tekshirilmoqda…';

  try {
    const r = await req({ action: 'login', username, parol });
    if (r.ok) {
      U = { username, parol, ism: r.ism, isSuper: r.isSuper };
      localStorage.setItem('iit_u', JSON.stringify(U));
      showApp();
    } else {
      showErr(g('login-err'), r.error || "Username yoki parol noto'g'ri");
    }
  } catch (e) {
    showErr(g('login-err'), 'Ulanishda xatolik');
  }
  btn.disabled = false; btn.textContent = 'Kirish';
}

function showErr(el, msg) {
  el.textContent = '❌ ' + msg;
  el.style.display = 'block';
}

function doLogout() {
  U = null; S = []; ADMINS = []; viewingAdmin = null;
  localStorage.removeItem('iit_u');
  document.body.classList.remove('super-admin');
  g('app').style.display = 'none';
  g('login-screen').style.display = 'flex';
  g('inp-username').value = '';
  g('inp-parol').value    = '';
  g('login-err').style.display = 'none';
}

// ─────────────────────────────────────────────
//  APP KO'RINISHI
// ─────────────────────────────────────────────
async function showApp() {
  g('login-screen').style.display = 'none';
  g('app').style.display = 'block';

  const b = g('admin-badge');
  b.textContent = U.ism;

  // Body'ga super-admin class qo'shish/olib tashlash
  if (U.isSuper) {
    document.body.classList.add('super-admin');
    b.classList.add('super');
    b.textContent = '⭐ ' + U.ism;
    g('tabs-row').style.display     = 'flex';
    g('admin-col').style.display    = '';
    g('admin-selector-wrap').style.display = 'flex';
    const amalCol = g('amal-col'); if(amalCol) amalCol.style.display = 'none';
    g('btn-davomat').style.display   = 'none';
    g('btn-teachers').style.display  = '';
    g('btn-nofaol').style.display    = '';
    g('add-student-form').style.display = 'none';
    await loadAdmins();
    buildAdminSelector();
  } else {
    document.body.classList.remove('super-admin');
    // Oddiy admin - selector va tabs yashiriladi
    g('tabs-row').style.display = 'none';
    g('admin-selector-wrap').style.display = 'none';
    g('btn-davomat').style.display  = '';
    g('btn-teachers').style.display = '';
    g('btn-nofaol').style.display   = '';
    g('add-student-form').style.display = 'block';
  }

  await loadStudents();
}

function switchTab(t) {
  g('tab-s').style.display = t === 's' ? 'block' : 'none';
  g('tab-a').style.display = t === 'a' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach((b, i) =>
    b.classList.toggle('active', (i === 0 && t === 's') || (i === 1 && t === 'a'))
  );
}

// ─────────────────────────────────────────────
//  SUPER ADMIN: ADMIN SELECTOR
// ─────────────────────────────────────────────
function buildAdminSelector() {
  const sel = g('admin-selector');
  sel.innerHTML = '<option value="">👁 Barcha o\'quvchilar</option>' +
    ADMINS.map(a => `<option value="${esc(a.username)}">${a.ism} (@${a.username})</option>`).join('');
  sel.value = viewingAdmin ? viewingAdmin.username : '';
}

async function onAdminSelect() {
  const sel = g('admin-selector');
  const val = sel.value;

  if (!val) {
    viewingAdmin = null;
    g('btn-davomat').style.display   = 'none';
    g('btn-teachers').style.display  = '';
    g('add-student-form').style.display = 'none';
  } else {
    const found = ADMINS.find(a => a.username === val);
    viewingAdmin = found ? { username: found.username, ism: found.ism, parol: found.parol } : null;
    g('btn-davomat').style.display   = '';
    g('btn-teachers').style.display  = '';
    g('add-student-form').style.display = 'block';
  }

  await loadStudents();
}

// ─────────────────────────────────────────────
//  O'QUVCHILAR
// ─────────────────────────────────────────────
async function loadStudents() {
  g('loading-ov').style.display = 'flex';
  try {
    const d = await req({ action: 'getStudents', username: U.username, parol: U.parol });
    if (d.ok) {
      let students = d.students;
      if (U.isSuper && viewingAdmin) {
        students = students.filter(s => s.admin === viewingAdmin.username);
      }
      S = students;
      S.forEach((s, i) => s.ri = i);
      updMaktabF();
      applyFilters();
      g('total-count').textContent = S.length + " o'quvchi";
    }
  } catch (e) { toast("❌ Ma'lumotlar yuklanmadi", 'error'); }
  g('loading-ov').style.display = 'none';
}

async function addStudent() {
  const ism      = g('f-ism').value.trim();
  const fam      = g('f-familiya').value.trim();
  const maktab   = getM('f-maktab');
  const sinf     = g('f-sinf').value;
  const tel      = g('f-tel').value.trim();
  const tel2     = g('f-tel2').value.trim();
  const manzil   = g('f-manzil').value.trim();
  const kun      = String(g('f-kun').value || '').padStart(2, '0');
  const oy       = g('f-oy').value;
  const yil      = g('f-yil').value;
  const boshlagan = g('f-boshlagan').value;

  if (yil && (yil < 2009 || yil > 2019)) { toast("⚠️ Yil 2009–2019 bo'lishi kerak", 'error'); return; }
  if (yil && oy && kun) g('f-tug').value = yil + '-' + oy + '-' + kun;
  const tug = g('f-tug').value;

  if (!ism || !fam) { toast("⚠️ Ism va familiya kiriting", 'error'); return; }
  if (!maktab)      { toast("⚠️ Maktab raqami 1–99", 'error'); g('f-maktab').classList.add('err'); return; }
  if (!sinf)        { toast("⚠️ Sinf tanlang", 'error'); return; }
  // Kelajak sanani tekshirish (agar kiritilgan bo'lsa)
  if (boshlagan && boshlagan > todayStr()) { toast("⚠️ Boshlagan sana bugundan kech bo'lmasligi kerak", 'error'); return; }

  bl('submit-btn', 'spinner', 'btn-txt', true, 'Saqlanmoqda…');
  const actingUser  = (U.isSuper && viewingAdmin) ? viewingAdmin.username : U.username;
  const actingParol = (U.isSuper && viewingAdmin) ? viewingAdmin.parol    : U.parol;
  try {
    const r = await req({
      action: 'addStudent', username: actingUser, parol: actingParol,
      ism, familiya: fam, maktab, sinf,
      telefon: tel, telefon2: tel2, manzil, tug, boshlagan,
      date: new Date().toLocaleDateString('uz-UZ')
    });
    if (r.ok) { clearF(); await loadStudents(); toast("✅ O'quvchi qo'shildi!", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  bl('submit-btn', 'spinner', 'btn-txt', false, 'Saqlash');
}

function applyFilters() {
  const q  = (g('f-search').value || '').toLowerCase();
  const fm = g('f-maktab-f').value;
  const fs = g('f-sinf-f').value;
  const d  = S.filter(s =>
    (!q  || (s.ism + ' ' + s.familiya + ' ' + s.telefon).toLowerCase().includes(q)) &&
    (!fm || String(s.maktab) === String(fm)) &&
    (!fs || s.sinf === fs)
  );
  renderTbl(d);
  renderMob(d);
}

function renderTbl(d) {
  const tb  = g('tbl-body');
  const sup = U && U.isSuper;
  if (!d.length) {
    tb.innerHTML = `<tr><td colspan="12">
      <div class="empty-state"><div class="empty-state-icon">📋</div><p>O'quvchi topilmadi</p></div>
    </td></tr>`;
    return;
  }
  tb.innerHTML = d.map((s, i) => `<tr>
    <td class="mono">${i + 1}</td>
    <td><strong>${s.ism}</strong> ${s.familiya}</td>
    <td><span class="maktab-badge">${s.maktab || '—'}</span></td>
    <td><span class="sinf-badge">${s.sinf || '—'}</span></td>
    <td class="mono">${s.telefon || '—'}</td>
    <td class="mono">${s.telefon2 || '—'}</td>
    <td class="mono">${fTug(s.tug)}</td>
    <td>${s.manzil || '—'}</td>
    ${sup ? `<td class="mono" style="font-size:11px;">${s.admin || '—'}</td>` : ''}
    <td class="mono">${fDate(s.boshlagan)}</td>
    <td class="mono">${fDate(s.date)}</td>
    ${!sup ? `<td><div style="display:flex;gap:6px;">
      <button class="btn-action" onclick="openES(${s.ri})">✏️</button>
      <button class="btn-action btn-action-del" onclick="openNofaolModal(${s.ri})">🗑️</button>
    </div></td>` : ''}
  </tr>`).join('');
}

function renderMob(d) {
  const el  = g('mob-cards');
  const sup = U && U.isSuper;
  if (!d.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>O\'quvchi topilmadi</p></div>';
    return;
  }
  el.innerHTML = d.map((s, i) => `
    <div class="sc">
      <div class="sc-header">
        <div>
          <div class="sc-name">${s.ism} ${s.familiya}</div>
          <div class="sc-num">#${i + 1}</div>
          <div class="sc-tags">
            <span class="maktab-badge">${s.maktab || '—'}-maktab</span>
            <span class="sinf-badge">${s.sinf || '—'}</span>
          </div>
        </div>
        ${!sup ? `<div class="sc-btns">
          <button class="btn-action" onclick="openES(${s.ri})">✏️</button>
          <button class="btn-action btn-action-del" onclick="openNofaolModal(${s.ri})">🗑️</button>
        </div>` : ''}
      </div>
      <div class="sc-body">
        <div class="sc-row"><span class="sc-lbl">📞 Telefon</span><span class="sc-val m">${s.telefon || '—'}</span></div>
        <div class="sc-row"><span class="sc-lbl">📞 Qo'sh.</span><span class="sc-val m">${s.telefon2 || '—'}</span></div>
        <div class="sc-row"><span class="sc-lbl">🎂 Tug'ilgan</span><span class="sc-val m">${fTug(s.tug)}</span></div>
        <div class="sc-row"><span class="sc-lbl">📅 Boshlagan</span><span class="sc-val m">${fDate(s.boshlagan)}</span></div>
        <div class="sc-row"><span class="sc-lbl">📍 Manzil</span><span class="sc-val">${s.manzil || '—'}</span></div>
        ${sup ? `<div class="sc-row sc-full"><span class="sc-lbl">👤 Admin</span><span class="sc-val m" style="font-size:11px;">${s.admin || '—'}</span></div>` : ''}
        <div class="sc-row"><span class="sc-lbl">🗓 Qo'shilgan</span><span class="sc-val m">${fDate(s.date)}</span></div>
      </div>
    </div>`).join('');
}

function updMaktabF() {
  const sel  = g('f-maktab-f'), cur = sel.value;
  const list = [...new Set(S.map(s => s.maktab).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  sel.innerHTML = '<option value="">Barcha maktab</option>' +
    list.map(m => `<option${String(m) === String(cur) ? ' selected' : ''}>${m}</option>`).join('');
}

// ── O'quvchi tahrirlash ──
let eIdx = null;

function openES(idx) {
  const s = S[idx]; if (!s) return; eIdx = idx;
  g('e-ism').value      = s.ism      || '';
  g('e-familiya').value = s.familiya || '';
  g('e-maktab').value   = s.maktab   || '';
  g('e-sinf').value     = s.sinf     || '';
  g('e-tel').value      = s.telefon  || '';
  g('e-tel2').value     = s.telefon2 || '';
  g('e-manzil').value   = s.manzil   || '';
  g('e-boshlagan').value = s.boshlagan ? String(s.boshlagan).substring(0, 10) : '';

  if (s.tug) {
    const d = new Date(s.tug);
    if (!isNaN(d)) {
      g('e-kun').value = d.getDate();
      g('e-oy').value  = String(d.getMonth() + 1).padStart(2, '0');
      g('e-yil').value = d.getFullYear();
      g('e-tug').value = d.toISOString().split('T')[0];
    }
  } else {
    ['e-kun', 'e-oy', 'e-yil', 'e-tug'].forEach(id => g(id).value = '');
  }
  g('es-modal').style.display = 'flex';
}

function closeES() { g('es-modal').style.display = 'none'; eIdx = null; }

async function saveES() {
  const ism      = g('e-ism').value.trim();
  const fam      = g('e-familiya').value.trim();
  const maktab   = getM('e-maktab');
  const sinf     = g('e-sinf').value;
  const tel      = g('e-tel').value.trim();
  const tel2     = g('e-tel2').value.trim();
  const manzil   = g('e-manzil').value.trim();
  const boshlagan = g('e-boshlagan').value;
  const kun      = String(g('e-kun').value || '').padStart(2, '0');
  const oy       = g('e-oy').value;
  const yil      = g('e-yil').value;

  if (yil && (yil < 2009 || yil > 2019)) { toast("⚠️ Yil 2009–2019 bo'lishi kerak", 'error'); return; }
  if (yil && oy && kun) g('e-tug').value = yil + '-' + oy + '-' + kun;
  const tug = g('e-tug').value;

  if (!ism || !fam) { toast("⚠️ Ism va familiya kiriting", 'error'); return; }
  if (!maktab)      { toast("⚠️ Maktab raqami 1–99", 'error'); return; }
  if (!sinf)        { toast("⚠️ Sinf tanlang", 'error'); return; }
  if (!tel)         { toast("⚠️ Telefon kiriting", 'error'); return; }
  if (boshlagan && boshlagan > todayStr()) { toast("⚠️ Boshlagan sana bugundan kech bo'lmasligi kerak", 'error'); return; }

  const s = S[eIdx];
  bl('es-save', 'es-spinner', 'es-btn-txt', true, 'Saqlanmoqda…');
  try {
    const r = await req({
      action: 'editStudent', username: U.username, parol: U.parol,
      oldIsm: s.ism, oldFamiliya: s.familiya,
      ism, familiya: fam, maktab, sinf,
      telefon: tel, telefon2: tel2, manzil, tug, boshlagan
    });
    if (r.ok) { closeES(); await loadStudents(); toast("✅ O'quvchi yangilandi!", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  bl('es-save', 'es-spinner', 'es-btn-txt', false, 'Saqlash');
}

// ─────────────────────────────────────────────
//  ✅ YANGI: NOFAOL MODAL
// ─────────────────────────────────────────────
let nofaolIdx = null;

function openNofaolModal(idx) {
  const s = S[idx]; if (!s) return;
  nofaolIdx = idx;
  g('nofaol-name-display').textContent = s.ism + ' ' + s.familiya;
  // Chiqgan sana default = bugun
  g('nofaol-chiqgan').value = todayStr();
  g('nofaol-chiqgan').max   = todayStr();
  g('nofaol-modal').style.display = 'flex';
}

const IZOH_MIN = 10;

function onNofaolIzohInput(el) {
  const len = el.value.trim().length;
  const counter = g('nofaol-izoh-counter');
  const hint    = g('nofaol-izoh-hint');
  const ok      = g('nofaol-izoh-ok');

  counter.textContent = len + ' / ' + IZOH_MIN + ' ta belgi minimum';

  if (len === 0) {
    el.classList.remove('field-error');
    counter.style.color = '#9ca3af';
    hint.style.display = 'none';
    ok.style.display   = 'none';
  } else if (len < IZOH_MIN) {
    el.classList.add('field-error');
    counter.style.color = '#dc2626';
    hint.style.display = 'block';
    ok.style.display   = 'none';
  } else {
    el.classList.remove('field-error');
    counter.style.color = '#16a34a';
    hint.style.display = 'none';
    ok.style.display   = 'block';
  }
}

function closeNofaolModal() {
  g('nofaol-modal').style.display = 'none';
  g('nofaol-izoh').value = '';
  g('nofaol-izoh').classList.remove('field-error');
  g('nofaol-izoh-hint').style.display = 'none';
  g('nofaol-izoh-ok').style.display   = 'none';
  g('nofaol-izoh-counter').textContent = '0 / ' + IZOH_MIN + ' ta belgi minimum';
  g('nofaol-izoh-counter').style.color = '#9ca3af';
  nofaolIdx = null;
}

async function confirmNofaol() {
  const s = S[nofaolIdx]; if (!s) return;
  const chiqgan = g('nofaol-chiqgan').value;
  const izoh    = (g('nofaol-izoh').value || '').trim();

  if (!chiqgan) { toast("⚠️ Safdan chiqgan sanani kiriting", 'error'); return; }
  if (chiqgan > todayStr()) { toast("⚠️ Sana bugundan kech bo'lmasligi kerak", 'error'); return; }
  if (!izoh) {
    g('nofaol-izoh').focus();
    g('nofaol-izoh').classList.add('field-error');
    g('nofaol-izoh-hint').style.display = 'block';
    g('nofaol-izoh-ok').style.display   = 'none';
    toast("⚠️ Chiqish sababini kiriting — majburiy maydon", 'error');
    return;
  }
  if (izoh.length < IZOH_MIN) {
    g('nofaol-izoh').focus();
    g('nofaol-izoh').classList.add('field-error');
    g('nofaol-izoh-hint').style.display = 'block';
    g('nofaol-izoh-ok').style.display   = 'none';
    toast("⚠️ Sabab kamida " + IZOH_MIN + " ta belgi bo'lishi kerak", 'error');
    return;
  }
  g('nofaol-izoh').classList.remove('field-error');
  g('nofaol-izoh-hint').style.display = 'none';

  g('nofaol-confirm-btn').disabled = true;
  g('nofaol-spinner').style.display = 'inline-block';
  g('nofaol-btn-txt').textContent = 'Saqlanmoqda…';

  try {
    const r = await req({
      action: 'moveToInactive',
      username: U.username, parol: U.parol,
      delIsm: s.ism, delFamiliya: s.familiya,
      chiqgan, izoh
    });
    if (r.ok) {
      closeNofaolModal();
      await loadStudents();
      toast("✅ O'quvchi nofaol ro'yxatga o'tkazildi", 'success');
    } else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }

  g('nofaol-confirm-btn').disabled = false;
  g('nofaol-spinner').style.display = 'none';
  g('nofaol-btn-txt').textContent = "Nofaolga o'tkazish";
}

// ─────────────────────────────────────────────
//  NOFAOL SAHIFAGA O'TISH ✅ YANGI
// ─────────────────────────────────────────────
function openNofaol() {
  // Super admin boshqa admin tanlagan bo'lsa, shu admin nomidan
  const isProxy = U.isSuper && viewingAdmin;
  const nofaolUser = {
    username:     isProxy ? viewingAdmin.username : U.username,
    parol:        isProxy ? viewingAdmin.parol    : U.parol,
    ism:          isProxy ? viewingAdmin.ism      : U.ism,
    isSuper:      U.isSuper && !viewingAdmin,
    isSuperProxy: !!isProxy
  };
  sessionStorage.setItem('iit_nofaol_user', JSON.stringify(nofaolUser));
  window.location.href = 'nofaol.html';
}

// ─────────────────────────────────────────────
//  ADMINLAR
// ─────────────────────────────────────────────
async function loadAdmins() {
  try {
    const d = await req({ action: 'getAdmins', username: U.username, parol: U.parol });
    if (d.ok) { ADMINS = d.admins; renderAdmins(d.admins); }
  } catch (e) {}
}

function renderAdmins(admins) {
  const el = g('admin-list');
  if (!admins.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><p>Admin yo\'q</p></div>';
    return;
  }
  el.innerHTML = admins.map(a => `
    <div class="admin-item">
      <div class="admin-info">
        <span class="admin-name">${a.ism}</span>
        <span class="admin-email">${a.username}</span>
        <span class="admin-ptag">🔑 ${a.parol || '—'}</span>
      </div>
      <div class="admin-acts">
        <button class="btn-action" onclick="openAE('${esc(a.username)}','${esc(a.ism)}','${esc(a.parol || '')}')">✏️</button>
        <button class="btn-small"  onclick="delA('${esc(a.username)}','${esc(a.ism)}')">O'chirish</button>
      </div>
    </div>`).join('');
}

async function createAdmin() {
  const ism      = g('a-ism').value.trim();
  const username = g('a-username').value.trim();
  const parol    = g('a-parol').value.trim();
  if (!ism || !username || !parol) { toast("⚠️ Barcha maydonlarni to'ldiring", 'error'); return; }

  bl(null, 'a-spinner', 'a-btn-txt', true, 'Yaratilmoqda…');
  try {
    const r = await req({
      action: 'createAdmin', username: U.username, parol: U.parol,
      newIsm: ism, newUsername: username, newParol: parol
    });
    if (r.ok) {
      ['a-ism', 'a-username', 'a-parol'].forEach(id => g(id).value = '');
      toast('✅ Admin yaratildi!', 'success');
      await loadAdmins();
      buildAdminSelector();
    } else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  bl(null, 'a-spinner', 'a-btn-txt', false, 'Yaratish');
}

async function delA(username, ism) {
  if (!confirm(`"${ism}" o'chirilsinmi?`)) return;
  try {
    const r = await req({ action: 'deleteAdmin', username: U.username, parol: U.parol, deleteUsername: username });
    if (r.ok) {
      toast("✅ Admin o'chirildi", 'success');
      await loadAdmins();
      buildAdminSelector();
    } else toast('❌ ' + r.error, 'error');
  } catch (e) {}
}

let aeOld = null;

function openAE(username, ism, parol) {
  aeOld = username;
  g('ae-ism').value      = ism;
  g('ae-username').value = username;
  g('ae-parol').value    = '';
  g('ae-modal').style.display = 'flex';
}
function closeAE() { g('ae-modal').style.display = 'none'; aeOld = null; }

async function saveAE() {
  const ism      = g('ae-ism').value.trim();
  const username = g('ae-username').value.trim();
  const parol    = g('ae-parol').value.trim();
  if (!ism || !username) { toast("⚠️ Ism va username majburiy", 'error'); return; }

  bl('ae-save', 'ae-spinner', 'ae-btn-txt', true, 'Saqlanmoqda…');
  try {
    const r = await req({
      action: 'editAdmin', username: U.username, parol: U.parol,
      oldUsername: aeOld, newIsm: ism, newUsername: username, newParol: parol
    });
    if (r.ok) {
      closeAE();
      await loadAdmins();
      buildAdminSelector();
      toast('✅ Admin yangilandi!', 'success');
    } else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  bl('ae-save', 'ae-spinner', 'ae-btn-txt', false, 'Saqlash');
}

// ─────────────────────────────────────────────
//  O'QITUVCHILAR / DAVOMAT
// ─────────────────────────────────────────────
function openTeachers() {
  let teacherUser;
  if (!U.isSuper) {
    teacherUser = { username: U.username, parol: U.parol, ism: U.ism, isSuper: false, isSuperProxy: false };
  } else if (viewingAdmin) {
    teacherUser = { username: viewingAdmin.username, parol: viewingAdmin.parol, ism: viewingAdmin.ism, isSuper: false, isSuperProxy: true, superUsername: U.username, superParol: U.parol, superIsm: U.ism };
  } else {
    teacherUser = { username: U.username, parol: U.parol, ism: U.ism, isSuper: true, adminsMap: JSON.stringify(ADMINS.map(a => ({ username: a.username, ism: a.ism }))) };
  }
  sessionStorage.setItem('iit_teacher_user', JSON.stringify(teacherUser));
  window.location.href = 'oqituvchilar.html';
}

function openDavomat() {
  if (U.isSuper && !viewingAdmin) { toast('⚠️ Avval maktab tanlang!', 'error'); return; }
  const isProxy = U.isSuper && viewingAdmin;
  const davomatUser = {
    username:      isProxy ? viewingAdmin.username : U.username,
    parol:         isProxy ? viewingAdmin.parol    : U.parol,
    ism:           isProxy ? viewingAdmin.ism      : U.ism,
    isSuper:       false,
    isSuperProxy:  isProxy,
    superUsername: U.username,
    superParol:    U.parol,
    superIsm:      U.ism
  };
  sessionStorage.setItem('iit_davomat_user', JSON.stringify(davomatUser));
  window.location.href = 'davomat.html';
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

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function clearF() {
  ['f-ism','f-familiya','f-maktab','f-tel','f-tel2','f-manzil','f-tug','f-kun','f-yil','f-boshlagan'].forEach(id => {
    const e = g(id); e.value = ''; e.classList && e.classList.remove('err');
  });
  g('f-oy').value = ''; g('f-sinf').value = '';
}

function bl(btnId, spId, txtId, loading, txt) {
  if (btnId) g(btnId).disabled = loading;
  g(spId).style.display = loading ? 'inline-block' : 'none';
  g(txtId).textContent  = txt;
}

function togglePw(id) {
  const i = document.getElementById(id);
  const ic = document.getElementById('eye-' + id);
  const h  = i.type === 'password'; i.type = h ? 'text' : 'password';
  ic.innerHTML = h
    ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
    : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`;
}

function valM(inp) {
  let v = inp.value.replace(/\D/g, '');
  if (v.length > 2) v = v.slice(0, 2);
  inp.value = v;
  const n = parseInt(v);
  inp.classList.toggle('err', !!(v && (isNaN(n) || n < 1 || n > 99)));
}

function getM(id) {
  const v = document.getElementById(id).value.trim();
  const n = parseInt(v);
  return (!v || isNaN(n) || n < 1 || n > 99) ? null : String(n);
}

function g(id)  { return document.getElementById(id); }
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function fDate(v) {
  if (!v) return '—';
  const s = String(v).trim();
  if (!s || s === 'undefined' || s === 'null') return '—';
  const d = new Date(s);
  if (!isNaN(d)) return d.toLocaleDateString('uz-UZ');
  return s;
}

function fTug(v) {
  if (!v) return '—';
  const s = String(v);
  if (s.match(/^\d{4}-\d{2}-\d{2}/) || s.includes('T')) {
    const d = new Date(s); if (!isNaN(d)) return d.toLocaleDateString('uz-UZ');
  }
  return s.length >= 4 ? s.substring(0, 4) : s;
}

let toastT;
function toast(msg, type = '') {
  const t = g('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, 3000);
}
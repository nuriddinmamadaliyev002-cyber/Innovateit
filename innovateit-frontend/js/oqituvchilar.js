// ═══════════════════════════════════════════════════
//  InnovateIT School — O'qituvchilar  (oqituvchilar.js)
//  Fixed: openEdit crash, modal show/hide, tel validation
// ═══════════════════════════════════════════════════

const API = (window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname === '')
  ? 'http://127.0.0.1:3001/api'
  : '/api';

let U    = null;   // { username, parol, ism, isSuper }
let T    = [];     // Barcha o'qituvchilar
let eIdx = null;   // Tahrirlash indexi
let ADMINS_MAP = {};

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_teacher_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch { window.location.href = 'index.html'; return; }

  // Topbar badge
  const badge = g('admin-badge');
  if (U.isSuper) {
    badge.classList.add('super');
    badge.textContent = '⭐ ' + U.ism;
  } else if (U.isSuperProxy) {
    badge.classList.add('super');
    badge.textContent = '🏫 ' + U.ism;
  } else {
    badge.textContent = U.ism;
  }

  // Super admin: forma va ba'zi tugmalar yashirin
  if (U.isSuper || U.isSuperProxy) {
    setDisplay('add-form', 'none');
    setDisplay('btn-davomat-teacher', 'none');
    setDisplay('btn-jadval-teacher', 'none');
  }

  // Telefon mask ulanishi
  setupTel('f-tel',  'f-tel-hint');
  setupTel('f-tel2', 'f-tel2-hint');
  setupTel('e-tel',  'e-tel-hint');
  setupTel('e-tel2', 'e-tel2-hint');

  await loadTeachers();
});

// ─────────────────────────────────────────────
//  NAVIGATSIYA
// ─────────────────────────────────────────────
function goBack()     { window.location.href = 'index.html'; }

function openDavomat() {
  sessionStorage.setItem('iit_teacher_dav_user', JSON.stringify(U));
  window.location.href = 'oqituvchilar-davomat.html';
}

function openJadval() {
  sessionStorage.setItem('iit_jadval_user', JSON.stringify(U));
  window.location.href = 'dars-jadvali.html';
}

// ─────────────────────────────────────────────
//  O'QITUVCHILARNI YUKLASH
// ─────────────────────────────────────────────
async function loadTeachers() {
  g('loading-ov').style.display = 'flex';

  if (U.isSuper && U.adminsMap) {
    try {
      const list = JSON.parse(U.adminsMap);
      list.forEach(a => { ADMINS_MAP[a.username] = a.ism; });
    } catch(e) {}
  }

  try {
    const d = await req({ action: 'getTeachers', username: U.username, parol: U.parol });
    if (d.ok) {
      T = d.teachers;
      T.forEach((t, i) => t.ri = i);
      applyFilter();
      g('total-count').textContent = T.length + " o'qituvchi";
    } else {
      toast('❌ ' + d.error, 'error');
    }
  } catch { toast("❌ Ma'lumotlar yuklanmadi", 'error'); }

  g('loading-ov').style.display = 'none';
}

// ─────────────────────────────────────────────
//  FILTER VA RENDER
// ─────────────────────────────────────────────
function applyFilter() {
  const q = (g('f-search').value || '').toLowerCase();
  const d = T.filter(t =>
    !q || (t.ism + ' ' + t.familiya + ' ' + (t.fan||'')).toLowerCase().includes(q)
  );
  renderTable(d);
  renderMobile(d);
}

function renderTable(d) {
  const tb      = g('tbl-body');
  const isSuper = U && U.isSuper;
  const isProxy = U && U.isSuperProxy;
  const isAdmin = !isSuper && !isProxy;

  // Ustunlarni ko'rinishini boshqarish
  const thAmal   = g('th-amal');
  const thMaktab = g('th-maktab');
  if (isSuper) {
    if (thAmal)   thAmal.style.display   = 'none';
    if (thMaktab) thMaktab.style.display = '';
  } else {
    if (thAmal)   thAmal.style.display   = '';
    if (thMaktab) thMaktab.style.display = 'none';
  }

  if (!d.length) {
    tb.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-state-icon">👩‍🏫</div>
      <p>O'qituvchi topilmadi</p>
    </div></td></tr>`;
    return;
  }

  tb.innerHTML = d.map((t, i) => {
    const maktabNom = ADMINS_MAP[t.admin] || t.admin || '—';
    return `<tr>
      <td class="mono">${i+1}</td>
      <td><strong>${esc2(t.ism)}</strong> ${esc2(t.familiya)}</td>
      <td><span class="fan-badge">${t.fan || '—'}</span></td>
      ${isSuper ? `<td style="font-size:12px;color:var(--muted);">${esc2(maktabNom)}</td>` : ''}
      <td class="mono">${t.telefon || '—'}</td>
      <td class="mono">${t.telefon2 || '—'}</td>
      ${isAdmin ? `<td><div style="display:flex;gap:6px;">
        <button class="btn-action" onclick="openEdit(${t.ri})">✏️</button>
        <button class="btn-action" onclick="confirmDel(${t.ri})">🗑️</button>
      </div></td>` : ''}
    </tr>`;
  }).join('');
}

function renderMobile(d) {
  const el      = g('mob-cards');
  const isSuper = U && U.isSuper;
  const isAdmin = !isSuper && !(U && U.isSuperProxy);

  if (!d.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👩‍🏫</div><p>O\'qituvchi topilmadi</p></div>';
    return;
  }

  el.innerHTML = d.map((t, i) => {
    const maktabNom = ADMINS_MAP[t.admin] || t.admin || '—';
    return `<div class="tc">
      <div class="tc-head">
        <div>
          <div class="tc-name">${esc2(t.ism)} ${esc2(t.familiya)}</div>
          <div class="tc-sub">#${i+1} · <span class="fan-badge">${t.fan||'—'}</span>${isSuper ? ` · <span style="font-size:10px;color:var(--muted);">${esc2(maktabNom)}</span>` : ''}</div>
        </div>
        ${isAdmin ? `<div class="tc-btns">
          <button class="btn-action" onclick="openEdit(${t.ri})">✏️</button>
          <button class="btn-action" onclick="confirmDel(${t.ri})">🗑️</button>
        </div>` : ''}
      </div>
      <div class="tc-body">
        <div class="tc-row"><span class="tc-lbl">📞 Telefon</span><span class="tc-val mono">${t.telefon||'—'}</span></div>
        ${t.telefon2 ? `<div class="tc-row"><span class="tc-lbl">📞 Qo'sh.</span><span class="tc-val mono">${t.telefon2}</span></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  O'QITUVCHI QO'SHISH
// ─────────────────────────────────────────────
async function addTeacher() {
  const ism  = g('f-ism').value.trim();
  const fam  = g('f-familiya').value.trim();
  const fan  = g('f-fan').value;
  const tel  = g('f-tel').value.trim();
  const tel2 = g('f-tel2').value.trim();

  if (!ism || !fam)     { toast('⚠️ Ism va familiya kiriting', 'error'); return; }
  if (!fan)             { toast('⚠️ Fan tanlang', 'error'); return; }
  if (!tel)             { toast('⚠️ Telefon kiriting', 'error'); return; }
  if (!isTelOk(tel))    { toast("⚠️ Telefon formati noto'g'ri (+998 XX XXX XX XX)", 'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon formati noto'g'ri", 'error'); return; }

  setBtnLoading('submit-btn', 'spinner', 'btn-txt', true, 'Saqlanmoqda…');
  try {
    const r = await req({
      action: 'addTeacher', username: U.username, parol: U.parol,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2 || '',
      kunlar: '', sinflar: '', boshlanish: '', tugash: '',
      date: new Date().toLocaleDateString('uz-UZ')
    });
    if (r.ok) {
      clearForm();
      await loadTeachers();
      toast("✅ O'qituvchi qo'shildi!", 'success');
    } else {
      showError('❌ ' + r.error);
    }
  } catch (err) {
    console.error('[addTeacher] xatolik:', err);
    showError('❌ Server bilan ulanishda xatolik. Konsol (F12) ni tekshiring.');
  }
  setBtnLoading('submit-btn', 'spinner', 'btn-txt', false, 'Saqlash');
}

function clearForm() {
  ['f-ism', 'f-familiya', 'f-tel', 'f-tel2'].forEach(id => g(id).value = '');
  g('f-fan').value = '';
  ['f-tel-hint', 'f-tel2-hint'].forEach(id => {
    const el = g(id);
    if (el) { el.textContent = ''; el.className = 'tel-hint'; }
  });
  ['f-tel', 'f-tel2'].forEach(id => {
    const el = g(id);
    if (el) el.className = 'field-input tel-input';
  });
}

// ─────────────────────────────────────────────
//  TAHRIRLASH — MODAL
// ─────────────────────────────────────────────
function openEdit(idx) {
  const t = T[idx];
  if (!t) return;
  eIdx = idx;

  // Asosiy maydonlarni to'ldirish
  setValue('e-ism',      t.ism      || '');
  setValue('e-familiya', t.familiya || '');
  setValue('e-fan',      t.fan      || '');
  setValue('e-tel',      t.telefon  || '');
  setValue('e-tel2',     t.telefon2 || '');

  // Tel validation reset
  ['e-tel', 'e-tel2'].forEach(id => {
    const inp  = g(id);
    const hint = g(id + '-hint');
    if (inp)  inp.className = 'field-input tel-input';
    if (hint) { hint.textContent = ''; hint.className = 'tel-hint'; }
    if (inp && inp.value) validateTel(inp, hint);
  });

  // Modalni ochish
  const modal = g('edit-modal');
  if (modal) modal.classList.add('show');
}

function closeEdit() {
  const modal = g('edit-modal');
  if (modal) modal.classList.remove('show');
  eIdx = null;
}

async function saveEdit() {
  const ism  = g('e-ism').value.trim();
  const fam  = g('e-familiya').value.trim();
  const fan  = g('e-fan').value;
  const tel  = g('e-tel').value.trim();
  const tel2 = g('e-tel2').value.trim();

  if (!ism || !fam)  { toast('⚠️ Ism va familiya kiriting', 'error'); return; }
  if (!fan)          { toast('⚠️ Fan tanlang', 'error'); return; }
  if (!tel)          { toast('⚠️ Telefon kiriting', 'error'); return; }
  if (!isTelOk(tel)) { toast("⚠️ Telefon formati noto'g'ri", 'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon noto'g'ri", 'error'); return; }

  const old = T[eIdx];
  setBtnLoading('e-save-btn', 'e-spinner', 'e-btn-txt', true, 'Saqlanmoqda…');
  try {
    const r = await req({
      action: 'editTeacher', username: U.username, parol: U.parol,
      oldIsm: old.ism, oldFamiliya: old.familiya,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2 || '',
      kunlar:     old.kunlar     || '',
      sinflar:    old.sinflar    || '',
      boshlanish: old.boshlanish || '',
      tugash:     old.tugash     || ''
    });
    if (r.ok) {
      closeEdit();
      await loadTeachers();
      toast("✅ O'qituvchi yangilandi!", 'success');
    } else {
      showError('❌ ' + r.error);
    }
  } catch { toast('❌ Xatolik', 'error'); }
  setBtnLoading('e-save-btn', 'e-spinner', 'e-btn-txt', false, 'Saqlash');
}

// ─────────────────────────────────────────────
//  O'CHIRISH — CONFIRM
// ─────────────────────────────────────────────
function confirmDel(idx) {
  const t = T[idx];
  if (!t) return;
  if (!confirm(`"${t.ism} ${t.familiya}" o'qituvchini o'chirishni tasdiqlaysizmi?`)) return;
  delTeacher(idx);
}

async function delTeacher(idx) {
  const t = T[idx];
  try {
    const r = await req({
      action: 'deleteTeacher', username: U.username, parol: U.parol,
      delIsm: t.ism, delFamiliya: t.familiya
    });
    if (r.ok) {
      await loadTeachers();
      toast("✅ O'qituvchi o'chirildi", 'success');
    } else {
      showError('❌ ' + r.error);
    }
  } catch { toast('❌ Xatolik', 'error'); }
}

// ─────────────────────────────────────────────
//  TELEFON VALIDATSIYA
// ─────────────────────────────────────────────
function fmtTel(val) {
  const digits = val.replace(/\D/g, '');
  let d = digits.startsWith('998') ? digits
        : digits.startsWith('0')   ? '998' + digits.slice(1)
        : '998' + digits;
  d = d.slice(0, 12);
  let out = '';
  if (d.length > 0)  out = '+' + d.slice(0, 3);
  if (d.length > 3)  out += ' ' + d.slice(3, 5);
  if (d.length > 5)  out += ' ' + d.slice(5, 8);
  if (d.length > 8)  out += ' ' + d.slice(8, 10);
  if (d.length > 10) out += ' ' + d.slice(10, 12);
  return out;
}

function isTelOk(val) {
  const d = val.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('998');
}

function validateTel(inp, hintEl) {
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) {
    inp.className = 'field-input tel-input';
    if (hintEl) { hintEl.className = 'tel-hint'; hintEl.textContent = ''; }
    return;
  }
  const ok = isTelOk(val);
  inp.className = 'field-input tel-input ' + (ok ? 'tel-ok' : 'tel-err');
  if (hintEl) {
    hintEl.className  = 'tel-hint ' + (ok ? 'ok' : 'err');
    hintEl.textContent = ok ? "✓ To'g'ri format" : "✗ +998 XX XXX XX XX formatida kiriting";
  }
}

function setupTel(inpId, hintId) {
  const inp  = g(inpId);
  const hint = g(hintId);
  if (!inp) return;
  inp.addEventListener('input', function() {
    const oldLen = this.value.length;
    const pos    = this.selectionStart;
    this.value   = fmtTel(this.value);
    const diff   = this.value.length - oldLen;
    try { this.setSelectionRange(pos + diff, pos + diff); } catch(e) {}
    validateTel(this, hint);
  });
  inp.addEventListener('blur', () => validateTel(inp, hint));
}

// ─────────────────────────────────────────────
//  YORDAMCHI FUNKSIYALAR
// ─────────────────────────────────────────────
async function req(body) {
  const qs = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v != null ? v : '')}`)
    .join('&');
  const resp = await fetch(`${API}?${qs}`);
  return resp.json();
}

function setBtnLoading(btnId, spId, txtId, loading, txt) {
  const btn = g(btnId);
  const sp  = g(spId);
  const tx  = g(txtId);
  if (btn) btn.disabled = loading;
  if (sp)  sp.style.display  = loading ? 'inline-block' : 'none';
  if (tx)  tx.textContent    = txt;
}

function setDisplay(id, val) {
  const el = g(id);
  if (el) el.style.display = val;
}

function setValue(id, val) {
  const el = g(id);
  if (el) el.value = val;
}

function g(id)   { return document.getElementById(id); }
function esc(s)  { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function esc2(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let toastT;
function toast(msg, type = '') {
  const t = g('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast show ' + (type || '');
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = 'toast'; }, type === 'error' ? 8000 : 3000);
}

// Kritik xatolik — toast + alert
function showError(msg) {
  toast(msg, 'error');
  console.error(msg);
}
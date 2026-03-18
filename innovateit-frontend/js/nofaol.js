// ═══════════════════════════════════════════════════
//  InnovateIT School — Nofaol O'quvchilar (nofaol.js)
//  v2.0 — edit, delete, yangi dizayn
// ═══════════════════════════════════════════════════


let U        = null;
let NS       = [];
let FILTERED = [];

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_nofaol_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch (e) { window.location.href = 'index.html'; return; }

  const badge = g('nofaol-badge');
  if (U.isSuperProxy) {
    badge.textContent = '🏫 ' + U.ism; badge.classList.add('super');
  } else if (U.isSuper) {
    badge.textContent = '⭐ ' + U.ism; badge.classList.add('super');
    const ac = g('admin-col-n'); if (ac) ac.style.display = '';
  } else {
    badge.textContent = U.ism;
  }
  await loadNofaol();
});

function goBack() { window.location.href = 'index.html'; }

// ─── MA'LUMOT YUKLASH ───
async function loadNofaol() {
  g('loading-ov').style.display = 'flex';
  try {
    const d = await api.getNofaol({ username: U.username, parol: U.parol });
    if (d.ok) {
      NS = d.students;
      NS.forEach((s, i) => s.ri = i);
      updMaktabF();
      applyFilters();
      g('nofaol-count').textContent = NS.length + " nofaol";
    } else toast('❌ ' + d.error, 'error');
  } catch (e) { toast("❌ Yuklashda xatolik", 'error'); }
  g('loading-ov').style.display = 'none';
}

// ─── FILTR VA RENDER ───
function applyFilters() {
  const q  = (g('f-search').value || '').toLowerCase();
  const fm = g('f-maktab-f').value;
  const fs = g('f-sinf-f').value;
  FILTERED = NS.filter(s =>
    (!q  || (s.familiya + ' ' + s.ism + ' ' + (s.telefon||'')).toLowerCase().includes(q)) &&
    (!fm || String(s.maktab) === String(fm)) &&
    (!fs || s.sinf === fs)
  );
  renderTbl(FILTERED);
  renderMob(FILTERED);
}

function renderTbl(d) {
  const tb  = g('tbl-body');
  const sup = U && U.isSuper;
  if (!d.length) {
    tb.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-state-icon">🎉</div><p>Nofaol o'quvchi yo'q</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = d.map((s, i) => `<tr>
    <td class="mono">${i + 1}</td>
    <td><strong>${s.familiya}</strong> ${s.ism}</td>
    <td><span class="maktab-badge">${s.maktab || '—'}</span></td>
    <td><span class="sinf-badge">${s.sinf || '—'}</span></td>
    <td class="mono">${s.telefon || '—'}</td>
    <td class="mono">${fTug(s.tug)}</td>
    <td class="mono">${fDate(s.boshlagan)}</td>
    <td>${fChiqgan(s.chiqgan)}</td>
    <td style="max-width:180px;">
      ${s.izoh
        ? `<span style="font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;" title="${s.izoh.replace(/"/g,'&quot;')}">${s.izoh}</span>`
        : '<span style="color:#ccc;font-size:12px;">—</span>'}
    </td>
    ${sup ? `<td class="mono" style="font-size:11px;">${s.admin || '—'}</td>` : ''}
    <td>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn-faollashtir" onclick="openFaolModal(${s.ri})" title="Faollashtirish">♻️</button>
        <button class="btn-edit-nofaol" onclick="openEditNofaol(${s.ri})" title="Tahrirlash">✏️</button>
        <button class="btn-ochir" onclick="openDelNofaol(${s.ri})" title="O'chirish">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function renderMob(d) {
  const el  = g('mob-cards');
  const sup = U && U.isSuper;
  if (!d.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎉</div><p>Nofaol o\'quvchi yo\'q</p></div>';
    return;
  }
  el.innerHTML = d.map((s, i) => `
    <div class="sc">
      <div class="sc-header">
        <div>
          <div class="sc-name">${s.familiya} ${s.ism}</div>
          <div class="sc-num">#${i + 1}</div>
          <div class="sc-tags">
            <span class="maktab-badge">${s.maktab || '—'}-maktab</span>
            <span class="sinf-badge">${s.sinf || '—'}</span>
          </div>
        </div>
        <div class="sc-btns">
          <button class="btn-faollashtir" onclick="openFaolModal(${s.ri})" title="Faollashtirish">♻️</button>
          <button class="btn-edit-nofaol" onclick="openEditNofaol(${s.ri})" title="Tahrirlash">✏️</button>
          <button class="btn-ochir" onclick="openDelNofaol(${s.ri})" title="O'chirish">🗑️</button>
        </div>
      </div>
      <div class="sc-body">
        <div class="sc-row"><span class="sc-lbl">📞 Telefon</span><span class="sc-val m">${s.telefon || '—'}</span></div>
        <div class="sc-row"><span class="sc-lbl">🎂 Tug'ilgan</span><span class="sc-val m">${fTug(s.tug)}</span></div>
        <div class="sc-row"><span class="sc-lbl">📅 Boshlagan</span><span class="sc-val m">${fDate(s.boshlagan)}</span></div>
        <div class="sc-row sc-full"><span class="sc-lbl">🚪 Chiqgan</span><span class="sc-val">${fChiqgan(s.chiqgan)}</span></div>
        ${s.izoh ? `<div class="sc-row sc-full"><span class="sc-lbl">💬 Sabab</span><span class="sc-val" style="color:#374151;">${s.izoh}</span></div>` : ''}
        <div class="sc-row"><span class="sc-lbl">📍 Manzil</span><span class="sc-val">${s.manzil || '—'}</span></div>
        ${sup ? `<div class="sc-row sc-full"><span class="sc-lbl">👤 Admin</span><span class="sc-val m" style="font-size:11px;">${s.admin || '—'}</span></div>` : ''}
      </div>
    </div>`).join('');
}

function updMaktabF() {
  const sel  = g('f-maktab-f'), cur = sel.value;
  const list = [...new Set(NS.map(s => s.maktab).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  sel.innerHTML = '<option value="">Barcha maktab</option>' +
    list.map(m => `<option${String(m) === String(cur) ? ' selected' : ''}>${m}</option>`).join('');
}

// ─── ♻️ FAOLLASHTIRISH ───
let faolIdx = null;
function openFaolModal(idx) {
  const s = NS[idx]; if (!s) return;
  faolIdx = idx;
  g('faol-name-display').textContent = s.familiya + ' ' + s.ism;
  g('faol-modal').style.display = 'flex';
}
function closeFaolModal() { g('faol-modal').style.display = 'none'; faolIdx = null; }

async function confirmFaollashtir() {
  const s = NS[faolIdx]; if (!s) return;
  setBtnLoading('faol-confirm-btn', 'faol-spinner', 'faol-btn-txt', 'Saqlanmoqda…');
  try {
    const r = await api.moveToActive({ username: U.username, parol: U.parol, delIsm: s.ism, delFamiliya: s.familiya });
    if (r.ok) { closeFaolModal(); await loadNofaol(); toast("✅ O'quvchi faol ro'yxatga qaytarildi!", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  setBtnLoading('faol-confirm-btn', 'faol-spinner', 'faol-btn-txt', null, 'Ha, faollashtirish');
}

// ─── ✏️ TAHRIRLASH ───
let editIdx = null;

function onEditIzohInput(el) {
  const len = el.value.trim().length;
  g('edit-izoh-counter').textContent = len + ' / 10';
  g('edit-izoh-counter').style.color = len >= 10 ? '#16a34a' : '#9ca3af';
  g('edit-izoh-hint').style.display  = (len > 0 && len < 10) ? 'block' : 'none';
}

function openEditNofaol(idx) {
  const s = NS[idx]; if (!s) return;
  editIdx = idx;
  g('edit-nofaol-name').textContent = s.familiya + ' ' + s.ism;
  g('edit-chiqgan').value = s.chiqgan
    ? (s.chiqgan.includes('.') ? s.chiqgan.split('.').reverse().join('-') : s.chiqgan.substring(0,10))
    : '';
  g('edit-izoh').value = s.izoh || '';
  const len = (s.izoh || '').trim().length;
  g('edit-izoh-counter').textContent = len + ' / 10';
  g('edit-izoh-counter').style.color = len >= 10 ? '#16a34a' : '#9ca3af';
  g('edit-izoh-hint').style.display = 'none';
  g('edit-nofaol-modal').style.display = 'flex';
}
function closeEditNofaol() { g('edit-nofaol-modal').style.display = 'none'; editIdx = null; }

async function saveEditNofaol() {
  const s = NS[editIdx]; if (!s) return;
  const chiqgan = g('edit-chiqgan').value;
  const izoh    = g('edit-izoh').value.trim();
  if (!chiqgan) { toast("⚠️ Chiqgan sanani kiriting", 'error'); return; }
  if (izoh.length < 10) { g('edit-izoh-hint').style.display = 'block'; toast("⚠️ Sabab kamida 10 ta belgi bo'lishi kerak", 'error'); return; }
  const chiqganUZ = chiqgan.includes('-') ? chiqgan.split('-').reverse().join('.') : chiqgan;
  setBtnLoading('edit-nofaol-btn', 'edit-nofaol-spinner', 'edit-nofaol-txt', 'Saqlanmoqda…');
  try {
    const r = await api.editNofaol({ username: U.username, parol: U.parol, delIsm: s.ism, delFamiliya: s.familiya, chiqgan: chiqganUZ, izoh });
    if (r.ok) { closeEditNofaol(); await loadNofaol(); toast("✅ Ma'lumotlar yangilandi!", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  setBtnLoading('edit-nofaol-btn', 'edit-nofaol-spinner', 'edit-nofaol-txt', null, 'Saqlash');
}

// ─── 🗑️ O'CHIRISH ───
let delIdx = null;
function openDelNofaol(idx) {
  const s = NS[idx]; if (!s) return;
  delIdx = idx;
  g('del-nofaol-name').textContent = s.familiya + ' ' + s.ism;
  g('del-nofaol-modal').style.display = 'flex';
}
function closeDelNofaol() { g('del-nofaol-modal').style.display = 'none'; delIdx = null; }

async function confirmDeleteNofaol() {
  const s = NS[delIdx]; if (!s) return;
  setBtnLoading('del-nofaol-btn', 'del-nofaol-spinner', 'del-nofaol-txt', "O'chirilmoqda…");
  try {
    const r = await api.deleteNofaol({ username: U.username, parol: U.parol, delIsm: s.ism, delFamiliya: s.familiya });
    if (r.ok) { closeDelNofaol(); await loadNofaol(); toast("✅ O'quvchi o'chirildi", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }
  setBtnLoading('del-nofaol-btn', 'del-nofaol-spinner', 'del-nofaol-txt', null, "Ha, o'chirish");
}

// ─── YORDAMCHI ───
function g(id) { return document.getElementById(id); }

function setBtnLoading(btnId, spinnerId, txtId, loadingTxt, doneTxt) {
  const btn = g(btnId);
  if (loadingTxt) { btn.disabled = true; g(spinnerId).style.display = 'inline-block'; g(txtId).textContent = loadingTxt; }
  else { btn.disabled = false; g(spinnerId).style.display = 'none'; g(txtId).textContent = doneTxt; }
}

function fDate(v) {
  if (!v) return '—';
  const s = String(v).trim();
  if (!s || s === 'undefined' || s === 'null') return '—';
  const d = new Date(s);
  if (!isNaN(d)) return d.toLocaleDateString('uz-UZ');
  return s;
}

function fChiqgan(v) {
  if (!v) return '—';
  const s = String(v).trim();
  if (!s || s === 'undefined' || s === 'null') return '—';
  const months = ['','Yan','Feb','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'];
  // DD.MM.YYYY
  if (s.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    const [d, m, y] = s.split('.');
    return `<span class="badge-chiqgan">${parseInt(d)} ${months[parseInt(m)]} ${y}</span>`;
  }
  // YYYY-MM-DD
  const dt = new Date(s);
  if (!isNaN(dt)) {
    return `<span class="badge-chiqgan">${dt.getDate()} ${months[dt.getMonth()+1]} ${dt.getFullYear()}</span>`;
  }
  return `<span class="badge-chiqgan">${s}</span>`;
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
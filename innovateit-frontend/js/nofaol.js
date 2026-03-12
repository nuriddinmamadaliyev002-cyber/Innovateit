// ═══════════════════════════════════════════════════
//  InnovateIT School — Nofaol O'quvchilar (nofaol.js)
//  v1.0
// ═══════════════════════════════════════════════════

const API = (window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname === '')
  ? 'http://127.0.0.1:3001/api'
  : '/api';

let U  = null;  // Foydalanuvchi
let NS = [];    // Barcha nofaol o'quvchilar
let FILTERED = [];

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_nofaol_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch (e) { window.location.href = 'index.html'; return; }

  // Badge
  const badge = g('nofaol-badge');
  if (U.isSuperProxy) {
    badge.textContent = '🏫 ' + U.ism;
    badge.classList.add('super');
  } else if (U.isSuper) {
    badge.textContent = '⭐ ' + U.ism;
    badge.classList.add('super');
    // Super admin (maktabsiz): admin ustunini ko'rsatish
    const ac = g('admin-col-n'); if (ac) ac.style.display = '';
  } else {
    badge.textContent = U.ism;
  }

  await loadNofaol();
});

// ─────────────────────────────────────────────
//  NAVIGATSIYA
// ─────────────────────────────────────────────
function goBack() {
  window.location.href = 'index.html';
}

// ─────────────────────────────────────────────
//  MA'LUMOT YUKLASH
// ─────────────────────────────────────────────
async function loadNofaol() {
  g('loading-ov').style.display = 'flex';
  try {
    const d = await req({ action: 'getNofaol', username: U.username, parol: U.parol });
    if (d.ok) {
      NS = d.students;
      NS.forEach((s, i) => s.ri = i);
      updMaktabF();
      applyFilters();
      g('nofaol-count').textContent = NS.length + " nofaol";
    } else {
      toast('❌ ' + d.error, 'error');
    }
  } catch (e) { toast("❌ Yuklashda xatolik", 'error'); }
  g('loading-ov').style.display = 'none';
}

// ─────────────────────────────────────────────
//  FILTR VA RENDER
// ─────────────────────────────────────────────
function applyFilters() {
  const q  = (g('f-search').value || '').toLowerCase();
  const fm = g('f-maktab-f').value;
  const fs = g('f-sinf-f').value;
  FILTERED = NS.filter(s =>
    (!q  || (s.ism + ' ' + s.familiya + ' ' + (s.telefon||'')).toLowerCase().includes(q)) &&
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
    tb.innerHTML = `<tr><td colspan="10">
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <p>Nofaol o'quvchi yo'q</p>
      </div>
    </td></tr>`;
    return;
  }
  tb.innerHTML = d.map((s, i) => `<tr>
    <td class="mono">${i + 1}</td>
    <td><strong>${s.ism}</strong> ${s.familiya}</td>
    <td><span class="maktab-badge">${s.maktab || '—'}</span></td>
    <td><span class="sinf-badge">${s.sinf || '—'}</span></td>
    <td class="mono">${s.telefon || '—'}</td>
    <td class="mono">${fTug(s.tug)}</td>
    <td class="mono">${fDate(s.boshlagan)}</td>
    <td><span class="badge-chiqgan">${fDate(s.chiqgan)}</span></td>
    <td style="max-width:200px;">
      ${s.izoh ? `<span style="font-size:12px;color:#7a7870;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.izoh.replace(/"/g,'&quot;')}">${s.izoh}</span>` : '<span style="color:#ccc;font-size:12px;">—</span>'}
    </td>
    ${sup ? `<td class="mono" style="font-size:11px;">${s.admin || '—'}</td>` : ''}
    <td>
      <button class="btn-faollashtir" onclick="openFaolModal(${s.ri})">✅ Faollashtirish</button>
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
          <div class="sc-name">${s.ism} ${s.familiya}</div>
          <div class="sc-num">#${i + 1}</div>
          <div class="sc-tags">
            <span class="maktab-badge">${s.maktab || '—'}-maktab</span>
            <span class="sinf-badge">${s.sinf || '—'}</span>
          </div>
        </div>
        <div class="sc-btns">
          <button class="btn-faollashtir" onclick="openFaolModal(${s.ri})">✅ Faollashtirish</button>
        </div>
      </div>
      <div class="sc-body">
        <div class="sc-row"><span class="sc-lbl">📞 Telefon</span><span class="sc-val m">${s.telefon || '—'}</span></div>
        <div class="sc-row"><span class="sc-lbl">🎂 Tug'ilgan</span><span class="sc-val m">${fTug(s.tug)}</span></div>
        <div class="sc-row"><span class="sc-lbl">📅 Boshlagan</span><span class="sc-val m">${fDate(s.boshlagan)}</span></div>
        <div class="sc-row"><span class="sc-lbl">🚪 Chiqgan</span><span class="sc-val m" style="color:#c2410c;font-weight:600;">${fDate(s.chiqgan)}</span></div>
        ${s.izoh ? `<div class="sc-row sc-full"><span class="sc-lbl">💬 Sabab</span><span class="sc-val" style="color:#7a7870;font-style:italic;">${s.izoh}</span></div>` : ''}
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

// ─────────────────────────────────────────────
//  FAOLLASHTIRISH MODAL
// ─────────────────────────────────────────────
let faolIdx = null;

function openFaolModal(idx) {
  const s = NS[idx]; if (!s) return;
  faolIdx = idx;
  g('faol-name-display').textContent = s.ism + ' ' + s.familiya;
  g('faol-modal').style.display = 'flex';
}

function closeFaolModal() {
  g('faol-modal').style.display = 'none';
  faolIdx = null;
}

async function confirmFaollashtir() {
  const s = NS[faolIdx]; if (!s) return;

  g('faol-confirm-btn').disabled = true;
  g('faol-spinner').style.display = 'inline-block';
  g('faol-btn-txt').textContent = 'Saqlanmoqda…';

  try {
    const r = await req({
      action: 'moveToActive',
      username: U.username, parol: U.parol,
      delIsm: s.ism, delFamiliya: s.familiya
    });
    if (r.ok) {
      closeFaolModal();
      await loadNofaol();
      toast("✅ O'quvchi faol ro'yxatga qaytarildi!", 'success');
    } else toast('❌ ' + r.error, 'error');
  } catch (e) { toast('❌ Xatolik', 'error'); }

  g('faol-confirm-btn').disabled = false;
  g('faol-spinner').style.display = 'none';
  g('faol-btn-txt').textContent = 'Ha, faollashtirish';
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

function g(id) { return document.getElementById(id); }

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
// ═══════════════════════════════════════════════════
//  InnovateIT School — O'qituvchilar  (oqituvchilar.js)
// ═══════════════════════════════════════════════════

const API = "/api";

const KUN_NAMES = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const KUN_SHORT = ['', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha'];

let U          = null;   // { username, parol, ism, isSuper }
let T          = [];     // Barcha o'qituvchilar
let eIdx       = null;   // Tahrirlash indexi
let ADMINS_MAP = {};     // { username: ism } — super admin uchun maktab nomlari

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_teacher_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch { window.location.href = 'index.html'; return; }

  // Badge
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

  // Super admin umumiy ko'rish rejimi: form va davomat yashiriq
  if (U.isSuper) {
    const addForm = g('add-form');
    if (addForm) addForm.style.display = 'none';
    const btnDav = g('btn-davomat-teacher');
    if (btnDav) btnDav.style.display = 'none';
  }

  // Super admin proxy (biror maktab tanlangan): faqat o'qituvchilar ko'rinadi, davomat yo'q
  if (U.isSuperProxy) {
    const addForm = g('add-form');
    if (addForm) addForm.style.display = 'none';
    const btnDav = g('btn-davomat-teacher');
    if (btnDav) btnDav.style.display = 'none';
  }

  // Chip clicklar
  setupChips('f-kunlar',  'kun-chip');
  setupChips('f-sinflar', 'sinf-chip');
  setupChips('e-kunlar',  'kun-chip');
  setupChips('e-sinflar', 'sinf-chip');

  // Vaqt inputlar
  setupVaqtInp('f-bosh-s'); setupVaqtInp('f-bosh-m');
  setupVaqtInp('f-tug-s');  setupVaqtInp('f-tug-m');
  setupVaqtInp('e-bosh-s'); setupVaqtInp('e-bosh-m');
  setupVaqtInp('e-tug-s');  setupVaqtInp('e-tug-m');

  // Telefon maskalari
  setupTel('f-tel',  'f-tel-hint');
  setupTel('f-tel2', 'f-tel2-hint');
  setupTel('e-tel',  'e-tel-hint');
  setupTel('e-tel2', 'e-tel2-hint');

  await loadTeachers();
});

// ─────────────────────────────────────────────
//  NAVIGATSIYA
// ─────────────────────────────────────────────
function goBack() {
  window.location.href = 'index.html';
}

function openDavomat() {
  sessionStorage.setItem('iit_teacher_dav_user', JSON.stringify(U));
  window.location.href = 'oqituvchilar-davomat.html';
}

// ─────────────────────────────────────────────
//  O'QITUVCHILARNI YUKLASH
// ─────────────────────────────────────────────
async function loadTeachers() {
  g('loading-ov').style.display = 'flex';
  // Super admin uchun admins map yuklash
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
//  FILTER
// ─────────────────────────────────────────────
function applyFilter() {
  const q = (g('f-search').value || '').toLowerCase();
  const d = T.filter(t =>
    !q || (t.ism + ' ' + t.familiya + ' ' + t.fan).toLowerCase().includes(q)
  );
  renderTable(d);
  renderMobile(d);
}

function renderTable(d) {
  const tb       = g('tbl-body');
  const isSuper  = U && U.isSuper;
  const isProxy  = U && U.isSuperProxy;
  const isAdmin  = !isSuper && !isProxy;

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
    tb.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="empty-state-icon">👩‍🏫</div><p>O'qituvchi topilmadi</p></div></td></tr>`;
    return;
  }

  const todayDay = new Date().getDay();
  tb.innerHTML = d.map((t, i) => {
    const kunlar  = parseDays(t.kunlar);
    const sinflar = parseSinflar(t.sinflar);
    const maktabNom = ADMINS_MAP[t.admin] || t.admin || '—';
    return `<tr>
      <td class="mono">${i+1}</td>
      <td><strong>${t.ism}</strong> ${t.familiya}</td>
      <td><span class="fan-badge">${t.fan || '—'}</span></td>
      ${isSuper ? `<td style="font-size:12px;color:var(--muted);">${maktabNom}</td>` : ''}
      <td><div class="sinf-tags">${sinflar.map(s=>`<span class="sinf-tag">${s}</span>`).join('')}</div></td>
      <td><div class="kun-tags">${kunlar.map(k=>`<span class="kun-tag${k==todayDay?' today':''}">${KUN_SHORT[k]}</span>`).join('')}</div></td>
      <td><span class="vaqt-badge">${fmtVaqt(t.boshlanish, t.tugash)}</span></td>
      <td class="mono">${t.telefon||'—'}</td>
      <td class="mono">${t.telefon2||'—'}</td>
      ${isAdmin ? `<td><div style="display:flex;gap:6px;">
        <button class="btn-action" onclick="openEdit(${t.ri})">✏️</button>
        <button class="btn-action" onclick="delT(${t.ri},'${esc(t.ism+' '+t.familiya)}')">🗑️</button>
      </div></td>` : ''}
    </tr>`;
  }).join('');
}

function renderMobile(d) {
  const el = g('mob-cards');
  if (!d.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👩‍🏫</div><p>O\'qituvchi topilmadi</p></div>';
    return;
  }
  const isSuper = U && U.isSuper;
  const isAdmin = !isSuper && !(U && U.isSuperProxy);
  const todayDay = new Date().getDay();
  el.innerHTML = d.map((t, i) => {
    const kunlar    = parseDays(t.kunlar);
    const sinflar   = parseSinflar(t.sinflar);
    const maktabNom = ADMINS_MAP[t.admin] || t.admin || '—';
    return `<div class="tc">
      <div class="tc-head">
        <div>
          <div class="tc-name">${t.ism} ${t.familiya}</div>
          <div class="tc-sub">#${i+1} · <span class="fan-badge">${t.fan||'—'}</span>${isSuper ? ` · <span style="font-size:10px;color:var(--muted);">${maktabNom}</span>` : ''}</div>
        </div>
        ${isAdmin ? `<div class="tc-btns">
          <button class="btn-action" onclick="openEdit(${t.ri})">✏️</button>
          <button class="btn-action" onclick="delT(${t.ri},'${esc(t.ism+' '+t.familiya)}')">🗑️</button>
        </div>` : ''}
      </div>
      <div class="tc-body">
        <div class="tc-row"><span class="tc-lbl">📞 Telefon</span><span class="tc-val mono">${t.telefon||'—'}</span></div>
        <div class="tc-row"><span class="tc-lbl">📞 Qo'sh.</span><span class="tc-val mono">${t.telefon2||'—'}</span></div>
        <div class="tc-row"><span class="tc-lbl">⏰ Vaqt</span><span class="tc-val"><span class="vaqt-badge">${fmtVaqt(t.boshlanish,t.tugash)}</span></span></div>
        <div class="tc-row"><span class="tc-lbl">📅 Kunlar</span><span class="tc-val"><div class="kun-tags">${kunlar.map(k=>`<span class="kun-tag${k==todayDay?' today':''}">${KUN_SHORT[k]}</span>`).join('')}</div></span></div>
        <div class="tc-row"><span class="tc-lbl">🏫 Sinflar</span><span class="tc-val"><div class="sinf-tags">${sinflar.map(s=>`<span class="sinf-tag">${s}</span>`).join('')}</div></span></div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  QO'SHISH
// ─────────────────────────────────────────────
async function addTeacher() {
  const ism    = g('f-ism').value.trim();
  const fam    = g('f-familiya').value.trim();
  const fan    = g('f-fan').value;
  const tel    = g('f-tel').value.trim();
  const tel2   = g('f-tel2').value.trim();
  const kunlar = getSelectedDays('f-kunlar');
  const sinflar= getSelectedSinfs('f-sinflar');
  const boshlanish = padZ(g('f-bosh-s').value) + ':' + padZ(g('f-bosh-m').value);
  const tugash     = padZ(g('f-tug-s').value)  + ':' + padZ(g('f-tug-m').value);

  if (!ism||!fam)     { toast('⚠️ Ism va familiya kiriting','error'); return; }
  if (!fan)           { toast('⚠️ Fan tanlang','error'); return; }
  if (!tel)           { toast('⚠️ Telefon kiriting','error'); return; }
  if (!isTelOk(tel))  { toast('⚠️ Telefon formati noto\'g\'ri','error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast('⚠️ Qo\'sh. telefon formati noto\'g\'ri','error'); return; }
  if (!kunlar.length) { toast('⚠️ Kamida 1 kun tanlang','error'); return; }
  if (!sinflar.length){ toast('⚠️ Kamida 1 sinf tanlang','error'); return; }

  bl('submit-btn', 'spinner', 'btn-txt', true, 'Saqlanmoqda…');
  try {
    const r = await req({
      action: 'addTeacher', username: U.username, parol: U.parol,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2||'',
      kunlar: kunlar.join(','), sinflar: sinflar.join(','),
      boshlanish, tugash,
      date: new Date().toLocaleDateString('uz-UZ')
    });
    if (r.ok) { clearForm(); await loadTeachers(); toast("✅ O'qituvchi qo'shildi!", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch { toast('❌ Xatolik', 'error'); }
  bl('submit-btn', 'spinner', 'btn-txt', false, 'Saqlash');
}

function clearForm() {
  ['f-ism','f-familiya','f-tel','f-tel2'].forEach(id => g(id).value='');
  g('f-fan').value='';
  g('f-bosh-s').value='08'; g('f-bosh-m').value='00';
  g('f-tug-s').value='14';  g('f-tug-m').value='00';
  g('f-kunlar').querySelectorAll('.kun-chip').forEach(c=>c.classList.remove('sel'));
  g('f-sinflar').querySelectorAll('.sinf-chip').forEach(c=>c.classList.remove('sel'));
  ['f-tel-hint','f-tel2-hint'].forEach(id=>{g(id).textContent='';g(id).className='tel-hint';});
  g('f-tel').className='field-input tel-input';
  g('f-tel2').className='field-input tel-input';
}

// ─────────────────────────────────────────────
//  TAHRIRLASH
// ─────────────────────────────────────────────
function openEdit(idx) {
  const t = T[idx]; if (!t) return; eIdx = idx;
  g('e-ism').value      = t.ism      || '';
  g('e-familiya').value = t.familiya || '';
  g('e-fan').value      = t.fan      || '';
  g('e-tel').value      = t.telefon  || '';
  g('e-tel2').value     = t.telefon2 || '';

  // Kunlar
  const kunlar = parseDays(t.kunlar);
  g('e-kunlar').querySelectorAll('.kun-chip').forEach(c => {
    c.classList.toggle('sel', kunlar.includes(parseInt(c.dataset.k)));
  });

  // Sinflar
  const sinflar = parseSinflar(t.sinflar);
  g('e-sinflar').querySelectorAll('.sinf-chip').forEach(c => {
    c.classList.toggle('sel', sinflar.includes(c.dataset.s));
  });

  // Vaqt — fmtVaqt orqali parse qilingan qiymat allaqachon "HH:MM" formatida keladi
  const [bS,bM] = (t.boshlanish||'08:00').split(':');
  const [tS,tM] = (t.tugash    ||'14:00').split(':');
  g('e-bosh-s').value=bS||'08'; g('e-bosh-m').value=bM||'00';
  g('e-tug-s').value =tS||'14'; g('e-tug-m').value =tM||'00';

  // Tel hints reset
  ['e-tel-hint','e-tel2-hint'].forEach(id=>{g(id).textContent='';g(id).className='tel-hint';});
  validateTel(g('e-tel'),  g('e-tel-hint'));
  validateTel(g('e-tel2'), g('e-tel2-hint'));

  g('edit-modal').classList.add('show');
}

function closeEdit() { g('edit-modal').classList.remove('show'); eIdx=null; }

async function saveEdit() {
  const ism    = g('e-ism').value.trim();
  const fam    = g('e-familiya').value.trim();
  const fan    = g('e-fan').value;
  const tel    = g('e-tel').value.trim();
  const tel2   = g('e-tel2').value.trim();
  const kunlar = getSelectedDays('e-kunlar');
  const sinflar= getSelectedSinfs('e-sinflar');
  const boshlanish = padZ(g('e-bosh-s').value)+':'+padZ(g('e-bosh-m').value);
  const tugash     = padZ(g('e-tug-s').value) +':'+padZ(g('e-tug-m').value);

  if (!ism||!fam)   { toast('⚠️ Ism va familiya kiriting','error'); return; }
  if (!fan)         { toast('⚠️ Fan tanlang','error'); return; }
  if (!tel)         { toast('⚠️ Telefon kiriting','error'); return; }
  if (!isTelOk(tel)){ toast("⚠️ Telefon formati noto'g'ri",'error'); return; }
  if (tel2&&!isTelOk(tel2)){ toast("⚠️ Qo'sh. telefon noto'g'ri",'error'); return; }
  if (!kunlar.length) { toast('⚠️ Kamida 1 kun tanlang','error'); return; }
  if (!sinflar.length){ toast('⚠️ Kamida 1 sinf tanlang','error'); return; }

  const old = T[eIdx];
  bl('e-save-btn','e-spinner','e-btn-txt',true,'Saqlanmoqda…');
  try {
    const r = await req({
      action:'editTeacher', username:U.username, parol:U.parol,
      oldIsm:old.ism, oldFamiliya:old.familiya,
      ism, familiya:fam, fan, telefon:tel, telefon2:tel2||'',
      kunlar:kunlar.join(','), sinflar:sinflar.join(','),
      boshlanish, tugash
    });
    if (r.ok) { closeEdit(); await loadTeachers(); toast("✅ O'qituvchi yangilandi!","success"); }
    else toast('❌ '+r.error,'error');
  } catch { toast('❌ Xatolik','error'); }
  bl('e-save-btn','e-spinner','e-btn-txt',false,'Saqlash');
}

// ─────────────────────────────────────────────
//  O'CHIRISH
// ─────────────────────────────────────────────
async function delT(idx, name) {
  if (!confirm(`"${name}" o'qituvchi o'chirilsinmi?`)) return;
  const t = T[idx];
  try {
    const r = await req({
      action:'deleteTeacher', username:U.username, parol:U.parol,
      delIsm:t.ism, delFamiliya:t.familiya
    });
    if (r.ok) { await loadTeachers(); toast("✅ O'qituvchi o'chirildi","success"); }
    else toast('❌ '+r.error,'error');
  } catch {}
}

// ─────────────────────────────────────────────
//  YORDAMCHI FUNKSIYALAR
// ─────────────────────────────────────────────
async function req(body) {
  const qs = Object.entries(body)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return (await fetch(`${API}?${qs}`)).json();
}

function setupChips(containerId, cls) {
  const cont = g(containerId);
  if (!cont) return;
  cont.querySelectorAll('.' + cls).forEach(c =>
    c.addEventListener('click', () => c.classList.toggle('sel'))
  );
}

function getSelectedDays(containerId) {
  return [...g(containerId).querySelectorAll('.kun-chip.sel')].map(c => parseInt(c.dataset.k));
}
function getSelectedSinfs(containerId) {
  return [...g(containerId).querySelectorAll('.sinf-chip.sel')].map(c => c.dataset.s);
}
function parseDays(str) {
  if (!str) return [];
  return String(str).split(',').map(Number).filter(n => n >= 1 && n <= 6);
}
function parseSinflar(str) {
  if (!str) return [];
  return String(str).split(',').map(s => s.trim()).filter(Boolean);
}

function setupVaqtInp(id) {
  const inp = g(id); if (!inp) return;
  inp.addEventListener('input', function() {
    const max = parseInt(this.max), v = parseInt(this.value);
    if (!isNaN(v)) { if(v>max) this.value=max; if(v<0) this.value=0; }
  });
  inp.addEventListener('blur', function() {
    if (this.value!=='') this.value = String(parseInt(this.value)||0).padStart(2,'0');
  });
}

// Telefon formatlash va validatsiya
function fmtTel(val) {
  const digits = val.replace(/\D/g,'');
  let d = digits.startsWith('998') ? digits : digits.startsWith('0') ? '998'+digits.slice(1) : '998'+digits;
  d = d.slice(0, 12);
  let out = '';
  if(d.length>0)  out = '+'+d.slice(0,3);
  if(d.length>3)  out += ' '+d.slice(3,5);
  if(d.length>5)  out += ' '+d.slice(5,8);
  if(d.length>8)  out += ' '+d.slice(8,10);
  if(d.length>10) out += ' '+d.slice(10,12);
  return out;
}
function isTelOk(val) {
  const d = val.replace(/\D/g,'');
  return d.length===12 && d.startsWith('998');
}
function validateTel(inp, hintEl) {
  const val = inp.value.trim();
  if (!val) {
    inp.className = 'field-input tel-input';
    hintEl.className = 'tel-hint'; hintEl.textContent=''; return;
  }
  const ok = isTelOk(val);
  inp.className = 'field-input tel-input ' + (ok ? 'tel-ok' : 'tel-err');
  hintEl.className = 'tel-hint ' + (ok ? 'ok' : 'err');
  hintEl.textContent = ok ? "✓ To'g'ri format" : "✗ +998 XX XXX XX XX formatida kiriting";
}
function setupTel(inpId, hintId) {
  const inp = g(inpId), hint = g(hintId); if(!inp) return;
  inp.addEventListener('input', function() {
    const oldLen=this.value.length, pos=this.selectionStart;
    this.value = fmtTel(this.value);
    const diff = this.value.length - oldLen;
    this.setSelectionRange(pos+diff, pos+diff);
    validateTel(this, hint);
  });
  inp.addEventListener('blur', () => validateTel(inp, hint));
}

// ─── FIX: Google Sheets vaqtni Date object sifatida yuboradi ───
// Bu funksiya "1899-12-30T08:00:00.000Z" → "08:00" formatiga o'giradi
function fmtVaqt(b, t) {
  if (!b && !t) return '—';

  function parseVaqt(v) {
    if (!v) return '?';
    const s = String(v);
    // Allaqachon "HH:MM" formatida bo'lsa — to'g'ridan qaytarish
    if (/^\d{1,2}:\d{2}$/.test(s)) return s;
    // Google Sheets Date string bo'lsa — UTC soat/daqiqani olish
    const d = new Date(s);
    if (!isNaN(d)) {
      return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
    }
    return s;
  }

  return parseVaqt(b) + '–' + parseVaqt(t);
}

function padZ(v) { return String(parseInt(v)||0).padStart(2,'0'); }
function bl(btnId, spId, txtId, loading, txt) {
  if(btnId) g(btnId).disabled = loading;
  g(spId).style.display  = loading ? 'inline-block' : 'none';
  g(txtId).textContent   = txt;
}
function g(id)  { return document.getElementById(id); }
function esc(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

let toastT;
function toast(msg, type='') {
  const t=g('toast'); t.textContent=msg; t.className='toast show '+(type||'');
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.className='toast'; },3000);
}

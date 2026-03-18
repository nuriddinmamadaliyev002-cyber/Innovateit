// ═══════════════════════════════════════════════════
//  InnovateIT School — O'qituvchilar  (oqituvchilar.js)
//  Many-to-many: bir o'qituvchi — bir nechta maktab
// ═══════════════════════════════════════════════════

let U          = null;
let T          = [];
let eIdx       = null;
let ADMINS_MAP  = {};   // { username: ism }
let ADMINS_LIST = [];   // [{ username, ism }]

// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_teacher_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch { window.location.href = 'index.html'; return; }

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

  if (U.isSuper || U.isSuperProxy) {
    setDisplay('add-form', 'none');
    setDisplay('btn-davomat-teacher', 'none');
    setDisplay('btn-jadval-teacher', 'none');
  }

  setupTel('f-tel',  'f-tel-hint');
  setupTel('f-tel2', 'f-tel2-hint');
  setupTel('e-tel',  'e-tel-hint');
  setupTel('e-tel2', 'e-tel2-hint');

  await loadTeachers();
});

// ─────────────────────────────────────────────
function goBack()      { window.location.href = 'index.html'; }
function openDavomat() { sessionStorage.setItem('iit_teacher_dav_user', JSON.stringify(U)); window.location.href = 'oqituvchilar-davomat.html'; }
function openJadval()  { sessionStorage.setItem('iit_jadval_user', JSON.stringify(U)); window.location.href = 'dars-jadvali.html'; }

// ─────────────────────────────────────────────
//  YUKLASH
// ─────────────────────────────────────────────
async function loadTeachers() {
  g('loading-ov').style.display = 'flex';

  if (U.isSuper && U.adminsMap) {
    try {
      const list = JSON.parse(U.adminsMap);
      ADMINS_LIST = list;
      list.forEach(a => { ADMINS_MAP[a.username] = a.ism; });
    } catch(e) {}
  }

  try {
    const d = await api.getTeachers({ username: U.username, parol: U.parol });
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
  const isAdmin = !isSuper && !(U && U.isSuperProxy);

  const thAmal   = g('th-amal');
  const thMaktab = g('th-maktab');
  if (isSuper) {
    if (thAmal)   thAmal.style.display   = '';
    if (thMaktab) thMaktab.style.display = '';
  } else {
    if (thAmal)   thAmal.style.display   = isAdmin ? '' : 'none';
    if (thMaktab) thMaktab.style.display = 'none';
  }

  if (!d.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👩‍🏫</div><p>O\'qituvchi topilmadi</p></div></td></tr>';
    return;
  }

  tb.innerHTML = d.map((t, i) => {
    if (isSuper) {
      // Biriktirilgan maktab badge'lari
      const maktabBadges = (t.maktablar || []).map(u => {
        const nom = ADMINS_MAP[u] || u;
        return '<span class="maktab-badge-item">' + esc2(nom)
          + ' <button class="maktab-badge-x" onclick="removeMaktab(' + t.ri + ',\'' + esc(u) + '\')" title="Ajratish">✕</button></span>';
      }).join('');

      // Dropdown — hali biriktirilmagan maktablar
      const taken = new Set(t.maktablar || []);
      const freeOpts = ADMINS_LIST
        .filter(a => !taken.has(a.username))
        .map(a => '<option value="' + esc(a.username) + '">' + esc2(a.ism) + '</option>')
        .join('');

      const hasFree = ADMINS_LIST.some(a => !taken.has(a.username));

      return '<tr>'
        + '<td class="mono">' + (i+1) + '</td>'
        + '<td><strong>' + esc2(t.ism) + '</strong> ' + esc2(t.familiya) + '</td>'
        + '<td><span class="fan-badge">' + (t.fan||'—') + '</span></td>'
        + '<td class="td-maktablar">'
          + '<div class="maktab-tags-wrap">' + (maktabBadges || '<span class="maktab-none">Biriktirilmagan</span>') + '</div>'
          + (hasFree
            ? '<div class="maktab-add-wrap">'
                + '<select class="maktab-add-sel" id="maktab-sel-' + t.ri + '">'
                + '<option value="">+ Maktab biriktirish…</option>'
                + freeOpts
                + '</select>'
                + '<button class="btn-maktab-add" onclick="addMaktab(' + t.ri + ')">Biriktirish</button>'
              + '</div>'
            : '')
        + '</td>'
        + '<td class="mono">' + (t.telefon||'—') + '</td>'
        + '<td class="mono">' + (t.telefon2||'—') + '</td>'
        + '<td></td>'
        + '</tr>';
    }

    // Oddiy admin ko'rinishi
    return '<tr>'
      + '<td class="mono">' + (i+1) + '</td>'
      + '<td><strong>' + esc2(t.ism) + '</strong> ' + esc2(t.familiya) + '</td>'
      + '<td><span class="fan-badge">' + (t.fan||'—') + '</span></td>'
      + '<td class="mono">' + (t.telefon||'—') + '</td>'
      + '<td class="mono">' + (t.telefon2||'—') + '</td>'
      + (isAdmin
          ? '<td><div style="display:flex;gap:6px;">'
              + '<button class="btn-action" onclick="openEdit(' + t.ri + ')">✏️</button>'
              + '<button class="btn-action" onclick="confirmDel(' + t.ri + ')">🗑️</button>'
            + '</div></td>'
          : '')
      + '</tr>';
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
    const maktabText = (t.maktablar||[]).map(u => ADMINS_MAP[u]||u).join(', ') || '—';
    return '<div class="tc">'
      + '<div class="tc-head">'
        + '<div>'
          + '<div class="tc-name">' + esc2(t.ism) + ' ' + esc2(t.familiya) + '</div>'
          + '<div class="tc-sub">#' + (i+1) + ' · <span class="fan-badge">' + (t.fan||'—') + '</span></div>'
        + '</div>'
        + (isAdmin
          ? '<div class="tc-btns">'
              + '<button class="btn-action" onclick="openEdit(' + t.ri + ')">✏️</button>'
              + '<button class="btn-action" onclick="confirmDel(' + t.ri + ')">🗑️</button>'
            + '</div>'
          : (isSuper
            ? '<div class="tc-btns"><button class="btn-assign-open" onclick="openMobile(' + t.ri + ')">🏫 Maktab</button></div>'
            : ''))
      + '</div>'
      + '<div class="tc-body">'
        + '<div class="tc-row"><span class="tc-lbl">📞 Telefon</span><span class="tc-val mono">' + (t.telefon||'—') + '</span></div>'
        + (t.telefon2 ? '<div class="tc-row"><span class="tc-lbl">📞 Qo\'sh.</span><span class="tc-val mono">' + t.telefon2 + '</span></div>' : '')
        + (isSuper ? '<div class="tc-row"><span class="tc-lbl">🏫 Maktab(lar)</span><span class="tc-val" style="font-size:12px;">' + esc2(maktabText) + '</span></div>' : '')
      + '</div>'
      + '</div>';
  }).join('');
}

// ─────────────────────────────────────────────
//  SUPERADMIN: MAKTAB BIRIKTIRISH / AJRATISH
// ─────────────────────────────────────────────
async function addMaktab(ri) {
  const t = T[ri];
  if (!t) return;
  const sel = g('maktab-sel-' + ri);
  if (!sel) return;
  const adminUsername = sel.value;
  if (!adminUsername) { toast('⚠️ Maktab tanlang', 'error'); return; }

  try {
    const r = await api.addTeacherMaktab({
      username:      U.username,
      parol:         U.parol,
      teacherId:     t.id,
      adminUsername: adminUsername
    });
    if (r.ok) {
      const nom = ADMINS_MAP[adminUsername] || adminUsername;
      toast('✅ ' + nom + " maktabiga biriktirildi!", 'success');
      await loadTeachers();
    } else {
      toast('❌ ' + r.error, 'error');
    }
  } catch { toast('❌ Xatolik', 'error'); }
}

async function removeMaktab(ri, adminUsername) {
  const t = T[ri];
  if (!t) return;
  const nom = ADMINS_MAP[adminUsername] || adminUsername;
  if (!confirm('"' + t.ism + ' ' + t.familiya + '" o\'qituvchini ' + nom + ' maktabidan ajratasizmi?\n\nDavomat ma\'lumotlari saqlanib qoladi.')) return;

  try {
    const r = await api.removeTeacherMaktab({
      username:      U.username,
      parol:         U.parol,
      teacherId:     t.id,
      adminUsername: adminUsername
    });
    if (r.ok) {
      toast('✅ ' + nom + " maktabidan ajratildi", 'success');
      await loadTeachers();
    } else {
      toast('❌ ' + r.error, 'error');
    }
  } catch { toast('❌ Xatolik', 'error'); }
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

  if (!ism || !fam)  { toast('⚠️ Ism va familiya kiriting', 'error'); return; }
  if (!fan)          { toast('⚠️ Fan tanlang', 'error'); return; }
  if (!tel)          { toast('⚠️ Telefon kiriting', 'error'); return; }
  if (!isTelOk(tel)) { toast("⚠️ Telefon formati noto'g'ri (+998 XX XXX XX XX)", 'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon formati noto'g'ri", 'error'); return; }

  setBtnLoading('submit-btn', 'spinner', 'btn-txt', true, 'Saqlanmoqda…');
  try {
    const r = await api.addTeacher({
      username: U.username, parol: U.parol,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2||'',
      kunlar:'', sinflar:'', boshlanish:'', tugash:'',
      date: new Date().toLocaleDateString('uz-UZ')
    });
    if (r.ok) { clearForm(); await loadTeachers(); toast("✅ O'qituvchi qo'shildi!", 'success'); }
    else toast('❌ ' + r.error, 'error');
  } catch { toast('❌ Server bilan ulanishda xatolik', 'error'); }
  setBtnLoading('submit-btn', 'spinner', 'btn-txt', false, 'Saqlash');
}

function clearForm() {
  ['f-ism','f-familiya','f-tel','f-tel2'].forEach(id => g(id).value = '');
  g('f-fan').value = '';
  ['f-tel-hint','f-tel2-hint'].forEach(id => {
    const el = g(id); if (el) { el.textContent=''; el.className='tel-hint'; }
  });
}

// ─────────────────────────────────────────────
//  TAHRIRLASH MODAL
// ─────────────────────────────────────────────
function openEdit(idx) {
  const t = T[idx]; if (!t) return;
  eIdx = idx;
  setValue('e-ism',      t.ism||'');
  setValue('e-familiya', t.familiya||'');
  setValue('e-fan',      t.fan||'');
  setValue('e-tel',      t.telefon||'');
  setValue('e-tel2',     t.telefon2||'');
  ['e-tel','e-tel2'].forEach(id => {
    const inp=g(id), hint=g(id+'-hint');
    if (inp) inp.className='field-input tel-input';
    if (hint) { hint.textContent=''; hint.className='tel-hint'; }
    if (inp && inp.value) validateTel(inp,hint);
  });
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

  if (!ism||!fam) { toast('⚠️ Ism va familiya kiriting','error'); return; }
  if (!fan)       { toast('⚠️ Fan tanlang','error'); return; }
  if (!tel)       { toast('⚠️ Telefon kiriting','error'); return; }
  if (!isTelOk(tel)) { toast("⚠️ Telefon formati noto'g'ri",'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon noto'g'ri",'error'); return; }

  const old = T[eIdx];
  setBtnLoading('e-save-btn','e-spinner','e-btn-txt',true,'Saqlanmoqda…');
  try {
    const r = await api.editTeacher({
      username: U.username, parol: U.parol,
      id: old.id,
      oldIsm: old.ism, oldFamiliya: old.familiya,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2||'',
      kunlar: old.kunlar||'', sinflar: old.sinflar||'',
      boshlanish: old.boshlanish||'', tugash: old.tugash||''
    });
    if (r.ok) { closeEdit(); await loadTeachers(); toast("✅ O'qituvchi yangilandi!",'success'); }
    else toast('❌ ' + r.error,'error');
  } catch { toast('❌ Xatolik','error'); }
  setBtnLoading('e-save-btn','e-spinner','e-btn-txt',false,'Saqlash');
}

// ─────────────────────────────────────────────
//  O'CHIRISH (oddiy admin)
// ─────────────────────────────────────────────
function confirmDel(idx) {
  const t = T[idx]; if (!t) return;
  if (!confirm('"' + t.ism + ' ' + t.familiya + "\" o'qituvchini o'z ro'yxatingizdan chiqarishni tasdiqlaysizmi?")) return;
  delTeacher(idx);
}

async function delTeacher(idx) {
  const t = T[idx];
  try {
    const r = await api.deleteTeacher({ username: U.username, parol: U.parol, delId: t.id, delIsm: t.ism, delFamiliya: t.familiya });
    if (r.ok) { await loadTeachers(); toast("✅ O'qituvchi ro'yxatdan chiqarildi",'success'); }
    else toast('❌ ' + r.error,'error');
  } catch { toast('❌ Xatolik','error'); }
}

// ─────────────────────────────────────────────
//  YORDAMCHI: Telefon
// ─────────────────────────────────────────────
function fmtTel(val) {
  const d = val.replace(/\D/g,'');
  let s = d.startsWith('998') ? d : d.startsWith('0') ? '998'+d.slice(1) : '998'+d;
  s = s.slice(0,12);
  let o='';
  if(s.length>0) o='+'+s.slice(0,3);
  if(s.length>3) o+=' '+s.slice(3,5);
  if(s.length>5) o+=' '+s.slice(5,8);
  if(s.length>8) o+=' '+s.slice(8,10);
  if(s.length>10) o+=' '+s.slice(10,12);
  return o;
}
function isTelOk(val) { const d=val.replace(/\D/g,''); return d.length===12&&d.startsWith('998'); }
function validateTel(inp,hintEl) {
  if(!inp) return;
  const val=inp.value.trim();
  if(!val) { inp.className='field-input tel-input'; if(hintEl){hintEl.className='tel-hint';hintEl.textContent='';} return; }
  const ok=isTelOk(val);
  inp.className='field-input tel-input '+(ok?'tel-ok':'tel-err');
  if(hintEl){hintEl.className='tel-hint '+(ok?'ok':'err');hintEl.textContent=ok?"✓ To'g'ri format":"✗ +998 XX XXX XX XX formatida kiriting";}
}
function setupTel(inpId,hintId) {
  const inp=g(inpId),hint=g(hintId); if(!inp) return;
  inp.addEventListener('input',function(){
    const ol=this.value.length,pos=this.selectionStart;
    this.value=fmtTel(this.value);
    const diff=this.value.length-ol;
    try{this.setSelectionRange(pos+diff,pos+diff);}catch(e){}
    validateTel(this,hint);
  });
  inp.addEventListener('blur',()=>validateTel(inp,hint));
}

// ─────────────────────────────────────────────
//  YORDAMCHI: Umumiy
// ─────────────────────────────────────────────
function setBtnLoading(btnId,spId,txtId,loading,txt) {
  const b=g(btnId),s=g(spId),t=g(txtId);
  if(b) b.disabled=loading;
  if(s) s.style.display=loading?'inline-block':'none';
  if(t) t.textContent=txt;
}
function setDisplay(id,val) { const el=g(id); if(el) el.style.display=val; }
function setValue(id,val)   { const el=g(id); if(el) el.value=val; }
function g(id)   { return document.getElementById(id); }
function esc(s)  { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function esc2(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let toastT;
function toast(msg,type='') {
  const t=g('toast'); if(!t) return;
  t.textContent=msg; t.className='toast show '+(type||'');
  clearTimeout(toastT);
  toastT=setTimeout(()=>{t.className='toast';},type==='error'?8000:3000);
}
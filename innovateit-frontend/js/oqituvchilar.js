// ═══════════════════════════════════════════════════
//  InnovateIT School — O'qituvchilar  (oqituvchilar.js)
//  Superadmin: qo'shish + portfolio + edit + delete
//  Oddiy admin: ko'rish + edit + delete (faqat asosiy)
// ═══════════════════════════════════════════════════

let U           = null;
let T           = [];
let eIdx        = null;          // oddiy admin edit index
let SE_ID       = null;          // superadmin edit teacher id
let SE_SERTS    = [];            // superadmin edit modal sertifikatlar
let ADMINS_MAP  = {};
let ADMINS_LIST = [];

const BASE_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '')
  ? 'http://127.0.0.1:3001' : '';

// ─── Ortga qaytganda (bfcache) modallarni yopish ───
window.addEventListener('pageshow', () => {
  ['edit-modal', 'assign-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  });
  // Super modallar faqat superadmin uchun dinamik qo'shiladi,
  // bfcache da bo'lsa ham yopamiz
  const sm = document.getElementById('super-edit-modal');
  if (sm) sm.style.display = 'none';
  const sa = document.getElementById('super-add-modal');
  if (sa) sa.style.display = 'none';
});

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
    if (U.isSuper) {
      setDisplay('super-add-bar', 'block');
      injectSuperModals(); // Faqat superadmin uchun modal HTMLni qo'shamiz
    }
  }

  setupTel('f-tel',  'f-tel-hint');
  setupTel('f-tel2', 'f-tel2-hint');
  setupTel('e-tel',  'e-tel-hint');
  setupTel('e-tel2', 'e-tel2-hint');
  setupTel('sa-tel', 'sa-tel-hint');
  setupTel('sa-tel2','sa-tel2-hint');
  setupTel('se-tel', 'se-tel-hint');
  setupTel('se-tel2','se-tel2-hint');

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
        + '<td>'
          + '<div style="display:flex;gap:6px;">'
            + '<button class="btn-action" onclick="openSuperEdit(' + t.id + ')" title="Tahrirlash">✏️</button>'
            + '<button class="btn-action" onclick="confirmDelSuper(' + t.ri + ')" title="O\'chirish" style="color:#ef4444;">🗑️</button>'
          + '</div>'
        + '</td>'
        + '</tr>';
    }

    // Oddiy admin ko'rinishi: faqat asosiy ma'lumotlar
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
        + (isSuper
          ? '<div class="tc-btns">'
              + '<button class="btn-action" onclick="openSuperEdit(' + t.id + ')">✏️</button>'
              + '<button class="btn-action" onclick="confirmDelSuper(' + t.ri + ')" style="color:#ef4444;">🗑️</button>'
            + '</div>'
          : (isAdmin
            ? '<div class="tc-btns">'
                + '<button class="btn-action" onclick="openEdit(' + t.ri + ')">✏️</button>'
                + '<button class="btn-action" onclick="confirmDel(' + t.ri + ')">🗑️</button>'
              + '</div>'
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
  const t = T[ri]; if (!t) return;
  const sel = g('maktab-sel-' + ri); if (!sel) return;
  const adminUsername = sel.value;
  if (!adminUsername) { toast('⚠️ Maktab tanlang', 'error'); return; }
  try {
    const r = await api.addTeacherMaktab({ username: U.username, parol: U.parol, teacherId: t.id, adminUsername });
    if (r.ok) {
      toast('✅ ' + (ADMINS_MAP[adminUsername]||adminUsername) + " maktabiga biriktirildi!", 'success');
      await loadTeachers();
    } else toast('❌ ' + r.error, 'error');
  } catch { toast('❌ Xatolik', 'error'); }
}

async function removeMaktab(ri, adminUsername) {
  const t = T[ri]; if (!t) return;
  const nom = ADMINS_MAP[adminUsername] || adminUsername;
  if (!confirm('"' + t.ism + ' ' + t.familiya + '" o\'qituvchini ' + nom + ' maktabidan ajratasizmi?')) return;
  try {
    const r = await api.removeTeacherMaktab({ username: U.username, parol: U.parol, teacherId: t.id, adminUsername });
    if (r.ok) { toast('✅ ' + nom + " maktabidan ajratildi", 'success'); await loadTeachers(); }
    else toast('❌ ' + r.error, 'error');
  } catch { toast('❌ Xatolik', 'error'); }
}

// ─────────────────────────────────────────────
//  SUPERADMIN: YANGI O'QITUVCHI QO'SHISH + PORTFOLIO
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
//  SUPERADMIN MODAL HTML INJECT (faqat superadmin uchun)
// ─────────────────────────────────────────────
function injectSuperModals() {
  if (document.getElementById('super-add-modal')) return; // allaqachon bor

  const fanOptions = `
    <option value="">— Tanlang —</option>
    <option value="Matematika">Matematika</option>
    <option value="Ingliz tili">Ingliz tili</option>
    <option value="IT">IT</option>`;

  const addHtml = `
<div class="modal-overlay" id="super-add-modal" style="display:none;" onclick="if(event.target===this)closeSuperAdd()">
  <div class="modal" style="max-width:660px;max-height:90vh;overflow-y:auto;">
    <div class="modal-drag"></div>
    <div class="modal-title">➕ Yangi o'qituvchi qo'shish</div>
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">📋 Asosiy ma'lumotlar</div>
    <div class="form-grid" style="margin-bottom:16px;">
      <div class="field-group"><label class="field-label">Ism *</label><input class="field-input" id="sa-ism" placeholder="Nodira" autocomplete="off"></div>
      <div class="field-group"><label class="field-label">Familiya *</label><input class="field-input" id="sa-familiya" placeholder="Yusupova" autocomplete="off"></div>
      <div class="field-group"><label class="field-label">Fan *</label><select class="field-input" id="sa-fan">${fanOptions}</select></div>
      <div class="field-group"><label class="field-label">Telefon *</label><div class="tel-wrap"><input class="field-input tel-input" id="sa-tel" placeholder="+998 __ ___ __ __" maxlength="17" inputmode="tel"><div class="tel-hint" id="sa-tel-hint"></div></div></div>
      <div class="field-group"><label class="field-label">Qo'sh. telefon <span style="font-weight:400;font-size:10px;">(ixtiyoriy)</span></label><div class="tel-wrap"><input class="field-input tel-input" id="sa-tel2" placeholder="+998 __ ___ __ __" maxlength="17" inputmode="tel"><div class="tel-hint" id="sa-tel2-hint"></div></div></div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">📂 Portfolio ma'lumotlari <span style="font-weight:400;text-transform:none;font-size:10px;">(ixtiyoriy)</span></div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
      <div class="field-group"><label class="field-label">F.I.SH. (To'liq ism)</label><input class="field-input" id="sa-fish" placeholder="Yusupova Nodira Karimovna"></div>
      <div class="field-group"><label class="field-label">O'qigan yoki bitirgan universiteti</label><input class="field-input" id="sa-univ" placeholder="Toshkent Davlat Pedagogika Universiteti"></div>
      <div class="field-group"><label class="field-label">Olgan sertifikatlari (matn)</label><textarea class="field-input" id="sa-sert" rows="3" style="resize:vertical;font-family:inherit;" placeholder="IELTS 7.0, Cambridge B2..."></textarea></div>
      <div class="field-group"><label class="field-label">Ish joylari va Ish tajribasi</label><textarea class="field-input" id="sa-tajriba" rows="3" style="resize:vertical;font-family:inherit;" placeholder="2018-2020: 45-maktab&#10;2020-hozir: InnovateIT School"></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeSuperAdd()">Bekor</button>
      <button class="btn-submit" id="sa-save-btn" onclick="saveSuperAdd()"><span class="spinner" id="sa-spinner"></span><span id="sa-btn-txt">Saqlash</span></button>
    </div>
  </div>
</div>`;

  const editHtml = `
<div class="modal-overlay" id="super-edit-modal" style="display:none;" onclick="if(event.target===this)closeSuperEdit()">
  <div class="modal" style="max-width:660px;max-height:92vh;overflow-y:auto;">
    <div class="modal-drag"></div>
    <div class="modal-title">✏️ O'qituvchini tahrirlash</div>
    <input type="hidden" id="se-id">
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">📋 Asosiy ma'lumotlar</div>
    <div class="form-grid" style="margin-bottom:16px;">
      <div class="field-group"><label class="field-label">Ism *</label><input class="field-input" id="se-ism"></div>
      <div class="field-group"><label class="field-label">Familiya *</label><input class="field-input" id="se-familiya"></div>
      <div class="field-group"><label class="field-label">Fan *</label><select class="field-input" id="se-fan">${fanOptions}</select></div>
      <div class="field-group"><label class="field-label">Telefon *</label><div class="tel-wrap"><input class="field-input tel-input" id="se-tel" maxlength="17" inputmode="tel"><div class="tel-hint" id="se-tel-hint"></div></div></div>
      <div class="field-group"><label class="field-label">Qo'sh. telefon</label><div class="tel-wrap"><input class="field-input tel-input" id="se-tel2" maxlength="17" inputmode="tel"><div class="tel-hint" id="se-tel2-hint"></div></div></div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">📂 Portfolio ma'lumotlari</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
      <div class="field-group"><label class="field-label">F.I.SH. (To'liq ism)</label><input class="field-input" id="se-fish" placeholder="Yusupova Nodira Karimovna"></div>
      <div class="field-group"><label class="field-label">O'qigan yoki bitirgan universiteti</label><input class="field-input" id="se-univ" placeholder="Toshkent Davlat Pedagogika Universiteti"></div>
      <div class="field-group"><label class="field-label">Olgan sertifikatlari (matn)</label><textarea class="field-input" id="se-sert" rows="3" style="resize:vertical;font-family:inherit;"></textarea></div>
      <div class="field-group"><label class="field-label">Ish joylari va Ish tajribasi</label><textarea class="field-input" id="se-tajriba" rows="3" style="resize:vertical;font-family:inherit;"></textarea></div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
      📎 Sertifikat rasmlari <span id="se-sert-count" style="font-weight:400;color:#6b7280;text-transform:none;font-size:11px;margin-left:6px;">(0/10)</span>
    </div>
    <div id="se-sert-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:12px;"></div>
    <label id="se-upload-label" style="display:inline-flex;align-items:center;gap:8px;padding:9px 16px;background:#f3f4f6;border:2px dashed #d1d5db;border-radius:10px;cursor:pointer;font-size:13px;color:#374151;font-weight:500;margin-bottom:4px;">
      📎 Fayl qo'shish (PDF, JPG, PNG)
      <input type="file" id="se-sert-file" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf" style="display:none;" onchange="uploadSeSert()">
    </label>
    <div style="font-size:11px;color:#9ca3af;margin-bottom:16px;">Maksimal 10 ta fayl, har biri max 10 MB</div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeSuperEdit()">Bekor</button>
      <button class="btn-submit" id="se-save-btn" onclick="saveSuperEdit()"><span class="spinner" id="se-spinner"></span><span id="se-btn-txt">Saqlash</span></button>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', addHtml);
  document.body.insertAdjacentHTML('beforeend', editHtml);

  // Tel inputlarini sozlash
  setupTel('sa-tel', 'sa-tel-hint');
  setupTel('sa-tel2', 'sa-tel2-hint');
  setupTel('se-tel', 'se-tel-hint');
  setupTel('se-tel2', 'se-tel2-hint');
}

function openSuperAdd() {
  if (!U || !U.isSuper) return;  // Faqat superadmin uchun
  ['sa-ism','sa-familiya','sa-tel','sa-tel2','sa-fish','sa-univ'].forEach(id => { const el=g(id); if(el) el.value=''; });
  ['sa-sert','sa-tajriba'].forEach(id => { const el=g(id); if(el) el.value=''; });
  g('sa-fan').value = '';
  ['sa-tel-hint','sa-tel2-hint'].forEach(id => { const el=g(id); if(el) { el.textContent=''; el.className='tel-hint'; } });
  const m = g('super-add-modal'); if(m) { m.style.display='flex'; }
}
function closeSuperAdd() {
  const m = g('super-add-modal'); if(m) { m.style.display='none'; }
}

async function saveSuperAdd() {
  const ism  = (g('sa-ism')?.value||'').trim();
  const fam  = (g('sa-familiya')?.value||'').trim();
  const fan  = g('sa-fan')?.value||'';
  const tel  = (g('sa-tel')?.value||'').trim();
  const tel2 = (g('sa-tel2')?.value||'').trim();

  if (!ism||!fam)    { toast('⚠️ Ism va familiya kiriting','error'); return; }
  if (!fan)          { toast('⚠️ Fan tanlang','error'); return; }
  if (!tel)          { toast('⚠️ Telefon kiriting','error'); return; }
  if (!isTelOk(tel)) { toast("⚠️ Telefon formati noto'g'ri (+998 XX XXX XX XX)",'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon formati noto'g'ri",'error'); return; }

  const fish     = (g('sa-fish')?.value||'').trim();
  const univ     = (g('sa-univ')?.value||'').trim();
  const sertMatn = (g('sa-sert')?.value||'').trim();
  const tajriba  = (g('sa-tajriba')?.value||'').trim();

  setBtnLoading('sa-save-btn','sa-spinner','sa-btn-txt',true,'Saqlanmoqda…');
  try {
    // 1. O'qituvchi qo'shish
    const r = await api.addTeacher({
      username: U.username, parol: U.parol,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2||'',
      kunlar:'', sinflar:'', boshlanish:'', tugash:'',
      date: new Date().toLocaleDateString('ru-RU')
    });
    if (!r.ok) { toast('❌ ' + r.error,'error'); return; }

    // 2. Agar portfolio ma'lumotlari bor bo'lsa, saqlaymiz
    if (fish||univ||sertMatn||tajriba) {
      // O'qituvchi id ni olish uchun qayta yuklash
      await loadTeachersQuiet();
      const added = T.find(t => t.ism===ism && t.familiya===fam);
      if (added) {
        await api.savePortfolioTeacher({
          username: U.username, parol: U.parol,
          fish, universitet: univ, sertifikatlar: sertMatn, ish_tajribasi: tajriba
        }, added.id);
      }
    }

    toast("✅ O'qituvchi qo'shildi!",'success');
    closeSuperAdd();
    await loadTeachers();
  } catch { toast('❌ Server bilan ulanishda xatolik','error'); }
  setBtnLoading('sa-save-btn','sa-spinner','sa-btn-txt',false,'Saqlash');
}

// Faqat T massivini yangilash (UI ni emas)
async function loadTeachersQuiet() {
  try {
    const d = await api.getTeachers({ username: U.username, parol: U.parol });
    if (d.ok) { T = d.teachers; T.forEach((t,i) => t.ri=i); }
  } catch {}
}

// ─────────────────────────────────────────────
//  SUPERADMIN: TAHRIRLASH (asosiy + portfolio + sertifikatlar)
// ─────────────────────────────────────────────
async function openSuperEdit(teacherId) {
  if (!U || !U.isSuper) return;  // Faqat superadmin uchun
  SE_ID    = teacherId;
  SE_SERTS = [];

  // Asosiy ma'lumotlarni topish
  const t = T.find(x => x.id === teacherId);
  if (t) {
    setValue('se-id',       t.id);
    setValue('se-ism',      t.ism||'');
    setValue('se-familiya', t.familiya||'');
    setValue('se-fan',      t.fan||'');
    setValue('se-tel',      t.telefon||'');
    setValue('se-tel2',     t.telefon2||'');
    ['se-tel','se-tel2'].forEach(id => {
      const inp=g(id), hint=g(id+'-hint');
      if (inp) inp.className='field-input tel-input';
      if (hint) { hint.textContent=''; hint.className='tel-hint'; }
      if (inp && inp.value) validateTel(inp,hint);
    });
  }

  // Portfolio va sertifikatlarni tozalash
  setValue('se-fish',''); setValue('se-univ','');
  setValue('se-sert',''); setValue('se-tajriba','');
  g('se-sert-gallery').innerHTML = '';
  updateSeCount(0);

  const modal = g('super-edit-modal'); if(modal) { modal.style.display='flex'; }

  // Portfolio yuklash
  try {
    const r = await api.getPortfolioTeacher({ username: U.username, parol: U.parol }, teacherId);
    if (r.ok) {
      const p = r.portfolio;
      if (p) {
        setValue('se-fish',    p.fish||'');
        setValue('se-univ',    p.universitet||'');
        setValue('se-sert',    p.sertifikatlar||'');
        setValue('se-tajriba', p.ish_tajribasi||'');
      }
      SE_SERTS = r.sertifikatlar || [];
      renderSeGallery();
    }
  } catch {}
}

function closeSuperEdit() {
  const m = g('super-edit-modal'); if(m) { m.style.display='none'; }
  SE_ID = null; SE_SERTS = [];
}

async function saveSuperEdit() {
  const ism  = (g('se-ism')?.value||'').trim();
  const fam  = (g('se-familiya')?.value||'').trim();
  const fan  = g('se-fan')?.value||'';
  const tel  = (g('se-tel')?.value||'').trim();
  const tel2 = (g('se-tel2')?.value||'').trim();

  if (!ism||!fam)    { toast('⚠️ Ism va familiya kiriting','error'); return; }
  if (!fan)          { toast('⚠️ Fan tanlang','error'); return; }
  if (!tel)          { toast('⚠️ Telefon kiriting','error'); return; }
  if (!isTelOk(tel)) { toast("⚠️ Telefon formati noto'g'ri",'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon noto'g'ri",'error'); return; }

  const old = T.find(x => x.id === SE_ID);

  setBtnLoading('se-save-btn','se-spinner','se-btn-txt',true,'Saqlanmoqda…');
  try {
    // 1. Asosiy ma'lumotlarni yangilash
    const r = await api.editTeacher({
      username: U.username, parol: U.parol,
      id: SE_ID,
      oldIsm: old?.ism||ism, oldFamiliya: old?.familiya||fam,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2||'',
      kunlar: old?.kunlar||'', sinflar: old?.sinflar||'',
      boshlanish: old?.boshlanish||'', tugash: old?.tugash||''
    });
    if (!r.ok) { toast('❌ ' + r.error,'error'); return; }

    // 2. Portfolio ma'lumotlarini saqlash
    await api.savePortfolioTeacher({
      username:      U.username,
      parol:         U.parol,
      fish:          (g('se-fish')?.value||'').trim(),
      universitet:   (g('se-univ')?.value||'').trim(),
      sertifikatlar: (g('se-sert')?.value||'').trim(),
      ish_tajribasi: (g('se-tajriba')?.value||'').trim()
    }, SE_ID);

    toast("✅ O'qituvchi yangilandi!",'success');
    closeSuperEdit();
    await loadTeachers();
  } catch { toast('❌ Xatolik','error'); }
  setBtnLoading('se-save-btn','se-spinner','se-btn-txt',false,'Saqlash');
}

// Sertifikat gallery (edit modal uchun)
function renderSeGallery() {
  const el = g('se-sert-gallery'); if (!el) return;
  updateSeCount(SE_SERTS.length);
  if (!SE_SERTS.length) { el.innerHTML=''; return; }

  el.innerHTML = SE_SERTS.map(s => {
    const url   = BASE_URL + '/uploads/' + encodeURIComponent(s.fayl_nomi);
    const isPdf = s.fayl_nomi.endsWith('.pdf');
    const thumb = isPdf
      ? '<div style="height:75px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#fee2e2;border-radius:8px;">📄</div>'
      : '<img src="' + url + '" style="width:100%;height:75px;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML=\'<div style=\\\"height:75px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f3f4f6;border-radius:8px;\\\">🖼️</div>\'">';
    return '<div style="position:relative;border:1.5px solid #e5e7eb;border-radius:10px;padding:6px;">'
      + thumb
      + '<div style="font-size:10px;color:#6b7280;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc2(s.asl_nomi||s.fayl_nomi) + '">' + esc2(s.asl_nomi||s.fayl_nomi) + '</div>'
      + '<button onclick="deleteSeSeert(\'' + esc(s.fayl_nomi) + '\')" style="position:absolute;top:3px;right:3px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0;">✕</button>'
      + '</div>';
  }).join('');
}

function updateSeCount(n) {
  const el = g('se-sert-count'); if(el) { el.textContent='('+n+'/10)'; el.style.color=n>=10?'#ef4444':'#6b7280'; }
  const lbl = g('se-upload-label'); if(lbl) lbl.style.opacity = n>=10?'.4':'1';
  const inp = g('se-sert-file');    if(inp) inp.disabled = n>=10;
}

async function uploadSeSert() {
  if (SE_SERTS.length >= 10) { toast('❗ Maksimal 10 ta sertifikat','error'); return; }
  const fileInput = g('se-sert-file');
  const file = fileInput?.files?.[0]; if(!file) return;

  const fd = new FormData();
  fd.append('file', file);
  fd.append('username', U.username);
  fd.append('parol', U.parol);
  fileInput.value = '';
  toast('⏳ Yuklanmoqda...');

  const r = await api.uploadSertifikat(SE_ID, fd);
  if (!r.ok) { toast('❌ ' + r.error,'error'); return; }

  SE_SERTS.push({ fayl_nomi: r.filename, asl_nomi: r.asl_nomi, yuklangan: new Date().toLocaleDateString('ru-RU') });
  renderSeGallery();
  toast('✅ Sertifikat yuklandi','success');
}

async function deleteSeSeert(filename) {
  if (!confirm("Bu sertifikatni o'chirmoqchimisiz?")) return;
  const r = await api.deleteSertifikat({ username: U.username, parol: U.parol }, SE_ID, filename);
  if (!r.ok) { toast('❌ ' + r.error,'error'); return; }
  SE_SERTS = SE_SERTS.filter(s => s.fayl_nomi !== filename);
  renderSeGallery();
  toast("✅ Sertifikat o'chirildi");
}

// ─────────────────────────────────────────────
//  SUPERADMIN: O'CHIRISH
// ─────────────────────────────────────────────
function confirmDelSuper(ri) {
  const t = T[ri]; if (!t) return;
  if (!confirm('"' + t.ism + ' ' + t.familiya + "\" o'qituvchini to'liq o'chirishni tasdiqlaysizmi?\n\nBarcha davomat va portfolio ma'lumotlari ham o'chiriladi!")) return;
  delTeacherSuper(t);
}

async function delTeacherSuper(t) {
  try {
    const r = await api.deleteTeacher({ username: U.username, parol: U.parol, delId: t.id, delIsm: t.ism, delFamiliya: t.familiya });
    if (r.ok) { await loadTeachers(); toast("✅ O'qituvchi o'chirildi",'success'); }
    else toast('❌ ' + r.error,'error');
  } catch { toast('❌ Xatolik','error'); }
}

// ─────────────────────────────────────────────
//  ODDIY ADMIN: O'QITUVCHI QO'SHISH
// ─────────────────────────────────────────────
async function addTeacher() {
  const ism  = g('f-ism').value.trim();
  const fam  = g('f-familiya').value.trim();
  const fan  = g('f-fan').value;
  const tel  = g('f-tel').value.trim();
  const tel2 = g('f-tel2').value.trim();

  if (!ism||!fam)  { toast('⚠️ Ism va familiya kiriting','error'); return; }
  if (!fan)        { toast('⚠️ Fan tanlang','error'); return; }
  if (!tel)        { toast('⚠️ Telefon kiriting','error'); return; }
  if (!isTelOk(tel)) { toast("⚠️ Telefon formati noto'g'ri (+998 XX XXX XX XX)",'error'); return; }
  if (tel2 && !isTelOk(tel2)) { toast("⚠️ Qo'sh. telefon formati noto'g'ri",'error'); return; }

  setBtnLoading('submit-btn','spinner','btn-txt',true,'Saqlanmoqda…');
  try {
    const r = await api.addTeacher({
      username: U.username, parol: U.parol,
      ism, familiya: fam, fan,
      telefon: tel, telefon2: tel2||'',
      kunlar:'', sinflar:'', boshlanish:'', tugash:'',
      date: new Date().toLocaleDateString('ru-RU')
    });
    if (r.ok) { clearForm(); await loadTeachers(); toast("✅ O'qituvchi qo'shildi!",'success'); }
    else toast('❌ ' + r.error,'error');
  } catch { toast('❌ Server bilan ulanishda xatolik','error'); }
  setBtnLoading('submit-btn','spinner','btn-txt',false,'Saqlash');
}

function clearForm() {
  ['f-ism','f-familiya','f-tel','f-tel2'].forEach(id => g(id).value = '');
  g('f-fan').value = '';
  ['f-tel-hint','f-tel2-hint'].forEach(id => {
    const el = g(id); if (el) { el.textContent=''; el.className='tel-hint'; }
  });
}

// ─────────────────────────────────────────────
//  ODDIY ADMIN: TAHRIRLASH
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
  const modal = g('edit-modal'); if (modal) modal.classList.add('show');
}

function closeEdit() {
  const modal = g('edit-modal'); if (modal) modal.classList.remove('show');
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
//  ODDIY ADMIN: O'CHIRISH
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
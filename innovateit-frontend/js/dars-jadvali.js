// ═══════════════════════════════════════════════════
//  InnovateIT School — Dars jadvali (dars-jadvali.js)
// ═══════════════════════════════════════════════════


const KUN_NAMES  = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const KUN_SHORT  = ['', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha'];
const KUNLAR_IDX = [1, 2, 3, 4, 5, 6];

let U         = null;   // { username, parol, ism }
let TEACHERS  = [];     // Barcha o'qituvchilar
let JADVALLAR = [];     // [{ id, teacher_ism, teacher_familiya, fan, sinflar:[], kunlar:[], boshlanish, tugash }]

let currentTab   = 'jadval';
let jadvalView   = 'sinf';   // 'sinf' | 'teacher'
let expJadType   = 'sinf';

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_jadval_user');
    if (!saved) { window.location.href = 'index.html'; return; }
    U = JSON.parse(saved);
  } catch { window.location.href = 'index.html'; return; }

  const badge = g('jad-badge');
  badge.textContent = U.ism;

  setupChips('b-sinf-chips', 'sinf-chip');
  setupChips('b-kun-chips',  'kun-chip');
  setupVaqtInp('b-bosh-s'); setupVaqtInp('b-bosh-m');
  setupVaqtInp('b-tug-s');  setupVaqtInp('b-tug-m');

  g('loading-ov').style.display = 'flex';
  await Promise.all([loadTeachers(), loadJadvallar()]);
  g('loading-ov').style.display = 'none';

  populateFilters();
  renderJadval();
  renderSavedJadvallar();
});

function goBack() {
  window.location.href = 'oqituvchilar.html';
}

// ─────────────────────────────────────────────
//  TAB SWITCH
// ─────────────────────────────────────────────
function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.jad-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  g('view-jadval').style.display   = tab === 'jadval'   ? '' : 'none';
  g('view-biriktir').style.display = tab === 'biriktir' ? '' : 'none';
  if (tab === 'jadval') renderJadval();
  if (tab === 'biriktir') renderSavedJadvallar();
}

// ─────────────────────────────────────────────
//  MA'LUMOT YUKLASH
// ─────────────────────────────────────────────
async function loadTeachers() {
  try {
    const d = await api.getTeachers({ username: U.username, parol: U.parol });
    if (d.ok) {
      TEACHERS = d.teachers;
      // O'qituvchi select larini to'ldirish
      ['b-teacher','filter-teacher','exp-teacher-sel'].forEach(id => {
        const sel = g(id); if (!sel) return;
        const cur = sel.value;
        // Faqat birinchi option ni saqlab, qolganlarni almashtiramiz
        while (sel.options.length > 1) sel.remove(1);
        TEACHERS.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.ism + ' ' + t.familiya;
          opt.textContent = `${t.ism} ${t.familiya} (${t.fan || '—'})`;
          sel.appendChild(opt);
        });
        if (cur) sel.value = cur;
      });
    }
  } catch {}
}

async function loadJadvallar() {
  try {
    const d = await api.getJadvallar({ username: U.username, parol: U.parol });
    if (d.ok) {
      JADVALLAR = d.jadvallar.map(j => ({
        ...j,
        sinflar: parseSinflar(j.sinflar),
        kunlar:  parseDays(j.kunlar)
      }));
    }
  } catch {}
}

// ─────────────────────────────────────────────
//  FILTER POPULATE
// ─────────────────────────────────────────────
function populateFilters() {
  const allSinflar = [...new Set(JADVALLAR.flatMap(j => j.sinflar))].sort((a,b) => parseInt(a)-parseInt(b));
  ['filter-sinf','exp-sinf-sel'].forEach(id => {
    const sel = g(id); if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    allSinflar.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  });
}

// ─────────────────────────────────────────────
//  VIEW TOGGLE
// ─────────────────────────────────────────────
function setView(view, btn) {
  jadvalView = view;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  g('filter-sinf-wrap').style.display    = view === 'sinf'    ? '' : 'none';
  g('filter-teacher-wrap').style.display = view === 'teacher' ? '' : 'none';
  renderJadval();
}

// ─────────────────────────────────────────────
//  JADVAL RENDER
// ─────────────────────────────────────────────
function renderJadval() {
  const wrap    = g('jadval-wrap');
  const today   = new Date().getDay(); // 0=yakshanba
  const filterS = g('filter-sinf')    ? g('filter-sinf').value    : '';
  const filterT = g('filter-teacher') ? g('filter-teacher').value : '';

  if (!JADVALLAR.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:40px;">
      <div class="empty-state-icon">📅</div>
      <p>Hali jadval yaratilmagan. "O'qituvchi biriktirish" bo'limidan boshlang.</p>
    </div>`;
    return;
  }

  if (jadvalView === 'sinf') {
    renderBySinf(wrap, filterS, today);
  } else {
    renderByTeacher(wrap, filterT, today);
  }
}

function renderBySinf(wrap, filterS, today) {
  // Barcha sinflar
  let sinflar = [...new Set(JADVALLAR.flatMap(j => j.sinflar))]
    .sort((a,b) => parseInt(a) - parseInt(b));
  if (filterS) sinflar = sinflar.filter(s => s === filterS);

  if (!sinflar.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:40px;"><p>Mos jadval topilmadi</p></div>';
    return;
  }

  let html = `<table class="jadval-table"><thead><tr>
    <th class="th-name">Sinf</th>
    ${KUNLAR_IDX.map(k => `<th class="${k===today?'today-col':''}">${KUN_NAMES[k]}</th>`).join('')}
  </tr></thead><tbody>`;

  sinflar.forEach(sinf => {
    html += `<tr><td class="td-name"><span class="sinf-badge">${sinf}</span></td>`;
    KUNLAR_IDX.forEach(kun => {
      const lessons = JADVALLAR.filter(j => j.sinflar.includes(sinf) && j.kunlar.includes(kun));
      if (lessons.length) {
        html += `<td class="${kun===today?'today-col':''}"><div class="jadval-cell">`;
        lessons.forEach(j => {
          html += `<div class="jcell teacher">
            <div class="jcell-name">${j.fan || '—'}</div>
            <div class="jcell-sub">${j.teacher_ism} ${j.teacher_familiya}</div>
            ${j.boshlanish ? `<div class="jcell-sub">⏰ ${j.boshlanish}–${j.tugash}</div>` : ''}
          </div>`;
        });
        html += `</div></td>`;
      } else {
        html += `<td class="${kun===today?'today-col':''}"><span class="jcell-empty">—</span></td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function renderByTeacher(wrap, filterT, today) {
  let jadvallar = JADVALLAR;
  if (filterT) jadvallar = jadvallar.filter(j => (j.teacher_ism+' '+j.teacher_familiya) === filterT);

  // Unique o'qituvchilar
  const teachers = [...new Map(jadvallar.map(j => [j.teacher_ism+' '+j.teacher_familiya, j])).values()];

  if (!teachers.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:40px;"><p>Mos jadval topilmadi</p></div>';
    return;
  }

  let html = `<table class="jadval-table"><thead><tr>
    <th class="th-name">O'qituvchi</th>
    ${KUNLAR_IDX.map(k => `<th class="${k===today?'today-col':''}">${KUN_NAMES[k]}</th>`).join('')}
  </tr></thead><tbody>`;

  teachers.forEach(tRef => {
    const tName = tRef.teacher_ism + ' ' + tRef.teacher_familiya;
    const tJad  = jadvallar.filter(j => j.teacher_ism+' '+j.teacher_familiya === tName);

    html += `<tr><td class="td-name">
      <div style="font-weight:600;">${tName}</div>
      <div style="font-size:11px;color:var(--muted);">${tRef.fan||'—'}</div>
    </td>`;

    KUNLAR_IDX.forEach(kun => {
      const lessons = tJad.filter(j => j.kunlar.includes(kun));
      if (lessons.length) {
        html += `<td class="${kun===today?'today-col':''}"><div class="jadval-cell">`;
        // Bir xil vaqtdagi darslarni guruhlash
        const grouped = [];
        lessons.forEach(j => {
          const vaqt = (j.boshlanish||'') + '-' + (j.tugash||'');
          const found = grouped.find(g => g.vaqt === vaqt);
          if (found) { found.sinflar = [...new Set([...found.sinflar, ...j.sinflar])]; }
          else { grouped.push({ vaqt, sinflar: [...j.sinflar], boshlanish: j.boshlanish, tugash: j.tugash }); }
        });
        grouped.forEach(g => {
          html += `<div class="jcell sinf">
            <div class="jcell-name">${g.sinflar.join(', ')}</div>
            ${g.boshlanish ? `<div class="jcell-sub">⏰ ${g.boshlanish}–${g.tugash}</div>` : ''}
          </div>`;
        });
        html += `</div></td>`;
      } else {
        html += `<td class="${kun===today?'today-col':''}"><span class="jcell-empty">—</span></td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ─────────────────────────────────────────────
//  BIRIKTIRISH
// ─────────────────────────────────────────────
function onTeacherSelect() {
  const val = g('b-teacher').value;
  g('b-sinf-panel').style.display = val ? '' : 'none';

  if (!val) {
    g('b-sinflar-current').innerHTML = '<span class="cs-empty">O\'qituvchi tanlanmagan</span>';
    return;
  }

  // Mavjud biriktiruvlarni ko'rsatish
  const existing = JADVALLAR.filter(j => j.teacher_ism + ' ' + j.teacher_familiya === val);
  const allSinflar = [...new Set(existing.flatMap(j => j.sinflar))];

  if (allSinflar.length) {
    g('b-sinflar-current').innerHTML = allSinflar
      .map(s => `<span class="cs-sinf">${s}</span>`).join('');
  } else {
    g('b-sinflar-current').innerHTML = '<span class="cs-empty">Hali biriktirilmagan</span>';
  }

  // Mavjud sinflarni chiplarda belgilash
  clearBirikChips();
  allSinflar.forEach(s => {
    const chip = g('b-sinf-chips').querySelector(`[data-s="${s}"]`);
    if (chip) chip.classList.add('sel');
  });
  if (existing.length) {
    const lastJ = existing[existing.length - 1];
    lastJ.kunlar.forEach(k => {
      const chip = g('b-kun-chips').querySelector(`[data-k="${k}"]`);
      if (chip) chip.classList.add('sel');
    });
    if (lastJ.boshlanish) {
      const [bs, bm] = (lastJ.boshlanish||'08:00').split(':');
      const [ts, tm] = (lastJ.tugash||'14:00').split(':');
      g('b-bosh-s').value=bs||'08'; g('b-bosh-m').value=bm||'00';
      g('b-tug-s').value=ts||'14';  g('b-tug-m').value=tm||'00';
    }
  }
}

function applyGroup(sinflar, btn) {
  // Toggle group
  const allSel = sinflar.every(s => {
    const chip = g('b-sinf-chips').querySelector(`[data-s="${s}"]`);
    return chip && chip.classList.contains('sel');
  });
  // Barcha group chiplarini deselect
  document.querySelectorAll('.group-chip').forEach(c => c.classList.remove('sel'));

  sinflar.forEach(s => {
    const chip = g('b-sinf-chips').querySelector(`[data-s="${s}"]`);
    if (chip) chip.classList.toggle('sel', !allSel);
  });
  if (!allSel) btn.classList.add('sel');
}

function clearBirikChips() {
  g('b-sinf-chips').querySelectorAll('.sinf-chip').forEach(c => c.classList.remove('sel'));
  g('b-kun-chips').querySelectorAll('.kun-chip').forEach(c => c.classList.remove('sel'));
  document.querySelectorAll('.group-chip').forEach(c => c.classList.remove('sel'));
}

function clearBirik() {
  g('b-teacher').value = '';
  g('b-sinf-panel').style.display = 'none';
  g('b-sinflar-current').innerHTML = '<span class="cs-empty">O\'qituvchi tanlanmagan</span>';
  clearBirikChips();
  g('b-bosh-s').value='08'; g('b-bosh-m').value='00';
  g('b-tug-s').value='14';  g('b-tug-m').value='00';
}

async function saveBiriktir() {
  const teacherVal = g('b-teacher').value;
  if (!teacherVal) { toast('⚠️ O\'qituvchi tanlang', 'error'); return; }

  const sinflar = [...g('b-sinf-chips').querySelectorAll('.sinf-chip.sel')].map(c => c.dataset.s);
  const kunlar  = [...g('b-kun-chips').querySelectorAll('.kun-chip.sel')].map(c => parseInt(c.dataset.k));

  if (!sinflar.length) { toast('⚠️ Kamida 1 sinf tanlang', 'error'); return; }
  if (!kunlar.length)  { toast('⚠️ Kamida 1 kun tanlang', 'error'); return; }

  const teacher = TEACHERS.find(t => t.ism + ' ' + t.familiya === teacherVal);
  const boshlanish = padZ(g('b-bosh-s').value) + ':' + padZ(g('b-bosh-m').value);
  const tugash     = padZ(g('b-tug-s').value)  + ':' + padZ(g('b-tug-m').value);

  bl('b-save-btn','b-spinner','b-btn-txt',true,'Saqlanmoqda…');
  try {
    const r = await api.saveJadval({
      username: U.username, parol: U.parol,
      teacher_ism: teacher ? teacher.ism : teacherVal.split(' ')[0],
      teacher_familiya: teacher ? teacher.familiya : teacherVal.split(' ').slice(1).join(' '),
      fan: teacher ? teacher.fan : '',
      sinflar: sinflar.join(','),
      kunlar: kunlar.join(','),
      boshlanish, tugash
    });
    if (r.ok) {
      await loadJadvallar();
      populateFilters();
      renderJadval();
      renderSavedJadvallar();
      clearBirik();
      toast('✅ Jadval saqlandi!', 'success');
    } else toast('❌ ' + r.error, 'error');
  } catch { toast('❌ Xatolik', 'error'); }
  bl('b-save-btn','b-spinner','b-btn-txt',false,'💾 Saqlash');
}

// ─────────────────────────────────────────────
//  SAQLANGAN JADVALLAR RENDER
// ─────────────────────────────────────────────
function renderSavedJadvallar() {
  const wrap = g('saved-jadvallar');
  if (!JADVALLAR.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><p>Hali jadval yaratilmagan</p></div>';
    return;
  }

  wrap.innerHTML = JADVALLAR.map((j, i) => `
    <div class="saved-jad-item">
      <div class="sji-info">
        <div class="sji-name">${j.teacher_ism} ${j.teacher_familiya}
          <span style="font-size:11px;color:var(--muted);margin-left:6px;">${j.fan||'—'}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap;">
          <div class="sji-sinflar">${j.sinflar.map(s=>`<span class="sji-sinf">${s}</span>`).join('')}</div>
          <div class="sji-kunlar">${j.kunlar.map(k=>`<span class="sji-kun">${KUN_SHORT[k]||k}</span>`).join('')}</div>
          ${j.boshlanish ? `<span style="font-size:11px;color:var(--muted);">⏰ ${j.boshlanish}–${j.tugash}</span>` : ''}
        </div>
      </div>
      <div class="sji-btns">
        <button class="btn-action" title="Tahrirlash" onclick="editJadval(${i})">✏️</button>
        <button class="btn-action" title="O'chirish"  onclick="deleteJadval(${j.id},'${esc(j.teacher_ism+' '+j.teacher_familiya)}')">🗑️</button>
      </div>
    </div>`).join('');
}

function editJadval(idx) {
  const j = JADVALLAR[idx]; if (!j) return;
  switchTab('biriktir', g('tab-biriktir'));
  g('b-teacher').value = j.teacher_ism + ' ' + j.teacher_familiya;
  onTeacherSelect();
}

async function deleteJadval(id, name) {
  if (!confirm(`"${name}" uchun jadval o'chirilsinmi?`)) return;
  try {
    const r = await api.deleteJadval({ username: U.username, parol: U.parol }, id);
    if (r.ok) {
      await loadJadvallar();
      populateFilters();
      renderJadval();
      renderSavedJadvallar();
      toast('✅ Jadval o\'chirildi', 'success');
    } else toast('❌ ' + r.error, 'error');
  } catch {}
}

// ─────────────────────────────────────────────
//  EXCEL EXPORT
// ─────────────────────────────────────────────
function openExportModal() {
  // Selectlarni to'ldirish
  populateFilters();
  g('export-jad-modal').style.display = 'flex';
}
function closeExportModal() { g('export-jad-modal').style.display = 'none'; }

function selectExpJad(type, btn) {
  expJadType = type;
  document.querySelectorAll('#exp-jad-tabs .export-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  g('exp-jad-sinf').style.display    = type === 'sinf'    ? '' : 'none';
  g('exp-jad-teacher').style.display = type === 'teacher' ? '' : 'none';
  g('exp-jad-all').style.display     = type === 'all'     ? '' : 'none';
}

function doExportJadval() {
  const wb = XLSX.utils.book_new();

  if (expJadType === 'sinf') {
    const filterS = g('exp-sinf-sel').value;
    const sinflar = filterS
      ? [filterS]
      : [...new Set(JADVALLAR.flatMap(j => j.sinflar))].sort((a,b)=>parseInt(a)-parseInt(b));

    sinflar.forEach(sinf => {
      buildSinfSheet(wb, sinf);
    });
    if (!wb.SheetNames.length) { toast('⚠️ Ma\'lumot topilmadi', 'error'); return; }
    XLSX.writeFile(wb, `Jadval_Sinf${filterS||'_Barchasi'}.xlsx`);

  } else if (expJadType === 'teacher') {
    const filterT = g('exp-teacher-sel').value;
    const teachers = filterT
      ? [filterT]
      : [...new Set(JADVALLAR.map(j => j.teacher_ism+' '+j.teacher_familiya))];

    teachers.forEach(tName => {
      buildTeacherSheet(wb, tName);
    });
    if (!wb.SheetNames.length) { toast('⚠️ Ma\'lumot topilmadi', 'error'); return; }
    XLSX.writeFile(wb, `Jadval_Oqituvchi${filterT ? '_'+filterT.replace(/ /g,'_') : '_Barchasi'}.xlsx`);

  } else {
    // Umumiy — sinf bo'yicha + o'qituvchi bo'yicha
    const sinflar = [...new Set(JADVALLAR.flatMap(j => j.sinflar))].sort((a,b)=>parseInt(a)-parseInt(b));
    sinflar.forEach(s => buildSinfSheet(wb, s));
    const teachers = [...new Set(JADVALLAR.map(j => j.teacher_ism+' '+j.teacher_familiya))];
    teachers.forEach(t => buildTeacherSheet(wb, t));
    if (!wb.SheetNames.length) { toast('⚠️ Ma\'lumot topilmadi', 'error'); return; }
    XLSX.writeFile(wb, 'Haftalik_Dars_Jadvali.xlsx');
  }

  closeExportModal();
  toast('✅ Excel yuklab olindi!', 'success');
}

function buildSinfSheet(wb, sinf) {
  const rows = [['', ...KUN_NAMES.slice(1)]]; // Header
  const sinfJad = JADVALLAR.filter(j => j.sinflar.includes(sinf));
  if (!sinfJad.length) return;

  // Unique vaqtlar bo'yicha guruhlash
  const vaqtlar = [...new Set(sinfJad.map(j => j.boshlanish||''))].sort();

  vaqtlar.forEach(vaqt => {
    const row = [vaqt || 'Belgilanmagan'];
    KUNLAR_IDX.forEach(kun => {
      const lesson = sinfJad.find(j => j.kunlar.includes(kun) && (j.boshlanish||'') === vaqt);
      row.push(lesson ? `${lesson.fan||'—'}\n${lesson.teacher_ism} ${lesson.teacher_familiya}` : '—');
    });
    rows.push(row);
  });

  // Agar vaqtsiz jadvallar bo'lsa
  const noVaqt = sinfJad.filter(j => !j.boshlanish);
  if (noVaqt.length && !vaqtlar.includes('')) {
    KUNLAR_IDX.forEach((kun, ci) => {
      const lesson = noVaqt.find(j => j.kunlar.includes(kun));
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:14}, ...KUN_NAMES.slice(1).map(()=>({wch:22}))];
  const sheetName = (sinf.length > 31 ? sinf.slice(0,31) : sinf);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

function buildTeacherSheet(wb, tName) {
  const tJad = JADVALLAR.filter(j => j.teacher_ism+' '+j.teacher_familiya === tName);
  if (!tJad.length) return;

  const rows = [['Sinf(lar)', ...KUN_NAMES.slice(1)]];

  // Har bir jadval qatori
  tJad.forEach(j => {
    const row = [j.sinflar.join(', ')];
    KUNLAR_IDX.forEach(kun => {
      if (j.kunlar.includes(kun)) {
        row.push(j.boshlanish ? `${j.boshlanish}–${j.tugash}` : '✓');
      } else {
        row.push('—');
      }
    });
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:16}, ...KUN_NAMES.slice(1).map(()=>({wch:14}))];
  const sheetName = (tName.length > 31 ? tName.slice(0,31) : tName);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

// ─────────────────────────────────────────────
//  YORDAMCHI
// ─────────────────────────────────────────────

function setupChips(containerId, cls) {
  const cont = g(containerId); if (!cont) return;
  cont.querySelectorAll('.' + cls).forEach(c =>
    c.addEventListener('click', () => c.classList.toggle('sel'))
  );
}

function setupVaqtInp(id) {
  const inp = g(id); if (!inp) return;
  inp.addEventListener('input', function() {
    const max = parseInt(this.max), v = parseInt(this.value);
    if (!isNaN(v)) { if(v>max) this.value=max; if(v<0) this.value=0; }
  });
  inp.addEventListener('blur', function() {
    if (this.value !== '') this.value = String(parseInt(this.value)||0).padStart(2,'0');
  });
}

function parseDays(str) {
  if (!str) return [];
  return String(str).split(',').map(Number).filter(n => n >= 1 && n <= 6);
}
function parseSinflar(str) {
  if (!str) return [];
  return String(str).split(',').map(s => s.trim()).filter(Boolean);
}

function bl(btnId, spId, txtId, loading, txt) {
  if (btnId) g(btnId).disabled = loading;
  g(spId).style.display = loading ? 'inline-block' : 'none';
  g(txtId).textContent  = txt;
}
function padZ(v) { return String(parseInt(v)||0).padStart(2,'0'); }
function g(id)   { return document.getElementById(id); }
function esc(s)  { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

let toastT;
function toast(msg, type='') {
  const t=g('toast'); t.textContent=msg; t.className='toast show '+(type||'');
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.className='toast'; },3000);
}
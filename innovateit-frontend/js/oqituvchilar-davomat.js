// ═══════════════════════════════════════════════════
//  InnovateIT School — O'qituvchilar Davomati
//  (oqituvchilar-davomat.js)
// ═══════════════════════════════════════════════════

const API = (window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname === '')
  ? 'http://127.0.0.1:3001/api'
  : '/api';

const OYLAR  = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const KUNLAR = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
const STATUSES = [
  { key:'keldi',   emoji:'✅', title:'Keldi'     },
  { key:'kelmadi', emoji:'❌', title:'Kelmadi'   },
  { key:'sababli', emoji:'📋', title:'Sababli'   },
  { key:'kech',    emoji:'⏰', title:'Kech keldi' },
];

let U          = null;
let TEACHERS   = [];      // Bugun dars o'tadigan o'qituvchilar
let attendance = {};      // { "Ism Familiya": "keldi"|... }
let izohlar    = {};      // { "Ism Familiya": "izoh" }
let pendingIzoh  = null;   // { key, btnEl, type }
let darsVaqtlar  = {};      // { key: { soat, daqiqa } }
let kechSabablar = {};      // { key: sabab }

const TODAY = (() => { const d=new Date(); d.setHours(0,0,0,0); return d; })();
let currentDate = skipWeekend(new Date(TODAY), -1);

// ─────────────────────────────────────────────
//  YUKLANGANDA
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = sessionStorage.getItem('iit_teacher_dav_user');
    if (!saved) { window.location.href = 'oqituvchilar.html'; return; }
    U = JSON.parse(saved);
  } catch { window.location.href = 'oqituvchilar.html'; return; }

  // Badge
  g('dav-badge').textContent = U.ism;

  // Sana picker max = bugun
  g('date-picker').max = dateStr(TODAY);

  setDateUI(currentDate);
  updateNextBtn();

  await loadTeachersAndDavomat(currentDate);
});

// ─────────────────────────────────────────────
//  NAVIGATSIYA
// ─────────────────────────────────────────────
function goBack() { window.location.href = 'oqituvchilar.html'; }

// ─────────────────────────────────────────────
//  SANA BOSHQARUVI
// ─────────────────────────────────────────────
// Yakshanbani o'tkazib yuborish
// dir = -1 (orqaga) | +1 (oldinga)
function skipWeekend(d, dir) {
  const nd = new Date(d); nd.setHours(0,0,0,0);
  if (nd.getDay() === 0) nd.setDate(nd.getDate() + dir);
  return nd;
}

function dateStr(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function fmtDate(d) {
  return d.getDate()+'-'+OYLAR[d.getMonth()]+', '+d.getFullYear();
}

function setDateUI(d) {
  g('date-display').textContent = fmtDate(d);
  g('date-sub').textContent     = KUNLAR[d.getDay()];
  g('date-picker').value        = dateStr(d);
}

async function changeDate(dir) {
  const nd = new Date(currentDate);
  nd.setDate(nd.getDate() + dir);
  if (nd.getDay() === 0) nd.setDate(nd.getDate() + dir); // Yakshanbani o'tkazib yuborish
  if (nd > TODAY) return;
  currentDate = nd;
  attendance = {}; izohlar = {}; darsVaqtlar = {}; kechSabablar = {};
  setDateUI(currentDate);
  updateNextBtn();
  await loadTeachersAndDavomat(currentDate);
}

async function onDatePick() {
  const val = g('date-picker').value; if (!val) return;
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
  attendance = {}; izohlar = {}; darsVaqtlar = {}; kechSabablar = {};
  setDateUI(currentDate);
  updateNextBtn();
  await loadTeachersAndDavomat(currentDate);
}

function updateNextBtn() {
  const nd = new Date(currentDate);
  nd.setDate(nd.getDate() + 1);
  if (nd.getDay() === 0) nd.setDate(nd.getDate() + 1);
  g('btn-next').disabled = nd > TODAY;
}

// ─────────────────────────────────────────────
//  MA'LUMOTLARNI YUKLASH
// ─────────────────────────────────────────────
async function loadTeachersAndDavomat(date) {
  g('loading-ov').style.display = 'flex';
  try {
    // Dars jadvali orqali bugun dars o'tadigan o'qituvchilarni ol
    const jd = await req({ action:'getJadvallar', username:U.username, parol:U.parol });
    if (!jd.ok) { toast('❌ '+jd.error,'error'); g('loading-ov').style.display='none'; return; }

    // Bugungi kun indeksi (0=Ya,1=Du...6=Sha)
    const dayOfWeek = date.getDay();

    // Bir xil o'qituvchi bir kunda bir marta chiqishi uchun unique filterlash
    const seen = new Set();
    TEACHERS = [];
    jd.jadvallar.forEach(j => {
      if (!parseDays(j.kunlar).includes(dayOfWeek)) return;
      const key = j.teacher_ism + ' ' + j.teacher_familiya;
      if (seen.has(key)) {
        // Sinflarni qo'shib qo'yamiz (bir xil vaqtda bir necha sinf bo'lsa)
        const existing = TEACHERS.find(t => t.ism+' '+t.familiya === key);
        if (existing) {
          const newSinflar = parseSinflar(j.sinflar);
          newSinflar.forEach(s => { if (!parseSinflar(existing.sinflar).includes(s)) existing.sinflar += ','+s; });
        }
        return;
      }
      seen.add(key);
      TEACHERS.push({
        ism:        j.teacher_ism,
        familiya:   j.teacher_familiya,
        fan:        j.fan || '—',
        boshlanish: j.boshlanish || '',
        tugash:     j.tugash || '',
        sinflar:    j.sinflar || '',
        kunlar:     j.kunlar || ''
      });
    });

    // Mavjud davomatni yuklash
    const dd = await req({ action:'getTeacherDavomat', username:U.username, parol:U.parol, sana:dateStr(date) });
    if (dd.ok && dd.records.length) {
      dd.records.forEach(r => {
        attendance[r.ism] = r.status;
        if (r.izoh) izohlar[r.ism] = r.izoh;
      });
    }

    render();

  } catch(e) { console.error(e); toast("❌ Yuklashda xatolik",'error'); }
  g('loading-ov').style.display = 'none';
}

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
function render() {
  const el = g('teacher-list');

  if (!TEACHERS.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📅</div>
      <p>${KUNLAR[currentDate.getDay()]} kuni hech kim dars o'tmaydi</p>
    </div>`;
    updateStats();
    return;
  }

  el.innerHTML = TEACHERS.map((t, i) => {
    const key = t.ism + ' ' + t.familiya;
    const cur = attendance[key] || '';
    const sinflar = parseSinflar(t.sinflar);
    return `<div class="teacher-row${cur?' done':''}" id="row-${safeId(key)}" style="animation-delay:${i*0.04}s">
      <div class="teacher-num">${i+1}</div>
      <div class="teacher-info">
        <div class="teacher-name">${t.ism} ${t.familiya}</div>
        <div class="teacher-meta">
          <span class="fan-badge">${t.fan||'—'}</span>
          <span class="vaqt-badge">${fmtVaqt(t.boshlanish,t.tugash)}</span>
          ${sinflar.length ? `<span class="sinf-meta">${sinflar.join(', ')}</span>` : ''}
        </div>
      </div>
      <div class="status-btns">
        ${STATUSES.map(st => `
          <button class="s-btn${cur===st.key?' active-'+st.key:''}"
            title="${st.title}"
            onclick="setStatus('${esc(key)}','${st.key}',this)"
          >${st.emoji}</button>`).join('')}
      </div>
      ${(()=>{ const dv=darsVaqtlar[key]; return dv ? `<span class="dv-badge" id="dvinfo-${safeId(key)}">\u{1F550} ${dv.soat}s ${dv.daqiqa}d</span>` : `<span class="dv-badge" id="dvinfo-${safeId(key)}" style="display:none"></span>`; })()}
    </div>`;
  }).join('');

  updateStats();
}

// ─────────────────────────────────────────────
//  STATUS BELGILASH
// ─────────────────────────────────────────────
function setStatus(key, status, btn) {
  if (status === 'sababli') {
    pendingIzoh = { key, btn, type: 'sababli' };
    g('izoh-input').value = izohlar[key] || '';
    g('izoh-modal').classList.add('show');
    setTimeout(() => g('izoh-input').focus(), 100);
    return;
  }
  if (status === 'keldi' || status === 'kech') {
    if (attendance[key] === status) { applyStatus(key, status, btn); return; }
    pendingIzoh = { key, btn, type: status };
    g('dv-soat').value   = darsVaqtlar[key] ? darsVaqtlar[key].soat   : '';
    g('dv-daqiqa').value = darsVaqtlar[key] ? darsVaqtlar[key].daqiqa : '';
    if (status === 'kech') {
      g('kech-sabab-wrap').style.display = 'block';
      g('kech-sabab-input').value = kechSabablar[key] || '';
      g('dv-modal-title').textContent = "Kech keldi — ma'lumot kiriting";
    } else {
      g('kech-sabab-wrap').style.display = 'none';
      g('dv-modal-title').textContent = "Keldi — dars soatini kiriting";
    }
    g('dv-modal').classList.add('show');
    setTimeout(() => g('dv-soat').focus(), 100);
    return;
  }
  applyStatus(key, status, btn);
}

function applyStatus(key, status, btn) {
  const row  = btn.closest('.teacher-row');
  const btns = row.querySelectorAll('.s-btn');

  if (attendance[key] === status) {
    // Toggle — o'chirish
    delete attendance[key];
    if (status === 'sababli') delete izohlar[key];
    btns.forEach(b => b.className='s-btn');
    row.classList.remove('done');
  } else {
    attendance[key] = status;
    btns.forEach(b => b.className='s-btn');
    btn.className = 's-btn active-' + status;
    row.classList.add('done');
  }
  updateStats();
}

// ─────────────────────────────────────────────
//  IZOH MODAL
// ─────────────────────────────────────────────
function confirmIzoh() {
  if (!pendingIzoh) return;
  const {key, btn} = pendingIzoh;
  izohlar[key] = g('izoh-input').value.trim();
  closeIzoh();
  applyStatus(key, 'sababli', btn);
}
function closeIzoh() { g('izoh-modal').classList.remove('show'); pendingIzoh=null; }

function confirmDarsVaqt() {
  if (!pendingIzoh) return;
  const {key, btn, type} = pendingIzoh;
  const soat   = parseInt(g('dv-soat').value)   || 0;
  const daqiqa = parseInt(g('dv-daqiqa').value) || 0;
  if (soat === 0 && daqiqa === 0) { g('dv-err').style.display='block'; return; }
  g('dv-err').style.display = 'none';
  darsVaqtlar[key] = { soat, daqiqa };
  if (type === 'kech') {
    kechSabablar[key] = g('kech-sabab-input').value.trim();
    izohlar[key] = kechSabablar[key];
  }
  closeDvModal();
  applyStatus(key, type, btn);
  const inf = g('dvinfo-'+safeId(key));
  if (inf) { inf.textContent = '\u{1F550} '+soat+'s '+daqiqa+'d'; inf.style.display='inline-flex'; }
}
function closeDvModal() { g('dv-modal').classList.remove('show'); pendingIzoh=null; }

// ─────────────────────────────────────────────
//  STATISTIKA
// ─────────────────────────────────────────────
function updateStats() {
  const c = {keldi:0, kelmadi:0, sababli:0, kech:0};
  Object.values(attendance).forEach(s => { if(s && c[s]!==undefined) c[s]++; });
  g('st-keldi').textContent   = c.keldi;
  g('st-kelmadi').textContent = c.kelmadi;
  g('st-sababli').textContent = c.sababli;
  g('st-kech').textContent    = c.kech;
  g('st-total').textContent   = TEACHERS.length;
}

// ─────────────────────────────────────────────
//  SAQLASH
// ─────────────────────────────────────────────
function confirmSave() {
  if (!TEACHERS.length) { toast('⚠️ Bugun dars o\'tadigan o\'qituvchilar yo\'q','error'); return; }

  const total  = TEACHERS.length;
  const marked = Object.keys(attendance).filter(k=>attendance[k]).length;

  const c = {keldi:0,kelmadi:0,sababli:0,kech:0};
  Object.values(attendance).forEach(s => { if(s&&c[s]!==undefined) c[s]++; });

  g('c-keldi').textContent   = c.keldi;
  g('c-kelmadi').textContent = c.kelmadi;
  g('c-sababli').textContent = c.sababli;
  g('c-kech').textContent    = c.kech;

  g('confirm-desc').innerHTML =
    `<strong>${fmtDate(currentDate)}</strong> — ${KUNLAR[currentDate.getDay()]}<br>
     <span style="font-size:12px;">${marked} / ${total} ta o'qituvchi belgilangan</span>`;

  const warn = g('confirm-warn');
  if (marked < total) {
    warn.style.display = 'block';
    warn.textContent   = `⚠️ ${total-marked} ta o'qituvchi belgilanmadi!`;
  } else {
    warn.style.display = 'none';
  }

  g('confirm-modal').classList.add('show');
}

function closeConfirm() { g('confirm-modal').classList.remove('show'); }

async function doSave() {
  const records = TEACHERS.map(t => {
    const key = t.ism + ' ' + t.familiya;
    const dv  = darsVaqtlar[key];
    return {
      ism:         key,
      fan:         t.fan,
      status:      attendance[key]||'',
      izoh:        izohlar[key]||'',
      dars_soat:   dv ? dv.soat   : 0,
      dars_daqiqa: dv ? dv.daqiqa : 0
    };
  }).filter(r => r.status);

  if (!records.length) { toast('⚠️ Hech narsa belgilanmadi','error'); closeConfirm(); return; }

  bl('btn-confirm','save-spinner','save-txt',true,'Saqlanmoqda…');
  try {
    const r = await req({
      action:   'saveTeacherDavomat',
      username:  U.username,
      parol:     U.parol,
      sana:      dateStr(currentDate),
      records:   JSON.stringify(records)
    });
    if (r.ok) {
      closeConfirm();
      toast(`✅ ${r.saved} ta yozuv saqlandi!`,'success');
    } else toast('❌ '+r.error,'error');
  } catch { toast('❌ Xatolik yuz berdi','error'); }
  bl('btn-confirm','save-spinner','save-txt',false,'Ha, saqlash');
}

// ─────────────────────────────────────────────
//  YORDAMCHI FUNKSIYALAR
// ─────────────────────────────────────────────
async function req(body) {
  const qs = Object.entries(body)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return (await fetch(`${API}?${qs}`)).json();
}

function parseDays(str) {
  if (!str) return [];
  return String(str).split(',').map(Number).filter(n => n>=1 && n<=6);
}
function parseSinflar(str) {
  if (!str) return [];
  return String(str).split(',').map(s=>s.trim()).filter(Boolean);
}
function fmtVaqt(b, t) {
  if (!b && !t) return '—';
  return (b||'?') + '–' + (t||'?');
}
function safeId(s)  { return s.replace(/[^a-zA-Z0-9]/g,'_'); }
function bl(btnId, spId, txtId, loading, txt) {
  g(btnId).disabled          = loading;
  g(spId).style.display      = loading ? 'inline-block' : 'none';
  g(txtId).textContent       = txt;
}
function g(id)  { return document.getElementById(id); }
function esc(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

let toastT;
function toast(msg, type='') {
  const t=g('toast'); t.textContent=msg; t.className='toast show '+(type||'');
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.className='toast'; },3000);
}
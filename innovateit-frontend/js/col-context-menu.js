/**
 * ═══════════════════════════════════════════════════
 *  Col Context Menu — Ustun ustida o'ng-klik menyu
 * ═══════════════════════════════════════════════════
 *
 *  Ishlatish:
 *    ColContextMenu.init('bux-table-main', COL_LABELS);
 *
 *  Menu imkoniyatlari:
 *  ├─ ⬆ A→Z tartiblash
 *  ├─ ⬇ Z→A tartiblash
 *  ├─ ✕ Tartibni bekor qilish
 *  ├─ ─────────────
 *  └─ 🙈 Ustunni yashirish
 */

const ColContextMenu = (() => {

  let tableId   = null;
  let colLabels = {};
  let menu      = null;
  let currentTh = null;
  let currentCol= null;

  // Hozirgi sort holati
  let sortState = { col: null, dir: null }; // dir: 'asc' | 'desc'

  // Tashqi callback lar (buxgalter.js dan)
  let onHide   = null; // (col) => void
  let onSort   = null; // (col, dir) => void — agar null bo'lsa, ichki sort ishlatiladi
  let getRows  = null; // () => FILTERED array
  let setRows  = null; // (sorted) => void + renderTable()

  /* ─────────────────────────────────────
     init
  ───────────────────────────────────── */
  function init(id, labels, options = {}) {
    tableId   = id;
    colLabels = labels || {};
    onHide    = options.onHide  || null;
    onSort    = options.onSort  || null;
    getRows   = options.getRows || null;
    setRows   = options.setRows || null;

    _buildMenu();
    _attachListeners();
  }

  /* ─────────────────────────────────────
     Menu elementini yaratish
  ───────────────────────────────────── */
  function _buildMenu() {
    // Agar bor bo'lsa — qayta ishlatamiz
    menu = document.getElementById('col-context-menu');
    if (menu) return;

    menu = document.createElement('div');
    menu.id = 'col-context-menu';
    menu.innerHTML = `
      <div class="ctx-header" id="ctx-col-name">—</div>
      <div class="ctx-item" id="ctx-sort-asc"  onclick="ColContextMenu._doSort('asc')">
        <span class="ctx-icon">⬆</span> A → Z tartiblash
      </div>
      <div class="ctx-item" id="ctx-sort-desc" onclick="ColContextMenu._doSort('desc')">
        <span class="ctx-icon">⬇</span> Z → A tartiblash
      </div>
      <div class="ctx-item" id="ctx-sort-clear" onclick="ColContextMenu._doSort(null)" style="display:none;">
        <span class="ctx-icon">↕</span> Tartibni bekor qilish
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item danger" id="ctx-hide" onclick="ColContextMenu._doHide()">
        <span class="ctx-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </span> Ustunni yashirish
      </div>
    `;
    document.body.appendChild(menu);
  }

  /* ─────────────────────────────────────
     Thead th larga contextmenu listener
  ───────────────────────────────────── */
  function _attachListeners() {
    const table = document.getElementById(tableId);
    if (!table) return;

    table.querySelectorAll('thead th').forEach(th => {
      // Oldingi listener ni olib tashlaymiz (ikki marta init bo'lmasligi uchun)
      th.removeEventListener('contextmenu', _onRightClick);
      th.addEventListener('contextmenu', _onRightClick);
    });

    // Tashqarida klik → menyuni yopish
    document.addEventListener('click',       _closeMenu);
    document.addEventListener('contextmenu', _onDocContextMenu);
    document.addEventListener('keydown',     _onKeyDown);
  }

  /* ─────────────────────────────────────
     Right-click handler
  ───────────────────────────────────── */
  function _onRightClick(e) {
    e.preventDefault();
    e.stopPropagation();

    currentTh  = e.currentTarget;
    currentCol = currentTh.getAttribute('data-col');

    if (!currentCol) return; // №, nomlarsiz th lar uchun

    // "num" va "name" ustunlarini ham menyu ko'rsatadi (sort uchun)
    _showMenu(e.clientX, e.clientY);
  }

  /* ─────────────────────────────────────
     Menyuni ko'rsatish
  ───────────────────────────────────── */
  function _showMenu(x, y) {
    if (!menu) _buildMenu();

    // Header nomi
    const label = colLabels[currentCol]
      || currentTh?.textContent?.trim().replace(/[⬆⬇↕]/g, '').trim()
      || currentCol;
    document.getElementById('ctx-col-name').textContent = label.toUpperCase();

    // Sort clear — faqat hozir bu ustun sort qilingan bo'lsa ko'rinsin
    const isSorted = sortState.col === currentCol;
    document.getElementById('ctx-sort-clear').style.display = isSorted ? '' : 'none';

    // Sort indicator highlight
    document.getElementById('ctx-sort-asc').style.fontWeight
      = (isSorted && sortState.dir === 'asc') ? '700' : '';
    document.getElementById('ctx-sort-desc').style.fontWeight
      = (isSorted && sortState.dir === 'desc') ? '700' : '';

    // "num" ustuniga yashirishni o'chirish
    const hideBtn = document.getElementById('ctx-hide');
    if (currentCol === 'num' || currentCol === 'name') {
      hideBtn.style.display = 'none';
      document.querySelector('#col-context-menu .ctx-sep').style.display = 'none';
    } else {
      hideBtn.style.display = '';
      document.querySelector('#col-context-menu .ctx-sep').style.display = '';
    }

    // Pozitsiya — ekrandan tashqariga chiqmasin
    menu.style.display = 'block';
    const mw = menu.offsetWidth  || 200;
    const mh = menu.offsetHeight || 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x + 2;
    let top  = y + 2;
    if (left + mw > vw) left = vw - mw - 8;
    if (top  + mh > vh) top  = vh - mh - 8;

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }

  /* ─────────────────────────────────────
     Menyuni yopish
  ───────────────────────────────────── */
  function _closeMenu() {
    if (menu) menu.style.display = 'none';
    currentTh  = null;
    currentCol = null;
  }

  function _onDocContextMenu(e) {
    // Th ustida emas bo'lsa — menyuni yopamiz
    if (!e.target.closest('thead th')) {
      _closeMenu();
    }
  }

  function _onKeyDown(e) {
    if (e.key === 'Escape') _closeMenu();
  }

  /* ─────────────────────────────────────
     Sort
  ───────────────────────────────────── */
  function _doSort(dir) {
    // currentCol ni oldin saqlaymiz — _closeMenu() null qilib yuboradi
    const col = currentCol;
    _closeMenu();
    if (!col && dir !== null) return;
    // dir===null holatda sortState.col dan olamiz
    const targetCol = col || sortState.col;
    if (!targetCol) return;

    // Sort holatini yangilash
    if (dir === null) {
      sortState = { col: null, dir: null };
    } else {
      sortState = { col: targetCol, dir };
    }

    // Barcha th lardan sort class larni olib tashlash
    const table = document.getElementById(tableId);
    if (table) {
      table.querySelectorAll('thead th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
      });
      if (dir && targetCol) {
        const activeTh = table.querySelector(`thead th[data-col="${targetCol}"]`);
        if (activeTh) activeTh.classList.add(`sorted-${dir}`);
      }
    }

    // Tashqi sort funksiyasi bor bo'lsa ishlatamiz
    if (onSort) {
      onSort(targetCol, dir);
      return;
    }

    // Ichki sort — getRows/setRows orqali
    if (!getRows || !setRows) return;
    const rows = getRows();
    if (!rows || rows.length === 0) return;

    if (dir === null) {
      // Original tartibga qaytish — id bo'yicha
      const sorted = [...rows].sort((a, b) => {
        const ai = a.student?.id || a.id || 0;
        const bi = b.student?.id || b.id || 0;
        return ai - bi;
      });
      setRows(sorted);
      return;
    }

    const sorted = [...rows].sort((a, b) => {
      const va = _getVal(a, targetCol);
      const vb = _getVal(b, targetCol);
      const cmp = _compare(va, vb);
      return dir === 'asc' ? cmp : -cmp;
    });
    setRows(sorted);
  }

  /* Qiymat olish — nested object dan */
  function _getVal(row, col) {
    const s = row.student || row;
    const t = row.tolov   || {};
    const map = {
      name:   `${s.familiya || ''} ${s.ism || ''}`.trim(),
      maktab: s.maktab  || '',
      sinf:   s.sinf    || '',
      tel:    s.telefon || '',
      qayd:   t.qaydnoma          || '',
      gap:    t.gaplashilgan_vaqt || '',
      kerak:  parseInt(t.tolov_kerak  || 0),
      qildi:  parseInt(t.tolov_qildi  || 0),
      sana:   t.tolov_sanasi      || '',
      holat:  (parseInt(t.tolov_kerak||0) - parseInt(t.tolov_qildi||0)),
      kvit:   t.kvitansiya_fayl   || '',
      num:    s.id || 0,
    };
    return map[col] !== undefined ? map[col] : '';
  }

  function _compare(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'uz', { numeric: true });
  }

  /* ─────────────────────────────────────
     Ustunni yashirish
  ───────────────────────────────────── */
  function _doHide() {
    const col = currentCol;
    _closeMenu();
    if (!col) return;
    if (onHide) onHide(col);
  }

  /* ─────────────────────────────────────
     Thead yangilanganda listener qayta ulash
  ───────────────────────────────────── */
  function refresh() {
    _attachListeners();
  }

  /* Public API */
  return { init, refresh, _doSort, _doHide };

})();
// ═══════════════════════════════════════════════════
//  InnovateIT School — Markazlashgan API Client (v6.0 JWT)
// ═══════════════════════════════════════════════════

const BASE = (window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1' ||
              window.location.hostname === '')
  ? 'http://127.0.0.1:3001'
  : '';

// ─── Token boshqaruvi ────────────────────────────────────────────────────────
const TOKEN_KEY = 'innovateit_token';

const tokenStore = {
  get()          { return localStorage.getItem(TOKEN_KEY); },
  set(t)         { localStorage.setItem(TOKEN_KEY, t); },
  clear()        { localStorage.removeItem(TOKEN_KEY); },
  isExpired(t) {
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch { return true; }
  },
  getUser() {
    const t = this.get();
    if (!t) return null;
    try { return JSON.parse(atob(t.split('.')[1])); }
    catch { return null; }
  }
};

// ─── 401 holatida login sahifasiga qaytish ───────────────────────────────────
function handleUnauthorized() {
  tokenStore.clear();
  // Qaysi sahifada ekanligimizni aniqlaymiz
  const page = window.location.pathname;
  if (page.includes('buxgalter')) {
    window.location.href = '/buxgalter.html';
  } else if (page.includes('portfolio')) {
    window.location.href = '/portfolio-viewer.html';
  } else {
    window.location.href = '/index.html';
  }
}

// ─── Asosiy so'rov funksiyasi ────────────────────────────────────────────────
async function apiReq(method, path, data = {}) {
  const token = tokenStore.get();

  // Token muddati tugagan bo'lsa — chiqib ketish
  if (token && tokenStore.isExpired(token)) {
    handleUnauthorized();
    return { ok: false, error: 'Seans muddati tugadi' };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url = `${BASE}${path}`;
  const opts = { method, headers };

  if (method === 'GET') {
    // GET da data → query string (lekin username/parol emas, ular tokenda)
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => k !== 'username' && k !== 'parol')
    );
    const qs = new URLSearchParams(filtered).toString();
    if (qs) url += `?${qs}`;
  } else {
    // POST/PUT/DELETE da username va parolni body dan olib tashlaymiz
    const { username, parol, ...rest } = data;
    opts.body = JSON.stringify(rest);
  }

  try {
    const res = await fetch(url, opts);

    // Token muammosi — chiqib ketish
    if (res.status === 401) {
      const json = await res.json().catch(() => ({}));
      if (json.expired || json.error?.includes('Token')) {
        handleUnauthorized();
      }
      return { ok: false, error: json.error || 'Ruxsat yo\'q' };
    }

    return res.json();
  } catch (err) {
    console.error('API xatolik:', err);
    return { ok: false, error: 'Server bilan aloqa yo\'q' };
  }
}

// ─── Qisqartirilgan yordamchilar ─────────────────────────────────────────────
const api = {
  get:  (path, params = {}) => apiReq('GET',    path, params),
  post: (path, body   = {}) => apiReq('POST',   path, body),
  put:  (path, body   = {}) => apiReq('PUT',    path, body),
  del:  (path, body   = {}) => apiReq('DELETE', path, body),

  // ─── Auth (token saqlash) ───
  login: async (d) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    }).then(r => r.json());
    if (res.ok && res.token) tokenStore.set(res.token);
    return res;
  },
  loginBuxgalter: async (d) => {
    const res = await fetch(`${BASE}/api/auth/login-buxgalter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    }).then(r => r.json());
    if (res.ok && res.token) tokenStore.set(res.token);
    return res;
  },
  loginViewer: async (d) => {
    const res = await fetch(`${BASE}/api/auth/login-viewer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    }).then(r => r.json());
    // MUHIM: viewer tokeni alohida saqlanadi, admin tokenini o'chirmasligi uchun
    if (res.ok && res.token) localStorage.setItem('innovateit_viewer_token', res.token);
    return res;
  },
  logout: () => {
    tokenStore.clear();
  },
  getUser:    () => tokenStore.getUser(),
  getToken:   () => tokenStore.get(),
  isLoggedIn: () => {
    const t = tokenStore.get();
    return t ? !tokenStore.isExpired(t) : false;
  },

  // ─── O'quvchilar ───
  getStudents:         (d) => api.get('/api/students', d),
  addStudent:          (d) => api.post('/api/students', d),
  editStudent:         (d) => api.put('/api/students', d),
  deleteStudent:       (d) => api.del('/api/students', d),
  moveToInactive:      (d) => api.post('/api/students/inactive', d),
  getNofaol:           (d) => api.get('/api/students/inactive', d),
  getInactiveStudents: (d) => api.get('/api/students/inactive', d),
  moveToActive:        (d) => api.post('/api/students/activate', d),
  editNofaol:          (d) => api.put('/api/students/inactive', d),
  deleteNofaol:        (d) => api.del('/api/students/inactive', d),

  // ─── Adminlar ───
  getAdmins:   (d) => api.get('/api/admins', d),
  createAdmin: (d) => api.post('/api/admins', d),
  editAdmin:   (d) => api.put('/api/admins', d),
  deleteAdmin: (d) => api.del('/api/admins', d),

  // ─── Davomat ───
  saveDavomat:        (d) => api.post('/api/davomat', d),
  getDavomat:         (d) => api.get('/api/davomat', d),
  getDavomatTarix:    (d) => api.get('/api/davomat/tarix', d),
  getDavomatRange:    (d) => api.get('/api/davomat/range', d),
  saveTeacherDavomat: (d) => api.post('/api/davomat/teacher', d),
  getTeacherDavomat:  (d) => api.get('/api/davomat/teacher', d),

  // ─── Dars jadvali ───
  getJadvallar: (d)     => api.get('/api/jadval', d),
  saveJadval:   (d)     => api.post('/api/jadval', d),
  deleteJadval: (d, id) => api.del(`/api/jadval/${id}`, d),

  // ─── O'qituvchilar ───
  getTeachers:         (d) => api.get('/api/teachers', d),
  addTeacher:          (d) => api.post('/api/teachers', d),
  editTeacher:         (d) => api.put('/api/teachers', d),
  deleteTeacher:       (d) => api.del('/api/teachers', d),
  addTeacherMaktab:    (d) => api.post('/api/teachers/maktab', d),
  removeTeacherMaktab: (d) => api.del('/api/teachers/maktab', d),
  mergeTeachers:       (d) => api.post('/api/teachers/merge', d),

  // ─── Buxgalter ───
  getBiriktirmalar: (d) => api.get('/api/buxgalter', d),
  createBuxgalter:  (d) => api.post('/api/buxgalter', d),
  editBuxgalter:    (d) => api.put('/api/buxgalter', d),
  deleteBuxgalter:  (d) => api.del('/api/buxgalter', d),
  biriktirAdmin:    (d) => api.post('/api/buxgalter/biriktiruv', d),
  ajratAdmin:       (d) => api.del('/api/buxgalter/biriktiruv', d),
  buxGetStudents:   (d) => api.get('/api/buxgalter/students', d),
  getTolovlar:      (d) => api.get('/api/buxgalter/tolovlar', d),
  saveTolov:        (d) => api.post('/api/buxgalter/tolovlar', d),
  initOy:           (d) => api.post('/api/buxgalter/init-oy', d),

  // ─── Portfolio Viewers ───
  getPortfolioViewers:   (d) => api.get('/api/portfolio/viewers', d),
  createPortfolioViewer: (d) => api.post('/api/portfolio/viewers', d),
  editPortfolioViewer:   (d) => api.put('/api/portfolio/viewers', d),
  deletePortfolioViewer: (d) => api.del('/api/portfolio/viewers', d),

  // ─── Portfolio O'qituvchilar ───
  getPortfolioTeachers: (d)     => api.get('/api/portfolio/teachers', d),
  getPortfolioTeacher:  (d, id) => api.get(`/api/portfolio/teacher/${id}`, d),
  savePortfolioTeacher: (d, id) => api.post(`/api/portfolio/teacher/${id}`, d),
  deleteSertifikat:     (d, id, filename) => api.del(`/api/portfolio/teacher/${id}/sertifikat/${filename}`, d),

  // ─── Viewer ↔ O'qituvchi biriktirish ───
  getViewerTeachers:     (d, vu) => api.get(`/api/portfolio/viewer-teachers/${encodeURIComponent(vu)}`, d),
  assignViewerTeacher:   (d)     => api.post('/api/portfolio/viewer-teachers', d),
  unassignViewerTeacher: (d)     => api.del('/api/portfolio/viewer-teachers', d),

  // ─── Avatar upload/delete — token bilan ───
  uploadAvatar: async (id, formData) => {
    const token = tokenStore.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE}/api/portfolio/teacher/${id}/avatar`, {
      method: 'POST',
      headers,
      body: formData
    });
    return r.json();
  },
  deleteAvatar: (d, id) => api.del(`/api/portfolio/teacher/${id}/avatar`, d),

  // ─── Sertifikat upload — token bilan FormData ───
  uploadSertifikat: async (id, formData) => {
    const token = tokenStore.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE}/api/portfolio/teacher/${id}/sertifikat`, {
      method: 'POST',
      headers,
      body: formData
    });
    return r.json();
  },

  // ─── Fayl upload (kvitansiya) — token bilan ───
  uploadFile: async (formData) => {
    const token = tokenStore.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    return r.json();
  },
  deleteFile: (filename) => api.del(`/upload/${filename}`, {}),
};
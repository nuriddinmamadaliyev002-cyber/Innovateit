// ═══════════════════════════════════════════════════
//  InnovateIT School — Markazlashgan API Client (v4.0 REST)
// ═══════════════════════════════════════════════════

const BASE = (window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1' ||
              window.location.hostname === '')
  ? 'http://127.0.0.1:3001'
  : '';

// Asosiy so'rov funksiyasi
async function apiReq(method, path, data = {}) {
  const opts = { method, headers: {} };

  if (method === 'GET' || method === 'DELETE') {
    // GET va DELETE: params query string sifatida (DELETE body bilan ham ishlaydi, lekin qo'shimcha xavfsizlik uchun body ishlatamiz)
    if (method === 'GET') {
      const qs = new URLSearchParams(data).toString();
      return (await fetch(`${BASE}${path}?${qs}`)).json();
    }
    // DELETE — body orqali
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  } else {
    // POST, PUT
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }

  return (await fetch(`${BASE}${path}`, opts)).json();
}

// Qisqartirilgan yordamchilar
const api = {
  get:    (path, params = {}) => apiReq('GET',    path, params),
  post:   (path, body   = {}) => apiReq('POST',   path, body),
  put:    (path, body   = {}) => apiReq('PUT',     path, body),
  del:    (path, body   = {}) => apiReq('DELETE',  path, body),

  // ─── Auth ───
  login:           (d) => api.post('/api/auth/login', d),
  loginBuxgalter:  (d) => api.post('/api/auth/login-buxgalter', d),

  // ─── O'quvchilar ───
  getStudents:         (d) => api.get('/api/students', d),
  addStudent:          (d) => api.post('/api/students', d),
  editStudent:         (d) => api.put('/api/students', d),
  deleteStudent:       (d) => api.del('/api/students', d),
  moveToInactive:      (d) => api.post('/api/students/inactive', d),
  getNofaol:           (d) => api.get('/api/students/inactive', d),
  getInactiveStudents: (d) => api.get('/api/students/inactive', d), // davomat filtrlash uchun
  moveToActive:        (d) => api.post('/api/students/activate', d),
  editNofaol:          (d) => api.put('/api/students/inactive', d),
  deleteNofaol:        (d) => api.del('/api/students/inactive', d),

  // ─── Adminlar ───
  getAdmins:       (d) => api.get('/api/admins', d),
  createAdmin:     (d) => api.post('/api/admins', d),
  editAdmin:       (d) => api.put('/api/admins', d),
  deleteAdmin:     (d) => api.del('/api/admins', d),

  // ─── Davomat ───
  saveDavomat:     (d) => api.post('/api/davomat', d),
  getDavomat:      (d) => api.get('/api/davomat', d),
  getDavomatTarix: (d) => api.get('/api/davomat/tarix', d),
  getDavomatRange: (d) => api.get('/api/davomat/range', d),
  saveTeacherDavomat: (d) => api.post('/api/davomat/teacher', d),
  getTeacherDavomat:  (d) => api.get('/api/davomat/teacher', d),

  // ─── Dars jadvali ───
  getJadvallar:    (d) => api.get('/api/jadval', d),
  saveJadval:      (d) => api.post('/api/jadval', d),
  deleteJadval:    (d, id) => api.del(`/api/jadval/${id}`, d),

  // ─── O'qituvchilar ───
  getTeachers:     (d) => api.get('/api/teachers', d),
  addTeacher:      (d) => api.post('/api/teachers', d),
  editTeacher:     (d) => api.put('/api/teachers', d),
  deleteTeacher:   (d) => api.del('/api/teachers', d),
  assignTeacher:   (d) => api.put('/api/teachers/assign', d),
  addTeacherMaktab:    (d) => api.post('/api/teachers/maktab', d),
  removeTeacherMaktab: (d) => api.del('/api/teachers/maktab', d),

  // ─── Buxgalter ───
  getBiriktirmalar:(d) => api.get('/api/buxgalter', d),
  createBuxgalter: (d) => api.post('/api/buxgalter', d),
  editBuxgalter:   (d) => api.put('/api/buxgalter', d),
  deleteBuxgalter: (d) => api.del('/api/buxgalter', d),
  biriktirAdmin:   (d) => api.post('/api/buxgalter/biriktiruv', d),
  ajratAdmin:      (d) => api.del('/api/buxgalter/biriktiruv', d),
  buxGetStudents:  (d) => api.get('/api/buxgalter/students', d),
  getTolovlar:     (d) => api.get('/api/buxgalter/tolovlar', d),
  saveTolov:       (d) => api.post('/api/buxgalter/tolovlar', d),
  initOy:          (d) => api.post('/api/buxgalter/init-oy', d),
};
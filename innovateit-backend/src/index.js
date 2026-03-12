// ═══════════════════════════════════════════════════
//  InnovateIT School — Express.js API Server
// ═══════════════════════════════════════════════════
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const { handleLogin }                             = require('./routes/auth');
const { handleGetStudents, handleAddStudent,
        handleEditStudent, handleDeleteStudent,
        handleMoveToInactive, handleGetNofaol,
        handleMoveToActive, handleEditNofaol,
        handleDeleteNofaol }                      = require('./routes/students');
const { handleGetAdmins, handleCreateAdmin,
        handleEditAdmin, handleDeleteAdmin }       = require('./routes/admins');
const { handleSaveDavomat, handleGetDavomat,
        handleGetDavomatTarix,
        handleGetDavomatRange }                    = require('./routes/davomat');
const { handleGetJadvallar, handleSaveJadval,
        handleDeleteJadval }                       = require('./routes/jadval');
const { handleGetTeachers, handleAddTeacher,
        handleEditTeacher, handleDeleteTeacher,
        handleSaveTeacherDavomat,
        handleGetTeacherDavomat }                  = require('./routes/teachers');

const app  = express();
const PORT = process.env.PORT || 3001;


// ─── Middleware ───
app.use(cors({
  origin: function(origin, callback) {
    // Local development
    if (!origin || 
        origin === 'null' ||
        origin.includes('localhost') || 
        origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Production server
    if (origin === 'https://innovateitschool.uz') {
      return callback(null, true);
    }
    callback(new Error('CORS: ruxsat yoq'));
  },
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ───
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ─── Asosiy API endpoint (GAS bilan bir xil format) ───
// GET /api?action=...&username=...&parol=...
app.get('/api', handleAction);
app.post('/api', async (req, res) => {
  req.query = { ...req.query, ...req.body };
  return handleAction(req, res);
});

async function handleAction(req, res) {
  const p      = req.query;
  const action = p.action;

  let result;
  try {
    switch (action) {

      // ═══ AUTH ═══
      case 'login':
        result = await handleLogin(p); break;

      // ═══ O'QUVCHILAR ═══
      case 'getStudents':
        result = await handleGetStudents(p); break;
      case 'addStudent':
        result = await handleAddStudent(p); break;
      case 'editStudent':
        result = await handleEditStudent(p); break;
      case 'deleteStudent':
        result = await handleDeleteStudent(p); break;
      case 'moveToInactive':
        result = await handleMoveToInactive(p); break;
      case 'getNofaol':
        result = await handleGetNofaol(p); break;
      case 'moveToActive':
        result = await handleMoveToActive(p); break;
      case 'editNofaol':
        result = await handleEditNofaol(p); break;
      case 'deleteNofaol':
        result = await handleDeleteNofaol(p); break;

      // ═══ ADMINLAR ═══
      case 'getAdmins':
        result = await handleGetAdmins(p); break;
      case 'createAdmin':
        result = await handleCreateAdmin(p); break;
      case 'editAdmin':
        result = await handleEditAdmin(p); break;
      case 'deleteAdmin':
        result = await handleDeleteAdmin(p); break;

      // ═══ DAVOMAT ═══
      case 'saveDavomat':
        result = await handleSaveDavomat(p); break;
      case 'getDavomat':
        result = await handleGetDavomat(p); break;
      case 'getDavomatTarix':
        result = await handleGetDavomatTarix(p); break;
      case 'getDavomatRange':
        result = await handleGetDavomatRange(p); break;

      // ═══ DARS JADVALI ═══
      case 'getJadvallar':
        result = await handleGetJadvallar(p); break;
      case 'saveJadval':
        result = await handleSaveJadval(p); break;
      case 'deleteJadval':
        result = await handleDeleteJadval(p); break;

      // ═══ O'QITUVCHILAR ═══
      case 'getTeachers':
        result = await handleGetTeachers(p); break;
      case 'addTeacher':
        result = await handleAddTeacher(p); break;
      case 'editTeacher':
        result = await handleEditTeacher(p); break;
      case 'deleteTeacher':
        result = await handleDeleteTeacher(p); break;
      case 'saveTeacherDavomat':
        result = await handleSaveTeacherDavomat(p); break;
      case 'getTeacherDavomat':
        result = await handleGetTeacherDavomat(p); break;

      default:
        result = { ok: false, error: "Noto'g'ri action: " + action };
    }
  } catch (err) {
    console.error(`[${action}] xatolik:`, err.message);
    result = { ok: false, error: 'Server xatoligi: ' + err.message };
  }

  res.json(result);
}

// ─── Server ishga tushirish ───
app.listen(PORT, '127.0.0.1', async () => {
  console.log(`✅ InnovateIT Backend ishga tushdi: http://127.0.0.1:${PORT}`);

  // DB ulanishni tekshirish
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL ulanish muvaffaqiyatli');
  } catch (err) {
    console.error('❌ PostgreSQL ulanishda xatolik:', err.message);
  }
});
// ─── Auth routes ───────────────────────────────────
// POST /api/auth/login             — admin login
// POST /api/auth/login-buxgalter   — buxgalter login
// POST /api/auth/login-viewer      — portfolio viewer login
// POST /api/auth/refresh           — tokenni yangilash
const { Router }   = require('express');
const { verifyAdmin, verifyBuxgalter, verifyViewer } = require('../middleware/auth');
const { generateToken, requireAuth }                 = require('../middleware/jwt');

const router = Router();

// ─── POST /api/auth/login ───
router.post('/login', async (req, res) => {
  const { username, parol } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });

  const token = generateToken({
    username: username.trim(),
    ism:      admin.ism,
    isSuper:  admin.isSuper,
    role:     'admin',
  });

  res.json({ ok: true, token, ism: admin.ism, isSuper: admin.isSuper });
});

// ─── POST /api/auth/login-buxgalter ───
router.post('/login-buxgalter', async (req, res) => {
  const { username, parol } = req.body;
  const bux = await verifyBuxgalter(username, parol);
  if (!bux) return res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });

  const token = generateToken({
    username: username.trim(),
    ism:      bux.ism,
    isSuper:  false,
    role:     'buxgalter',
  });

  res.json({ ok: true, token, ism: bux.ism, role: 'buxgalter' });
});

// ─── POST /api/auth/login-viewer ───
router.post('/login-viewer', async (req, res) => {
  const { username, parol } = req.body;
  const viewer = await verifyViewer(username, parol);
  if (!viewer) return res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });

  const token = generateToken({
    username: username.trim(),
    ism:      viewer.ism,
    isSuper:  false,
    role:     'viewer',
  });

  res.json({ ok: true, token, ism: viewer.ism, role: 'viewer' });
});

// ─── POST /api/auth/refresh ───
// Yangi token olish (eski token hali amal qilsa)
router.post('/refresh', requireAuth(['admin', 'buxgalter', 'viewer']), (req, res) => {
  const { username, ism, isSuper, role } = req.user;
  const token = generateToken({ username, ism, isSuper, role });
  res.json({ ok: true, token });
});

module.exports = router;
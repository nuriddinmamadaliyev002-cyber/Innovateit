// ─── Auth routes ───────────────────────────────────
// POST /api/auth/login             — admin login
// POST /api/auth/login-buxgalter   — buxgalter login
// POST /api/auth/login-viewer      — portfolio viewer login
const { Router } = require('express');
const { verifyAdmin, verifyBuxgalter, verifyViewer } = require('../middleware/auth');

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, parol } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });
  res.json({ ok: true, ism: admin.ism, isSuper: admin.isSuper });
});

// POST /api/auth/login-buxgalter
router.post('/login-buxgalter', async (req, res) => {
  const { username, parol } = req.body;
  const bux = await verifyBuxgalter(username, parol);
  if (!bux) return res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });
  res.json({ ok: true, ism: bux.ism, role: 'buxgalter' });
});

// POST /api/auth/login-viewer
router.post('/login-viewer', async (req, res) => {
  const { username, parol } = req.body;
  const viewer = await verifyViewer(username, parol);
  if (!viewer) return res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });
  res.json({ ok: true, ism: viewer.ism, role: 'viewer' });
});

module.exports = router;
const { verifyAdmin } = require('../middleware/auth');

async function handleLogin(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Username yoki parol noto'g'ri" };
  return { ok: true, ism: admin.ism, isSuper: admin.isSuper };
}

module.exports = { handleLogin };

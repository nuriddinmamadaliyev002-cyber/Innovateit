const bcrypt = require('bcrypt');
const pool   = require('../db');
require('dotenv').config();

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const SUPER_ADMIN_PAROL    = process.env.SUPER_ADMIN_PAROL    || '25145771';
const SUPER_ADMIN_ISM      = process.env.SUPER_ADMIN_ISM      || 'InnovateIT School Manager';

// Hash yoki ochiq matn — ikkalasini ham tekshiradi
async function checkPassword(input, stored) {
  if (!input || !stored) return false;
  const isHashed = stored.startsWith('$2b$') || stored.startsWith('$2a$');
  if (isHashed) return bcrypt.compare(input, stored);
  return input === stored;
}

async function verifyAdmin(username, parol) {
  if (!username || !parol) return null;
  if (username === SUPER_ADMIN_USERNAME) {
    const ok = await checkPassword(parol, SUPER_ADMIN_PAROL);
    if (ok) return { ism: SUPER_ADMIN_ISM, isSuper: true };
    return null;
  }
  try {
    const result = await pool.query(
      'SELECT ism, parol FROM adminlar WHERE username = $1',
      [username.trim()]
    );
    if (result.rows.length === 0) return null;
    const { ism, parol: stored } = result.rows[0];
    const ok = await checkPassword(parol, stored);
    return ok ? { ism, isSuper: false } : null;
  } catch (err) {
    console.error('verifyAdmin xatolik:', err.message);
    return null;
  }
}

async function verifyBuxgalter(username, parol) {
  if (!username || !parol) return null;
  try {
    const result = await pool.query(
      'SELECT ism, parol FROM buxgalterlar WHERE username = $1',
      [username.trim()]
    );
    if (result.rows.length === 0) return null;
    const { ism, parol: stored } = result.rows[0];
    const ok = await checkPassword(parol, stored);
    return ok ? { ism, username: username.trim() } : null;
  } catch (err) {
    console.error('verifyBuxgalter xatolik:', err.message);
    return null;
  }
}

async function verifyViewer(username, parol) {
  if (!username || !parol) return null;
  try {
    const result = await pool.query(
      'SELECT ism, parol FROM portfolio_viewers WHERE username = $1',
      [username.trim()]
    );
    if (result.rows.length === 0) return null;
    const { ism, parol: stored } = result.rows[0];
    const ok = await checkPassword(parol, stored);
    return ok ? { ism, username: username.trim() } : null;
  } catch (err) {
    console.error('verifyViewer xatolik:', err.message);
    return null;
  }
}

const SALT_ROUNDS = 10;
async function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

module.exports = {
  verifyAdmin,
  verifyBuxgalter,
  verifyViewer,
  hashPassword,
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PAROL,
  SUPER_ADMIN_ISM,
};
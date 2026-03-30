const pool = require('../db');
require('dotenv').config();

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const SUPER_ADMIN_PAROL    = process.env.SUPER_ADMIN_PAROL    || '25145771';
const SUPER_ADMIN_ISM      = process.env.SUPER_ADMIN_ISM      || 'InnovateIT School Manager';

/**
 * Admin tekshirish:
 * @returns { ism, isSuper } yoki null
 */
async function verifyAdmin(username, parol) {
  if (!username || !parol) return null;

  // Super admin tekshirish
  if (username === SUPER_ADMIN_USERNAME && parol === SUPER_ADMIN_PAROL) {
    return { ism: SUPER_ADMIN_ISM, isSuper: true };
  }

  // Oddiy admin — DB dan tekshirish
  try {
    const result = await pool.query(
      'SELECT ism FROM adminlar WHERE username = $1 AND parol = $2',
      [username.trim(), parol.trim()]
    );
    if (result.rows.length > 0) {
      return { ism: result.rows[0].ism, isSuper: false };
    }
  } catch (err) {
    console.error('verifyAdmin xatolik:', err.message);
  }
  return null;
}

/**
 * Buxgalter tekshirish
 * @returns { ism, username } yoki null
 */
async function verifyBuxgalter(username, parol) {
  if (!username || !parol) return null;
  try {
    const result = await pool.query(
      'SELECT ism FROM buxgalterlar WHERE username = $1 AND parol = $2',
      [username.trim(), parol.trim()]
    );
    if (result.rows.length > 0) {
      return { ism: result.rows[0].ism, username: username.trim() };
    }
  } catch (err) {
    console.error('verifyBuxgalter xatolik:', err.message);
  }
  return null;
}

/**
 * Portfolio Viewer tekshirish
 * @returns { ism, username } yoki null
 */
async function verifyViewer(username, parol) {
  if (!username || !parol) return null;
  try {
    const result = await pool.query(
      'SELECT ism FROM portfolio_viewers WHERE username = $1 AND parol = $2',
      [username.trim(), parol.trim()]
    );
    if (result.rows.length > 0) {
      return { ism: result.rows[0].ism, username: username.trim() };
    }
  } catch (err) {
    console.error('verifyViewer xatolik:', err.message);
  }
  return null;
}

module.exports = {
  verifyAdmin,
  verifyBuxgalter,
  verifyViewer,
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PAROL,
  SUPER_ADMIN_ISM
};
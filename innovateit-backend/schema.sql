-- ═══════════════════════════════════════════════════
--  InnovateIT School — PostgreSQL Schema
-- ═══════════════════════════════════════════════════

-- Database yaratish (terminaldan: createdb innovateit)

-- ─── Adminlar ───
CREATE TABLE IF NOT EXISTS adminlar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT        NOT NULL,
    username   TEXT        NOT NULL UNIQUE,
    parol      TEXT        NOT NULL,
    yaratilgan TEXT        DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY')
);

-- ─── Faol O'quvchilar ───
CREATE TABLE IF NOT EXISTS oquvchilar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    familiya   TEXT NOT NULL,
    maktab     TEXT,
    sinf       TEXT,
    telefon    TEXT,
    telefon2   TEXT,
    tug        TEXT,
    manzil     TEXT,
    admin      TEXT,   -- admin username
    qoshilgan  TEXT,   -- ko'rinish uchun sana (DD.MM.YYYY)
    boshlagan  TEXT    -- o'qishni boshlagan sana (YYYY-MM-DD)
);

-- ─── Nofaol O'quvchilar ───
CREATE TABLE IF NOT EXISTS nofaol_oquvchilar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    familiya   TEXT NOT NULL,
    maktab     TEXT,
    sinf       TEXT,
    telefon    TEXT,
    telefon2   TEXT,
    tug        TEXT,
    manzil     TEXT,
    admin      TEXT,
    qoshilgan  TEXT,
    boshlagan  TEXT,
    chiqgan    TEXT    -- safdan chiqgan sana
);

-- ─── O'quvchilar Davomati ───
CREATE TABLE IF NOT EXISTS davomat (
    id               SERIAL PRIMARY KEY,
    sana             TEXT NOT NULL,
    admin_username   TEXT NOT NULL,
    sinf             TEXT,
    oquvchi_ism      TEXT,
    status           TEXT,
    izoh             TEXT,
    vaqt_belgilangan TEXT
);

-- ─── O'qituvchilar ───
CREATE TABLE IF NOT EXISTS oqituvchilar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    familiya   TEXT NOT NULL,
    fan        TEXT,
    telefon    TEXT,
    telefon2   TEXT,
    kunlar     TEXT,
    sinflar    TEXT,
    boshlanish TEXT,
    tugash     TEXT,
    admin      TEXT,
    qoshilgan  TEXT
);

-- ─── O'qituvchilar Davomati ───
CREATE TABLE IF NOT EXISTS oqituvchilar_davomat (
    id               SERIAL PRIMARY KEY,
    sana             TEXT NOT NULL,
    admin_username   TEXT NOT NULL,
    oqituvchi_ism    TEXT,
    fan              TEXT,
    status           TEXT,
    izoh             TEXT,
    vaqt_belgilangan TEXT
);


CREATE TABLE IF NOT EXISTS dars_jadvali (
    id               SERIAL PRIMARY KEY,
    admin_username   TEXT NOT NULL,
    teacher_ism      TEXT NOT NULL,
    teacher_familiya TEXT NOT NULL,
    fan              TEXT,
    sinflar          TEXT,
    kunlar           TEXT,
    boshlanish       TEXT,
    tugash           TEXT
);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO innovateit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO innovateit_user;
GRANT USAGE ON SCHEMA public TO innovateit_user;


-- ─── Indekslar (tezlik uchun) ───
CREATE INDEX IF NOT EXISTS idx_oquvchilar_admin    ON oquvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_nofaol_admin        ON nofaol_oquvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_davomat_sana_admin  ON davomat(sana, admin_username);
CREATE INDEX IF NOT EXISTS idx_oqituvchilar_admin  ON oqituvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_tdavomat_sana_admin ON oqituvchilar_davomat(sana, admin_username);

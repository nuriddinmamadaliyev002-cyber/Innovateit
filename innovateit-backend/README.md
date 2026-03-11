# InnovateIT School — Backend

Node.js + Express.js API server. Ma'lumotlar PostgreSQL da saqlanadi.

## O'rnatish

```bash
npm install
cp .env.example .env
# .env faylni to'ldiring
```

## Ishga tushirish

```bash
# Development
npm run dev

# Production (PM2)
pm2 start ecosystem.config.js
```

## API

`GET /api?action=ACTION&username=U&parol=P`

Barcha amallar `action` parametri orqali boshqariladi.

## Deploy

`DEPLOY.md` faylga qarang.

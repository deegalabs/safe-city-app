# API Reference — Safe City

Base: `http://localhost:3000` (dev) / `https://api-production-8437.up.railway.app` (prod)

**Documentação interativa:** `GET /docs` — Swagger UI (OpenAPI 3).

Resposta padrão: `{ data: T, error: null }` ou `{ data: null, error: { code, message } }`

---

## Bot (PWA)
`POST /api/bot/message` — envia interação ao BotService  
Body: `{ sessionId, text?, optionKey?, optionData? }`

## WhatsApp
`POST /api/whatsapp/webhook` — recebe mensagens da Evolution API  
`GET  /api/whatsapp/status`  — verifica se instância está conectada

## Reports
`POST /api/reports`           — cria report anônimo. Body: `tipo`, `urgencia`, `local`, `zone_id`, `fingerprint` (min 10 chars), `channel?` (pwa|whatsapp), `retrato?`, `extra?`  
`GET  /api/reports/active`    — alertas ativos `?zone=praca-xv`  
`POST /api/reports/:id/confirm` — confirma alerta. Body: `fingerprint`

## Zones
`GET /api/zones` — zonas com risco e alertas ativos

## Partners
`GET  /api/partners`        — bares parceiros ativos  
`POST /api/partners/checkin` — check-in anônimo

## Stats
`GET /api/stats/public` — estatísticas agregadas da semana

## Subscribe
`POST /api/subscribe` — registra push subscription

## Admin (requer Bearer token Supabase Auth)
`GET    /api/admin/dashboard`       — métricas gerais  
`GET    /api/admin/reports`         — reports paginados `?status=&zone=&page=`  
`PATCH  /api/admin/reports/:id`     — atualiza status do report  
`GET    /api/admin/partners`        — todos os parceiros  
`POST   /api/admin/partners`        — cria parceiro (superadmin)  
`PATCH  /api/admin/partners/:id`    — edita parceiro  
`DELETE /api/admin/partners/:id`    — desativa parceiro (superadmin)  
`GET    /api/admin/admins`          — lista admins (superadmin)  
`POST   /api/admin/admins`          — cria admin + convite (superadmin)  
`PATCH  /api/admin/admins/:id`      — edita admin (superadmin)  
`GET    /api/admin/audit`           — log de auditoria (superadmin)  
`GET    /api/admin/stats`           — stats completas

## Health
`GET /health` — `{ status: "ok", ts: string }`

---

## Testes

- **O quê testar:** **TESTS_API.md** (raiz do repositório logos-circle).
- **Como rodar e convenções:** **TESTING.md** (nesta pasta docs). Comando rápido: `cd shield-app/api && pnpm test`.

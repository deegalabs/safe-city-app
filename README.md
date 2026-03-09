# 🛡 Safe City — safe-city-app

**Repositório público** — PWA comunitário + API backend para alertas anônimos no Centro de Florianópolis.

> O código é público para que qualquer pessoa possa auditar que não há rastreamento.  
> O painel admin fica em repositório **privado** separado (`safe-city-admin`).

---

## Estrutura

```
safe-city-app/
├── web/          React + Vite + TypeScript — PWA público (Vercel)
├── api/          Node.js + Fastify + TypeScript — Backend (Railway)
└── docs/         Documentação técnica
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| PWA | React + Vite + TypeScript + PWA |
| API | Node.js + Fastify + TypeScript |
| Banco | Supabase (PostgreSQL + Realtime) |
| ORM | Prisma |
| Cache / Bot sessions | Redis |
| IA | Anthropic Claude Haiku |
| WhatsApp | Evolution API (self-hosted) |
| Mapa | Leaflet + OpenStreetMap |
| Deploy web | Vercel CLI |
| Deploy api | Railway CLI |

---

## Rodar local

Cada pasta (`api/`, `web/`) é um projeto independente com seu próprio `package.json`, `pnpm-lock.yaml` e `.env`.

### 1. API — Redis (obrigatório) e, se quiser, Postgres local

```bash
cd api
docker compose up -d
```

- **Redis** (porta 6379): sessões do bot. Sem ele a API não sobe.
- **Postgres** (porta 5432): opcional. Use **Supabase** em nuvem (recomendado) ou este Postgres. Credenciais do container: `shield` / `shield` / banco `shield`.

### 2. API — Dependências e variáveis

```bash
cd api
pnpm install
cp .env.example .env
```

No `api/.env`: **Mínimo** `REDIS_URL=redis://localhost:6379` e `FINGERPRINT_SALT` (veja `docs/ENV.md`). Para persistência: **Supabase** (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*`) ou Postgres local (`DATABASE_URL=postgresql://shield:shield@localhost:5432/shield`).

### 3. API — Banco (se tiver DATABASE_URL)

```bash
cd api
pnpm db:migrate
pnpm db:seed
```

### 4. Web — Dependências e variáveis

```bash
cd web
pnpm install
cp .env.example .env
```

Opcional: preencha `web/.env` com `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` (ver `web/.env.example`).

### 5. Subir API e Web

Em dois terminais:

```bash
# Terminal 1 — API
cd api && pnpm dev
```

```bash
# Terminal 2 — Web
cd web && pnpm dev
```

- **PWA:** http://localhost:5173  
- **API:** http://localhost:3000  
- **Health:** http://localhost:3000/health

---

## Documentação

**Na raiz do repo (logos-circle):** `ENV.md`, `EVOLUTION_LOCAL.md`, `BACKLOG.md`.

**Pasta `docs/`:** `ARCHITECTURE.md`, `API.md`, `PRIVACY.md`, `BOT_FLOW.md`, `DATABASE.md`.

---

## Princípios de privacidade

- Sem login no app público
- IP nunca armazenado
- Fingerprint sempre SHA-256 hasheado antes de persistir
- Nenhuma foto de pessoa aceita
- Alertas expiram automaticamente em 45min
- Autoridade vê o mesmo mapa público que qualquer cidadão

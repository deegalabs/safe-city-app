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

### 1. Subir Redis (obrigatório) e, se quiser, Postgres local

```bash
docker compose up -d
```

- **Redis** (porta 6379): sessões do bot na API. Sem ele a API não sobe.
- **Postgres** (porta 5432): opcional. Use **Supabase** em nuvem (recomendado) ou este Postgres para rodar 100% local. Credenciais do container: `shield` / `shield` / banco `shield`.

### 2. Dependências e variáveis

```bash
pnpm install
cp .env.example .env
```

No `.env`:

- **Mínimo para ver o PWA e a API no ar:** já vem `REDIS_URL=redis://localhost:6379` e `FINGERPRINT_SALT` pode ser gerado (veja `docs/ENV.md`). O frontend abre mesmo sem Supabase (alertas vêm da API; Realtime só com Supabase).
- **Para a API persistir dados:** configure **Supabase** (recomendado) ou use o Postgres do Docker:
  - Supabase: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — ver `docs/ENV.md`.
  - Postgres local: `DATABASE_URL=postgresql://shield:shield@localhost:5432/shield` e `DIRECT_URL` igual.

### 3. Banco (se tiver DATABASE_URL configurado)

```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Subir web e API

```bash
pnpm dev
```

- **PWA:** http://localhost:5173  
- **API:** http://localhost:3000  
- **Health:** http://localhost:3000/health

---

## Documentação

**Na raiz:** `ENV.md` (variáveis de ambiente), `BACKLOG.md` (bugs/melhorias/dúvidas).

**Pasta `docs/`:** `ARCHITECTURE.md`, `API.md`, `PRIVACY.md`, `BOT_FLOW.md`, `DATABASE.md`.

---

## Princípios de privacidade

- Sem login no app público
- IP nunca armazenado
- Fingerprint sempre SHA-256 hasheado antes de persistir
- Nenhuma foto de pessoa aceita
- Alertas expiram automaticamente em 45min
- Autoridade vê o mesmo mapa público que qualquer cidadão

# Arquitetura — Safe City Centro Floripa

## Repositórios

| Repo | Visibilidade | Conteúdo |
|---|---|---|
| `safe-city-app` | Público | `web/` + `api/` + `docs/` |
| `safe-city-admin` | Privado | painel admin |

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| PWA | React + Vite + TypeScript | Zero barreira, instala como app |
| Admin | React + Vite + TypeScript | Separado, URL e bundle diferentes |
| API | Node.js + Fastify + TypeScript | Leve, rápido, tipagem ponta-a-ponta |
| Banco | Supabase (PostgreSQL) | Realtime nativo, plano gratuito generoso |
| ORM | Prisma | Tipos automáticos, migrations versionadas |
| Cache / Sessões | Redis (Railway) | Estado do bot por canal (PWA + WhatsApp) |
| IA | Anthropic Claude Haiku | Extração texto livre, ~$0.0002/req |
| WhatsApp | Evolution API (self-hosted) | Open source, sem custo por mensagem |
| Mapa | Leaflet + OpenStreetMap | Gratuito, sem vendor lock-in |
| Auth admin | Supabase Auth | Sessões, magic link, convites |
| Deploy web/admin | Vercel CLI | CDN global |
| Deploy api | Railway CLI | Always-on, Redis junto |

## Diagrama

```
                    ┌──────────────┐
       PWA ─────────▶              │
                    │  Fastify API  │──▶ Supabase (PostgreSQL + Realtime)
  WhatsApp ─────────▶  (Railway)   │──▶ Redis (sessões de bot)
    webhook         │              │──▶ Anthropic Haiku
                    └──────┬───────┘──▶ Evolution API (WhatsApp)
                           │
                    ┌──────▼───────┐
    Admin ──────────▶  /api/admin  │ (rotas protegidas por Supabase Auth JWT)
                    └──────────────┘
```

## BotService — canal agnóstico

O bot não mora no frontend. A lógica vive no `BotService` no backend.
Sessões persistidas no Redis com TTL de 30 minutos.

```
Canal PWA:
  useBot() → POST /api/bot/message → BotService → output → render React

Canal WhatsApp:
  mensagem → Evolution API → webhook POST /api/whatsapp/webhook/:token → BotService → Evolution API → WhatsApp
```

O mesmo fluxo, o mesmo retrato falado, a mesma lógica de moderação e envio.

## Fluxo de um report (qualquer canal)

```
Usuário completa o bot
    ↓
BotService.sendReport()
    ↓
moderateNewReport() — rate limit + duplicate check
    ↓
prisma.report.create() com fingerprint hasheado
    ↓
Supabase Realtime emite INSERT para todos os clientes
    ↓
notifyZoneSubscribers() — Web Push para assinantes da zona
    ↓
Job a cada 5min expira reports sem confirmação após 45min
```

---

## API (safe-city-app/api) — estrutura e responsabilidades

Documento de referência da estrutura e responsabilidades da API em `safe-city-app/api`.

### Estrutura de pastas

```
safe-city-app/api/src/
├── lib/           # Infraestrutura e utilitários (DB, Redis, auth helpers, fingerprint)
├── middleware/    # Middlewares HTTP (auth admin, etc.)
├── schemas/       # Validação de entrada (Zod) — um arquivo por domínio
├── services/      # Lógica de negócio (bot, reports, alerts, push, etc.)
├── routes/        # Registro de rotas Fastify — delegam para schemas + services
├── types/         # Tipos e helpers de resposta (ok/err)
├── server.ts      # Bootstrap: Fastify, CORS, rate limit, registro de rotas
└── prisma/        # Schema e migrations (fora de src)
```

### Responsabilidades

| Camada       | Responsabilidade |
|-------------|-------------------|
| **routes/** | Receber request, validar com **schemas**, chamar **services**, responder com **ok/err**. Não contém lógica de negócio nem queries diretas ao Prisma (exceto em rotas muito simples). |
| **schemas/**| Schemas Zod para body/query/params. Reutilizáveis e testáveis. |
| **services/** | Regras de negócio, acesso a dados (Prisma), chamadas externas (Supabase, Evolution, push). Retornam dados ou um resultado tipado (ex.: `{ ok: true, report }` ou `{ ok: false, code }`). |
| **middleware/** | PreHandlers Fastify (ex.: `requireAdmin`, `requireSuperAdmin`). Autenticação e autorização. |
| **lib/**    | Clientes (Prisma, Redis, Supabase), funções puras (hash de fingerprint, rate limit). |

### Fluxo de uma requisição

1. **Fastify** recebe a requisição.
2. **Route** usa schema Zod para validar body/query/params → em falha, responde 400 com `err('VALIDATION', ...)`.
3. **Route** chama **service** com os dados validados.
4. **Service** aplica regras de negócio, usa **lib** (Prisma, Redis, etc.) e retorna resultado.
5. **Route** mapeia resultado do service para HTTP (201, 404, 429, etc.) e responde com `ok(data)` ou `err(code, message)`.

### Convenções

- **Validação:** sempre em `schemas/`, nunca Zod inline nas rotas.
- **Respostas:** usar `ok(data)` e `err(code, message)` de `types` para formato uniforme.
- **Erros de negócio:** o service pode retornar `{ ok: false, code: 'BLOCKED' }`; a rota traduz para 429 e `err('BLOCKED', ...)`.
- **Auth admin:** usar `requireAdmin` ou `requireSuperAdmin` de `middleware/auth`; não duplicar lógica de token nas rotas.

### Mapa de testes

O arquivo **TESTS_API.md** na raiz do repositório lista todos os testes que a API deve ter, por módulo. Use como checklist ao implementar ou evoluir a API.

# Testes — Safe City API

Este documento descreve **onde** e **como** os testes da API estão organizados e como rodá-los. A lista completa do *que* testar (checklist por módulo) está em **TESTS_API.md** na raiz do repositório (logos-circle).

---

## Onde ficam os testes

Todos os testes da API estão em **`safe-city-app/api/src/`**, no mesmo pacote do código:

- **`src/**/*.test.ts`** — Vitest descobre por esse glob (ver `vitest.config.ts`).

Estrutura atual:

| Pasta        | Tipo        | Exemplos |
|-------------|-------------|----------|
| `types/`    | Unitário    | `index.test.ts` (ok/err) |
| `schemas/`  | Unitário    | `reports.test.ts`, `bot.test.ts`, `public.test.ts`, `admin.test.ts` |
| `lib/`      | Unitário    | `fingerprint.test.ts` (hash + checkRateLimit com mock Redis) |
| `services/` | Unitário    | `alerts.test.ts`, `reportService.test.ts`, `bot.test.ts` |
| `middleware/` | Unitário  | `auth.test.ts` |
| `routes/`   | Integração  | `health.integration.test.ts`, `reports.integration.test.ts`, `bot.integration.test.ts`, `public.integration.test.ts`, `whatsapp.integration.test.ts`, `admin.integration.test.ts`, `infra.integration.test.ts` |

Testes de integração usam **`src/test-utils/build-app.ts`**: monta a instância Fastify com todas as rotas (sem conectar Redis nem listen), para chamadas via `app.inject()`.

---

## Como rodar

A partir de **`safe-city-app/api`**:

```bash
pnpm test          # roda toda a suíte uma vez
pnpm test:watch    # watch mode (re-roda ao salvar)
pnpm test -- --run src/routes/reports.integration.test.ts   # um arquivo
pnpm test -- -t "createReport"   # testes cujo nome contém a string
```

Coverage (opcional):

```bash
pnpm test -- --coverage
```

Relatório em `safe-city-app/api/coverage/` (HTML).

---

## Convenções

1. **Unitários:** use **`vi.mock('...')`** para Prisma, Redis, Supabase, serviços externos (alerts, push, ai). Assim os testes não dependem de DB/Redis/API.
2. **Integração:** use **`buildApp()`** de `test-utils/build-app.ts`. Não sobe servidor; as rotas são chamadas com `app.inject({ method, url, payload })`.
3. **Testes que precisam de DB/Redis:** use **`it.runIf(hasDb)`** (ou `it.runIf(Boolean(process.env['DATABASE_URL']))`). Assim o teste só roda quando `DATABASE_URL` está definido; em CI ou máquina sem banco, ele é **skipped** em vez de falhar.
4. **Nomenclatura:** testes de integração por rota podem usar o sufixo **`.integration.test.ts`** (ex.: `reports.integration.test.ts`). Unitários ficam ao lado do módulo (ex.: `reportService.test.ts`).
5. **Resposta da API:** formato padrão `{ data: T, error: null }` ou `{ data: null, error: { code, message } }`. Nos testes, validar `res.statusCode` e `body.error?.code` quando for caso de erro.

---

## Ambiente

- **Sem env:** unitários e integração que não tocam em DB/Redis passam. Integração que depende de banco fica **skipped** (`it.runIf(hasDb)`).
- **Com `DATABASE_URL` (e Redis para bot):** a suíte completa roda, incluindo os testes condicionais (GET /reports/active, POST /bot/message, zones, partners, subscribe, stats, etc.).

---

## Ao adicionar ou mudar comportamento

1. **Incluir ou ajustar o caso** em **TESTS_API.md** (raiz do repo), no módulo correspondente.
2. **Implementar o teste** no arquivo certo (schemas, services, routes) seguindo as convenções acima.
3. Rodar **`pnpm test`** antes de fechar a alteração.

Isso mantém o mapa (TESTS_API.md) e a suíte (TESTING.md + código) alinhados e facilita para qualquer um — ou para uma IA — manter e estender os testes de forma consistente.

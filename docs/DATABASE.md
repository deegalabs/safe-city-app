# Banco de dados — safe-city-app

Schema Prisma, regras de privacidade e TTL.

---

## Schema (Prisma)

### Tabelas principais

| Tabela | Uso |
|--------|-----|
| **zones** | Bairros/ruas do Centro (slug, nome, lat/lng, risco, contadores) |
| **reports** | Alertas anônimos (tipo, urgencia, local, zone_id, retrato JSON, fingerprint hasheado, channel, expires_at) |
| **confirmations** | Confirmações por report (report_id + fingerprint; 1 por pessoa) |
| **partners** | Bares parceiros (nome, slug, status, lat/lng, zone_id, checkins_hoje) |
| **checkins** | Check-in anônimo em parceiro (partner_id + fingerprint) |
| **push_subscriptions** | Assinaturas Web Push (endpoint, chaves, zonas de interesse) |
| **admins** | Usuários do painel admin (email, role, partner_id opcional) |
| **audit_logs** | Log de ações no admin (admin_id, action, entity, entity_id, meta) |

### Enums

- **ReportTipo:** furto, violencia, assedio, suspeito, infra  
- **ReportUrgencia:** alta, media, baixa  
- **ReportStatus:** ativo, confirmado, critico, expirado, removido  
- **PartnerStatus:** seguro, atencao, fechado  
- **AdminRole:** superadmin, parceiro  
- **BotChannel:** pwa, whatsapp  

---

## Regras de privacidade no banco

1. **Nunca armazenar IP** — não existe campo de IP em nenhuma tabela.
2. **Fingerprint sempre hasheado** — antes de gravar em `reports.fingerprint`, `confirmations.fingerprint` ou `checkins.fingerprint` usa-se `hashFingerprint(raw, FINGERPRINT_SALT)` (SHA-256).
3. **Reports sem identidade** — só: tipo, local, zona, retrato (características), extra (texto livre), fingerprint hasheado, channel. Nada de telefone, email ou nome.
4. **Admin não vê quem reportou** — a API admin retorna apenas dados agregados ou reports sem possibilidade de identificar a pessoa.

---

## TTL e expiração

- **reports.expires_at** — definido na criação (ex.: 45 minutos a partir de `created_at`). Job no backend (`startExpiryJob`) marca como `expirado` quando passa do prazo.
- **Sessões do bot** — ficam no **Redis** com TTL de 30 minutos (não no Postgres).
- Política de retenção: pode-se definir limpeza periódica de reports antigos (ex.: deletar ou anonimizar após 72h); atualmente a lógica usa status `expirado` e não remove linhas automaticamente.

---

## Migrations e seed

Execute a partir de `safe-city-app/api`:

```bash
pnpm db:migrate   # aplica migrations
pnpm db:seed      # popula zones + parceiros de exemplo do Centro
```

O seed cria zonas (Praça XV, Paulo Fontes, Victor Meirelles, TICEN, etc.) e alguns parceiros para desenvolvimento.

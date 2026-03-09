# Privacidade — Safe City Centro Floripa

O Safe City foi desenhado para **não identificar** quem reporta. Este documento descreve o que é e o que não é coletado.

---

## O que NÃO coletamos

- **IP do usuário** — nunca é armazenado nem logado.
- **Número de telefone em texto claro** — no WhatsApp, só usamos um hash irreversível (SHA-256 + salt) como identificador de sessão; o número nunca é guardado.
- **Nome, e-mail ou qualquer dado de cadastro** — o app público não exige login.
- **Foto ou vídeo de pessoas** — não aceitamos envio de foto/vídeo; apenas o retrato falado (descrição por campos).

---

## O que é armazenado (e por quê)

| Dado | Uso | Retenção |
|------|-----|----------|
| **Fingerprint hasheado** | Identificador anônimo por dispositivo (rate limit, anti-spam, sessão do bot). Não permite descobrir quem é a pessoa. | Enquanto o report estiver ativo; depois só em hash para evitar duplicatas em janela curta. |
| **Conteúdo do report** | Tipo, local, urgência, retrato falado (JSON), zona. Sem nenhum campo de identidade. | Reports expiram em 45 minutos; políticas de limpeza podem reduzir retenção (ex.: 72h). |
| **Confirmações** | Apenas fingerprint hasheado + `report_id` — para contar “quem confirmou” sem identificar. | Mesma política dos reports. |
| **Push (Web Push)** | Endpoint e chaves públicas do browser + zonas de interesse. Nenhum e-mail, telefone ou nome. | Até o usuário revogar ou o endpoint ficar inválido. |

---

## Quem vê o quê

- **Cidadão no PWA:** vê alertas ativos (tipo, local, retrato falado, tempo restante). Não vê quem reportou nem quem confirmou.
- **Prefeitura / GMF / polícia:** em princípio veem o **mesmo** que o cidadão (mapa e alertas públicos). O sistema não é canal de denúncia formal nem dá acesso privilegiado a dados identificáveis.
- **Admin (painel):** vê métricas agregadas, parceiros, fila de moderação e ações de outros admins. **Não** vê IP, telefone ou dados que permitam identificar quem reportou.

---

## Princípios

1. **Minimização** — só guardamos o necessário para o serviço (alertas, confirmações, moderação).
2. **Anonimato por desenho** — fingerprint sempre hasheado; sem cadastro no app público.
3. **Expiração** — alertas saem do mapa em 45 min; políticas de limpeza aplicáveis ao banco.
4. **Transparência** — código público (safe-city-app) para auditoria; este doc descreve a prática.

Para dúvidas ou solicitações sobre dados, use o canal público do projeto (ex.: repositório ou contato da organização).

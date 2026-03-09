# Fluxo do chatbot — safe-city-app

Estados do bot (BotService) e transições. O mesmo fluxo vale para **PWA** e **WhatsApp**.

---

## Visão geral

O bot é uma máquina de estados. Cada estado tem:
- **text:** mensagem exibida ao usuário  
- **options:** botões (label + key); keys podem ser `goto:<step>` ou `nav:<tela>` ou `ACTION:send`  
- **input** (opcional): campo de texto livre; **inputKey** indica onde salvar no session; **nextOnInput** é o próximo step após enviar texto  

A sessão é persistida no **Redis** por `channel + sessionId` com TTL 30 min.

---

## Mapa de estados

| Step | Descrição | Próximo(s) |
|------|-----------|------------|
| **start** | Menu principal | report_tipo, nav:alertas, nav:mapa, como |
| **report_tipo** | Tipo do report (furto, violência, assédio, suspeito, infra) | report_local_modo |
| **report_local_modo** | Escolha: usar GPS ou descrever o local | report_local_texto ou ACTION:gps |
| **report_local_texto** | Input de local (texto ou busca OSM) | report_local_confirmar |
| **report_local_confirmar** | Confirma o local exibido | report_urgencia |
| **report_urgencia** | Urgência (agora / há pouco / suspeito) | retrato_inicio |
| **retrato_inicio** | Tem suspeito visível? | retrato_genero ou report_extra |
| **retrato_genero** | Gênero (homem, mulher, grupo) | retrato_idade |
| **retrato_idade** | Faixa etária | retrato_altura |
| **retrato_altura** | Altura | retrato_porte |
| **retrato_porte** | Porte físico | retrato_pele |
| **retrato_pele** | Tom de pele | retrato_cabelo |
| **retrato_cabelo** | Cabelo / boné | retrato_roupa ou retrato_bone_cor |
| **retrato_bone_cor** | Cor do boné | retrato_roupa |
| **retrato_roupa** | Roupa de cima | retrato_cor_roupa ou retrato_detalhe |
| **retrato_cor_roupa** | Cor da roupa | retrato_detalhe |
| **retrato_detalhe** | Detalhe marcante (input) | retrato_fuga |
| **retrato_fuga** | Ainda no local? / Fugiu? | report_extra ou retrato_direcao |
| **retrato_direcao** | Direção da fuga | report_extra |
| **report_extra** | Informação extra (input) ou “Enviar alerta” | ACTION:send |
| **como** | Explicação do Safe City | report_tipo, start |

---

## Ações especiais

- **ACTION:gps** — usa localização do dispositivo; o frontend envia `optionData` com `local`, `zone_id` (ex.: gps-resolved) e o backend faz merge na sessão e vai para report_local_confirmar.
- **nav:alertas** / **nav:mapa** — o frontend interpreta e navega para a aba Alertas ou Mapa (não muda step no backend).
- **ACTION:send** — o backend persiste o report (Prisma), dispara push para assinantes da zona, limpa a sessão e retorna mensagem de confirmação com hash anônimo. Zone_id gps-resolved/osm-resolved é normalizado para `outro`.

---

## Texto livre (IA opcional)

Se o usuário **digitar texto** em um step do tipo `retrato_*` e o texto tiver mais de 15 caracteres, o serviço pode usar **extractRetratoFromText** (Anthropic Haiku) para preencher campos do retrato e pular para `report_extra`. Se não houver API key, o bot apenas reexibe o step atual.

---

## Canais

- **PWA:** `sessionId` = fingerprint do browser (hasheado).  
- **WhatsApp:** `sessionId` = número do usuário hasheado.  

O fluxo e os steps são idênticos; só muda o canal e o formato da resposta (Quick Replies no WhatsApp, botões no PWA).

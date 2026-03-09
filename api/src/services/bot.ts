import { getSession, setSession, deleteSession, sessionKey as redisSessionKey } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { extractRetratoFromText } from './ai'
import { moderateNewReport, buildExpiryDate } from './alerts'
import { notifyZoneSubscribers } from './push'
import { hashFingerprint } from '../lib/fingerprint'
import { resolveLocationFromText } from './geocoding'
import type {
  BotChannel, BotInput, BotOutput, BotOption, BotSession, Retrato,
  ReportTipo, ReportUrgencia,
} from '../types'

// ── Flow definition ───────────────────────────────────────────

interface FlowStep {
  text: string
  options?: BotOption[]
  input?: boolean
  inputPlaceholder?: string
  inputKey?: string
  nextOnInput?: string
  inputMode?: 'location' | 'text'
}

function buildFlow(): Record<string, FlowStep> {
  return {
    start: {
      text: '🛡 Olá. Sou o Safe City, sistema de alertas do Centro de Floripa.\n\nO que você quer fazer?',
      options: [
        { label: '⚠️ Reportar algo agora',       key: 'goto:report_tipo'  },
        { label: '🗺 Ver alertas da região',      key: 'nav:alertas'       },
        { label: '📍 Pontos seguros próximos', key: 'nav:mapa' },
        { label: 'ℹ️ Como funciona',             key: 'goto:como'         },
      ],
    },
    report_tipo: {
      text: 'O que você está reportando?',
      options: [
        { label: '🎒 Furto / Roubo em andamento', key: 'goto:report_local_modo', data: { tipo: 'furto'     } },
        { label: '⚠️ Violência / Briga',          key: 'goto:report_local_modo', data: { tipo: 'violencia' } },
        { label: '🛑 Assédio',                    key: 'goto:report_local_modo', data: { tipo: 'assedio'   } },
        { label: '🚨 Situação suspeita',           key: 'goto:report_local_modo', data: { tipo: 'suspeito'  } },
        { label: '💡 Infraestrutura',             key: 'goto:report_local_modo', data: { tipo: 'infra'     } },
      ],
    },
    report_local_modo: {
      text: 'Em qual local está acontecendo?\n\nPosso detectar automaticamente ou você descreve.',
      options: [
        { label: '📍 Usar minha localização', key: 'ACTION:gps' },
        { label: '✏️ Descrever o local', key: 'goto:report_local_texto' },
      ],
    },
    report_local_texto: {
      text: 'Descreva o local:\nEx: Praça XV, Terminal TICEN, Rua Bocaiúva...',
      input: true,
      inputPlaceholder: 'Nome da rua, praça ou referência...',
      inputKey: 'local_texto',
      nextOnInput: 'ACTION:location_search',
      inputMode: 'location',
      options: [
        { label: '📍 Usar localização', key: 'ACTION:gps' },
      ],
    },
    report_local_confirmar: {
      text: 'Local identificado:\n{local}\n\nCorreto?',
      options: [
        { label: '✅ Sim, está correto', key: 'goto:report_urgencia' },
        { label: '✏️ Corrigir', key: 'goto:report_local_texto' },
      ],
    },
    report_urgencia: {
      text: 'Qual a situação agora?',
      options: [
        { label: '🔴 Está acontecendo AGORA',         key: 'goto:retrato_inicio', data: { urgencia: 'alta'  } },
        { label: '🟡 Aconteceu há pouco (< 10min)',   key: 'goto:retrato_inicio', data: { urgencia: 'media' } },
        { label: '⚪ Vi algo suspeito',                key: 'goto:retrato_inicio', data: { urgencia: 'baixa' } },
      ],
    },
    retrato_inicio: {
      text: 'Algumas perguntas rápidas para o alerta.\nPode pular qualquer uma.\n\nTem suspeito visível?',
      options: [
        { label: '✅ Sim, vi a pessoa',  key: 'goto:retrato_genero' },
        { label: '❌ Não / Não vi bem',  key: 'goto:report_extra'   },
      ],
    },
    retrato_genero: {
      text: 'Era...',
      options: [
        { label: '👨 Homem',            key: 'goto:retrato_idade',     data: { 'retrato.genero': 'homem'  } },
        { label: '👩 Mulher',           key: 'goto:retrato_idade',     data: { 'retrato.genero': 'mulher' } },
        { label: '👥 Grupo (2+)',       key: 'goto:retrato_grupo_qtd', data: { 'retrato.genero': 'grupo'  } },
        { label: '❓ Não consegui ver', key: 'goto:retrato_idade',     data: { 'retrato.genero': null     } },
      ],
    },
    retrato_grupo_qtd: {
      text: 'Quantas pessoas aproximadamente?',
      options: [
        { label: '👥 2–3 pessoas', key: 'goto:retrato_detalhe', data: { 'retrato.idade': '2-3 pessoas' } },
        { label: '👥 4–6 pessoas', key: 'goto:retrato_detalhe', data: { 'retrato.idade': '4-6 pessoas' } },
        { label: '👥 Mais de 6',   key: 'goto:retrato_detalhe', data: { 'retrato.idade': '6+ pessoas'  } },
        { label: '❓ Não sei',     key: 'goto:retrato_detalhe', data: { 'retrato.idade': null           } },
      ],
    },
    retrato_idade: {
      text: 'Faixa de idade aparente?',
      options: [
        { label: '🧒 Jovem 15–25',       key: 'goto:retrato_altura', data: { 'retrato.idade': 'jovem 15-25'      } },
        { label: '🧑 Adulto 26–40',      key: 'goto:retrato_altura', data: { 'retrato.idade': 'adulto 26-40'     } },
        { label: '🧔 Meia-idade 40–60',  key: 'goto:retrato_altura', data: { 'retrato.idade': 'meia-idade 40-60' } },
        { label: '❓ Não sei',           key: 'goto:retrato_altura', data: { 'retrato.idade': null                } },
      ],
    },
    retrato_altura: {
      text: 'Altura aproximada?',
      options: [
        { label: '📏 Baixo < 1,65',     key: 'goto:retrato_porte', data: { 'retrato.altura': 'baixo (<1,65)'    } },
        { label: '📏 Médio 1,65–1,80',  key: 'goto:retrato_porte', data: { 'retrato.altura': 'médio (1,65-1,80)'} },
        { label: '📏 Alto > 1,80',      key: 'goto:retrato_porte', data: { 'retrato.altura': 'alto (>1,80)'     } },
        { label: '❓ Não percebi',      key: 'goto:retrato_porte', data: { 'retrato.altura': null                } },
      ],
    },
    retrato_porte: {
      text: 'Porte físico?',
      options: [
        { label: '🔹 Magro / Franzino', key: 'goto:retrato_pele', data: { 'retrato.porte': 'magro'  } },
        { label: '🔸 Médio',            key: 'goto:retrato_pele', data: { 'retrato.porte': 'médio'  } },
        { label: '🔶 Forte / Robusto',  key: 'goto:retrato_pele', data: { 'retrato.porte': 'forte'  } },
        { label: '❓ Não sei',          key: 'goto:retrato_pele', data: { 'retrato.porte': null      } },
      ],
    },
    retrato_pele: {
      text: 'Tom de pele?',
      options: [
        { label: '⬜ Clara',            key: 'goto:retrato_cabelo', data: { 'retrato.pele': 'clara' } },
        { label: '🟫 Parda',           key: 'goto:retrato_cabelo', data: { 'retrato.pele': 'parda' } },
        { label: '⬛ Negra',           key: 'goto:retrato_cabelo', data: { 'retrato.pele': 'negra' } },
        { label: '❓ Não lembro',       key: 'goto:retrato_cabelo', data: { 'retrato.pele': null    } },
      ],
    },
    retrato_cabelo: {
      text: 'Cabelo / cabeça?',
      options: [
        { label: '✂️ Curto',             key: 'goto:retrato_roupa',    data: { 'retrato.cabelo': 'curto'  } },
        { label: '💇 Médio',            key: 'goto:retrato_roupa',    data: { 'retrato.cabelo': 'médio'  } },
        { label: '🦱 Longo',            key: 'goto:retrato_roupa',    data: { 'retrato.cabelo': 'longo'  } },
        { label: '🧢 Boné / chapéu',    key: 'goto:retrato_bone_cor', data: { 'retrato.cabelo': 'boné'   } },
        { label: '😶 Careca / raspado', key: 'goto:retrato_roupa',    data: { 'retrato.cabelo': 'careca' } },
      ],
    },
    retrato_bone_cor: {
      text: 'Cor do boné / chapéu?',
      options: [
        { label: '⬛ Preto',    key: 'goto:retrato_roupa', data: { 'retrato.bone_cor': 'preto'    } },
        { label: '⬜ Branco',   key: 'goto:retrato_roupa', data: { 'retrato.bone_cor': 'branco'   } },
        { label: '🔵 Azul',    key: 'goto:retrato_roupa', data: { 'retrato.bone_cor': 'azul'     } },
        { label: '🔴 Vermelho', key: 'goto:retrato_roupa', data: { 'retrato.bone_cor': 'vermelho' } },
        { label: '❓ Outra cor',key: 'goto:retrato_roupa', data: { 'retrato.bone_cor': 'outra'    } },
      ],
    },
    retrato_roupa: {
      text: 'Roupa de cima?',
      options: [
        { label: '👕 Camiseta',    key: 'goto:retrato_cor_roupa', data: { 'retrato.roupa': 'camiseta' } },
        { label: '👔 Camisa',      key: 'goto:retrato_cor_roupa', data: { 'retrato.roupa': 'camisa'   } },
        { label: '🧥 Moletom',     key: 'goto:retrato_cor_roupa', data: { 'retrato.roupa': 'moletom'  } },
        { label: '🦺 Regata',      key: 'goto:retrato_cor_roupa', data: { 'retrato.roupa': 'regata'   } },
        { label: '❓ Não percebi', key: 'goto:retrato_detalhe',   data: { 'retrato.roupa': null       } },
      ],
    },
    retrato_cor_roupa: {
      text: 'Cor da roupa de cima?',
      options: [
        { label: '⬛ Preta',     key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'preta'    } },
        { label: '⬜ Branca',    key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'branca'   } },
        { label: '🔵 Azul',     key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'azul'     } },
        { label: '🔴 Vermelha', key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'vermelha' } },
        { label: '🟢 Verde',    key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'verde'    } },
        { label: '🟡 Amarela',  key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'amarela'  } },
        { label: '❓ Outra',    key: 'goto:retrato_detalhe', data: { 'retrato.cor_roupa': 'outra'    } },
      ],
    },
    retrato_detalhe: {
      text: 'Detalhe marcante?\n(tatuagem, cicatriz, barba, óculos, mochila...)\nDigite ou toque em Pular.',
      input: true,
      inputPlaceholder: 'Ex: tatuagem no pescoço...',
      inputKey: 'retrato.detalhe',
      nextOnInput: 'retrato_fuga',
      options: [{ label: '➡️ Pular', key: 'goto:retrato_fuga', data: { 'retrato.detalhe': null } }],
    },
    retrato_fuga: {
      text: 'O suspeito ainda está no local?',
      options: [
        { label: '📍 Ainda está lá',            key: 'goto:report_extra',    data: { 'retrato.fuga': 'ainda no local' } },
        { label: '🏃 Fugiu — indicar direção', key: 'goto:retrato_direcao', data: { 'retrato.fuga': 'fugiu'          } },
        { label: '❓ Não sei',                  key: 'goto:report_extra',    data: { 'retrato.fuga': 'desconhecida'   } },
      ],
    },
    retrato_direcao: {
      text: 'Em direção a qual rua ou ponto?',
      input: true,
      inputPlaceholder: 'Ex: Av. Rio Branco, Praça XV...',
      inputKey: 'retrato.direcao',
      nextOnInput: 'report_extra',
      options: [{ label: '➡️ Pular', key: 'goto:report_extra', data: { 'retrato.direcao': null } }],
    },
    report_extra: {
      text: 'Quer adicionar mais alguma informação? (opcional)',
      input: true,
      inputPlaceholder: 'O que mais você observou...',
      inputKey: 'extra',
      nextOnInput: 'retrato_revisar',
      options: [{ label: '✅ Revisar e enviar', key: 'goto:retrato_revisar' }],
    },
    report_infra_desc: {
      text: 'Descreva o problema de infraestrutura:\nEx: poste apagado, calçada com buraco, lixo acumulado...',
      input: true,
      inputPlaceholder: 'Descreva o problema...',
      inputKey: 'extra',
      nextOnInput: 'retrato_revisar',
      options: [{ label: '✅ Revisar e enviar', key: 'goto:retrato_revisar' }],
    },
    retrato_revisar: {
      text: '', // built dynamically in stepToOutput
      options: [], // built dynamically
    },
    como: {
      text: '🛡 Safe City é um sistema de alertas comunitários.\n\n✓ Você reporta de forma anônima\n✓ A comunidade recebe o alerta em segundos\n✓ Nenhuma foto de pessoa é armazenada\n✓ Alertas somem automaticamente em 45min\n✓ Sem login, sem rastreamento pessoal',
      options: [
        { label: '📢 Quero reportar algo', key: 'goto:report_tipo' },
        { label: '🏠 Início',             key: 'goto:start'       },
      ],
    },
  }
}

// ── BotService ────────────────────────────────────────────────

export class BotService {
  private flow = buildFlow()

  async process(input: BotInput): Promise<BotOutput> {
    const key = redisSessionKey(input.channel, input.sessionId)
    let session = await getSession<BotSession>(key)

    // New session
    if (!session) {
      session = {
        channel: input.channel,
        sessionId: input.sessionId,
        step: 'start',
        dados: { retrato: {} },
        updatedAt: Date.now(),
      }
    }

    // SOS / PANICO — before any other step
    if (input.text && /^(sos|panico)$/i.test(input.text.trim())) {
      session.step = 'sos_pending'
      session.dados.tipo = 'violencia'
      session.dados.urgencia = 'alta'
      session.updatedAt = Date.now()
      await setSession(key, session)
      return {
        text: '🚨 Alerta de emergência. Envie sua localização para disparar o alerta.',
        options: [{ label: '📍 Usar minha localização', key: 'ACTION:gps_sos' }],
      }
    }

    // SOS submit or stuck SOS session reset
    const optKeyForSos = input.optionKey ?? ''
    if (session.step === 'sos_pending') {
      if (optKeyForSos === 'ACTION:sos_submit' && input.optionData?.local != null && input.optionData?.zone_id != null) {
        session = this.mergeData(session, { local: input.optionData.local as string, zone_id: input.optionData.zone_id as string })
        return await this.sendReport(session, key)
      }
      // User abandoned SOS (cancel or any other action) — reset to start
      session.step = 'start'
      session.dados = { retrato: {} }
      session.updatedAt = Date.now()
      await setSession(key, session)
      return this.stepToOutput('start', session)
    }

    // Handle free text: input step with nextOnInput → merge and advance
    if (input.text && !input.optionKey) {
      const currentFlow = this.flow[session.step]
      if (currentFlow?.inputKey && currentFlow?.nextOnInput) {
        session = this.mergeData(session, { [currentFlow.inputKey]: input.text })
        let nextFromInput = currentFlow.nextOnInput.replace('goto:', '')
        const fromReviewText = (session.dados as Record<string, unknown>).from_review
        if (fromReviewText && session.step.startsWith('retrato_') && session.step !== 'retrato_revisar') {
          nextFromInput = 'retrato_revisar'
          delete (session.dados as Record<string, unknown>).from_review
        }
        // WhatsApp (e outros canais sem frontend): texto em report_local_texto → geocoding → report_local_confirmar
        if (nextFromInput === 'ACTION:location_search') {
          const localTexto = (session.dados as Record<string, unknown>).local_texto as string | undefined
          if (localTexto?.trim()) {
            const { local, zone_id } = await resolveLocationFromText(localTexto)
            session = this.mergeData(session, { local, zone_id })
            session.step = 'report_local_confirmar'
            session.updatedAt = Date.now()
            await setSession(key, session)
            return this.stepToOutput('report_local_confirmar', session)
          }
        }
        session.step = nextFromInput
        session.updatedAt = Date.now()
        await setSession(key, session)
        return this.stepToOutput(session.step, session)
      }
      return await this.handleFreeText(session, input.text, key)
    }

    const optKey = input.optionKey ?? 'goto:start'

    // Handle special actions
    if (optKey === 'ACTION:send' || optKey === 'ACTION:send_text') {
      if (input.text) session.dados.extra = input.text
      return await this.sendReport(session, key)
    }

    // Navigation actions (PWA handles these, WhatsApp shows info)
    if (optKey.startsWith('nav:')) {
      const dest = optKey.replace('nav:', '')
      await deleteSession(key)
      return {
        type: 'navigate',
        navigateTo: dest,
        text: dest === 'alertas'
          ? '🗺 Veja os alertas ativos no app.'
          : '📍 Veja os pontos seguros no mapa.',
      }
    }

    // WhatsApp: "Usar minha localização" sem pin → pedir para enviar localização ou descrever
    if (optKey === 'ACTION:gps' && input.channel === 'whatsapp' && !input.optionData?.local) {
      session.step = 'report_local_texto'
      session.updatedAt = Date.now()
      await setSession(key, session)
      return {
        type: 'text',
        text: '📍 No WhatsApp você pode:\n\n1. Enviar sua **localização** (clipe 📎 → Localização) ou\n2. **Descrever o local** digitando abaixo. Ex: Praça XV, Terminal TICEN, Rua Bocaiúva...',
        input: true,
        inputPlaceholder: 'Nome da rua, praça ou referência...',
        inputKey: 'local_texto',
        nextOnInput: 'ACTION:location_search',
        options: [{ label: '🏠 Voltar ao início', key: 'goto:start' }],
      }
    }

    // Merge option data into session
    if (input.optionData) {
      session = this.mergeData(session, input.optionData)
    }

    // Get next step
    let nextStep = optKey.replace('goto:', '')

    // Handle send after input field
    const currentFlow = this.flow[session.step]
    if (currentFlow?.nextOnInput === nextStep && input.text) {
      if (currentFlow.inputKey) {
        session = this.mergeData(session, { [currentFlow.inputKey]: input.text })
      }
    }

    // When user chose an option FROM a retrato_* step and came from review, return to revisar
    const fromReview = (session.dados as Record<string, unknown>).from_review
    if (fromReview && session.step.startsWith('retrato_') && session.step !== 'retrato_revisar') {
      nextStep = 'retrato_revisar'
      delete (session.dados as Record<string, unknown>).from_review
    }

    // Infra tipo skips retrato steps — go directly to infra description
    if (nextStep === 'retrato_inicio' && session.dados.tipo === 'infra') {
      nextStep = 'report_infra_desc'
    }

    // ACTION:gps com optionData (local já resolvido, ex.: pin no WhatsApp) → ir para confirmar local
    if (nextStep === 'ACTION:gps' && session.dados.local) {
      nextStep = 'report_local_confirmar'
    }

    session.step = nextStep
    session.updatedAt = Date.now()
    await setSession(key, session)

    return this.stepToOutput(nextStep, session)
  }

  private async handleFreeText(session: BotSession, text: string, key: string): Promise<BotOutput> {
    // Try AI extraction if text is substantial
    if (text.length > 15 && session.step.startsWith('retrato_')) {
      const extracted = await extractRetratoFromText(text)
      const retratoData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(extracted)) {
        retratoData[`retrato.${k}`] = v
      }
      session = this.mergeData(session, retratoData)
      session.step = 'report_extra'
      session.updatedAt = Date.now()
      await setSession(key, session)
      return this.stepToOutput('report_extra', session)
    }

    // Otherwise re-show current step
    return this.stepToOutput(session.step, session)
  }

  private async sendReport(session: BotSession, key: string): Promise<BotOutput> {
    try {
      const zoneId = session.dados.zone_id
      let normalizedZone: string
      if (zoneId && !['gps-resolved', 'osm-resolved', 'manual-text', 'outro'].includes(zoneId)) {
        normalizedZone = zoneId
      } else {
        // zone not resolved by frontend: use closest zone by risco or first available
        const fallback = await prisma.zone.findFirst({ orderBy: { risco: 'desc' } })
        normalizedZone = fallback?.id ?? zoneId ?? 'outro'
      }

      const mod = await moderateNewReport({
        fingerprint: session.sessionId,
        zone_id: normalizedZone,
        tipo: session.dados.tipo ?? 'suspeito',
      })

      if (!mod.allowed) {
        await deleteSession(key)
        return { text: '⚠️ Você já reportou um incidente recentemente. Aguarde alguns minutos.' }
      }

      const hashedFp = hashFingerprint(session.sessionId)
      const report = await prisma.report.create({
        data: {
          tipo: (session.dados.tipo ?? 'suspeito') as ReportTipo,
          urgencia: (session.dados.urgencia ?? 'media') as ReportUrgencia,
          local: session.dados.local ?? 'Centro',
          zone_id: normalizedZone,
          retrato: session.dados.retrato as object,
          extra: session.dados.extra ?? null,
          fingerprint: hashedFp,
          channel: session.channel,
          expires_at: buildExpiryDate(),
        },
      })

      void notifyZoneSubscribers(report.zone_id, {
        title: `⚠️ ${report.local}`,
        body: 'Novo alerta na sua região',
        zone_id: report.zone_id,
        report_id: report.id,
      })

      const retratoStr = this.buildRetratoString(session.dados.retrato, session.dados.extra)
      await deleteSession(key)

      return {
        type: 'confirm',
        text: '✅ Alerta enviado com sucesso.',
        confirmData: { hash: report.hash, retrato: retratoStr },
        options: [
          { label: '🏠 Início',             key: 'goto:start' },
          { label: '⚠️ Ver alertas ativos', key: 'nav:alertas' },
        ],
      }
    } catch (err) {
      console.error('BotService.sendReport error:', err)
      return { text: '❌ Erro ao enviar o alerta. Tente novamente.' }
    }
  }

  private stepToOutput(step: string, session?: BotSession): BotOutput {
    if (step === 'retrato_revisar' && session) {
      const text = this.buildRetratoSummaryForReview(session)
      const options = this.buildRevisarOptions(session)
      return { type: 'text', text, options }
    }
    const flowStep = this.flow[step]
    if (!flowStep) return { text: '❓ Não entendi. Tente novamente.', options: [{ label: '🏠 Início', key: 'goto:start' }] }
    let text = flowStep.text
    if (step === 'report_local_confirmar' && session?.dados?.local) {
      text = text.replace('{local}', session.dados.local)
    }
    return {
      type: 'text',
      text,
      options: flowStep.options,
      input: flowStep.input,
      inputPlaceholder: flowStep.inputPlaceholder,
      inputMode: flowStep.inputMode,
    }
  }

  private buildRetratoSummaryForReview(session: BotSession): string {
    const r = session.dados.retrato ?? {}
    const lines: string[] = []
    const labels: Record<string, string> = {
      genero: 'Gênero', idade: 'Idade', altura: 'Altura', porte: 'Porte',
      pele: 'Pele', cabelo: 'Cabelo', bone_cor: 'Cor do boné',
      roupa: 'Roupa', cor_roupa: 'Cor da roupa', detalhe: 'Detalhe',
      fuga: 'Fuga', direcao: 'Direção',
    }
    const order: (keyof Retrato)[] = ['genero', 'idade', 'altura', 'porte', 'pele', 'cabelo', 'bone_cor', 'roupa', 'cor_roupa', 'detalhe', 'fuga', 'direcao']
    for (const k of order) {
      const v = (r as Record<string, unknown>)[k]
      if (v != null && String(v).trim() !== '') {
        lines.push(`${labels[k] ?? k}: ${v}`)
      }
    }
    if (session.dados.extra?.trim()) {
      lines.push(`Outro: ${session.dados.extra}`)
    }
    const block = lines.length ? lines.join('\n') : 'Nenhum detalhe preenchido.'
    return `📋 Confira o retrato falado antes de enviar:\n\n${block}\n\nEstá correto? Você pode alterar um item ou confirmar.`
  }

  private buildRevisarOptions(session: BotSession): BotOption[] {
    const opts: BotOption[] = [{ label: '✅ Confirmar e enviar', key: 'ACTION:send' }]
    const r = session.dados.retrato ?? {}
    const stepByField: Record<string, string> = {
      genero: 'retrato_genero', idade: 'retrato_idade', altura: 'retrato_altura', porte: 'retrato_porte',
      pele: 'retrato_pele', cabelo: 'retrato_cabelo', bone_cor: 'retrato_bone_cor',
      roupa: 'retrato_roupa', cor_roupa: 'retrato_cor_roupa', detalhe: 'retrato_detalhe',
      fuga: 'retrato_fuga', direcao: 'retrato_direcao',
    }
    const labels: Record<string, string> = {
      genero: 'Gênero', idade: 'Idade', altura: 'Altura', porte: 'Porte',
      pele: 'Pele', cabelo: 'Cabelo', bone_cor: 'Cor do boné',
      roupa: 'Roupa', cor_roupa: 'Cor da roupa', detalhe: 'Detalhe',
      fuga: 'Fuga', direcao: 'Direção',
    }
    for (const [field, step] of Object.entries(stepByField)) {
      const v = (r as Record<string, unknown>)[field]
      if (v != null && String(v).trim() !== '') {
        opts.push({ label: `✏️ Alterar ${labels[field] ?? field}`, key: `goto:${step}`, data: { from_review: true } })
      }
    }
    return opts
  }

  private mergeData(session: BotSession, data: Record<string, unknown>): BotSession {
    const next = { ...session, dados: { ...session.dados, retrato: { ...session.dados.retrato } } }
    const retratoKeys: Array<keyof Retrato> = [
      'genero','idade','altura','porte','pele','cabelo',
      'bone_cor','roupa','cor_roupa','detalhe','fuga','direcao',
    ]
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('retrato.')) {
        const rk = k.replace('retrato.', '') as keyof Retrato
        if (retratoKeys.includes(rk)) {
          (next.dados.retrato as Record<string, unknown>)[rk] = v
        }
      } else if (k === 'tipo') next.dados.tipo = v as ReportTipo
      else if (k === 'local') next.dados.local = v as string
      else if (k === 'local_display') next.dados.local = v as string
      else if (k === 'local_lat') next.dados.local_lat = v as number
      else if (k === 'local_lng') next.dados.local_lng = v as number
      else if (k === 'zone_id') next.dados.zone_id = v as string
      else if (k === 'urgencia') next.dados.urgencia = v as ReportUrgencia
      else if (k === 'extra') next.dados.extra = v as string
      else if (k === 'from_review') (next.dados as Record<string, unknown>).from_review = v
    }
    return next
  }

  private buildRetratoString(r: Retrato, extra?: string): string {
    const parts: string[] = []
    if (r.genero) parts.push(r.genero)
    if (r.idade)  parts.push(r.idade)
    if (r.altura) parts.push(r.altura)
    if (r.porte)  parts.push(r.porte)
    if (r.pele)   parts.push(`pele ${r.pele}`)
    if (r.cabelo) parts.push(r.cabelo === 'boné' && r.bone_cor ? `boné ${r.bone_cor}` : r.cabelo)
    if (r.roupa)  parts.push(r.cor_roupa ? `${r.roupa} ${r.cor_roupa}` : r.roupa)
    if (r.detalhe) parts.push(r.detalhe)
    if (r.fuga)   parts.push(r.fuga)
    if (r.direcao) parts.push(`direção ${r.direcao}`)
    if (extra)    parts.push(extra)
    return parts.length ? parts.join(', ') + '.' : ''
  }
}

export const botService = new BotService()

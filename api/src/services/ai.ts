import Anthropic from '@anthropic-ai/sdk'
import type { Retrato } from '../types'

const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

export async function extractRetratoFromText(text: string): Promise<Partial<Retrato>> {
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `Extraia informações de descrições de suspeitos em português. Retorne SOMENTE JSON válido, sem markdown.
Campos possíveis: genero ("homem"|"mulher"|"grupo"), idade ("jovem 15-25"|"adulto 26-40"|"meia-idade 40-60"),
altura ("baixo (<1,65)"|"médio (1,65-1,80)"|"alto (>1,80)"), porte ("magro"|"médio"|"forte"),
pele ("clara"|"parda"|"negra"), cabelo ("curto"|"médio"|"longo"|"boné"|"careca"),
bone_cor (string), roupa ("camiseta"|"camisa"|"moletom"|"regata"), cor_roupa (string),
detalhe (string), fuga ("ainda no local"|"fugiu"|"desconhecida"), direcao (string).
Omita campos não mencionados.`,
      messages: [{ role: 'user', content: `Descrição: "${text}"` }],
    })
    const content = msg.content[0]
    if (content?.type !== 'text') return {}
    return JSON.parse(content.text) as Partial<Retrato>
  } catch {
    return {}
  }
}

export async function moderateText(text: string): Promise<boolean> {
  if (!text || text.length < 3) return true
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: 'Responda SOMENTE "ok" ou "spam". É um report de segurança legítimo?',
      messages: [{ role: 'user', content: text.slice(0, 200) }],
    })
    const content = msg.content[0]
    return content?.type === 'text' ? content.text.toLowerCase().includes('ok') : true
  } catch {
    return true
  }
}

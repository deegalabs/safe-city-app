import Groq from 'groq-sdk'
import type { Retrato } from '../types'

let _client: Groq | null = null
function getClient(): Groq | null {
  if (!process.env['GROQ_API_KEY']) return null
  if (!_client) _client = new Groq({ apiKey: process.env['GROQ_API_KEY'] })
  return _client
}

const SYSTEM_RETRATO = `Extraia informações de descrições de suspeitos em português. Retorne SOMENTE JSON válido, sem markdown.
Campos possíveis: genero ("homem"|"mulher"|"grupo"), idade ("jovem 15-25"|"adulto 26-40"|"meia-idade 40-60"),
altura ("baixo (<1,65)"|"médio (1,65-1,80)"|"alto (>1,80)"), porte ("magro"|"médio"|"forte"),
pele ("clara"|"parda"|"negra"), cabelo ("curto"|"médio"|"longo"|"boné"|"careca"),
bone_cor (string), roupa ("camiseta"|"camisa"|"moletom"|"regata"), cor_roupa (string),
detalhe (string), fuga ("ainda no local"|"fugiu"|"desconhecida"), direcao (string).
Omita campos não mencionados.`

export async function extractRetratoFromText(text: string): Promise<Partial<Retrato>> {
  const client = getClient()
  if (!client) return {}
  try {
    const chat = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_RETRATO },
        { role: 'user', content: `Descrição: "${text}"` },
      ],
    })
    const content = chat.choices[0]?.message?.content
    if (!content) return {}
    return JSON.parse(content) as Partial<Retrato>
  } catch {
    return {}
  }
}

export async function moderateText(text: string): Promise<boolean> {
  if (!text || text.length < 3) return true
  const client = getClient()
  if (!client) return true
  try {
    const chat = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 10,
      messages: [
        { role: 'system', content: 'Responda SOMENTE "ok" ou "spam". É um report de segurança legítimo?' },
        { role: 'user', content: text.slice(0, 200) },
      ],
    })
    const content = chat.choices[0]?.message?.content ?? ''
    return content.toLowerCase().includes('ok')
  } catch {
    return true
  }
}

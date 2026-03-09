import Groq, { toFile } from 'groq-sdk'
import type { Retrato } from '../types'

const WHISPER_MODEL = 'whisper-large-v3-turbo'

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

/**
 * Transcreve áudio para texto (pt) via Groq Whisper.
 * Usa a mesma GROQ_API_KEY. Retorna string vazia se sem key ou erro.
 */
export async function transcribeAudio(buffer: Buffer, mimeType?: string): Promise<string> {
  const client = getClient()
  if (!client || buffer.length === 0) return ''
  const ext = mimeType === 'audio/mpeg' || mimeType === 'audio/mp3' ? 'mp3' : 'webm'
  try {
    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType ?? 'audio/webm' })
    const out = await client.audio.transcriptions.create({
      model: WHISPER_MODEL,
      file,
      language: 'pt',
      response_format: 'text',
    })
    return (out as { text?: string }).text?.trim() ?? ''
  } catch (err) {
    console.error('transcribeAudio error:', err instanceof Error ? err.message : err)
    return ''
  }
}

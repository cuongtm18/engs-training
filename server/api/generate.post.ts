import type { TranslatedLine } from '~/utils/types'

const MIN = 5
const MAX = 20

const SYSTEM = `You write practice material for a Vietnamese learner of everyday spoken English (level A2-B1).
Given a topic (and optionally a specific situation), write a realistic mini-script: the sentences people really say in that situation, in the order they would come up, mixing questions, requests, replies and small talk.

Rules:
- Each item is ONE short, standalone, useful sentence (at most about 15 words), natural spoken English, not textbook English.
- Cover different phrases; do not repeat the same pattern over and over.
- en = the English sentence. vi = a natural Vietnamese translation that fits the situation.
- Do not number the sentences. Do not include any sentence from the "avoid" list or a near copy of it.

Reply with JSON that matches the schema and nothing else.`

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: { vi: { type: 'string' }, en: { type: 'string' } }, required: ['vi', 'en'] },
    },
  },
  required: ['items'],
} as const

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  assertAccess(event, env)

  const body = await readBody<{ topic?: unknown; situation?: unknown; count?: unknown; avoid?: unknown }>(event)
  const topic = String(body?.topic ?? '').trim().slice(0, 60)
  const situation = String(body?.situation ?? '').trim().slice(0, 200)
  const count = Math.min(MAX, Math.max(MIN, Math.round(Number(body?.count)) || 15))
  const avoid = (Array.isArray(body?.avoid) ? body.avoid : []).slice(0, 40).map((s) => String(s).slice(0, 120))
  if (!topic) throw badRequest('Missing topic name.')

  const prompt =
    `Topic: ${topic}\n` +
    (situation ? `Situation: ${situation}\n` : '') +
    `Number of sentences: ${count}\n` +
    (avoid.length ? `Avoid (already in the learner's list):\n${avoid.map((a) => `- ${a}`).join('\n')}` : '')

  const parse = (obj: any): TranslatedLine[] | null => {
    if (!Array.isArray(obj?.items)) return null
    const seen = new Set<string>()
    const out: TranslatedLine[] = []
    for (const it of obj.items) {
      const en = String(it?.en ?? '').trim().slice(0, 300)
      const vi = String(it?.vi ?? '').trim().slice(0, 300)
      const key = en.toLowerCase()
      if (!en || !vi || seen.has(key)) continue
      seen.add(key)
      out.push({ vi, en })
    }
    return out.length ? out.slice(0, count) : null
  }

  const { data, engine } = await aiJson(env, { system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.8, maxTokens: 3000, parse })
  return { items: data, engine }
})

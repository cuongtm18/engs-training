import type { TranslatedLine, TranslateResult } from '~/utils/types'

const MAX_LINES = 20

const SYSTEM = `You help Vietnamese people learn everyday spoken English. You receive a numbered list of sentences; each line may be English or Vietnamese.

For every line return one element with i (the line number), vi and en:
- If the line is English: en = the original sentence (only fix clear typos or capitalization, keep the meaning), vi = a natural Vietnamese translation that fits an everyday conversation.
- If the line is Vietnamese: vi = the original sentence, en = a NATURAL English translation, the way a native speaker would really say it (not word for word).
- Keep the same count and order: exactly one output element per input line.

Reply with JSON that matches the schema and nothing else.`

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, vi: { type: 'string' }, en: { type: 'string' } },
        required: ['i', 'vi', 'en'],
      },
    },
  },
  required: ['items'],
} as const

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  assertAccess(event, env)

  const body = await readBody<{ lines?: unknown }>(event)
  const lines = Array.isArray(body?.lines) ? body.lines.map((l) => String(l).trim()).filter(Boolean) : []
  if (!lines.length || lines.length > MAX_LINES || lines.some((l) => l.length > 300)) throw badRequest(`Translate at most ${MAX_LINES} lines at a time, each up to 300 characters.`)

  const parse = (obj: any): TranslatedLine[] | null => {
    if (!Array.isArray(obj?.items)) return null
    const out: TranslatedLine[] = lines.map(() => ({ vi: '', en: '' }))
    let hit = 0
    obj.items.forEach((it: any, pos: number) => {
      // ưu tiên số thứ tự mô hình trả về, nếu thiếu thì dùng vị trí
      const idx = Number.isInteger(it?.i) ? it.i - 1 : pos
      const vi = String(it?.vi ?? '').trim().slice(0, 400)
      const en = String(it?.en ?? '').trim().slice(0, 400)
      if (idx >= 0 && idx < lines.length && vi && en && !out[idx]!.en) {
        out[idx] = { vi, en }
        hit++
      }
    })
    return hit ? out : null
  }

  const prompt = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
  const { data, engine } = await aiJson(env, { system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.2, maxTokens: 2500, parse })
  return { items: data, engine } satisfies TranslateResult
})

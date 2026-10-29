import type { TranslateResult } from '~/utils/types'

const SYSTEM = `Bạn là người bản xứ nói tiếng Anh, giúp người Việt học tiếng Anh giao tiếp hằng ngày.
Dịch câu tiếng Việt người dùng đưa sang tiếng Anh TỰ NHIÊN, đúng cách người bản xứ nói trong hội thoại đời thường (không dịch sát từng chữ).

en: bản dịch tự nhiên nhất.
alternatives: tối đa 3 cách nói khác cũng tự nhiên (có thể để mảng rỗng).
note: tối đa 1 câu tiếng Việt về điểm đáng chú ý (cụm từ hay, khác biệt Anh-Mỹ, lưu ý ngữ pháp). Để chuỗi rỗng nếu không cần.

Chỉ trả về JSON đúng schema, không thêm chữ nào khác.`

const SCHEMA = {
  type: 'object',
  properties: {
    en: { type: 'string' },
    alternatives: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: ['en', 'alternatives', 'note'],
} as const

function parse(obj: any): Omit<TranslateResult, 'engine'> | null {
  const en = String(obj?.en ?? '').trim()
  if (!en) return null
  const alternatives = Array.isArray(obj.alternatives)
    ? obj.alternatives.map((s: unknown) => String(s).trim()).filter((s: string) => s && s !== en).slice(0, 3)
    : []
  return { en: en.slice(0, 400), alternatives, note: String(obj.note ?? '').trim().slice(0, 300) }
}

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  assertAccess(event, env)

  const body = await readBody<{ text?: string }>(event)
  const text = String(body?.text ?? '').trim()
  if (!text || text.length > 300) throw badRequest()

  const { data, engine } = await aiJson(env, { system: SYSTEM, prompt: `Câu tiếng Việt: ${text}`, schema: SCHEMA, temperature: 0.3, parse })
  return { ...data, engine } satisfies TranslateResult
})

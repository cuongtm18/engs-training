import type { TranslatedLine, TranslateResult } from '~/utils/types'

const MAX_LINES = 20

const SYSTEM = `Bạn giúp người Việt học tiếng Anh giao tiếp hằng ngày. Bạn nhận một danh sách câu được đánh số, mỗi dòng có thể là tiếng Anh hoặc tiếng Việt.

Với mỗi dòng, trả về một phần tử gồm i (số thứ tự của dòng), vi, en:
- Nếu dòng là tiếng Anh: en = câu gốc (chỉ sửa lỗi chính tả hoặc viết hoa rõ ràng, giữ nguyên ý), vi = bản dịch tiếng Việt tự nhiên, đúng ngữ cảnh hội thoại.
- Nếu dòng là tiếng Việt: vi = câu gốc, en = bản dịch tiếng Anh TỰ NHIÊN như người bản xứ nói trong đời thường (không dịch sát từng chữ).
- Giữ nguyên số lượng và thứ tự: mỗi dòng đầu vào đúng một phần tử đầu ra.

Chỉ trả về JSON đúng schema, không thêm chữ nào khác.`

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
  if (!lines.length || lines.length > MAX_LINES || lines.some((l) => l.length > 300)) throw badRequest(`Mỗi lần dịch tối đa ${MAX_LINES} dòng, mỗi dòng tối đa 300 ký tự.`)

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

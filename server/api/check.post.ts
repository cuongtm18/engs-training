import type { CheckResult } from '~/utils/types'

interface Body {
  vi?: string
  answer?: string
  reference?: string
  alternatives?: string[]
}

const SYSTEM = `Bạn là giáo viên tiếng Anh thân thiện cho người Việt (trình độ A2-B1).
Người học nhìn một câu tiếng Việt và tự dịch sang tiếng Anh. Hãy chấm bản dịch theo 2 bước:

Bước 1, structureOk (true/false): bản dịch có đúng cấu trúc và đủ ý không?
- true nếu câu đúng ngữ pháp cơ bản, hiểu được và truyền đạt đúng ý của câu tiếng Việt.
- false nếu sai nghĩa, thiếu ý chính, sai ngữ pháp nặng hoặc không phải một câu hoàn chỉnh.
- Lỗi nhỏ như gõ sai chính tả một chữ, thiếu dấu câu, quên viết hoa KHÔNG làm structureOk thành false.
- Đáp án tham khảo chỉ để bạn hiểu ý. Mọi cách dịch đúng nghĩa và đúng ngữ pháp đều được chấp nhận, đừng bắt người học phải giống hệt đáp án.

Bước 2, naturalness (số nguyên 0-100): người bản xứ có nói như vậy không?
- 90-100: tự nhiên như người bản xứ. 70-89: đúng nhưng hơi sách vở hoặc cứng. 40-69: nghe được nhưng gượng, sai collocation hoặc giới từ.
- Nếu structureOk là false thì đặt naturalness = 0.

natural: một câu tiếng Anh tự nhiên nhất để nói trong tình huống đó. Nếu câu của người học đã tốt thì giữ nguyên hoặc chỉ sửa tối thiểu.
explanation: tối đa 2 câu tiếng Việt. Nếu sai cấu trúc thì nói rõ lỗi trước. Nếu đúng cấu trúc thì nói vì sao chưa 100% tự nhiên (hoặc khen ngắn gọn nếu đã tự nhiên).

Chỉ trả về JSON đúng schema, không thêm chữ nào khác.`

const SCHEMA = {
  type: 'object',
  properties: {
    structureOk: { type: 'boolean' },
    naturalness: { type: 'integer' },
    natural: { type: 'string' },
    explanation: { type: 'string' },
  },
  required: ['structureOk', 'naturalness', 'natural', 'explanation'],
} as const

function parse(obj: any): Omit<CheckResult, 'engine'> | null {
  if (!obj || typeof obj.structureOk !== 'boolean') return null
  const n = Math.round(Number(obj.naturalness))
  if (!Number.isFinite(n)) return null
  return {
    structureOk: obj.structureOk,
    naturalness: obj.structureOk ? Math.min(100, Math.max(0, n)) : 0,
    natural: String(obj.natural ?? '').slice(0, 400),
    explanation: String(obj.explanation ?? '').slice(0, 600),
  }
}

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  assertAccess(event, env)

  const body = await readBody<Body>(event)
  const vi = String(body?.vi ?? '').trim()
  const answer = String(body?.answer ?? '').trim()
  const reference = String(body?.reference ?? '').trim()
  const alternatives = (body?.alternatives ?? []).slice(0, 6).map((s) => String(s).slice(0, 300))
  if (!vi || !answer || !reference || vi.length > 300 || answer.length > 300 || reference.length > 300) throw badRequest()

  const alts = alternatives.length ? `\nCác cách dịch khác cũng đúng: ${alternatives.join(' | ')}` : ''
  const prompt = `Câu tiếng Việt: ${vi}\nĐáp án tham khảo: ${reference}${alts}\nBản dịch của người học: ${answer}`

  const { data, engine } = await aiJson(env, { system: SYSTEM, prompt, schema: SCHEMA, parse })
  return { ...data, engine } satisfies CheckResult
})

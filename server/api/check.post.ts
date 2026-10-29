import type { CheckResult, Verdict } from '~/utils/types'

interface Body {
  vi?: string
  answer?: string
  reference?: string
  alternatives?: string[]
}

interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  WORKERS_AI_MODEL?: string
  ACCESS_CODE?: string
  AI?: { run: (model: string, input: unknown) => Promise<any> }
}

const SYSTEM = `Bạn là giáo viên tiếng Anh thân thiện cho người Việt (trình độ A2-B1).
Người học nhìn một câu tiếng Việt và tự dịch sang tiếng Anh. Hãy chấm bản dịch.

verdict:
- "perfect": đúng nghĩa, đúng ngữ pháp và nghe tự nhiên.
- "good": đúng nghĩa và hiểu được, nhưng còn lỗi nhỏ hoặc nghe chưa tự nhiên.
- "wrong": sai nghĩa, thiếu ý chính hoặc sai ngữ pháp nặng.

natural: một câu tiếng Anh tự nhiên nhất để nói trong tình huống đó. Nếu câu của người học đã tốt thì giữ nguyên hoặc chỉ sửa tối thiểu.
explanation: tối đa 2 câu tiếng Việt, chỉ rõ lỗi cụ thể và vì sao bản "natural" hay hơn. Nếu perfect thì khen ngắn gọn hoặc gợi ý một cách nói thay thế.

Chỉ trả về JSON đúng schema, không thêm chữ nào khác.`

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['perfect', 'good', 'wrong'] },
    natural: { type: 'string' },
    explanation: { type: 'string' },
  },
  required: ['verdict', 'natural', 'explanation'],
}

function buildPrompt(b: Required<Pick<Body, 'vi' | 'answer' | 'reference'>> & { alternatives: string[] }) {
  const alts = b.alternatives.length ? `\nCác đáp án chấp nhận được khác: ${b.alternatives.join(' | ')}` : ''
  return `Câu tiếng Việt: ${b.vi}\nĐáp án tham khảo: ${b.reference}${alts}\nBản dịch của người học: ${b.answer}`
}

function parseResult(raw: unknown): Omit<CheckResult, 'engine'> | null {
  let obj: any = raw
  if (typeof raw === 'string') {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      obj = JSON.parse(m[0])
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const verdict = obj.verdict as Verdict
  if (!['perfect', 'good', 'wrong'].includes(verdict)) return null
  return {
    verdict,
    natural: String(obj.natural ?? '').slice(0, 400),
    explanation: String(obj.explanation ?? '').slice(0, 600),
  }
}

async function viaGemini(env: Env, prompt: string): Promise<CheckResult> {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            verdict: { type: 'STRING', enum: ['perfect', 'good', 'wrong'] },
            natural: { type: 'STRING' },
            explanation: { type: 'STRING' },
          },
          required: ['verdict', 'natural', 'explanation'],
        },
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`gemini ${res.status}`)
  const data: any = await res.json()
  const parsed = parseResult(data?.candidates?.[0]?.content?.parts?.[0]?.text)
  if (!parsed) throw new Error('gemini: bad output')
  return { ...parsed, engine: 'gemini' }
}

async function viaWorkersAi(env: Env, prompt: string): Promise<CheckResult> {
  const model = env.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  const out = await env.AI!.run(model, {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 400,
    response_format: { type: 'json_schema', json_schema: SCHEMA },
  })
  const parsed = parseResult(out?.response ?? out)
  if (!parsed) throw new Error('workers-ai: bad output')
  return { ...parsed, engine: 'workers-ai' }
}

export default defineEventHandler(async (event) => {
  const env = ((event.context as any).cloudflare?.env ?? process.env) as Env

  if (env.ACCESS_CODE && getHeader(event, 'x-access-code') !== env.ACCESS_CODE) {
    throw createError({ statusCode: 401, statusMessage: 'Sai mã truy cập' })
  }

  const body = await readBody<Body>(event)
  const vi = String(body?.vi ?? '').trim()
  const answer = String(body?.answer ?? '').trim()
  const reference = String(body?.reference ?? '').trim()
  const alternatives = (body?.alternatives ?? []).slice(0, 6).map((s) => String(s).slice(0, 300))
  if (!vi || !answer || !reference || vi.length > 300 || answer.length > 300 || reference.length > 300) {
    throw createError({ statusCode: 400, statusMessage: 'Dữ liệu không hợp lệ' })
  }

  const prompt = buildPrompt({ vi, answer, reference, alternatives })
  const errors: string[] = []

  if (env.GEMINI_API_KEY) {
    try {
      return await viaGemini(env, prompt)
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  if (env.AI) {
    try {
      return await viaWorkersAi(env, prompt)
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  throw createError({
    statusCode: 503,
    statusMessage: errors.length ? `AI lỗi: ${errors.join('; ')}` : 'Chưa cấu hình AI (GEMINI_API_KEY hoặc binding AI)',
  })
})

import type { H3Event } from 'h3'

export interface AiEnv {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  WORKERS_AI_MODEL?: string
  ACCESS_CODE?: string
  AI?: { run: (model: string, input: unknown) => Promise<any> }
}

/** Schema JSON dạng chuẩn (type viết thường), tự đổi sang kiểu của Gemini khi gọi. */
export type JsonSchema = {
  type: 'object' | 'string' | 'integer' | 'boolean' | 'array'
  properties?: Readonly<Record<string, JsonSchema>>
  items?: JsonSchema
  required?: readonly string[]
}

export type Engine = 'gemini' | 'workers-ai'

export function getEnv(event: H3Event): AiEnv {
  return ((event.context as any).cloudflare?.env ?? process.env) as AiEnv
}

export function assertAccess(event: H3Event, env: AiEnv) {
  if (env.ACCESS_CODE && getHeader(event, 'x-access-code') !== env.ACCESS_CODE) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { detail: 'Sai mã truy cập: hãy nhập đúng ACCESS_CODE trong ⚙️ Cài đặt.' },
    })
  }
}

export function badRequest(detail = 'Dữ liệu gửi lên không hợp lệ.') {
  return createError({ statusCode: 400, statusMessage: 'Bad Request', data: { detail } })
}

function toGeminiSchema(s: JsonSchema): any {
  const out: any = { type: s.type.toUpperCase() }
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]))
  if (s.items) out.items = toGeminiSchema(s.items)
  if (s.required) out.required = [...s.required]
  return out
}

function extractJson(raw: unknown): any | null {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

async function callGemini(env: AiEnv, model: string, system: string, prompt: string, schema: JsonSchema, temperature: number) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) },
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw Object.assign(new Error(`${model} ${res.status}`), { status: res.status })
  const data: any = await res.json()
  const obj = extractJson(data?.candidates?.[0]?.content?.parts?.[0]?.text)
  if (!obj) throw new Error(`${model}: bad output`)
  return obj
}

// Model bị từ chối vì không có trong gói của key (402/403) hoặc không tồn tại (404) thì nhớ lại 1 giờ để khỏi gọi lại.
const unavailable = new Map<string, number>()
const SKIP_MS = 3_600_000

// Thử lần lượt các model. Chuyển sang model kế tiếp khi model không dùng được với key này
// (402/403/404), hết hạn mức (429) hoặc quá tải (5xx); các lỗi khác (vd 400 sai key) thì dừng.
async function viaGemini(env: AiEnv, system: string, prompt: string, schema: JsonSchema, temperature: number) {
  const errors: string[] = []
  const now = Date.now()
  for (const model of await pickGeminiModels(env)) {
    if ((unavailable.get(model) ?? 0) > now) continue
    try {
      return await callGemini(env, model, system, prompt, schema, temperature)
    } catch (e) {
      errors.push((e as Error).message)
      const status = (e as { status?: number }).status ?? 0
      if ([402, 403, 404].includes(status)) unavailable.set(model, now + SKIP_MS)
      else if (status && status !== 429 && status < 500) break
    }
  }
  const hint = errors.some((m) => m.endsWith(' 402'))
    ? ' (402: project của key này đang ở gói trả phí và hết credit; hãy dùng key của project không gắn billing để được free)'
    : ''
  throw new Error(`gemini: ${errors.join(', ') || 'không có model nào dùng được với key này'}${hint}`)
}

async function viaWorkersAi(env: AiEnv, system: string, prompt: string, schema: JsonSchema, temperature: number) {
  const model = env.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  const out = await env.AI!.run(model, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: 500,
    response_format: { type: 'json_schema', json_schema: schema },
  })
  const obj = extractJson(out?.response ?? out)
  if (!obj) throw new Error('workers-ai: bad output')
  return obj
}

/**
 * Gọi AI trả về JSON: Gemini trước, dự phòng Workers AI. `parse` kiểm tra và chuẩn hóa kết quả,
 * trả null nếu dữ liệu không hợp lệ.
 */
export async function aiJson<T>(
  env: AiEnv,
  opts: { system: string; prompt: string; schema: JsonSchema; temperature?: number; parse: (raw: any) => T | null },
): Promise<{ data: T; engine: Engine }> {
  const { system, prompt, schema, temperature = 0.2, parse } = opts
  const errors: string[] = []

  if (env.GEMINI_API_KEY) {
    try {
      const data = parse(await viaGemini(env, system, prompt, schema, temperature))
      if (data) return { data, engine: 'gemini' }
      errors.push('gemini: kết quả không đúng định dạng')
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  if (env.AI) {
    try {
      const data = parse(await viaWorkersAi(env, system, prompt, schema, temperature))
      if (data) return { data, engine: 'workers-ai' }
      errors.push('workers-ai: kết quả không đúng định dạng')
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  // statusMessage phải là ASCII (Cloudflare từ chối ký tự khác trong header), nội dung tiếng Việt để trong data.
  throw createError({
    statusCode: 503,
    statusMessage: 'AI unavailable',
    data: {
      detail: errors.length
        ? `AI báo lỗi: ${errors.join('; ')}`
        : 'Server chưa thấy GEMINI_API_KEY hoặc binding AI. Kiểm tra biến môi trường (Production) rồi deploy lại.',
    },
  })
}

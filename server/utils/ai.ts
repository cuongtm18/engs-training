import type { H3Event } from 'h3'

export interface AiEnv {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  WORKERS_AI_MODEL?: string
  ACCESS_CODE?: string
  AI?: { run: (model: string, input: unknown) => Promise<any> }
}

/** Standard JSON schema (lowercase types); converted to Gemini's format when calling. */
export type JsonSchema = {
  type: 'object' | 'string' | 'integer' | 'boolean' | 'array'
  properties?: Readonly<Record<string, JsonSchema>>
  items?: JsonSchema
  required?: readonly string[]
}

export type Engine = 'gemini' | 'workers-ai'

export function getEnv(event: H3Event): AiEnv {
  const env = ((event.context as any).cloudflare?.env ?? process.env) as AiEnv
  // Keys pasted into a dashboard often carry stray spaces/newlines, which makes Google answer 401.
  return { ...env, GEMINI_API_KEY: env.GEMINI_API_KEY?.trim() || undefined, GEMINI_MODEL: env.GEMINI_MODEL?.trim() || undefined }
}

export function assertAccess(event: H3Event, env: AiEnv) {
  if (env.ACCESS_CODE && getHeader(event, 'x-access-code') !== env.ACCESS_CODE) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { detail: 'Wrong access code: enter the correct ACCESS_CODE in ⚙️ Settings.' },
    })
  }
}

export function badRequest(detail = 'Invalid request data.') {
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

async function callGemini(env: AiEnv, model: string, system: string, prompt: string, schema: JsonSchema, temperature: number, useSchema = true) {
  // Nếu Google từ chối schema (400) thì mô tả schema ngay trong lời nhắc thay vì dùng responseSchema.
  const sys = useSchema ? system : `${system}\n\nReply with exactly one JSON object that matches this schema:\n${JSON.stringify(schema)}`
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        ...(useSchema ? { responseSchema: toGeminiSchema(schema) } : {}),
      },
    }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) {
    if (res.status === 400 && useSchema) return callGemini(env, model, system, prompt, schema, temperature, false)
    let msg = ''
    try {
      msg = String(((await res.json()) as any)?.error?.message ?? '').replace(/\s+/g, ' ').slice(0, 160)
    } catch {
      /* error body not readable */
    }
    throw Object.assign(new Error(`${model} ${res.status}${msg ? ` (${msg})` : ''}`), { status: res.status })
  }
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
  const hint = errors.some((m) => / 402\b/.test(m))
    ? ' (402: the project behind this key is on a paid plan and out of credit; use a key from a project without billing to stay on the free tier)'
    : errors.some((m) => / 401\b/.test(m))
      ? ' (401: Google rejected the API key; re-create it in AI Studio and paste it again without spaces)'
      : ''
  throw new Error(`gemini: ${errors.join(', ') || 'no model is usable with this key'}${hint}`)
}

// Cloudflare gỡ model theo lịch (llama-3.1-8b-instruct đã bị gỡ 2026-05-30) nên thử lần lượt vài model.
// Đặt WORKERS_AI_MODEL để chọn model riêng, nó luôn được thử đầu tiên.
const WORKERS_AI_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
]
const aiUnavailable = new Map<string, number>()

async function viaWorkersAi(env: AiEnv, system: string, prompt: string, schema: JsonSchema, temperature: number, maxTokens: number) {
  const errors: string[] = []
  const now = Date.now()
  const models = [...new Set([env.WORKERS_AI_MODEL?.trim(), ...WORKERS_AI_MODELS].filter(Boolean) as string[])]
  for (const model of models) {
    if ((aiUnavailable.get(model) ?? 0) > now) continue
    try {
      const out = await env.AI!.run(model, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_schema', json_schema: schema },
      })
      const obj = extractJson(out?.response ?? out)
      if (obj) return obj
      errors.push(`${model}: bad output`)
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      errors.push(`${model}: ${msg.replace(/\s+/g, ' ').slice(0, 120)}`)
      if (/deprecat|not found|no such model|unavailable|5007|5028/i.test(msg)) aiUnavailable.set(model, now + SKIP_MS)
    }
  }
  throw new Error(`workers-ai: ${errors.join('; ')}`)
}

/**
 * Call an AI for JSON: Gemini first, Workers AI as the fallback. `parse` validates and normalizes the
 * result and returns null when the data is invalid.
 */
export async function aiJson<T>(
  env: AiEnv,
  opts: { system: string; prompt: string; schema: JsonSchema; temperature?: number; maxTokens?: number; parse: (raw: any) => T | null },
): Promise<{ data: T; engine: Engine }> {
  const { system, prompt, schema, temperature = 0.2, maxTokens = 500, parse } = opts
  const errors: string[] = []

  if (env.GEMINI_API_KEY) {
    try {
      const data = parse(await viaGemini(env, system, prompt, schema, temperature))
      if (data) return { data, engine: 'gemini' }
      errors.push('gemini: unexpected output format')
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  if (env.AI) {
    try {
      const data = parse(await viaWorkersAi(env, system, prompt, schema, temperature, maxTokens))
      if (data) return { data, engine: 'workers-ai' }
      errors.push('workers-ai: unexpected output format')
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
        ? `AI error: ${errors.join('; ')}`
        : 'The server sees no GEMINI_API_KEY or AI binding. Check the Production environment variables, then redeploy.',
    },
  })
}

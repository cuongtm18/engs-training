interface ModelInfo {
  name?: string
  supportedGenerationMethods?: string[]
}

const SKIP = /(image|tts|audio|live|embedding|vision|robotics|computer|exp|learnlm|gemma|aqa|thinking)/
// Alias do Google duy trì, dùng làm phương án cuối nếu không liệt kê được model.
const ALIASES = ['gemini-flash-lite-latest', 'gemini-flash-latest']

let cache: { at: number; key: string; models: string[] } | undefined

function rank(id: string): [number, number, number] {
  const version = Number(id.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  const preview = /preview/.test(id) ? 1 : 0
  const lite = /flash-lite/.test(id) ? 0 : 1
  return [preview, lite, -version]
}

/**
 * Danh sách model Gemini để thử theo thứ tự ưu tiên: bản ổn định trước, flash-lite trước flash
 * (higher free quota), rồi version mới trước. GEMINI_MODEL (nếu đặt) luôn được thử đầu tiên.
 */
export async function pickGeminiModels(env: { GEMINI_API_KEY?: string; GEMINI_MODEL?: string }): Promise<string[]> {
  const forced = env.GEMINI_MODEL?.trim()
  const key = env.GEMINI_API_KEY!
  let discovered: string[] = []

  if (cache && cache.key === key && Date.now() - cache.at < 3_600_000) {
    discovered = cache.models
  } else {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(8_000),
      })
      if (res.ok) {
        const data = (await res.json()) as { models?: ModelInfo[] }
        discovered = (data.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => (m.name ?? '').replace(/^models\//, ''))
          .filter((id) => /^gemini-[\d.]+-flash(-lite)?(-[a-z0-9-]+)?$/.test(id) && !SKIP.test(id))
          .sort((a, b) => {
            const ra = rank(a)
            const rb = rank(b)
            return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || a.localeCompare(b)
          })
          .slice(0, 3)
        cache = { at: Date.now(), key, models: discovered }
      }
    } catch {
      /* dùng alias bên dưới */
    }
  }

  return [...new Set([...(forced ? [forced] : []), ...discovered, ...ALIASES])]
}

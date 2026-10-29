interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  ACCESS_CODE?: string
  AI?: unknown
}

// Chỉ trả về cờ true/false, không lộ giá trị bí mật.
export default defineEventHandler((event) => {
  const env = ((event.context as any).cloudflare?.env ?? process.env) as Env
  return {
    gemini: Boolean(env.GEMINI_API_KEY),
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    workersAi: Boolean(env.AI),
    accessCodeRequired: Boolean(env.ACCESS_CODE),
  }
})

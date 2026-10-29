interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  ACCESS_CODE?: string
  AI?: unknown
}

// Chỉ trả về cờ true/false và tên model, không lộ giá trị bí mật.
export default defineEventHandler(async (event) => {
  const env = ((event.context as any).cloudflare?.env ?? process.env) as Env
  return {
    gemini: Boolean(env.GEMINI_API_KEY),
    geminiModels: env.GEMINI_API_KEY ? await pickGeminiModels(env) : [],
    workersAi: Boolean(env.AI),
    accessCodeRequired: Boolean(env.ACCESS_CODE),
  }
})

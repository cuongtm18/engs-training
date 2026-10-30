import type { CheckResult } from '~/utils/types'
// Nitro only auto-imports server/utils; the client utils/ folder must be imported explicitly.
import { hasVietnamese } from '../../utils/text'

interface Body {
  vi?: string
  answer?: string
  reference?: string
  alternatives?: string[]
}

const SYSTEM = `You are a friendly English teacher for a Vietnamese learner (level A2-B1).
The learner sees a Vietnamese sentence and translates it into English. Grade the translation in two steps.

Step 1, structureOk (true/false): is the structure correct and is the meaning complete?
- true if the sentence is grammatically sound enough to be understood and conveys the meaning of the Vietnamese sentence.
- false if the meaning is wrong, a key idea is missing, the grammar is badly broken, or it is not a complete sentence.
- Small slips such as one misspelled word, missing punctuation or missing capital letters do NOT make structureOk false, but they do lower naturalness (a wrong word form such as "vary" instead of "variety" caps naturalness at about 75).
- The reference answer is only a hint about the intended meaning. Accept every translation that is correct in meaning and grammar; never require it to match the reference.

Step 2, naturalness (integer 0-100): would a native speaker actually say it this way?
- 90-100: sounds native. 70-89: correct but a bit textbook or stiff. 40-69: understandable but awkward, with wrong collocations or prepositions.
- If structureOk is false, set naturalness to 0.

natural: the single most natural ENGLISH sentence for this situation. It must be written in English only, never in Vietnamese, because the learner is translating INTO English. If the learner's sentence is already good, keep it or change it minimally.
Only the explanation field is in VIETNAMESE (the learner is Vietnamese, level A2-B1), at most 2 short, friendly sentences. The explanation mixes Vietnamese and English naturally: write the sentence in Vietnamese, but EVERY English word, phrase or sentence you mention (the learner's words, the missing or wrong word, the correction, the natural version) must stay in English inside single quotes. NEVER translate a quoted English word into Vietnamese. If the structure is wrong, name the specific mistake first. If the structure is fine, say why it is not 100% natural, or give brief praise if it is natural.

Example of a good explanation.
Vietnamese sentence: "Bên bạn có cái nhỏ hơn không?" / learner wrote: "Do you have a small one" / natural: "Do you have a smaller one?"
explanation: "Câu của bạn thiếu từ 'smaller' (dạng so sánh hơn của 'small'), nhưng vẫn hiểu được ý. Nói 'Do you have a smaller one?' sẽ đúng và tự nhiên hơn."
Bad: "Câu của bạn thiếu từ 'nhỏ hơn'..." (the quoted word is Vietnamese instead of English).

Reply with JSON that matches the schema and nothing else.`

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

  const alts = alternatives.length ? `\nOther accepted translations: ${alternatives.join(' | ')}` : ''
  const prompt = `Vietnamese sentence: ${vi}\nReference answer: ${reference}${alts}\nLearner's translation: ${answer}`

  const { data, engine } = await aiJson(env, { system: SYSTEM, prompt, schema: SCHEMA, parse })
  // The model sometimes answers the "natural" field in Vietnamese. It must be English, so fall back to the reference sentence.
  if (hasVietnamese(data.natural)) data.natural = reference
  return { ...data, engine } satisfies CheckResult
})

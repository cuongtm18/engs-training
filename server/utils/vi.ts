/**
 * Small models sometimes return mangled Vietnamese ("tFdi chei" for "tôi chơi"): capitals in the middle of a
 * word, stray symbols, or a long sentence with no diacritics at all. Treat those as untranslated.
 */
export function looksGarbledVi(vi: string): boolean {
  const s = vi.trim()
  if (!s) return true
  if (/\p{Ll}\p{Lu}/u.test(s)) return true
  if (/[^\p{L}\p{N}\s.,!?'"’‘“”\-–—:;()…%$&\/]/u.test(s)) return true
  if (s.length >= 12 && !/[^\u0000-ɏ]|[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(s)) return true
  return false
}

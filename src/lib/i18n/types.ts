// Supported locales. `zh` is the default and matches values stored in Supabase.
// English ('en') is a display translation only — stored values stay Chinese.
export const LOCALES = ['zh', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'zh'
export const LOCALE_STORAGE_KEY = 'kol-tracker.locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

// Locale-aware date formatting helpers. Wrap date-fns so call sites don't
// each have to thread the locale through.

import { format, formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import type { Locale } from './types'

const DATE_FNS_LOCALES = {
  zh: zhCN,
  en: enUS,
} as const

export function getDateFnsLocale(locale: Locale) {
  return DATE_FNS_LOCALES[locale]
}

export function formatRelative(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: DATE_FNS_LOCALES[locale] })
}

export function formatShortDateTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MM-dd HH:mm', { locale: DATE_FNS_LOCALES[locale] })
}

export function formatToday(locale: Locale): string {
  return new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')
}

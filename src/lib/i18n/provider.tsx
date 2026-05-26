'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from './types'
import { zh } from './dictionaries/zh'
import { en } from './dictionaries/en'
import type { Dictionary } from './dictionaries/types'
import {
  STAGE_LABELS, DEAL_TYPE_LABELS, CONTACT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS, KANBAN_COLUMN_LABELS, CATEGORY_LABELS,
} from './dictionaries/data-labels'
import type { InfluencerStage, DealType, ContactMethod, PaymentStatus, KanbanColumnId } from '@/types/database'

const DICTIONARIES: Record<Locale, Dictionary> = { zh, en }

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  dict: Dictionary
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface LanguageProviderProps {
  children: React.ReactNode
  /** Optional initial locale read from cookie/header on the server. */
  initialLocale?: Locale
}

export function LanguageProvider({ children, initialLocale }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)

  // Hydrate from localStorage after mount. The first paint stays consistent
  // with SSR (default zh); a single switch may happen post-hydration if the
  // user's saved preference differs. Component state (filters, kanban,
  // detail page) is preserved through the swap because only labels rerender.
  //
  // We deliberately use useEffect → setState (not lazy useState init) so the
  // server render and the client's first render agree — a lazy initializer
  // that reads localStorage on the client would cause a hydration mismatch
  // for any locale-dependent text in the initial HTML.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY)
      if (saved && isLocale(saved) && saved !== locale) {
        // Post-hydration sync from localStorage; intentional (see comment above).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(saved)
      }
    } catch {
      // localStorage may be unavailable (privacy mode); silently fall back.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
      } catch {
        // ignore
      }
      // Update the <html lang> attribute so screen readers / browser features
      // pick up the new language without a page reload.
      const htmlEl = document.documentElement
      htmlEl.setAttribute('lang', next === 'zh' ? 'zh-CN' : 'en')
    }
  }, [])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    dict: DICTIONARIES[locale],
  }), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Defensive fallback — components rendered outside the provider use the
    // default locale dictionary. This keeps utility components resilient
    // during testing or storybook-style isolation.
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, dict: DICTIONARIES[DEFAULT_LOCALE] }
  }
  return ctx
}

/** Substitute `{key}` placeholders. Missing keys are left as-is. */
function formatTemplate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in params ? String(params[key]) : match
  })
}

/** Resolve a dotted path inside the dictionary; returns the path itself if missing. */
function resolvePath(dict: Dictionary, path: string): string {
  const parts = path.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return path
    }
  }
  return typeof cur === 'string' ? cur : path
}

export interface UseTranslationResult {
  locale: Locale
  setLocale: (l: Locale) => void
  /** Translate a dotted-path key with optional `{param}` substitution. */
  t: (key: string, params?: Record<string, string | number>) => string
  /** Stage label translator — keys remain stored Chinese values. */
  tStage: (s: InfluencerStage) => string
  tDealType: (d: DealType | null | undefined) => string
  tContactMethod: (m: ContactMethod) => string
  tPaymentStatus: (p: PaymentStatus) => string
  tKanbanColumn: (id: KanbanColumnId) => string
  /** Category label translator — falls back to the original string when unmapped. */
  tCategory: (c: string | null | undefined) => string
}

export function useTranslation(): UseTranslationResult {
  const { locale, setLocale, dict } = useI18nContext()

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      formatTemplate(resolvePath(dict, key), params),
    [dict],
  )

  const tStage = useCallback((s: InfluencerStage) => STAGE_LABELS[locale][s] ?? s, [locale])
  const tDealType = useCallback(
    (d: DealType | null | undefined) => (d ? DEAL_TYPE_LABELS[locale][d] ?? d : ''),
    [locale],
  )
  const tContactMethod = useCallback((m: ContactMethod) => CONTACT_METHOD_LABELS[locale][m] ?? m, [locale])
  const tPaymentStatus = useCallback((p: PaymentStatus) => PAYMENT_STATUS_LABELS[locale][p] ?? p, [locale])
  const tKanbanColumn = useCallback((id: KanbanColumnId) => KANBAN_COLUMN_LABELS[locale][id] ?? id, [locale])
  const tCategory = useCallback(
    (c: string | null | undefined) => {
      if (!c) return ''
      return CATEGORY_LABELS[locale][c] ?? c
    },
    [locale],
  )

  return { locale, setLocale, t, tStage, tDealType, tContactMethod, tPaymentStatus, tKanbanColumn, tCategory }
}

/** Hook variant that returns just the locale (avoids re-render churn for
 *  components that only need date-fns locale or formatters). */
export function useLocale(): Locale {
  return useI18nContext().locale
}

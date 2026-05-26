'use client'

import { useTranslation } from '@/lib/i18n/provider'
import { Languages } from 'lucide-react'

/**
 * Floating top-right language toggle. Renders for every page (login + dashboard)
 * because it lives in the root layout. Click flips between zh and en; the
 * choice persists to localStorage. No URL changes, no route restructure —
 * filters / kanban / detail-page state survive the swap.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation()

  function toggle() {
    setLocale(locale === 'zh' ? 'en' : 'zh')
  }

  const next = locale === 'zh' ? 'EN' : '中'
  const aria = locale === 'zh' ? 'Switch to English' : '切换到中文'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={aria}
      title={t('common.languageLabel')}
      className="fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-gray-200 bg-white/90 backdrop-blur text-xs font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-white shadow-sm transition-colors"
    >
      <Languages className="h-3.5 w-3.5" />
      <span>{next}</span>
    </button>
  )
}

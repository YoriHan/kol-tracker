'use client'

import { useTranslation } from '@/lib/i18n/provider'
import { Languages } from 'lucide-react'

/**
 * Inline language toggle. Click flips between zh and en; the choice persists
 * to localStorage and updates `<html lang>`. No URL changes, no route
 * restructure — filters / kanban / detail-page state survive the swap.
 *
 * The switcher renders inline (not `position: fixed`) so it never overlaps
 * page-level action buttons. Hosts decide where to place it: the dashboard
 * mounts it inside the sidebar; the login page mounts it above the auth card.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
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
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 transition-colors ${className ?? ''}`}
    >
      <Languages className="h-3.5 w-3.5" />
      <span>{next}</span>
    </button>
  )
}

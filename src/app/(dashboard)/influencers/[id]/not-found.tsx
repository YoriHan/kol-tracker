'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/provider'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold">{t('errors.notFoundTitle')}</h2>
      <p className="text-sm text-gray-500">{t('errors.notFoundDescription')}</p>
      <Link
        href="/influencers"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
      >
        {t('errors.backToList')}
      </Link>
    </div>
  )
}

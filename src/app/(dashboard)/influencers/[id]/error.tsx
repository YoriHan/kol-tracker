'use client'

import { useTranslation } from '@/lib/i18n/provider'

export default function DetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold text-red-600">{t('errors.pageLoadFailed')}</h2>
      <p className="text-sm text-gray-500">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
      >
        {t('errors.retry')}
      </button>
    </div>
  )
}

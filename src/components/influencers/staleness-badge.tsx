'use client'

import { getStaleness, getStalenessColor } from '@/lib/staleness'
import { useTranslation } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

interface StalenessBadgeProps {
  stageEnteredAt: string
  className?: string
}

export function StalenessBadge({ stageEnteredAt, className }: StalenessBadgeProps) {
  const { t } = useTranslation()
  const { days, level } = getStaleness(stageEnteredAt)
  const label = days === 0 ? t('staleness.today') : t('staleness.days', { days })

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        getStalenessColor(level),
        className
      )}
    >
      {label}
    </span>
  )
}

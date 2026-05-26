import { differenceInDays } from 'date-fns'
import { STALENESS_THRESHOLDS } from '@/types/database'

export type StalenessLevel = 'normal' | 'warning' | 'danger'

export function getStaleness(stageEnteredAt: string): {
  days: number
  level: StalenessLevel
} {
  const days = differenceInDays(new Date(), new Date(stageEnteredAt))

  let level: StalenessLevel = 'normal'
  if (days >= STALENESS_THRESHOLDS.danger) level = 'danger'
  else if (days >= STALENESS_THRESHOLDS.warning) level = 'warning'

  return { days, level }
}

export function getStalenessColor(level: StalenessLevel): string {
  switch (level) {
    case 'danger':  return 'text-red-600 bg-red-50'
    case 'warning': return 'text-yellow-600 bg-yellow-50'
    default:        return 'text-gray-500 bg-gray-50'
  }
}

// Day-count formatting moved into the locale-aware StalenessBadge component
// (see `src/components/influencers/staleness-badge.tsx`). The badge consumes
// `staleness.days` / `staleness.today` from the i18n dictionary directly.

export function isFollowupOverdue(nextFollowupDate: string | null): boolean {
  if (!nextFollowupDate) return false
  return new Date(nextFollowupDate) < new Date()
}

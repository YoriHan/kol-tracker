import { getStaleness, getStalenessColor, getStalenessLabel } from '@/lib/staleness'
import { cn } from '@/lib/utils'

interface StalenessBadgeProps {
  stageEnteredAt: string
  className?: string
}

export function StalenessBadge({ stageEnteredAt, className }: StalenessBadgeProps) {
  const { days, level } = getStaleness(stageEnteredAt)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        getStalenessColor(level),
        className
      )}
    >
      {getStalenessLabel(days)}
    </span>
  )
}

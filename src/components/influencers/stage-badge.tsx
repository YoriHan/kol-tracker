import { Badge } from '@/components/ui/badge'
import type { InfluencerStage, KanbanColumnId } from '@/types/database'
import { KANBAN_COLUMNS } from '@/types/database'
import { cn } from '@/lib/utils'

const COLUMN_COLORS: Record<KanbanColumnId, string> = {
  outreach:   'bg-blue-50 text-blue-700 border-blue-200',
  business:   'bg-purple-50 text-purple-700 border-purple-200',
  production: 'bg-orange-50 text-orange-700 border-orange-200',
  publishing: 'bg-teal-50 text-teal-700 border-teal-200',
  finance:    'bg-green-50 text-green-700 border-green-200',
}

function getColumnForStage(stage: InfluencerStage): KanbanColumnId {
  for (const col of KANBAN_COLUMNS) {
    if ((col.stages as readonly string[]).includes(stage)) return col.id
  }
  return 'finance'
}

interface StageBadgeProps {
  stage: InfluencerStage
  className?: string
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  const colId = getColumnForStage(stage)
  return (
    <Badge
      variant="outline"
      className={cn('text-xs', COLUMN_COLORS[colId], className)}
    >
      {stage}
    </Badge>
  )
}

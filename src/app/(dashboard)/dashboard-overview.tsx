'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Users, CheckCircle, DollarSign, TrendingUp, Bell } from 'lucide-react'
import { KANBAN_COLUMNS, type KanbanColumnId } from '@/types/database'
import { useTranslation } from '@/lib/i18n/provider'

interface DashboardOverviewProps {
  totalCount: number
  newThisWeek: number
  pendingFollowup: number
  completedThisMonth: number
  pendingPayment: number
  colCounts: { id: KanbanColumnId; count: number }[]
}

export function DashboardOverview({
  totalCount, newThisWeek, pendingFollowup, completedThisMonth, pendingPayment, colCounts,
}: DashboardOverviewProps) {
  const { t, tKanbanColumn } = useTranslation()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">{t('dashboard.overview')}</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label={t('dashboard.totalCount')}
          value={totalCount}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          label={t('dashboard.newThisWeek')}
          value={newThisWeek}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Bell className="h-5 w-5 text-red-600" />}
          label={t('dashboard.pendingFollowup')}
          value={pendingFollowup}
          bg="bg-red-50"
          highlight={pendingFollowup > 0}
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          label={t('dashboard.completedThisMonth')}
          value={completedThisMonth}
          bg="bg-green-50"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-orange-600" />}
          label={t('dashboard.pendingPayment')}
          value={pendingPayment > 0 ? `¥${pendingPayment.toLocaleString()}` : t('common.dash')}
          bg="bg-orange-50"
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">{t('dashboard.stageDistribution')}</h2>
        <div className="grid grid-cols-5 gap-3">
          {colCounts.map(({ id, count }) => (
            <div key={id} className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-semibold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 mt-1">{tKanbanColumn(id)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon, label, value, bg, highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  bg: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-red-200' : ''}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`${bg} rounded-lg p-2.5 shrink-0`}>{icon}</div>
        <div>
          <div className={`text-xl font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// Re-export KANBAN_COLUMNS so the server page knows the iteration order without
// re-importing types itself.
export { KANBAN_COLUMNS }

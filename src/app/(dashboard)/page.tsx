export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { KANBAN_COLUMNS } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Users, CheckCircle, DollarSign, TrendingUp, Bell } from 'lucide-react'
import { startOfMonth, startOfWeek } from 'date-fns'

interface StatsRow {
  id: string
  current_stage: string
  payment_status: string
  invoice_amount: number | null
  updated_at: string
  created_at: string
  next_followup_date: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('influencers')
    .select('id, current_stage, payment_status, invoice_amount, updated_at, created_at, next_followup_date')

  const all: StatsRow[] = (raw ?? []) as StatsRow[]
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = startOfMonth(now).toISOString()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString()

  const totalCount = all.length
  const completedThisMonth = all.filter(
    (i) => i.current_stage === '完成' && i.updated_at >= monthStart
  ).length
  const newThisWeek = all.filter((i) => i.created_at >= weekStart).length
  const pendingFollowup = all.filter(
    (i) => i.next_followup_date != null && i.next_followup_date <= today && i.current_stage !== '完成' && i.current_stage !== '已付款'
  ).length
  const pendingPayment = all
    .filter((i) => i.payment_status === '已开票')
    .reduce((sum, i) => sum + (i.invoice_amount ?? 0), 0)

  const colCounts = KANBAN_COLUMNS.map((col) => ({
    label: col.label,
    count: all.filter((i) => (col.stages as string[]).includes(i.current_stage)).length,
  }))

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">总览</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label="红人总数"
          value={totalCount}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          label="本周新增"
          value={newThisWeek}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Bell className="h-5 w-5 text-red-600" />}
          label="待跟进"
          value={pendingFollowup}
          bg="bg-red-50"
          highlight={pendingFollowup > 0}
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          label="本月完成"
          value={completedThisMonth}
          bg="bg-green-50"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-orange-600" />}
          label="待付款"
          value={pendingPayment > 0 ? `¥${pendingPayment.toLocaleString()}` : '—'}
          bg="bg-orange-50"
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">各阶段分布</h2>
        <div className="grid grid-cols-5 gap-3">
          {colCounts.map(({ label, count }) => (
            <div key={label} className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-semibold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
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

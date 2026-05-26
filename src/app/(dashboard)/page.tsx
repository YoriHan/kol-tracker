export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { KANBAN_COLUMNS } from '@/types/database'
import { startOfMonth, startOfWeek } from 'date-fns'
import { DashboardOverview } from './dashboard-overview'

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
    id: col.id,
    count: all.filter((i) => (col.stages as string[]).includes(i.current_stage)).length,
  }))

  return (
    <DashboardOverview
      totalCount={totalCount}
      newThisWeek={newThisWeek}
      pendingFollowup={pendingFollowup}
      completedThisMonth={completedThisMonth}
      pendingPayment={pendingPayment}
      colCounts={colCounts}
    />
  )
}

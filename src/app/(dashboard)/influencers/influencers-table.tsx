'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StageBadge } from '@/components/influencers/stage-badge'
import { StalenessBadge } from '@/components/influencers/staleness-badge'
import { isFollowupOverdue } from '@/lib/staleness'
import type { Influencer, Profile, InfluencerStage } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MoreHorizontal, AlertCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface InfluencersTableProps {
  influencers: Influencer[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
  onUpdate: (updater: (prev: Influencer[]) => Influencer[]) => void
}

function formatFollowers(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function InfluencersTable({ influencers, profiles, onUpdate }: InfluencersTableProps) {
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchAssigning, setBatchAssigning] = useState(false)

  const allIds = influencers.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function batchAssign(userId: string) {
    if (selected.size === 0) return
    setBatchAssigning(true)
    const ids = Array.from(selected)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ assigned_to: userId || null })
      .in('id', ids)
    if (!error) {
      onUpdate((prev) =>
        prev.map((i) => selected.has(i.id) ? { ...i, assigned_to: userId || null } : i)
      )
      setSelected(new Set())
    }
    setBatchAssigning(false)
  }

  async function updateStage(id: string, stage: InfluencerStage) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ current_stage: stage })
      .eq('id', id)
    if (!error) {
      onUpdate((prev) =>
        prev.map((i) => (i.id === id ? { ...i, current_stage: stage } : i))
      )
    }
  }

  const stages: InfluencerStage[] = [
    '待接触','已发DM','谈判中','已签约',
    '合作中-Draft1','合作中-Draft2',
    '待发布','已发送','已发Invoice','已付款','完成',
  ]

  return (
    <div className="overflow-x-auto min-w-full">
      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3">
          <span className="text-sm text-blue-700 font-medium">已选 {selected.size} 个</span>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <Select onValueChange={batchAssign} disabled={batchAssigning}>
              <SelectTrigger className="h-7 w-36 text-xs border-blue-300">
                <SelectValue placeholder="批量分配负责人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">清除负责人</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.display_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs ml-auto"
            onClick={() => setSelected(new Set())}
          >
            取消选择
          </Button>
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-3 py-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded"
              />
            </th>
            <th className="px-4 py-3 font-medium w-48">红人</th>
            <th className="px-4 py-3 font-medium">粉丝数</th>
            <th className="px-4 py-3 font-medium">类别</th>
            <th className="px-4 py-3 font-medium">阶段</th>
            <th className="px-4 py-3 font-medium">停留时间</th>
            <th className="px-4 py-3 font-medium">负责人</th>
            <th className="px-4 py-3 font-medium">最近联系</th>
            <th className="px-4 py-3 font-medium">跟进</th>
            <th className="px-4 py-3 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {influencers.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                没有红人
              </td>
            </tr>
          )}
          {influencers.map((inf) => {
            const overdue = isFollowupOverdue(inf.next_followup_date)
            return (
              <tr key={inf.id} className={`hover:bg-gray-50 transition-colors ${selected.has(inf.id) ? 'bg-blue-50' : ''}`}>
                {/* Checkbox */}
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(inf.id)}
                    onChange={() => toggleOne(inf.id)}
                    className="rounded"
                  />
                </td>
                {/* Influencer */}
                <td className="px-4 py-3">
                  <Link
                    href={`/influencers/${inf.id}`}
                    className="flex items-center gap-2.5 group"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={inf.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(inf.display_name ?? inf.twitter_handle).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate group-hover:text-blue-600">
                        {inf.display_name ?? inf.twitter_handle}
                      </div>
                      <div className="text-xs text-gray-400">@{inf.twitter_handle}</div>
                    </div>
                  </Link>
                </td>

                {/* Followers */}
                <td className="px-4 py-3 text-gray-600">
                  {formatFollowers(inf.followers_count)}
                </td>

                {/* Category */}
                <td className="px-4 py-3">
                  {inf.category ? (
                    <Badge variant="secondary" className="text-xs">{inf.category}</Badge>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Stage */}
                <td className="px-4 py-3">
                  <StageBadge stage={inf.current_stage} />
                </td>

                {/* Staleness */}
                <td className="px-4 py-3">
                  <StalenessBadge stageEnteredAt={inf.stage_entered_at} />
                </td>

                {/* Assigned */}
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {inf.assigned_profile
                    ? inf.assigned_profile.display_name ?? inf.assigned_profile.email
                    : <span className="text-gray-300">未分配</span>}
                </td>

                {/* Last contact */}
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {inf.last_contact_date
                    ? formatDistanceToNow(new Date(inf.last_contact_date), {
                        addSuffix: true,
                        locale: zhCN,
                      })
                    : <span className="text-gray-300">—</span>}
                </td>

                {/* Followup */}
                <td className="px-4 py-3">
                  {inf.next_followup_date ? (
                    <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                      {overdue && <AlertCircle className="h-3.5 w-3.5" />}
                      {inf.next_followup_date}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <Link href={`/influencers/${inf.id}`}>
                        <DropdownMenuItem>查看详情</DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem className="text-xs text-gray-400 pointer-events-none">
                        更换阶段
                      </DropdownMenuItem>
                      {stages.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => updateStage(inf.id, s)}
                          className={inf.current_stage === s ? 'font-medium' : ''}
                        >
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

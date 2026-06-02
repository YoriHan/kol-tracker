'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StageBadge } from '@/components/influencers/stage-badge'
import { StalenessBadge } from '@/components/influencers/staleness-badge'
import { isFollowupOverdue } from '@/lib/staleness'
import type { Influencer, Profile, InfluencerStage } from '@/types/database'
import { MoreHorizontal, AlertCircle, Users, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/provider'
import { formatRelative } from '@/lib/i18n/format'

interface InfluencersTableProps {
  influencers: Influencer[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
  onUpdate: (updater: (prev: Influencer[]) => Influencer[]) => void
}

function formatFollowers(n: number | null, dash: string): string {
  if (n == null) return dash
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function InfluencersTable({ influencers, profiles, onUpdate }: InfluencersTableProps) {
  const supabase = createClient()
  const router = useRouter()
  const { t, tStage, tCategory, locale } = useTranslation()
  const dash = t('common.dash')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchAssigning, setBatchAssigning] = useState(false)
  const [batchStageing, setBatchStageing] = useState(false)

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

  // The previous versions of these handlers either swallowed write errors
  // entirely (batch ops) or "rolled back" with `onUpdate((prev) => [...prev])`,
  // which is a no-op — same items, new array reference. A failed Supabase
  // write therefore left the rows visually mutated and the user with no
  // signal that anything broke. Each handler now captures prior values
  // BEFORE the optimistic update and restores them on error.

  async function batchAssign(userId: string) {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const newAssignee = userId || null

    // Snapshot prior assignees keyed by id for rollback.
    const prevAssignees = new Map<string, string | null>()
    for (const inf of influencers) {
      if (selected.has(inf.id)) prevAssignees.set(inf.id, inf.assigned_to)
    }

    onUpdate((prev) => prev.map((i) => selected.has(i.id) ? { ...i, assigned_to: newAssignee } : i))
    setSelected(new Set())
    setBatchAssigning(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ assigned_to: newAssignee })
      .in('id', ids)
    setBatchAssigning(false)
    if (error) {
      onUpdate((prev) =>
        prev.map((i) =>
          prevAssignees.has(i.id) ? { ...i, assigned_to: prevAssignees.get(i.id) ?? null } : i
        )
      )
      if (typeof window !== 'undefined') {
        window.alert(t('influencers.errors.bulkAssignFailed', { n: ids.length }))
      }
    }
  }

  async function batchChangeStage(stage: InfluencerStage) {
    if (selected.size === 0) return
    const ids = Array.from(selected)

    // Snapshot prior stages keyed by id for rollback.
    const prevStages = new Map<string, InfluencerStage>()
    for (const inf of influencers) {
      if (selected.has(inf.id)) prevStages.set(inf.id, inf.current_stage)
    }

    onUpdate((prev) => prev.map((i) => selected.has(i.id) ? { ...i, current_stage: stage } : i))
    setSelected(new Set())
    setBatchStageing(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ current_stage: stage })
      .in('id', ids)
    setBatchStageing(false)
    if (error) {
      onUpdate((prev) =>
        prev.map((i) => {
          const prevStage = prevStages.get(i.id)
          return prevStage !== undefined ? { ...i, current_stage: prevStage } : i
        })
      )
      if (typeof window !== 'undefined') {
        window.alert(t('influencers.errors.bulkStageUpdateFailed', { n: ids.length }))
      }
    }
  }

  async function updateStage(id: string, stage: InfluencerStage) {
    const prevStage = influencers.find((i) => i.id === id)?.current_stage
    if (prevStage === undefined) return // row not in view; treat as desync, no-op.

    onUpdate((prev) =>
      prev.map((i) => (i.id === id ? { ...i, current_stage: stage } : i))
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ current_stage: stage })
      .eq('id', id)
    if (error) {
      onUpdate((prev) =>
        prev.map((i) => (i.id === id ? { ...i, current_stage: prevStage } : i))
      )
      if (typeof window !== 'undefined') {
        window.alert(t('influencers.errors.stageUpdateFailed'))
      }
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
          <span className="text-sm text-blue-700 font-medium">{t('influencers.selectedCount', { n: selected.size })}</span>
          <div className="flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-blue-500" />
            <Select onValueChange={(v) => batchChangeStage(v as InfluencerStage)} disabled={batchStageing}>
              <SelectTrigger className="h-7 w-36 text-xs border-blue-300">
                <SelectValue placeholder={t('influencers.batchChangeStage')} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (<SelectItem key={s} value={s} className="text-xs">{tStage(s)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <Select onValueChange={(v) => batchAssign(v === '__clear__' ? '' : v)} disabled={batchAssigning}>
              <SelectTrigger className="h-7 w-36 text-xs border-blue-300">
                <SelectValue placeholder={t('influencers.batchAssign')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__clear__">{t('influencers.clearAssignee')}</SelectItem>
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
            {t('influencers.clearSelection')}
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
            <th className="px-4 py-3 font-medium w-48">{t('influencers.columns.influencer')}</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">{t('influencers.columns.followers')}</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">{t('influencers.columns.category')}</th>
            <th className="px-4 py-3 font-medium">{t('influencers.columns.stage')}</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">{t('influencers.columns.staleness')}</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">{t('influencers.columns.assignee')}</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">{t('influencers.columns.lastContact')}</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">{t('influencers.columns.followup')}</th>
            <th className="px-4 py-3 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {influencers.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                {t('influencers.noInfluencers')}
              </td>
            </tr>
          )}
          {influencers.map((inf) => {
            const overdue = isFollowupOverdue(inf.next_followup_date)
            return (
              <tr
                key={inf.id}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${selected.has(inf.id) ? 'bg-blue-50' : ''}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest('input,button,[role="combobox"],[role="menu"],[role="menuitem"]')) return
                  router.push(`/influencers/${inf.id}`)
                }}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(inf.id)}
                    onChange={() => toggleOne(inf.id)}
                    className="rounded"
                  />
                </td>
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

                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                  {formatFollowers(inf.followers_count, dash)}
                </td>

                <td className="px-4 py-3 hidden md:table-cell">
                  {inf.category ? (
                    <Badge variant="secondary" className="text-xs">{tCategory(inf.category)}</Badge>
                  ) : (
                    <span className="text-gray-300">{dash}</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <StageBadge stage={inf.current_stage} />
                </td>

                <td className="px-4 py-3 hidden lg:table-cell">
                  <StalenessBadge stageEnteredAt={inf.stage_entered_at} />
                </td>

                <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">
                  {inf.assigned_profile
                    ? inf.assigned_profile.display_name ?? inf.assigned_profile.email
                    : <span className="text-gray-300">{t('common.none')}</span>}
                </td>

                <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                  {inf.last_contact_date
                    ? formatRelative(inf.last_contact_date, locale)
                    : <span className="text-gray-300">{dash}</span>}
                </td>

                <td className="px-4 py-3 hidden sm:table-cell">
                  {inf.next_followup_date ? (
                    <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                      {overdue && <AlertCircle className="h-3.5 w-3.5" />}
                      {inf.next_followup_date}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">{dash}</span>
                  )}
                </td>

                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <Link href={`/influencers/${inf.id}`}>
                        <DropdownMenuItem>{t('influencers.actions.viewDetail')}</DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem className="text-xs text-gray-400 pointer-events-none">
                        {t('influencers.actions.changeStage')}
                      </DropdownMenuItem>
                      {stages.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => updateStage(inf.id, s)}
                          className={inf.current_stage === s ? 'font-medium' : ''}
                        >
                          {tStage(s)}
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

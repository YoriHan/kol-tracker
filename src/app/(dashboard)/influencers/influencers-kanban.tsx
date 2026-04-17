'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KANBAN_COLUMNS, type Influencer, type Profile, type InfluencerStage } from '@/types/database'
import { StalenessBadge } from '@/components/influencers/staleness-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { isFollowupOverdue } from '@/lib/staleness'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface InfluencersKanbanProps {
  influencers: Influencer[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
  onUpdate: (updater: (prev: Influencer[]) => Influencer[]) => void
}

function formatFollowers(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function InfluencersKanban({ influencers, profiles, onUpdate }: InfluencersKanbanProps) {
  const supabase = createClient()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  function getInfluencersForColumn(stages: readonly InfluencerStage[]) {
    return influencers.filter((i) => (stages as string[]).includes(i.current_stage))
  }

  // Default stage when dropping into a column = first stage of that column
  function getDefaultStage(colId: string): InfluencerStage {
    const col = KANBAN_COLUMNS.find((c) => c.id === colId)
    return col ? col.stages[0] : '待接触'
  }

  async function handleDrop(colId: string) {
    if (!draggingId) return
    const newStage = getDefaultStage(colId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ current_stage: newStage })
      .eq('id', draggingId)
    if (!error) {
      onUpdate((prev) =>
        prev.map((i) => (i.id === draggingId ? { ...i, current_stage: newStage } : i))
      )
    }
    setDraggingId(null)
    setDragOverCol(null)
  }

  const COL_COLORS: Record<string, string> = {
    outreach:   'border-t-blue-400',
    business:   'border-t-purple-400',
    production: 'border-t-orange-400',
    publishing: 'border-t-teal-400',
    finance:    'border-t-green-400',
  }

  return (
    <div className="flex gap-4 p-4 overflow-x-auto min-h-full items-start">
      {KANBAN_COLUMNS.map((col) => {
        const cards = getInfluencersForColumn(col.stages)
        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-60 flex flex-col rounded-lg bg-gray-100 border-t-4 ${COL_COLORS[col.id]} ${
              dragOverCol === col.id ? 'ring-2 ring-blue-400' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id) }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverCol(null)
              }
            }}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{col.label}</span>
              <span className="text-xs text-gray-400 bg-white rounded-full px-2 py-0.5 font-medium">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 px-2 pb-3 overflow-y-auto max-h-[calc(100vh-180px)]">
              {cards.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">空</div>
              )}
              {cards.map((inf) => {
                const overdue = isFollowupOverdue(inf.next_followup_date)
                return (
                  <div
                    key={inf.id}
                    draggable
                    onDragStart={() => setDraggingId(inf.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    className={`bg-white rounded-md p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-opacity ${
                      draggingId === inf.id ? 'opacity-40' : ''
                    }`}
                  >
                    <Link href={`/influencers/${inf.id}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarImage src={inf.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(inf.display_name ?? inf.twitter_handle).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {inf.display_name ?? inf.twitter_handle}
                          </div>
                          <div className="text-xs text-gray-400">@{inf.twitter_handle}</div>
                        </div>
                      </div>
                    </Link>

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <StalenessBadge stageEnteredAt={inf.stage_entered_at} className="text-xs" />
                      {inf.followers_count && (
                        <span className="text-xs text-gray-400">{formatFollowers(inf.followers_count)}</span>
                      )}
                    </div>

                    {/* Sub-stage tooltip */}
                    <div className="mt-1.5 text-xs text-gray-400 truncate">{inf.current_stage}</div>

                    {/* Overdue indicator */}
                    {overdue && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        跟进已逾期
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

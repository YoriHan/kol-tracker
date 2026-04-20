'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Upload, Download, LayoutGrid, List, X, AlertCircle } from 'lucide-react'
import type { Influencer, InfluencerStage, Profile } from '@/types/database'
import { InfluencersTable } from './influencers-table'
import { InfluencersKanban } from './influencers-kanban'
import { ImportCsvDialog } from './import-csv-dialog'
import { AddInfluencerDialog } from './add-influencer-dialog'

const ALL_STAGES: InfluencerStage[] = [
  '待接触','已发DM','谈判中','已签约',
  '合作中-Draft1','合作中-Draft2','待发布','已发送',
  '已发Invoice','已付款','完成',
]

interface InfluencersClientProps {
  initialInfluencers: Influencer[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
}

export function InfluencersClient({ initialInfluencers, profiles }: InfluencersClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [influencers, setInfluencers] = useState(initialInfluencers)

  // Read filter state from URL
  const search = searchParams.get('q') ?? ''
  const stageFilter = searchParams.get('stage') ?? ''
  const categoryFilter = searchParams.get('category') ?? ''
  const overdueOnly = searchParams.get('overdue') === '1'

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  // Derive unique categories from data
  const categories = useMemo(() => {
    const cats = new Set(influencers.map((i) => i.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [influencers])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    let list = influencers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.twitter_handle.toLowerCase().includes(q) ||
          (i.display_name ?? '').toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q) ||
          (i.notes ?? '').toLowerCase().includes(q)
      )
    }
    if (stageFilter) {
      list = list.filter((i) => i.current_stage === stageFilter)
    }
    if (categoryFilter) {
      list = list.filter((i) => i.category === categoryFilter)
    }
    if (overdueOnly) {
      list = list.filter(
        (i) => i.next_followup_date != null && i.next_followup_date <= today && i.current_stage !== '完成'
      )
    }
    return list
  }, [influencers, search, stageFilter, categoryFilter, overdueOnly, today])

  const activeFilters = [stageFilter, categoryFilter, overdueOnly ? '逾期' : ''].filter(Boolean)

  function handleExport() {
    const headers = [
      'twitter_handle','display_name','followers_count','category',
      'current_stage','next_followup_date','contract_value','payment_status',
    ]
    const rows = filtered.map((i) => {
      const rec = i as unknown as Record<string, unknown>
      return headers.map((h) => {
        const v = rec[h] ?? ''
        return `"${String(v).replace(/"/g, '""')}"`
      }).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-tracker-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold text-gray-900 mr-auto">红人库</h1>

        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8 h-9"
            placeholder="搜索用户名、备注…"
            value={search}
            onChange={(e) => updateParam('q', e.target.value || null)}
          />
        </div>

        {/* Stage filter */}
        <select
          className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
          value={stageFilter}
          onChange={(e) => updateParam('stage', e.target.value || null)}
        >
          <option value="">全部阶段</option>
          {ALL_STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Category filter */}
        {categories.length > 0 && (
          <select
            className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
            value={categoryFilter}
            onChange={(e) => updateParam('category', e.target.value || null)}
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Overdue toggle */}
        <button
          className={`h-9 px-3 text-sm rounded-md border flex items-center gap-1.5 transition-colors ${
            overdueOnly
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => updateParam('overdue', overdueOnly ? null : '1')}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          逾期跟进
        </button>

        {/* View toggle */}
        <div className="flex items-center border rounded-md overflow-hidden">
          <button
            className={`px-2.5 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
              view === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => setView('table')}
          >
            <List className="h-4 w-4" />
            表格
          </button>
          <button
            className={`px-2.5 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-l ${
              view === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
            看板
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          导入
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" />
          导出
        </Button>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          添加红人
        </Button>
      </div>

      {/* Active filters + count */}
      <div className="px-6 py-2 text-sm text-gray-500 bg-white border-b flex items-center gap-2 flex-wrap">
        <span>
          {activeFilters.length > 0 || search
            ? `找到 ${filtered.length} / ${influencers.length} 个`
            : `共 ${influencers.length} 个红人`}
        </span>
        {activeFilters.map((f) => (
          <Badge key={f} variant="secondary" className="text-xs gap-1 cursor-pointer"
            onClick={() => {
              if (f === stageFilter) updateParam('stage', null)
              else if (f === categoryFilter) updateParam('category', null)
              else if (f === '逾期') updateParam('overdue', null)
            }}
          >
            {f} <X className="h-3 w-3" />
          </Badge>
        ))}
        {(activeFilters.length > 0 || search) && (
          <button
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => router.replace(pathname)}
          >
            清空筛选
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === 'table' ? (
          <InfluencersTable influencers={filtered} profiles={profiles} onUpdate={setInfluencers} />
        ) : (
          <InfluencersKanban influencers={filtered} profiles={profiles} onUpdate={setInfluencers} />
        )}
      </div>

      <ImportCsvDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={(newOnes) => setInfluencers((prev) => [...newOnes, ...prev])}
      />
      <AddInfluencerDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(inf) => setInfluencers((prev) => [inf, ...prev])}
      />
    </div>
  )
}

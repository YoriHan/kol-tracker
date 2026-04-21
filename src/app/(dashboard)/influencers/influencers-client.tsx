'use client'

import { useState, useMemo, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Upload, Download, LayoutGrid, List, X, AlertCircle, Tag, SlidersHorizontal } from 'lucide-react'
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

function readParam(key: string) {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(key) ?? ''
}

export function InfluencersClient({ initialInfluencers, profiles }: InfluencersClientProps) {
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [influencers, setInfluencers] = useState(initialInfluencers)
  const [showFilters, setShowFilters] = useState(false)

  // All filters in local state — fast, no server round-trip
  const [search, setSearch] = useState(() => readParam('q'))
  const [stageFilter, setStageFilter] = useState(() => readParam('stage'))
  const [categoryFilter, setCategoryFilter] = useState(() => readParam('category'))
  const [tagFilter, setTagFilter] = useState(() => readParam('tag'))
  const [overdueOnly, setOverdueOnly] = useState(() => readParam('overdue') === '1')
  const [minFollowers, setMinFollowers] = useState(() => readParam('minf'))
  const [maxFollowers, setMaxFollowers] = useState(() => readParam('maxf'))

  // Sync filters to URL without triggering Next.js navigation
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (stageFilter) params.set('stage', stageFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    if (tagFilter) params.set('tag', tagFilter)
    if (overdueOnly) params.set('overdue', '1')
    if (minFollowers) params.set('minf', minFollowers)
    if (maxFollowers) params.set('maxf', maxFollowers)
    const qs = params.toString()
    const url = window.location.pathname + (qs ? '?' + qs : '')
    window.history.replaceState(null, '', url)
  }, [search, stageFilter, categoryFilter, tagFilter, overdueOnly, minFollowers, maxFollowers])

  const categories = useMemo(() => {
    const cats = new Set(influencers.map((i) => i.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [influencers])

  const allTags = useMemo(() => {
    const t = new Set<string>()
    influencers.forEach((i) => (i.tags ?? []).forEach((tag) => t.add(tag)))
    return Array.from(t).sort()
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
    if (stageFilter) list = list.filter((i) => i.current_stage === stageFilter)
    if (categoryFilter) list = list.filter((i) => i.category === categoryFilter)
    if (tagFilter) list = list.filter((i) => (i.tags ?? []).includes(tagFilter))
    if (overdueOnly) {
      list = list.filter(
        (i) => i.next_followup_date != null && i.next_followup_date <= today && i.current_stage !== '完成'
      )
    }
    const min = minFollowers ? parseInt(minFollowers, 10) : null
    const max = maxFollowers ? parseInt(maxFollowers, 10) : null
    if (min != null && !isNaN(min)) list = list.filter((i) => (i.followers_count ?? 0) >= min)
    if (max != null && !isNaN(max)) list = list.filter((i) => (i.followers_count ?? 0) <= max)
    return list
  }, [influencers, search, stageFilter, categoryFilter, overdueOnly, today, minFollowers, maxFollowers])

  const activeFilters = [
    stageFilter && { key: 'stage', label: stageFilter },
    categoryFilter && { key: 'category', label: categoryFilter },
    tagFilter && { key: 'tag', label: `#${tagFilter}` },
    overdueOnly && { key: 'overdue', label: '逾期跟进' },
    (minFollowers || maxFollowers) && {
      key: 'followers',
      label: `粉丝 ${minFollowers ? minFollowers + '+' : ''}${minFollowers && maxFollowers ? '~' : ''}${maxFollowers ? maxFollowers + '-' : ''}`.trim(),
    },
  ].filter(Boolean) as { key: string; label: string }[]

  function clearFilter(key: string) {
    if (key === 'stage') setStageFilter('')
    if (key === 'category') setCategoryFilter('')
    if (key === 'tag') setTagFilter('')
    if (key === 'overdue') setOverdueOnly(false)
    if (key === 'followers') { setMinFollowers(''); setMaxFollowers('') }
  }

  function clearAll() {
    setSearch('')
    setStageFilter('')
    setCategoryFilter('')
    setTagFilter('')
    setOverdueOnly(false)
    setMinFollowers('')
    setMaxFollowers('')
  }

  function handleExport() {
    const headers = [
      'twitter_handle', 'display_name', 'followers_count', 'category', 'bio',
      'current_stage', 'assigned_to', 'last_contact_date', 'next_followup_date',
      'deal_type', 'quote_per_post', 'contract_value', 'contract_url',
      'draft1_done', 'draft1_url', 'draft2_done', 'draft2_url',
      'publish_date', 'post_url',
      'impressions', 'engagement_rate', 'clicks',
      'invoice_number', 'invoice_amount', 'payment_status', 'payment_due_date', 'payment_date',
      'notes', 'tags', 'created_at',
    ]
    const displayHeaders = [
      'Twitter账号', '显示名称', '粉丝数', '分类', '简介',
      '合作阶段', '负责人', '最后联系日期', '下次跟进日期',
      '合作形式', '报价/条', '合同金额', '合同链接',
      'Draft1完成', 'Draft1链接', 'Draft2完成', 'Draft2链接',
      '预定发布日', '发布链接',
      '曝光量', '互动率', '点击数',
      '发票编号', '发票金额', '付款状态', '付款截止日', '实际付款日',
      '备注', '标签', '创建时间',
    ]
    // resolve assigned_to → display name
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.display_name || p.email]))
    const rows = filtered.map((i) => {
      const rec = i as unknown as Record<string, unknown>
      return headers.map((h) => {
        let val: unknown = rec[h]
        if (h === 'assigned_to' && val) val = profileMap[val as string] ?? val
        if (h === 'tags') val = (i.tags ?? []).join(';') // semicolon-separated tag list
        if (typeof val === 'boolean') val = val ? '是' : '否'
        return `"${String(val ?? '').replace(/"/g, '""')}"`
      }).join(',')
    })
    const csv = [displayHeaders.join(','), ...rows].join('\n')
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
      <div className="px-4 md:px-6 py-3 md:py-4 border-b bg-white">
        {/* Top row: title + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-semibold text-gray-900 mr-auto">红人库</h1>

          {/* Mobile filter toggle */}
          <button
            className={`md:hidden h-9 px-3 text-sm rounded-md border flex items-center gap-1.5 transition-colors ${
              showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600'
            }`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            筛选{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
          </button>

          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              className={`px-2.5 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setView('table')}
            >
              <List className="h-4 w-4" /><span className="hidden sm:inline">表格</span>
            </button>
            <button
              className={`px-2.5 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-l ${view === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">看板</span>
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="hidden sm:flex">
            <Upload className="h-4 w-4 mr-1.5" />导入
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="hidden sm:flex">
            <Download className="h-4 w-4 mr-1.5" />导出
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">添加红人</span><span className="sm:hidden">添加</span>
          </Button>
        </div>

        {/* Filter bar — always visible on desktop, toggle on mobile */}
        <div className={`mt-2 flex items-center gap-2 flex-wrap ${showFilters ? 'flex' : 'hidden md:flex'}`}>
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              className="pl-8 h-9"
              placeholder="搜索用户名、备注…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700 cursor-pointer flex-1 sm:flex-none"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">全部阶段</option>
            {ALL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {categories.length > 0 && (
            <select
              className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700 cursor-pointer flex-1 sm:flex-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">全部分类</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {allTags.length > 0 && (
            <select
              className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700 cursor-pointer flex-1 sm:flex-none"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">全部标签</option>
              {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
            </select>
          )}

          {/* Follower range filter */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              placeholder="最小粉丝"
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
              className="h-9 w-24 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
            />
            <span className="text-gray-400 text-xs">~</span>
            <input
              type="number"
              min={0}
              placeholder="最大粉丝"
              value={maxFollowers}
              onChange={(e) => setMaxFollowers(e.target.value)}
              className="h-9 w-24 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
            />
          </div>

          <button
            className={`h-9 px-3 text-sm rounded-md border flex items-center gap-1.5 transition-colors ${
              overdueOnly ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            逾期跟进
          </button>

          {/* Mobile-only: import/export inside filter bar */}
          <div className="flex items-center gap-2 sm:hidden w-full">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="flex-1">
              <Upload className="h-4 w-4 mr-1.5" />导入
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="flex-1">
              <Download className="h-4 w-4 mr-1.5" />导出
            </Button>
          </div>
        </div>
      </div>

      {/* Filter chips + count */}
      <div className="px-6 py-2 text-sm text-gray-500 bg-white border-b flex items-center gap-2 flex-wrap min-h-[38px]">
        <span>
          {(activeFilters.length > 0 || search)
            ? `找到 ${filtered.length} / ${influencers.length} 个`
            : `共 ${influencers.length} 个红人`}
        </span>
        {activeFilters.map((f) => (
          <Badge key={f.key} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => clearFilter(f.key)}>
            {f.label} <X className="h-3 w-3" />
          </Badge>
        ))}
        {(activeFilters.length > 0 || search) && (
          <button className="text-xs text-gray-400 hover:text-gray-600" onClick={clearAll}>
            清空筛选
          </button>
        )}
      </div>

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

'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, Upload, Download, LayoutGrid, List } from 'lucide-react'
import type { Influencer, Profile } from '@/types/database'
import { InfluencersTable } from './influencers-table'
import { InfluencersKanban } from './influencers-kanban'
import { ImportCsvDialog } from './import-csv-dialog'
import { AddInfluencerDialog } from './add-influencer-dialog'

interface InfluencersClientProps {
  initialInfluencers: Influencer[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
}

export function InfluencersClient({ initialInfluencers, profiles }: InfluencersClientProps) {
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [influencers, setInfluencers] = useState(initialInfluencers)

  const filtered = useMemo(() => {
    if (!search.trim()) return influencers
    const q = search.toLowerCase()
    return influencers.filter(
      (i) =>
        i.twitter_handle.toLowerCase().includes(q) ||
        (i.display_name ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q) ||
        (i.notes ?? '').toLowerCase().includes(q)
    )
  }, [influencers, search])

  function handleExport() {
    const headers = [
      'twitter_handle','display_name','followers_count','category',
      'current_stage','next_followup_date','contract_value','payment_status',
    ]
    const rows = filtered.map((i) => {
      const rec = i as unknown as Record<string, unknown>
      return headers.map((h) => rec[h] ?? '').join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kol-tracker-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold text-gray-900 mr-auto">红人库</h1>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8 h-9"
            placeholder="搜索用户名、类别、备注…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
          导入 CSV
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

      {/* Count */}
      <div className="px-6 py-2 text-sm text-gray-500 bg-white border-b">
        {search ? `找到 ${filtered.length} / ${influencers.length} 个` : `共 ${influencers.length} 个红人`}
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

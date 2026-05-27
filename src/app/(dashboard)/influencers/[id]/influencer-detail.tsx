'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RichTextEditor } from '@/components/rich-text-editor'
import { StageBadge } from '@/components/influencers/stage-badge'
import { StalenessBadge } from '@/components/influencers/staleness-badge'
import { isFollowupOverdue } from '@/lib/staleness'
import type {
  Influencer, CommunicationLog, ActivityLog, Profile, InfluencerStage, ContactMethod, DealType
} from '@/types/database'
import { useTranslation } from '@/lib/i18n/provider'
import { formatRelative, formatShortDateTime } from '@/lib/i18n/format'
import {
  ArrowLeft, ExternalLink, AlertCircle, Plus,
  FileText, DollarSign, BarChart2, MessageSquare, Clock, Link2, Copy, Check,
  Download, Tag, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AttributionChart } from '@/components/attribution-chart'

interface InfluencerDetailProps {
  influencer: Influencer
  communicationLogs: CommunicationLog[]
  activityLogs: ActivityLog[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
}

// Stored values (Supabase enums) stay Chinese — display goes through `tStage`,
// `tDealType`, etc.
const STAGES: InfluencerStage[] = [
  '待接触','已发DM','谈判中','已签约',
  '合作中-Draft1','合作中-Draft2','待发布','已发送',
  '已发Invoice','已付款','完成',
]

const PAYMENT_STAGE_SYNC: Partial<Record<InfluencerStage, string>> = {
  '已发Invoice': '已开票',
  '已付款': '已付款',
}

const CATEGORIES = ['美妆','时尚','科技','游戏','美食','旅行','健身','生活方式','教育','金融','其他']
const DEAL_TYPES: DealType[] = ['推文','视频','Story','直播','其他']
const CONTACT_METHODS: ContactMethod[] = ['DM','邮件','电话','其他']

export function InfluencerDetail({
  influencer: initial, communicationLogs: initialLogs, activityLogs, profiles,
}: InfluencerDetailProps) {
  // Memoize supabase client so it doesn't trigger infinite re-renders
  const supabase = useMemo(() => createClient(), [])
  const {
    t, tStage, tDealType, tContactMethod, tPaymentStatus, tCategory, locale,
  } = useTranslation()
  const [inf, setInf] = useState(initial)
  const [logs, setLogs] = useState(initialLogs)
  const [saving, setSaving] = useState(false)

  // Attribution stats
  const [attrStats, setAttrStats] = useState<{ clicks: number; conversions: number } | null>(null)
  const [clickEvents, setClickEvents] = useState<{ created_at: string }[]>([])
  const [attrLoading, setAttrLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadAttrStats = useCallback(async () => {
    if (!inf.kol_slug) return
    setAttrLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const [{ count: clicks }, { count: conversions }, { data: eventsData }] = await Promise.all([
      sb.from('click_events').select('id', { count: 'exact', head: true }).eq('kol_slug', inf.kol_slug),
      sb.from('conversion_events').select('id', { count: 'exact', head: true }).eq('kol_slug', inf.kol_slug),
      sb.from('click_events').select('created_at').eq('kol_slug', inf.kol_slug).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ])
    setAttrStats({ clicks: clicks ?? 0, conversions: conversions ?? 0 })
    setClickEvents(eventsData ?? [])
    setAttrLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inf.kol_slug])

  useEffect(() => { loadAttrStats() }, [loadAttrStats])

  function generateSlug() {
    const base = inf.twitter_handle.toLowerCase().replace(/[^a-z0-9]/g, '')
    const suffix = Math.random().toString(36).slice(2, 6)
    return `${base}-${suffix}`
  }

  async function handleGenerateSlug() {
    const slug = generateSlug()
    await updateField('kol_slug', slug)
    setAttrStats({ clicks: 0, conversions: 0 })
  }

  function getTrackingLink() {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/api/track/${inf.kol_slug}`
  }

  async function copyTrackingLink() {
    await navigator.clipboard.writeText(getTrackingLink())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Communication log form + @mention
  const [logMethod, setLogMethod] = useState<ContactMethod>('DM')
  const [logSummary, setLogSummary] = useState('')
  const [addingLog, setAddingLog] = useState(false)
  const [mentionSearch, setMentionSearch] = useState<string | null>(null) // null = no active mention
  const [mentionStart, setMentionStart] = useState(0)
  const logInputRef = useRef<HTMLInputElement>(null)

  const mentionMatches = useMemo(() => {
    if (mentionSearch === null) return []
    const q = mentionSearch.toLowerCase()
    return profiles.filter((p) => {
      const name = (p.display_name ?? p.email ?? '').toLowerCase()
      return name.includes(q)
    }).slice(0, 6)
  }, [mentionSearch, profiles])

  function handleLogSummaryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setLogSummary(val)

    // Detect @mention: find last @ before cursor with no space after it
    const textBefore = val.slice(0, cursor)
    const atIdx = textBefore.lastIndexOf('@')
    if (atIdx !== -1) {
      const afterAt = textBefore.slice(atIdx + 1)
      if (!afterAt.includes(' ') && !afterAt.includes('@')) {
        setMentionStart(atIdx)
        setMentionSearch(afterAt)
        return
      }
    }
    setMentionSearch(null)
  }

  function insertMention(profile: Pick<typeof profiles[0], 'id' | 'display_name' | 'email'>) {
    const name = profile.display_name ?? profile.email ?? ''
    const before = logSummary.slice(0, mentionStart)
    const after = logSummary.slice(mentionStart + 1 + (mentionSearch ?? '').length)
    const newVal = `${before}@${name} ${after}`
    setLogSummary(newVal)
    setMentionSearch(null)
    // Restore focus
    setTimeout(() => {
      logInputRef.current?.focus()
      const pos = before.length + name.length + 2
      logInputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  // Tags
  const [tagInput, setTagInput] = useState('')
  const tags = inf.tags ?? []

  async function addTag(tag: string) {
    const t = tag.trim().toLowerCase()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    const next = [...tags, t]
    setInf((p) => ({ ...p, tags: next }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('influencers').update({ tags: next }).eq('id', inf.id)
    setTagInput('')
  }

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag)
    setInf((p) => ({ ...p, tags: next }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('influencers').update({ tags: next }).eq('id', inf.id)
  }

  function stripHtml(html: string | null): string {
    const dash = t('common.dash')
    if (!html) return dash
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').trim() || dash
  }

  async function handleExportPDF() {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    const name = inf.display_name ?? inf.twitter_handle
    const dash = t('common.dash')
    const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

    // Title
    doc.setFontSize(18)
    doc.text(t('detail.pdf.title', { name }), 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(
      `@${inf.twitter_handle}  |  ${tStage(inf.current_stage)}  |  ${t('detail.fields.generatedAt')}: ${new Date().toLocaleDateString(dateLocale)}`,
      14, 28,
    )
    doc.setTextColor(0)

    const fieldHead: [string, string] = [t('detail.pdf.fieldLabel'), t('detail.pdf.valueLabel')]

    // Basic info table
    autoTable(doc, {
      startY: 35,
      head: [fieldHead],
      body: [
        [t('detail.fields.category'), inf.category ? tCategory(inf.category) : dash],
        [t('detail.fields.followers'), inf.followers_count ? inf.followers_count.toLocaleString() : dash],
        [t('detail.fields.stage'), tStage(inf.current_stage)],
        [t('detail.fields.nextFollowup'), inf.next_followup_date ?? dash],
        [t('detail.fields.lastContact'), inf.last_contact_date ?? dash],
        [t('detail.fields.tags'), tags.join(', ') || dash],
        [t('detail.fields.notes'), stripHtml(inf.notes)],
      ],
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
    })

    // Deal / Finance table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY1 = (doc as any).lastAutoTable.finalY + 8
    doc.setFontSize(12)
    doc.text(t('detail.pdf.sectionDeal'), 14, finalY1)
    autoTable(doc, {
      startY: finalY1 + 4,
      head: [fieldHead],
      body: [
        [t('detail.fields.dealType'), inf.deal_type ? tDealType(inf.deal_type) : dash],
        [t('detail.fields.quotePerPost'), inf.quote_per_post ? `¥${inf.quote_per_post.toLocaleString()}` : dash],
        [t('detail.fields.contractValue'), inf.contract_value ? `¥${inf.contract_value.toLocaleString()}` : dash],
        [t('detail.fields.paymentStatus'), inf.payment_status ? tPaymentStatus(inf.payment_status) : dash],
        [t('detail.fields.invoiceAmount'), inf.invoice_amount ? `¥${inf.invoice_amount.toLocaleString()}` : dash],
        [t('detail.fields.paymentDueDate'), inf.payment_due_date ?? dash],
        [t('detail.fields.paymentDate'), inf.payment_date ?? dash],
      ],
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
    })

    // Performance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY2 = (doc as any).lastAutoTable.finalY + 8
    doc.setFontSize(12)
    doc.text(t('detail.pdf.sectionPerformance'), 14, finalY2)
    autoTable(doc, {
      startY: finalY2 + 4,
      head: [fieldHead],
      body: [
        [t('detail.fields.impressions'), inf.impressions ? inf.impressions.toLocaleString() : dash],
        [t('detail.fields.engagementRate'), inf.engagement_rate ? `${inf.engagement_rate}%` : dash],
        [t('detail.pdf.manualClicks'), inf.clicks ? inf.clicks.toLocaleString() : dash],
        [t('detail.pdf.trackedClicks'), attrStats ? attrStats.clicks.toLocaleString() : dash],
        [t('detail.pdf.conversions'), attrStats ? attrStats.conversions.toLocaleString() : dash],
      ],
      headStyles: { fillColor: [168, 85, 247] },
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
    })

    doc.save(`kol-report-${inf.twitter_handle}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const overdue = isFollowupOverdue(inf.next_followup_date)

  async function updateField<K extends keyof Influencer>(key: K, value: Influencer[K]) {
    // Optimistic update — UI changes instantly
    const prev = inf[key]
    setInf((p) => ({ ...p, [key]: value }))
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ [key]: value })
      .eq('id', inf.id)
    if (error) setInf((p) => ({ ...p, [key]: prev })) // rollback
    setSaving(false)
  }

  async function updateStage(stage: InfluencerStage) {
    const extra: Record<string, unknown> = {}
    const syncedStatus = PAYMENT_STAGE_SYNC[stage]
    if (syncedStatus) extra['payment_status'] = syncedStatus

    // Optimistic update — stage badge changes instantly
    const prevStage = inf.current_stage
    setInf((p) => ({ ...p, current_stage: stage, ...extra }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ current_stage: stage, ...extra })
      .eq('id', inf.id)
    if (error) {
      setInf((p) => ({ ...p, current_stage: prevStage })) // rollback
      return
    }

    // Log activity in background (don't block UI). Description is stored in
    // Chinese — same as stored stage values, the per-locale display happens
    // at render. Activity log render currently shows `description` as-is.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from('activity_logs').insert({
      influencer_id: inf.id,
      action: 'stage_changed',
      field_name: 'current_stage',
      old_value: prevStage,
      new_value: stage,
      description: `阶段从「${prevStage}」改为「${stage}」`,
    })
  }

  async function addCommunicationLog() {
    if (!logSummary.trim()) return
    const summary = logSummary.trim()
    const now = new Date().toISOString()
    const prevLastContact = inf.last_contact_date

    // Optimistic — show entry immediately.
    //
    // `contacted_at` mirrors the DB column (`timestamptz not null default now()`)
    // and is read by `formatRelative(log.contacted_at, locale)` at render. Without
    // it the cast to CommunicationLog masks the missing field at compile time, but
    // at runtime `formatRelative(undefined, …)` calls `new Date(undefined)` →
    // Invalid Date → date-fns throws RangeError, which crashes the log list until
    // the insert returns. Set the same `now` timestamp for visual continuity.
    const tempId = `temp-${Date.now()}`
    const optimisticEntry = {
      id: tempId,
      influencer_id: inf.id,
      user_id: null,
      contacted_at: now,
      method: logMethod,
      summary,
      source: 'manual',
      twitter_dm_id: null,
      created_at: now,
      profile: null,
    } as CommunicationLog
    setLogs((prev) => [optimisticEntry, ...prev])
    setLogSummary('')
    setInf((p) => ({ ...p, last_contact_date: now }))

    setAddingLog(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('communication_logs')
      .insert({ influencer_id: inf.id, method: logMethod, summary, source: 'manual' })
      .select('*, profile:profiles(id, display_name, email, avatar_url)')
      .single()

    if (!error && data) {
      // Replace optimistic entry with real one
      setLogs((prev) => prev.map((l) => (l.id === tempId ? (data as CommunicationLog) : l)))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase as any).from('influencers').update({ last_contact_date: now }).eq('id', inf.id)
    } else {
      // Rollback — also restore `last_contact_date` so the influencer header
      // doesn't keep showing the bumped timestamp after a failed insert.
      setLogs((prev) => prev.filter((l) => l.id !== tempId))
      setInf((p) => ({ ...p, last_contact_date: prevLastContact }))
      setLogSummary(summary)
    }
    setAddingLog(false)
  }

  function renderWithMentions(text: string) {
    const parts = text.split(/(@\S+)/g)
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-blue-600 font-medium">{part}</span>
      ) : (
        part
      )
    )
  }

  function formatFollowers(n: number | null) {
    if (n == null) return t('common.dash')
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toString()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-6 py-4 border-b bg-white flex items-center gap-4">
        <Link href="/influencers" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar className="h-10 w-10">
          <AvatarImage src={inf.avatar_url ?? undefined} />
          <AvatarFallback>{(inf.display_name ?? inf.twitter_handle).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{inf.display_name ?? inf.twitter_handle}</h1>
            {overdue && <AlertCircle className="h-4 w-4 text-red-500" aria-label={t('detail.followupOverdue')} />}
            {saving && <span className="text-xs text-gray-400">{t('detail.saving')}</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <a
              href={`https://twitter.com/${inf.twitter_handle}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-blue-500"
            >
              @{inf.twitter_handle}
              <ExternalLink className="h-3 w-3" />
            </a>
            {inf.followers_count && (
              <span className="text-gray-400">· {t('detail.followers', { count: formatFollowers(inf.followers_count) })}</span>
            )}
          </div>
        </div>

        {/* Stage selector */}
        <div className="flex items-center gap-2">
          <StageBadge stage={inf.current_stage} />
          <StalenessBadge stageEnteredAt={inf.stage_entered_at} />
          <Select value={inf.current_stage} onValueChange={(v) => updateStage(v as InfluencerStage)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{tStage(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportPDF}>
            <Download className="h-3.5 w-3.5" />{t('detail.exportPdf')}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-3 md:p-6">
        <Tabs defaultValue="info">
          <TabsList className="mb-4 overflow-x-auto flex w-full sm:w-auto h-auto flex-nowrap">
            <TabsTrigger value="info" className="shrink-0 text-xs sm:text-sm"><FileText className="h-3.5 w-3.5 mr-1" /><span className="hidden xs:inline">{t('detail.tabs.info')}</span><span className="xs:hidden">{t('detail.tabs.infoShort')}</span></TabsTrigger>
            <TabsTrigger value="finance" className="shrink-0 text-xs sm:text-sm"><DollarSign className="h-3.5 w-3.5 mr-1" />{t('detail.tabs.finance')}</TabsTrigger>
            <TabsTrigger value="performance" className="shrink-0 text-xs sm:text-sm"><BarChart2 className="h-3.5 w-3.5 mr-1" />{t('detail.tabs.performance')}</TabsTrigger>
            <TabsTrigger value="logs" className="shrink-0 text-xs sm:text-sm"><MessageSquare className="h-3.5 w-3.5 mr-1" />{t('detail.tabs.logs')}</TabsTrigger>
            <TabsTrigger value="activity" className="shrink-0 text-xs sm:text-sm"><Clock className="h-3.5 w-3.5 mr-1" />{t('detail.tabs.activity')}</TabsTrigger>
            <TabsTrigger value="attribution" className="shrink-0 text-xs sm:text-sm"><Link2 className="h-3.5 w-3.5 mr-1" />{t('detail.tabs.attribution')}</TabsTrigger>
          </TabsList>

          {/* Basic & Deal tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">{t('detail.cards.basicInfo')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label={t('detail.fields.category')}>
                    <Select value={inf.category ?? ''} onValueChange={(v) => updateField('category', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('detail.placeholders.selectCategory')} /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{tCategory(c)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('detail.fields.followers')}>
                    <EditableNumber value={inf.followers_count} onSave={(v) => updateField('followers_count', v)} placeholder={t('common.clickToEdit')} />
                  </Field>
                  <Field label={t('detail.fields.assignee')}>
                    <Select value={inf.assigned_to ?? '__none__'} onValueChange={(v) => updateField('assigned_to', v === '__none__' ? null : v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('detail.placeholders.noAssignee')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('detail.placeholders.noAssignee')}</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('detail.fields.nextFollowup')}>
                    <input
                      type="date"
                      className={`w-full text-sm border rounded px-2 py-1 ${overdue ? 'border-red-300 text-red-600' : 'border-gray-200'}`}
                      value={inf.next_followup_date ?? ''}
                      onChange={(e) => updateField('next_followup_date', e.target.value || null)}
                    />
                  </Field>
                  <Field label={t('detail.fields.tags')}>
                    <div className="space-y-1.5">
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
                              <Tag className="h-2.5 w-2.5" />{tag}
                              <button onClick={() => removeTag(tag)} className="hover:text-red-500 ml-0.5">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1">
                        <input
                          type="text"
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                          placeholder={t('detail.placeholders.addTagAndEnter')}
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => addTag(tagInput)}>{t('detail.placeholders.addTag')}</Button>
                      </div>
                    </div>
                  </Field>
                  <Field label={t('detail.fields.notes')}>
                    <RichTextEditor
                      value={inf.notes}
                      onChange={(html) => updateField('notes', html)}
                      rows={3}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">{t('detail.cards.dealTerms')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label={t('detail.fields.dealType')}>
                    <Select value={inf.deal_type ?? ''} onValueChange={(v) => updateField('deal_type', v as never || null)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('detail.placeholders.selectDealType')} /></SelectTrigger>
                      <SelectContent>
                        {DEAL_TYPES.map((d) => <SelectItem key={d} value={d}>{tDealType(d)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('detail.fields.quotePerPost')}>
                    <EditableNumber value={inf.quote_per_post} onSave={(v) => updateField('quote_per_post', v)} prefix="¥" placeholder={t('common.clickToEdit')} />
                  </Field>
                  <Field label={t('detail.fields.contractValue')}>
                    <EditableNumber value={inf.contract_value} onSave={(v) => updateField('contract_value', v)} prefix="¥" placeholder={t('common.clickToEdit')} />
                  </Field>
                  <Field label={t('detail.fields.contractUrl')}>
                    <EditableUrl value={inf.contract_url} onSave={(v) => updateField('contract_url', v)} placeholder={t('common.clickToAddLink')} />
                  </Field>
                </CardContent>
              </Card>
            </div>

            {/* Content progress */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t('detail.cards.contentProgress')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="draft1"
                        checked={inf.draft1_done}
                        onChange={(e) => updateField('draft1_done', e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="draft1" className="text-sm font-medium">Draft 1</label>
                    </div>
                    <EditableUrl value={inf.draft1_url} onSave={(v) => updateField('draft1_url', v)} placeholder={t('detail.placeholders.draft1Url')} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="draft2"
                        checked={inf.draft2_done}
                        onChange={(e) => updateField('draft2_done', e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="draft2" className="text-sm font-medium">Draft 2</label>
                    </div>
                    <EditableUrl value={inf.draft2_url} onSave={(v) => updateField('draft2_url', v)} placeholder={t('detail.placeholders.draft2Url')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('detail.progress.publishDate')}>
                    <input
                      type="date"
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                      value={inf.publish_date ?? ''}
                      onChange={(e) => updateField('publish_date', e.target.value || null)}
                    />
                  </Field>
                  <Field label={t('detail.progress.postUrl')}>
                    <EditableUrl value={inf.post_url} onSave={(v) => updateField('post_url', v)} placeholder={t('detail.placeholders.postUrlAfterPublish')} />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance tab */}
          <TabsContent value="finance">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t('detail.cards.finance')}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('detail.fields.paymentStatus')}>
                  <Select value={inf.payment_status} onValueChange={(v) => updateField('payment_status', v as never)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未开票">{tPaymentStatus('未开票')}</SelectItem>
                      <SelectItem value="已开票">{tPaymentStatus('已开票')}</SelectItem>
                      <SelectItem value="已付款">{tPaymentStatus('已付款')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('detail.fields.invoiceNumber')}>
                  <EditableText value={inf.invoice_number} onSave={(v) => updateField('invoice_number', v)} placeholder={t('common.clickToEdit')} />
                </Field>
                <Field label={t('detail.fields.invoiceAmount')}>
                  <EditableNumber value={inf.invoice_amount} onSave={(v) => updateField('invoice_amount', v)} prefix="¥" placeholder={t('common.clickToEdit')} />
                </Field>
                <Field label={t('detail.fields.paymentDueDate')}>
                  <input
                    type="date"
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                    value={inf.payment_due_date ?? ''}
                    onChange={(e) => updateField('payment_due_date', e.target.value || null)}
                  />
                </Field>
                <Field label={t('detail.fields.paymentDate')}>
                  <input
                    type="date"
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                    value={inf.payment_date ?? ''}
                    onChange={(e) => updateField('payment_date', e.target.value || null)}
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance tab */}
          <TabsContent value="performance">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t('detail.cards.performanceManual')}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <Field label={t('detail.fields.impressions')}>
                  <EditableNumber value={inf.impressions} onSave={(v) => updateField('impressions', v)} placeholder={t('common.clickToEdit')} />
                </Field>
                <Field label={t('detail.fields.engagementRate')}>
                  <EditableNumber value={inf.engagement_rate} onSave={(v) => updateField('engagement_rate', v)} placeholder={t('common.clickToEdit')} />
                </Field>
                <Field label={t('detail.fields.clicks')}>
                  <EditableNumber value={inf.clicks} onSave={(v) => updateField('clicks', v)} placeholder={t('common.clickToEdit')} />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communication logs tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('detail.cards.communicationLogs')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add log form */}
                <div className="flex gap-2 items-start">
                  <Select value={logMethod} onValueChange={(v) => setLogMethod(v as ContactMethod)}>
                    <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_METHODS.map((m) => <SelectItem key={m} value={m} className="text-xs">{tContactMethod(m)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                  <input
                    ref={logInputRef}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                    placeholder={t('detail.placeholders.logSummary')}
                    value={logSummary}
                    onChange={handleLogSummaryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setMentionSearch(null); return }
                      if (e.key === 'Enter' && mentionSearch === null) addCommunicationLog()
                    }}
                  />
                  {/* @mention dropdown */}
                  {mentionSearch !== null && mentionMatches.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-52">
                      {mentionMatches.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                          onMouseDown={(e) => { e.preventDefault(); insertMention(p) }}
                        >
                          <span className="font-medium text-gray-800 truncate">{p.display_name ?? p.email}</span>
                          {p.display_name && <span className="text-xs text-gray-400 truncate">{p.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                  <Button size="sm" onClick={addCommunicationLog} disabled={addingLog || !logSummary.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Log list */}
                <div className="space-y-2">
                  {logs.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">{t('detail.logs.empty')}</p>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm border-l-2 border-gray-200 pl-3 py-1">
                      <div className="shrink-0">
                        <Badge variant="outline" className="text-xs">{tContactMethod(log.method)}</Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800">{renderWithMentions(log.summary)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatRelative(log.contacted_at, locale)}
                          {log.profile && ` · ${log.profile.display_name ?? log.profile.email}`}
                          {log.source === 'twitter_api' && <span className="ml-1 text-blue-400">Twitter</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attribution tracking tab */}
          <TabsContent value="attribution" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('detail.cards.trackingLink')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!inf.kol_slug ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-gray-500">{t('detail.attribution.noSlugYet')}</p>
                    <Button size="sm" onClick={handleGenerateSlug}>{t('detail.attribution.generate')}</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">{t('detail.fields.slug')}</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1">
                          {inf.kol_slug}
                        </code>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">{t('detail.fields.trackingShareLink')}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={getTrackingLink()}
                          className="text-xs font-mono"
                        />
                        <Button size="sm" variant="outline" onClick={copyTrackingLink}>
                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">{t('detail.fields.trackingTargetUrl')}</label>
                      <EditableUrl
                        value={inf.tracking_url}
                        onSave={(v) => updateField('tracking_url', v)}
                        placeholder={t('detail.placeholders.trackingTargetExample')}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {inf.kol_slug && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 mb-1">{t('detail.attribution.clicks')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {attrLoading ? '…' : (attrStats?.clicks ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 mb-1">{t('detail.attribution.conversions')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {attrLoading ? '…' : (attrStats?.conversions ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 mb-1">{t('detail.attribution.conversionRate')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {attrLoading || !attrStats ? '…' : attrStats.clicks === 0 ? t('common.dash') : `${((attrStats.conversions / attrStats.clicks) * 100).toFixed(1)}%`}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}


            {inf.kol_slug && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('detail.cards.clickTrend')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {attrLoading ? (
                    <p className="text-sm text-gray-400 py-4 text-center">{t('common.loading')}</p>
                  ) : (
                    <AttributionChart clickEvents={clickEvents} />
                  )}
                </CardContent>
              </Card>
            )}

            {inf.kol_slug && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('detail.cards.embed')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
{`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/embed.js"></script>`}
                  </pre>
                  <p className="text-xs text-gray-500">{t('detail.attribution.embedHint')}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity log tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t('detail.cards.activityLog')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activityLogs.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">{t('detail.logs.activityEmpty')}</p>
                  )}
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700">{log.description ?? log.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatShortDateTime(log.created_at, locale)}
                          {log.profile && ` · ${log.profile.display_name ?? log.profile.email}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ── Tiny editable field helpers ───────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      {children}
    </div>
  )
}

function EditableText({
  value, onSave, placeholder,
}: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  // Sync external value changes (e.g. after rollback)
  useEffect(() => { if (!editing) setV(value ?? '') }, [value, editing])

  function commit() {
    setEditing(false)
    onSave(v.trim() || null)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="text"
        className="w-full text-sm border border-blue-400 rounded px-2 py-1 outline-none ring-1 ring-blue-300"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value ?? ''); setEditing(false) } }}
      />
    )
  }

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer min-h-[30px] px-2 py-1 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
      onClick={() => setEditing(true)}
    >
      <span className={`flex-1 text-sm ${v ? 'text-gray-900' : 'text-gray-400'}`}>{v || (placeholder ?? t('common.clickToEdit'))}</span>
      <svg className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" /></svg>
    </div>
  )
}

function EditableNumber({
  value, onSave, prefix, placeholder,
}: { value: number | null; onSave: (v: number | null) => void; prefix?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value?.toString() ?? '')
  const { t } = useTranslation()

  useEffect(() => { if (!editing) setV(value?.toString() ?? '') }, [value, editing])

  function commit() {
    setEditing(false)
    onSave(v ? parseFloat(v) : null)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        <input
          autoFocus
          type="number"
          className="w-full text-sm border border-blue-400 rounded px-2 py-1 outline-none ring-1 ring-blue-300"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value?.toString() ?? ''); setEditing(false) } }}
        />
      </div>
    )
  }

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer min-h-[30px] px-2 py-1 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
      onClick={() => setEditing(true)}
    >
      {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
      <span className={`flex-1 text-sm ${v ? 'text-gray-900' : 'text-gray-400'}`}>{v ? Number(v).toLocaleString() : (placeholder ?? t('common.clickToEdit'))}</span>
      <svg className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" /></svg>
    </div>
  )
}

function EditableUrl({
  value, onSave, placeholder,
}: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value ?? '')
  const { t } = useTranslation()

  useEffect(() => { if (!editing) setV(value ?? '') }, [value, editing])

  function commit() {
    setEditing(false)
    onSave(v.trim() || null)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="url"
          className="flex-1 text-sm border border-blue-400 rounded px-2 py-1 outline-none ring-1 ring-blue-300"
          placeholder={placeholder ?? 'https://…'}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value ?? ''); setEditing(false) } }}
        />
        {v && (
          <a href={v} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500 shrink-0">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    )
  }

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer min-h-[30px] px-2 py-1 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
      onClick={() => setEditing(true)}
    >
      {v ? (
        <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 text-sm text-blue-600 hover:underline truncate">{v}</a>
      ) : (
        <span className="flex-1 text-sm text-gray-400">{placeholder ?? t('common.clickToAddLink')}</span>
      )}
      <svg className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" /></svg>
    </div>
  )
}

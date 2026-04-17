'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StageBadge } from '@/components/influencers/stage-badge'
import { StalenessBadge } from '@/components/influencers/staleness-badge'
import { isFollowupOverdue } from '@/lib/staleness'
import type {
  Influencer, CommunicationLog, ActivityLog, Profile, InfluencerStage, ContactMethod
} from '@/types/database'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  ArrowLeft, ExternalLink, AlertCircle, Plus,
  FileText, DollarSign, BarChart2, MessageSquare, Clock, Link2, Copy, Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface InfluencerDetailProps {
  influencer: Influencer
  communicationLogs: CommunicationLog[]
  activityLogs: ActivityLog[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]
}

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
const DEAL_TYPES = ['推文','视频','Story','直播','其他']
const CONTACT_METHODS: ContactMethod[] = ['DM','邮件','电话','其他']

export function InfluencerDetail({
  influencer: initial, communicationLogs: initialLogs, activityLogs, profiles,
}: InfluencerDetailProps) {
  const supabase = createClient()
  const [inf, setInf] = useState(initial)
  const [logs, setLogs] = useState(initialLogs)
  const [saving, setSaving] = useState(false)

  // Attribution stats
  const [attrStats, setAttrStats] = useState<{ clicks: number; conversions: number } | null>(null)
  const [attrLoading, setAttrLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadAttrStats = useCallback(async () => {
    if (!inf.kol_slug) return
    setAttrLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const [{ count: clicks }, { count: conversions }] = await Promise.all([
      sb.from('click_events').select('id', { count: 'exact', head: true }).eq('kol_slug', inf.kol_slug),
      sb.from('conversion_events').select('id', { count: 'exact', head: true }).eq('kol_slug', inf.kol_slug),
    ])
    setAttrStats({ clicks: clicks ?? 0, conversions: conversions ?? 0 })
    setAttrLoading(false)
  }, [inf.kol_slug, supabase])

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

  // Communication log form
  const [logMethod, setLogMethod] = useState<ContactMethod>('DM')
  const [logSummary, setLogSummary] = useState('')
  const [addingLog, setAddingLog] = useState(false)

  const overdue = isFollowupOverdue(inf.next_followup_date)

  async function updateField<K extends keyof Influencer>(key: K, value: Influencer[K]) {
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ [key]: value })
      .eq('id', inf.id)
    if (!error) setInf((prev) => ({ ...prev, [key]: value }))
    setSaving(false)
  }

  async function updateStage(stage: InfluencerStage) {
    setSaving(true)
    const extra: Record<string, unknown> = {}
    const syncedStatus = PAYMENT_STAGE_SYNC[stage]
    if (syncedStatus) extra['payment_status'] = syncedStatus

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('influencers')
      .update({ current_stage: stage, ...extra })
      .eq('id', inf.id)
    if (!error) setInf((prev) => ({ ...prev, current_stage: stage, ...extra }))

    // Log activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('activity_logs').insert({
      influencer_id: inf.id,
      action: 'stage_changed',
      field_name: 'current_stage',
      old_value: inf.current_stage,
      new_value: stage,
      description: `阶段从「${inf.current_stage}」改为「${stage}」`,
    })
    setSaving(false)
  }

  async function addCommunicationLog() {
    if (!logSummary.trim()) return
    setAddingLog(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('communication_logs')
      .insert({
        influencer_id: inf.id,
        method: logMethod,
        summary: logSummary.trim(),
        source: 'manual',
      })
      .select('*, profile:profiles(id, display_name, email, avatar_url)')
      .single()

    if (!error && data) {
      setLogs((prev) => [data as CommunicationLog, ...prev])
      setLogSummary('')
      // Update last_contact_date
      await updateField('last_contact_date', new Date().toISOString())
    }
    setAddingLog(false)
  }

  function formatFollowers(n: number | null) {
    if (n == null) return '—'
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
            {overdue && <AlertCircle className="h-4 w-4 text-red-500" aria-label="跟进已逾期" />}
            {saving && <span className="text-xs text-gray-400">保存中…</span>}
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
              <span className="text-gray-400">· {formatFollowers(inf.followers_count)} 粉丝</span>
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
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="info">
          <TabsList className="mb-4">
            <TabsTrigger value="info"><FileText className="h-3.5 w-3.5 mr-1.5" />基础 & 合作</TabsTrigger>
            <TabsTrigger value="finance"><DollarSign className="h-3.5 w-3.5 mr-1.5" />财务</TabsTrigger>
            <TabsTrigger value="performance"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />效果</TabsTrigger>
            <TabsTrigger value="logs"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />沟通记录</TabsTrigger>
            <TabsTrigger value="activity"><Clock className="h-3.5 w-3.5 mr-1.5" />操作日志</TabsTrigger>
            <TabsTrigger value="attribution"><Link2 className="h-3.5 w-3.5 mr-1.5" />归因追踪</TabsTrigger>
          </TabsList>

          {/* Basic & Deal tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">基础信息</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label="类别">
                    <Select value={inf.category ?? ''} onValueChange={(v) => updateField('category', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择类别" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="粉丝数">
                    <EditableNumber value={inf.followers_count} onSave={(v) => updateField('followers_count', v)} />
                  </Field>
                  <Field label="负责人">
                    <Select value={inf.assigned_to ?? ''} onValueChange={(v) => updateField('assigned_to', v || null)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="未分配" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">未分配</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="下次跟进">
                    <input
                      type="date"
                      className={`w-full text-sm border rounded px-2 py-1 ${overdue ? 'border-red-300 text-red-600' : 'border-gray-200'}`}
                      value={inf.next_followup_date ?? ''}
                      onChange={(e) => updateField('next_followup_date', e.target.value || null)}
                    />
                  </Field>
                  <Field label="备注">
                    <textarea
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 resize-none"
                      rows={3}
                      value={inf.notes ?? ''}
                      onChange={(e) => updateField('notes', e.target.value || null)}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">合作条款</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label="合作形式">
                    <Select value={inf.deal_type ?? ''} onValueChange={(v) => updateField('deal_type', v as never || null)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择形式" /></SelectTrigger>
                      <SelectContent>
                        {DEAL_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="报价/条">
                    <EditableNumber value={inf.quote_per_post} onSave={(v) => updateField('quote_per_post', v)} prefix="¥" />
                  </Field>
                  <Field label="合同金额">
                    <EditableNumber value={inf.contract_value} onSave={(v) => updateField('contract_value', v)} prefix="¥" />
                  </Field>
                  <Field label="合同链接">
                    <EditableUrl value={inf.contract_url} onSave={(v) => updateField('contract_url', v)} />
                  </Field>
                </CardContent>
              </Card>
            </div>

            {/* Content progress */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">内容进度</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
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
                    <EditableUrl value={inf.draft1_url} onSave={(v) => updateField('draft1_url', v)} placeholder="Draft 1 链接" />
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
                    <EditableUrl value={inf.draft2_url} onSave={(v) => updateField('draft2_url', v)} placeholder="Draft 2 链接" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="预定发布日">
                    <input
                      type="date"
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                      value={inf.publish_date ?? ''}
                      onChange={(e) => updateField('publish_date', e.target.value || null)}
                    />
                  </Field>
                  <Field label="发布链接">
                    <EditableUrl value={inf.post_url} onSave={(v) => updateField('post_url', v)} placeholder="发布后粘贴链接" />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance tab */}
          <TabsContent value="finance">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">财务信息</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="付款状态">
                  <Select value={inf.payment_status} onValueChange={(v) => updateField('payment_status', v as never)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未开票">未开票</SelectItem>
                      <SelectItem value="已开票">已开票</SelectItem>
                      <SelectItem value="已付款">已付款</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Invoice 编号">
                  <EditableText value={inf.invoice_number} onSave={(v) => updateField('invoice_number', v)} />
                </Field>
                <Field label="Invoice 金额">
                  <EditableNumber value={inf.invoice_amount} onSave={(v) => updateField('invoice_amount', v)} prefix="¥" />
                </Field>
                <Field label="付款截止日">
                  <input
                    type="date"
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                    value={inf.payment_due_date ?? ''}
                    onChange={(e) => updateField('payment_due_date', e.target.value || null)}
                  />
                </Field>
                <Field label="实际付款日">
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
              <CardHeader className="pb-3"><CardTitle className="text-sm">效果数据（手动填入）</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <Field label="曝光量">
                  <EditableNumber value={inf.impressions} onSave={(v) => updateField('impressions', v)} />
                </Field>
                <Field label="互动率 (%)">
                  <EditableNumber value={inf.engagement_rate} onSave={(v) => updateField('engagement_rate', v)} />
                </Field>
                <Field label="点击量">
                  <EditableNumber value={inf.clicks} onSave={(v) => updateField('clicks', v)} />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communication logs tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">沟通记录</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add log form */}
                <div className="flex gap-2 items-start">
                  <Select value={logMethod} onValueChange={(v) => setLogMethod(v as ContactMethod)}>
                    <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_METHODS.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <input
                    className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                    placeholder="这次沟通的内容摘要…"
                    value={logSummary}
                    onChange={(e) => setLogSummary(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCommunicationLog()}
                  />
                  <Button size="sm" onClick={addCommunicationLog} disabled={addingLog || !logSummary.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Log list */}
                <div className="space-y-2">
                  {logs.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">暂无沟通记录</p>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm border-l-2 border-gray-200 pl-3 py-1">
                      <div className="shrink-0">
                        <Badge variant="outline" className="text-xs">{log.method}</Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800">{log.summary}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(log.contacted_at), { addSuffix: true, locale: zhCN })}
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
                <CardTitle className="text-sm">追踪链接</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!inf.kol_slug ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-gray-500">还没有生成追踪链接，点击生成一个专属 slug。</p>
                    <Button size="sm" onClick={handleGenerateSlug}>生成追踪链接</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">Slug</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1">
                          {inf.kol_slug}
                        </code>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">追踪链接（分享给受众）</label>
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
                      <label className="text-xs text-gray-500 font-medium">目标 URL（跳转目的地）</label>
                      <EditableUrl
                        value={inf.tracking_url}
                        onSave={(v) => updateField('tracking_url', v)}
                        placeholder="https://yoursite.com/register（空则用环境变量默认值）"
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
                    <p className="text-xs text-gray-500 mb-1">点击数</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {attrLoading ? '…' : (attrStats?.clicks ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 mb-1">转化数</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {attrLoading ? '…' : (attrStats?.conversions ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 mb-1">转化率</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {attrLoading || !attrStats ? '…' : attrStats.clicks === 0 ? '—' : `${((attrStats.conversions / attrStats.clicks) * 100).toFixed(1)}%`}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {inf.kol_slug && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">嵌入代码（放在落地页 &lt;head&gt; 里）</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
{`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/embed.js"></script>`}
                  </pre>
                  <p className="text-xs text-gray-500">
                    用户注册时调用 <code className="bg-gray-100 px-1 rounded">window.kolTrack(&apos;register&apos;)</code> 上报转化。
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity log tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">操作日志</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activityLogs.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">暂无操作记录</p>
                  )}
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700">{log.description ?? log.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {format(new Date(log.created_at), 'MM-dd HH:mm', { locale: zhCN })}
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
  const [v, setV] = useState(value ?? '')
  return (
    <input
      type="text"
      className="w-full text-sm border border-gray-200 rounded px-2 py-1"
      placeholder={placeholder ?? '—'}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v.trim() || null)}
    />
  )
}

function EditableNumber({
  value, onSave, prefix,
}: { value: number | null; onSave: (v: number | null) => void; prefix?: string }) {
  const [v, setV] = useState(value?.toString() ?? '')
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
      <input
        type="number"
        className="w-full text-sm border border-gray-200 rounded px-2 py-1"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v ? parseFloat(v) : null)}
      />
    </div>
  )
}

function EditableUrl({
  value, onSave, placeholder,
}: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [v, setV] = useState(value ?? '')
  return (
    <div className="flex items-center gap-1">
      <input
        type="url"
        className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
        placeholder={placeholder ?? 'https://…'}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v.trim() || null)}
      />
      {v && (
        <a href={v} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500 shrink-0">
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}

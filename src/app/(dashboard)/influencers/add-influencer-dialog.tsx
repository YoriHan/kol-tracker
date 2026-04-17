'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Influencer } from '@/types/database'

const CATEGORIES = ['美妆','时尚','科技','游戏','美食','旅行','健身','生活方式','教育','金融','其他']

interface AddInfluencerDialogProps {
  open: boolean
  onClose: () => void
  onAdded: (influencer: Influencer) => void
}

export function AddInfluencerDialog({ open, onClose, onAdded }: AddInfluencerDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [urlOrHandle, setUrlOrHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [followers, setFollowers] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')

  const RESERVED_HANDLES = new Set(['home', 'i', 'explore', 'notifications', 'messages', 'settings', 'search'])

  // Parse Twitter handle from URL or @handle or plain handle
  function parseHandle(input: string): string {
    const trimmed = input.trim()
    const urlMatch = trimmed.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i)
    if (urlMatch) {
      const candidate = urlMatch[1].toLowerCase()
      if (RESERVED_HANDLES.has(candidate)) return ''
      return urlMatch[1]
    }
    return trimmed.replace(/^@/, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanHandle = parseHandle(urlOrHandle)
    if (!cleanHandle) return

    if (cleanHandle.length > 15) {
      setError('Twitter 用户名最长 15 位')
      return
    }

    setLoading(true)
    setError(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from('influencers')
      .insert({
        twitter_handle: cleanHandle,
        display_name: displayName.trim() || null,
        followers_count: followers ? parseInt(followers.replace(/,/g, '')) || null : null,
        category: category || null,
        notes: notes.trim() || null,
      })
      .select()
      .single()

    if (err) {
      setError(err.message.includes('unique') ? '该用户名已存在' : err.message)
      setLoading(false)
      return
    }

    onAdded(data as Influencer)
    handleClose()
  }

  function handleClose() {
    setUrlOrHandle('')
    setDisplayName('')
    setFollowers('')
    setCategory('')
    setNotes('')
    setError(null)
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加红人</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Twitter 链接或用户名 *</label>
            <Input
              placeholder="https://x.com/username 或 @handle"
              value={urlOrHandle}
              onChange={(e) => setUrlOrHandle(e.target.value)}
              required
              autoFocus
            />
            {urlOrHandle && (() => {
              const parsed = parseHandle(urlOrHandle)
              return parsed ? (
                <p className="text-xs text-gray-400">识别为：@{parsed}</p>
              ) : null
            })()}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">显示名称</label>
            <Input
              placeholder="留空则显示用户名"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">粉丝数</label>
              <Input
                placeholder="如 1,234,567"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">类别</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类别" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">备注</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded px-3 py-2 resize-none"
              placeholder="可选备注…"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>取消</Button>
            <Button type="submit" disabled={loading || !urlOrHandle.trim()}>
              {loading ? '添加中…' : '添加'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

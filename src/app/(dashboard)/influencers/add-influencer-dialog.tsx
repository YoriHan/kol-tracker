'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/provider'
import type { Influencer } from '@/types/database'

// Stored values stay Chinese — display labels go through `tCategory`.
const CATEGORIES = ['美妆','时尚','科技','游戏','美食','旅行','健身','生活方式','教育','金融','其他']

interface AddInfluencerDialogProps {
  open: boolean
  onClose: () => void
  onAdded: (influencer: Influencer) => void
}

export function AddInfluencerDialog({ open, onClose, onAdded }: AddInfluencerDialogProps) {
  const supabase = createClient()
  const { t, tCategory } = useTranslation()
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
      setError(t('addDialog.handleTooLong'))
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
      setError(err.message.includes('unique') ? t('addDialog.duplicateHandle') : err.message)
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
          <DialogTitle>{t('addDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">{t('addDialog.handleLabel')}</label>
            <Input
              placeholder={t('addDialog.handlePlaceholder')}
              value={urlOrHandle}
              onChange={(e) => setUrlOrHandle(e.target.value)}
              required
              autoFocus
            />
            {urlOrHandle && (() => {
              const parsed = parseHandle(urlOrHandle)
              return parsed ? (
                <p className="text-xs text-gray-400">{t('addDialog.parsedAs', { handle: parsed })}</p>
              ) : null
            })()}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">{t('addDialog.displayNameLabel')}</label>
            <Input
              placeholder={t('addDialog.displayNamePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">{t('addDialog.followersLabel')}</label>
              <Input
                placeholder={t('addDialog.followersPlaceholder')}
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">{t('addDialog.categoryLabel')}</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('addDialog.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{tCategory(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">{t('addDialog.notesLabel')}</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded px-3 py-2 resize-none"
              placeholder={t('addDialog.notesPlaceholder')}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading || !urlOrHandle.trim()}>
              {loading ? t('addDialog.submitting') : t('addDialog.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

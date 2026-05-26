'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/provider'
import type { Influencer } from '@/types/database'
import { Upload, AlertCircle, CheckCircle } from 'lucide-react'

interface ImportCsvDialogProps {
  open: boolean
  onClose: () => void
  onImported: (influencers: Influencer[]) => void
}

type ParsedRow = Record<string, string>

export function ImportCsvDialog({ open, onClose, onImported }: ImportCsvDialogProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [imported, setImported] = useState(0)

  const supabase = createClient()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: { data: ParsedRow[] }) => {
        const errs: string[] = []
        const valid = results.data.filter((row: ParsedRow, i: number) => {
          if (!row['twitter_handle'] && !row['Twitter Handle'] && !row['handle']) {
            errs.push(t('importDialog.rowMissingHandle', { row: i + 2 }))
            return false
          }
          return true
        })
        setRows(valid)
        setErrors(errs)
        setStep('preview')
      },
    })
  }

  function normalizeRow(row: ParsedRow) {
    const handle =
      (row['twitter_handle'] || row['Twitter Handle'] || row['handle'] || '')
        .replace(/^@/, '')
        .trim()

    return {
      twitter_handle: handle,
      display_name: row['display_name'] || row['Name'] || row['name'] || null,
      followers_count: parseInt((row['followers_count'] || row['Followers'] || '0').replace(/,/g, '')) || null,
      category: row['category'] || row['Category'] || null,
      notes: row['notes'] || row['Notes'] || null,
    }
  }

  async function handleImport() {
    setStep('importing')
    const normalized = rows.map(normalizeRow).filter((r) => r.twitter_handle)
    const errs: string[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('influencers')
      .upsert(normalized, { onConflict: 'twitter_handle', ignoreDuplicates: false })
      .select()

    if (error) {
      errs.push(error.message)
      setErrors(errs)
    } else {
      setImported((data as Influencer[])?.length ?? 0)
      onImported((data as Influencer[]) ?? [])
    }

    setErrors(errs)
    setStep('done')
  }

  function handleClose() {
    setStep('upload')
    setRows([])
    setErrors([])
    setImported(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('importDialog.title')}</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('importDialog.description')}</p>
            <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:border-gray-300 transition-colors">
              <Upload className="h-8 w-8 text-gray-400" />
              <span className="text-sm text-gray-500">{t('importDialog.selectFile')}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('importDialog.foundValid', { count: rows.length })}
              {errors.length > 0 && t('importDialog.skipped', { count: errors.length })}
            </p>
            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 rounded p-3 space-y-1 max-h-24 overflow-y-auto">
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div className="border rounded overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('importDialog.columns.handle')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('importDialog.columns.name')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('importDialog.columns.category')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 20).map((row, i) => {
                    const n = normalizeRow(row)
                    return (
                      <tr key={i}>
                        <td className="px-3 py-1.5">@{n.twitter_handle}</td>
                        <td className="px-3 py-1.5 text-gray-500">{n.display_name ?? t('common.dash')}</td>
                        <td className="px-3 py-1.5 text-gray-500">{n.category ?? t('common.dash')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && (
              <p className="text-xs text-gray-400">{t('importDialog.only20Preview')}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
              <Button onClick={handleImport} disabled={rows.length === 0}>
                {t('importDialog.importN', { n: rows.length })}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center text-gray-500">
            {t('importDialog.importing')}
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            {errors.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>{t('importDialog.success', { n: imported })}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{t('importDialog.failed', { message: errors[0] })}</span>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>{t('common.close')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

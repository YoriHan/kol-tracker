'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { useTranslation } from '@/lib/i18n/provider'

interface ClickEvent {
  created_at: string
}

interface Props {
  clickEvents: ClickEvent[]
}

export function AttributionChart({ clickEvents }: Props) {
  const { t } = useTranslation()
  const data = useMemo(() => {
    const days: { date: string; clicks: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      days.push({ date: d, clicks: 0 })
    }
    const dayMap = new Map(days.map((d) => [d.date, d]))
    for (const ev of clickEvents) {
      const d = ev.created_at.slice(0, 10)
      const entry = dayMap.get(d)
      if (entry) entry.clicks++
    }
    return days.map((d) => ({ ...d, label: format(parseISO(d.date), 'MM/dd') }))
  }, [clickEvents])

  const hasData = data.some((d) => d.clicks > 0)

  if (!hasData) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">{t('chart.noClickData')}</p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          interval={4}
        />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v) => [String(v), t('chart.clicksLabel')]}
          
        />
        <Line
          type="monotone"
          dataKey="clicks"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface AlertData {
  counts: { high: number; medium: number; low: number; total: number }
  topItems: string[]
}

export function StockAlertBanner() {
  const [data, setData] = useState<AlertData | null>(null)

  useEffect(() => {
    fetch('/api/recommendations')
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (!res?.recommendations) return
        const recs = res.recommendations as Array<{ name: string; urgency: string }>
        const highMed = recs.filter(r => r.urgency === 'high' || r.urgency === 'medium')
        setData({
          counts: res.counts,
          topItems: highMed.slice(0, 3).map(r => r.name),
        })
      })
      .catch(() => {})
  }, [])

  if (!data || data.counts.total === 0) return null

  const urgent = data.counts.high + data.counts.medium

  return (
    <Link href="/recommendations">
      <div className="card px-4 py-4 border-l-4 border-l-terra-500 animate-fade-up active:scale-[0.98] transition-transform">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-forest-800 font-body">
              {urgent > 0
                ? `${urgent} produit${urgent > 1 ? 's' : ''} à réapprovisionner`
                : `${data.counts.low} suggestion${data.counts.low > 1 ? 's' : ''} d'achat`
              }
            </p>
            {data.topItems.length > 0 && (
              <p className="text-xs text-stone-warm/70 font-body mt-0.5">
                {data.topItems.join(', ')}{data.counts.total > 3 ? ` +${data.counts.total - 3} autres` : ''}
              </p>
            )}
          </div>
          <span className="text-xs text-terra-500 font-medium font-body whitespace-nowrap mt-0.5">
            Voir →
          </span>
        </div>
      </div>
    </Link>
  )
}

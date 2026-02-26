'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const suppliers = [
  { name: 'Picnic', color: '#FF6B35', emoji: '🛒' },
  { name: 'La Fourche', color: '#2d6a2d', emoji: '🌿' },
  { name: 'Le Fourgon', color: '#1a3a5c', emoji: '🚐' },
  { name: 'Marché', color: '#c0622a', emoji: '🥕' },
]

interface DashboardStats {
  monthlySpend: number
  supplierSpend: Record<string, number>
  stockOk: number
  stockLow: number
  stockMissing: number
  stockTotal: number
}

export function DashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard-stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stockPercent = stats && stats.stockTotal > 0
    ? Math.round((stats.stockOk / stats.stockTotal) * 100)
    : 0

  const stockColor = stockPercent >= 70 ? 'bg-forest-600' : stockPercent >= 40 ? 'bg-terra-400' : 'bg-red-400'
  const stockLabel = stockPercent >= 70 ? 'Bien approvisionné' : stockPercent >= 40 ? 'Stock moyen' : 'Stock bas'

  return (
    <>
      {/* Dépenses du mois + Jauge de stock */}
      <section className="animate-fade-up animate-delay-150">
        <div className="grid grid-cols-2 gap-3">
          {/* Dépenses du mois */}
          <div className="card px-4 py-4 text-center">
            <p className="text-xs text-stone-warm/60 font-body mb-1">Dépenses ce mois</p>
            {loading ? (
              <div className="skeleton h-7 w-20 mx-auto" />
            ) : (
              <p className="font-display text-2xl text-forest-800 font-medium">
                {stats ? `${stats.monthlySpend.toFixed(0)}€` : '—'}
              </p>
            )}
          </div>

          {/* Jauge de stock */}
          <div className="card px-4 py-4">
            <p className="text-xs text-stone-warm/60 font-body mb-1 text-center">Niveau de stock</p>
            {loading ? (
              <div className="skeleton h-7 w-full mx-auto" />
            ) : stats && stats.stockTotal > 0 ? (
              <>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-forest-700 font-body">{stockLabel}</span>
                  <span className="text-xs text-stone-warm/60 font-body">{stockPercent}%</span>
                </div>
                <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${stockColor}`}
                    style={{ width: `${stockPercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-stone-warm/50 font-body">{stats.stockOk} OK</span>
                  {stats.stockLow > 0 && (
                    <span className="text-[10px] text-terra-500 font-body">{stats.stockLow} bas</span>
                  )}
                  {stats.stockMissing > 0 && (
                    <span className="text-[10px] text-red-500 font-body">{stats.stockMissing} manquant{stats.stockMissing > 1 ? 's' : ''}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="font-display text-lg text-stone-warm/40 text-center">—</p>
            )}
          </div>
        </div>
      </section>

      {/* Fournisseurs — lien vers dépenses par fournisseur */}
      <section className="animate-fade-up animate-delay-200">
        <h2 className="font-display text-base text-forest-700 mb-3 font-medium">Fournisseurs</h2>
        <div className="space-y-2.5">
          {suppliers.map((s) => {
            const spend = stats?.supplierSpend?.[s.name] ?? 0
            return (
              <Link key={s.name} href={`/history?supplier=${encodeURIComponent(s.name)}`}>
                <div className="card px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: s.color + '18' }}
                  >
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-forest-800 font-body">{s.name}</p>
                    {loading ? (
                      <div className="skeleton h-3 w-16 mt-0.5" />
                    ) : (
                      <p className="text-xs text-stone-warm/60 font-body">
                        {spend > 0 ? `${spend.toFixed(2)} € ce mois` : 'Aucune dépense ce mois'}
                      </p>
                    )}
                  </div>
                  <span className="text-stone-warm/30 text-sm">›</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}

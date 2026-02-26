'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface TopProduct {
  name: string
  count: number
  totalSpent: number
  suppliers: string[]
}

interface SupplierFreq {
  orderCount: number
  avgDaysBetween: number | null
  avgSpend: number
  lastOrder: string
}

interface MonthlySpend {
  month: string
  total: number
}

interface Insight {
  type: string
  icon: string
  title: string
  description: string
}

interface NextOrder {
  supplier: string
  suggested_date: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

interface SavingsTip {
  tip: string
}

interface AnalysisData {
  hasData: boolean
  message?: string
  stats?: {
    totalOrders: number
    totalSpend: string
    topProducts: TopProduct[]
    supplierFrequency: Record<string, SupplierFreq>
    monthlySpending: MonthlySpend[]
  }
  ai?: {
    insights: Insight[]
    next_orders: NextOrder[]
    savings_tips: SavingsTip[]
    summary: string
  }
}

const SUPPLIER_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  'Picnic':      { emoji: '🛒', color: '#FF6B35', bg: '#fff3ee' },
  'La Fourche':  { emoji: '🌿', color: '#2d6a2d', bg: '#eef4ee' },
  'Le Fourgon':  { emoji: '🚐', color: '#1a3a5c', bg: '#eef1f6' },
  'Marché':      { emoji: '🥕', color: '#c0622a', bg: '#fdf0ea' },
}

function getSupplier(name: string) {
  return SUPPLIER_CONFIG[name] || { emoji: '📦', color: '#8c7b6b', bg: '#f5f0ec' }
}

const CONFIDENCE_CONFIG = {
  high:   { label: 'Fiable',    color: 'text-forest-600', bg: 'bg-forest-100' },
  medium: { label: 'Probable',  color: 'text-terra-500',  bg: 'bg-terra-100' },
  low:    { label: 'Indicatif', color: 'text-stone-warm', bg: 'bg-cream-200' },
}

function formatMonthLabel(ym: string) {
  try {
    const [y, m] = ym.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1)
    return d.toLocaleDateString('fr-FR', { month: 'short' })
  } catch { return ym }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch { return dateStr }
}

function daysUntil(dateStr: string) {
  try {
    const target = new Date(dateStr).getTime()
    const now = Date.now()
    return Math.round((target - now) / (1000 * 60 * 60 * 24))
  } catch { return null }
}

export default function AnalyticsPage() {
  const [data, setData]       = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [showAllProducts, setShowAllProducts] = useState(false)

  useEffect(() => {
    fetch('/api/analyze')
      .then(r => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => {
        setError('Impossible de charger l\'analyse')
        setLoading(false)
      })
  }, [])

  return (
    <>
      <AppHeader title="Analyse" subtitle="Vos habitudes de courses" />

      <div className="px-5 py-5 space-y-6">

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="w-16 h-16 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin mb-6" />
              <p className="font-display text-lg text-forest-800 mb-1">Analyse en cours…</p>
              <p className="text-sm text-stone-warm/60 font-body text-center max-w-xs">
                Claude étudie vos habitudes d'achat
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card px-5 py-5 border-l-4 border-l-terra-500 animate-fade-up">
            <p className="text-sm font-medium text-forest-800 font-body">{error}</p>
            <button onClick={() => window.location.reload()} className="text-sm text-terra-500 font-body mt-2">
              Réessayer →
            </button>
          </div>
        )}

        {/* No data */}
        {data && !data.hasData && (
          <div className="card px-5 py-10 text-center animate-fade-up">
            <p className="text-3xl mb-3">📊</p>
            <p className="font-display text-base text-forest-800 mb-1">Pas encore de données</p>
            <p className="text-sm text-stone-warm/60 font-body mb-4">{data.message}</p>
            <Link href="/import" className="btn-primary">
              📄 Importer une facture
            </Link>
          </div>
        )}

        {/* Main content */}
        {data?.hasData && data.stats && data.ai && (
          <>
            {/* AI Summary */}
            <div className="card-elevated px-5 py-5 bg-forest-800 text-cream-50 relative overflow-hidden animate-fade-up">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-forest-600/30" />
              <div className="absolute -right-4 -bottom-10 w-24 h-24 rounded-full bg-terra-500/15" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <span className="text-xs font-medium font-body text-cream-100/70 uppercase tracking-wider">Résumé IA</span>
                </div>
                <p className="font-display text-base text-cream-50 leading-relaxed">
                  {data.ai.summary}
                </p>
              </div>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3 animate-fade-up animate-delay-100">
              <div className="card px-4 py-3.5 text-center">
                <p className="font-display text-2xl text-forest-800 font-medium">{data.stats.totalOrders}</p>
                <p className="text-xs text-stone-warm/60 font-body mt-0.5">Commandes</p>
              </div>
              <div className="card px-4 py-3.5 text-center">
                <p className="font-display text-2xl text-forest-800 font-medium">{data.stats.totalSpend} €</p>
                <p className="text-xs text-stone-warm/60 font-body mt-0.5">Total dépensé</p>
              </div>
            </div>

            {/* Next suggested orders */}
            {data.ai.next_orders.length > 0 && (
              <section className="animate-fade-up animate-delay-200">
                <h2 className="font-display text-base text-forest-700 font-medium mb-3">
                  Prochaines commandes suggérées
                </h2>
                <div className="space-y-2.5">
                  {data.ai.next_orders.map((order, i) => {
                    const supplier = getSupplier(order.supplier)
                    const days = daysUntil(order.suggested_date)
                    const conf = CONFIDENCE_CONFIG[order.confidence] || CONFIDENCE_CONFIG.medium
                    return (
                      <div key={i} className="card overflow-hidden">
                        <div className="h-0.5 w-full" style={{ backgroundColor: supplier.color }} />
                        <div className="px-4 py-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{supplier.emoji}</span>
                              <span className="text-sm font-medium text-forest-800 font-body">{order.supplier}</span>
                            </div>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium font-body', conf.bg, conf.color)}>
                              {conf.label}
                            </span>
                          </div>
                          <p className="font-display text-lg text-forest-800 font-medium capitalize">
                            {formatDate(order.suggested_date)}
                          </p>
                          {days !== null && (
                            <p className="text-xs text-terra-500 font-medium font-body mt-0.5">
                              {days <= 0 ? 'Aujourd\'hui ou en retard' : days === 1 ? 'Demain' : `Dans ${days} jours`}
                            </p>
                          )}
                          <p className="text-xs text-stone-warm/60 font-body mt-1">{order.reason}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* AI Insights */}
            {data.ai.insights.length > 0 && (
              <section className="animate-fade-up animate-delay-300">
                <h2 className="font-display text-base text-forest-700 font-medium mb-3">
                  Observations
                </h2>
                <div className="space-y-2.5">
                  {data.ai.insights.map((insight, i) => (
                    <div key={i} className="card px-4 py-3.5 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center text-lg flex-shrink-0">
                        {insight.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-forest-800 font-body">{insight.title}</p>
                        <p className="text-xs text-stone-warm/70 font-body mt-0.5 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Supplier frequency */}
            {Object.keys(data.stats.supplierFrequency).length > 0 && (
              <section className="animate-fade-up">
                <h2 className="font-display text-base text-forest-700 font-medium mb-3">
                  Rythme par fournisseur
                </h2>
                <div className="card divide-y divide-forest-100/30">
                  {Object.entries(data.stats.supplierFrequency)
                    .sort(([,a], [,b]) => b.orderCount - a.orderCount)
                    .map(([name, freq]) => {
                      const supplier = getSupplier(name)
                      return (
                        <div key={name} className="px-4 py-3.5 flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: supplier.bg }}
                          >
                            {supplier.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-forest-800 font-body">{name}</p>
                            <p className="text-xs text-stone-warm/60 font-body">
                              {freq.orderCount} commande{freq.orderCount > 1 ? 's' : ''}
                              {freq.avgDaysBetween !== null && ` · tous les ~${freq.avgDaysBetween} jours`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-forest-700 font-body">
                              {freq.avgSpend.toFixed(0)} €
                            </p>
                            <p className="text-[10px] text-stone-warm/50 font-body">moy./cmd</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </section>
            )}

            {/* Monthly spending chart */}
            {data.stats.monthlySpending.length > 1 && (
              <section className="animate-fade-up">
                <h2 className="font-display text-base text-forest-700 font-medium mb-3">
                  Dépenses par mois
                </h2>
                <div className="card px-4 py-4">
                  <div className="flex items-end gap-1.5 h-32">
                    {(() => {
                      const months = data.stats!.monthlySpending.slice(-8)
                      const max = Math.max(...months.map(m => m.total), 1)
                      return months.map((m, i) => {
                        const pct = (m.total / max) * 100
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px] text-stone-warm/60 font-body font-medium">
                              {m.total.toFixed(0)}€
                            </span>
                            <div className="w-full relative" style={{ height: '80px' }}>
                              <div
                                className="absolute bottom-0 w-full rounded-t-md bg-forest-400 transition-all duration-700"
                                style={{
                                  height: `${pct}%`,
                                  animationDelay: `${i * 80}ms`,
                                  opacity: i === months.length - 1 ? 1 : 0.6,
                                }}
                              />
                            </div>
                            <span className="text-[9px] text-stone-warm/50 font-body">
                              {formatMonthLabel(m.month)}
                            </span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </section>
            )}

            {/* Top products */}
            {data.stats.topProducts.length > 0 && (
              <section className="animate-fade-up">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-base text-forest-700 font-medium">
                    Produits les plus achetés
                  </h2>
                  {data.stats.topProducts.length > 5 && (
                    <button
                      onClick={() => setShowAllProducts(!showAllProducts)}
                      className="text-xs text-terra-500 font-medium font-body"
                    >
                      {showAllProducts ? 'Voir moins' : 'Voir tout'}
                    </button>
                  )}
                </div>
                <div className="card divide-y divide-forest-100/30">
                  {data.stats.topProducts
                    .slice(0, showAllProducts ? 20 : 5)
                    .map((product, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs font-medium text-stone-warm/40 font-body w-5 text-right flex-shrink-0">
                            {i + 1}.
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-forest-800 font-body font-medium truncate">{product.name}</p>
                            <p className="text-xs text-stone-warm/50 font-body">
                              {product.suppliers.join(', ')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium text-forest-700 font-body">{product.count}x</p>
                          {product.totalSpent > 0 && (
                            <p className="text-[10px] text-stone-warm/50 font-body">{product.totalSpent.toFixed(2)} €</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Savings tips */}
            {data.ai.savings_tips.length > 0 && (
              <section className="animate-fade-up">
                <h2 className="font-display text-base text-forest-700 font-medium mb-3">
                  Conseils
                </h2>
                <div className="space-y-2">
                  {data.ai.savings_tips.map((tip, i) => (
                    <div key={i} className="card px-4 py-3 flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">💡</span>
                      <p className="text-sm text-stone-warm/80 font-body leading-relaxed">{tip.tip}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Action */}
            <div className="flex gap-3 pt-2 animate-fade-up">
              <Link href="/shopping-list" className="btn-primary flex-1 text-center">
                🛍️ Mes courses
              </Link>
              <Link href="/import" className="btn-secondary flex-1 text-center">
                📄 Importer
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  )
}

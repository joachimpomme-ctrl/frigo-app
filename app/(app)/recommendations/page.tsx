'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Recommendation {
  id: string
  name: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
  source: 'inventory' | 'frequency' | 'history'
  supplier: string
  suggestedQuantity: string
  lastSeen: string
}

interface Counts {
  high: number
  medium: number
  low: number
  total: number
}

const URGENCY_CONFIG = {
  high:   { label: 'Urgent',    color: 'text-red-600',    bg: 'bg-red-50',      dot: 'bg-red-400',    border: 'border-red-200' },
  medium: { label: 'A prévoir', color: 'text-terra-500',  bg: 'bg-terra-100',   dot: 'bg-terra-300',  border: 'border-terra-200' },
  low:    { label: 'Suggestion',color: 'text-forest-600', bg: 'bg-forest-50',   dot: 'bg-forest-400', border: 'border-forest-100' },
}

const SOURCE_LABELS: Record<string, string> = {
  inventory: 'Inventaire',
  frequency: 'Habitude d\'achat',
  history: 'Stock',
}

const SUPPLIER_CONFIG: Record<string, { emoji: string; color: string }> = {
  'Picnic':      { emoji: '🛒', color: '#FF6B35' },
  'La Fourche':  { emoji: '🌿', color: '#2d6a2d' },
  'Le Fourgon':  { emoji: '🚐', color: '#1a3a5c' },
  'Marché':      { emoji: '🥕', color: '#c0622a' },
}

export default function RecommendationsPage() {
  const [recs, setRecs]           = useState<Recommendation[]>([])
  const [counts, setCounts]       = useState<Counts>({ high: 0, medium: 0, low: 0, total: 0 })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [adding, setAdding]       = useState(false)
  const [addResult, setAddResult] = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'high' | 'medium' | 'low'>('all')

  useEffect(() => {
    fetch('/api/recommendations')
      .then(r => {
        if (!r.ok) throw new Error('Erreur')
        return r.json()
      })
      .then(data => {
        setRecs(data.recommendations || [])
        setCounts(data.counts || { high: 0, medium: 0, low: 0, total: 0 })
        setLoading(false)
      })
      .catch(() => {
        setError('Impossible de charger les recommandations')
        setLoading(false)
      })
  }, [])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setAddResult(null)
  }

  const selectAll = () => {
    const filtered = getFilteredRecs()
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(r => r.id)))
    }
  }

  const addToList = async () => {
    if (selected.size === 0) return
    setAdding(true)
    setAddResult(null)

    const items = recs
      .filter(r => selected.has(r.id))
      .map(r => ({
        name: r.name,
        quantity: r.suggestedQuantity || '1',
        supplier: r.supplier || '',
      }))

    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setAddResult(data.message)
      // Retirer les items ajoutés de la liste
      setRecs(prev => prev.filter(r => !selected.has(r.id)))
      setCounts(prev => {
        const removed = recs.filter(r => selected.has(r.id))
        return {
          high: prev.high - removed.filter(r => r.urgency === 'high').length,
          medium: prev.medium - removed.filter(r => r.urgency === 'medium').length,
          low: prev.low - removed.filter(r => r.urgency === 'low').length,
          total: prev.total - removed.length,
        }
      })
      setSelected(new Set())
    } catch {
      setAddResult('Erreur lors de l\'ajout')
    } finally {
      setAdding(false)
    }
  }

  const getFilteredRecs = () => {
    if (filter === 'all') return recs
    return recs.filter(r => r.urgency === filter)
  }

  const filtered = getFilteredRecs()

  return (
    <>
      <AppHeader
        title="Recommandations"
        subtitle={counts.total > 0 ? `${counts.total} produit${counts.total > 1 ? 's' : ''} suggéré${counts.total > 1 ? 's' : ''}` : 'Suggestions intelligentes'}
      />

      <div className="px-5 py-5 space-y-5">

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card p-4 space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
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

        {/* Empty state */}
        {!loading && !error && recs.length === 0 && (
          <div className="card px-5 py-10 text-center animate-fade-up">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-display text-base text-forest-800 mb-1">Tout est en ordre !</p>
            <p className="text-sm text-stone-warm/60 font-body mb-4">
              Aucun produit à réapprovisionner pour le moment
            </p>
            <Link href="/fridge" className="btn-secondary">
              📷 Scanner le frigo
            </Link>
          </div>
        )}

        {/* Content */}
        {!loading && !error && recs.length > 0 && (
          <>
            {/* Urgency summary */}
            <div className="grid grid-cols-3 gap-2 animate-fade-up">
              {(['high', 'medium', 'low'] as const).map(level => {
                const conf = URGENCY_CONFIG[level]
                const count = counts[level]
                const isActive = filter === level
                return (
                  <button
                    key={level}
                    onClick={() => setFilter(filter === level ? 'all' : level)}
                    className={cn(
                      'rounded-xl px-3 py-2.5 text-center transition-all',
                      isActive ? 'ring-2 ring-forest-400' : '',
                      conf.bg,
                    )}
                  >
                    <p className={cn('font-display text-xl font-medium', conf.color)}>{count}</p>
                    <p className={cn('text-[10px] font-body font-medium', conf.color)}>{conf.label}</p>
                  </button>
                )
              })}
            </div>

            {/* Select all + add to list bar */}
            <div className="flex items-center justify-between animate-fade-up animate-delay-100">
              <button
                onClick={selectAll}
                className="text-xs font-medium text-forest-600 font-body"
              >
                {selected.size === filtered.length && filtered.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              {selected.size > 0 && (
                <button
                  onClick={addToList}
                  disabled={adding}
                  className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
                >
                  {adding ? (
                    <div className="w-4 h-4 border-2 border-cream-100/30 border-t-cream-50 rounded-full animate-spin" />
                  ) : (
                    `🛍️ Ajouter ${selected.size} aux courses`
                  )}
                </button>
              )}
            </div>

            {/* Success message */}
            {addResult && (
              <div className={cn(
                'px-4 py-3 rounded-xl text-sm font-body animate-scale-in',
                addResult.startsWith('Erreur') ? 'bg-terra-100 text-terra-500' : 'bg-forest-50 text-forest-600'
              )}>
                {addResult.startsWith('Erreur') ? '⚠️' : '✓'} {addResult}
                {!addResult.startsWith('Erreur') && (
                  <Link href="/shopping-list" className="ml-2 underline font-medium">
                    Voir la liste →
                  </Link>
                )}
              </div>
            )}

            {/* Recommendation cards */}
            <div className="space-y-2 animate-fade-up animate-delay-200">
              {filtered.map((rec, i) => {
                const conf = URGENCY_CONFIG[rec.urgency]
                const isSelected = selected.has(rec.id)
                const supplierConf = SUPPLIER_CONFIG[rec.supplier]

                return (
                  <div
                    key={rec.id}
                    className={cn(
                      'card w-full text-left border px-4 py-3.5 transition-all relative',
                      isSelected ? 'border-forest-400 bg-forest-50/30' : conf.border,
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* Bouton supprimer */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRecs(prev => prev.filter(r => r.id !== rec.id))
                        setCounts(prev => ({
                          ...prev,
                          [rec.urgency]: prev[rec.urgency] - 1,
                          total: prev.total - 1,
                        }))
                        setSelected(prev => { const n = new Set(prev); n.delete(rec.id); return n })
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cream-100 flex items-center justify-center text-stone-warm/40 active:bg-red-50 active:text-red-400 transition-colors z-10"
                    >
                      <svg width="10" height="10" fill="none" viewBox="0 0 10 10">
                        <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>

                    <button
                      onClick={() => toggleSelect(rec.id)}
                      className="w-full text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start gap-3 pr-6">
                        {/* Checkbox */}
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
                          isSelected ? 'bg-forest-600 border-forest-600' : 'border-forest-300'
                        )}>
                          {isSelected && (
                            <svg width="10" height="8" fill="none" viewBox="0 0 10 8">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-sm font-medium text-forest-800 font-body truncate">{rec.name}</p>
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium font-body flex-shrink-0',
                              conf.bg, conf.color,
                            )}>
                              {conf.label}
                            </span>
                          </div>

                          <p className="text-xs text-stone-warm/70 font-body leading-relaxed">
                            {rec.reason}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-stone-warm/40 font-body">
                              {SOURCE_LABELS[rec.source] || rec.source}
                            </span>
                            {rec.supplier && (
                              <>
                                <span className="text-stone-warm/20">·</span>
                                <span className="text-[10px] font-body flex items-center gap-1">
                                  {supplierConf && <span>{supplierConf.emoji}</span>}
                                  <span className="text-stone-warm/50">{rec.supplier}</span>
                                </span>
                              </>
                            )}
                            {rec.suggestedQuantity && rec.suggestedQuantity !== '1' && (
                              <>
                                <span className="text-stone-warm/20">·</span>
                                <span className="text-[10px] text-stone-warm/50 font-body">
                                  Qté: {rec.suggestedQuantity}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Bottom actions */}
            <div className="flex gap-3 pt-2">
              <Link href="/fridge" className="btn-secondary flex-1 text-center">
                📷 Nouvel inventaire
              </Link>
              <Link href="/shopping-list" className="btn-primary flex-1 text-center">
                🛍️ Voir les courses
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  )
}

'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Product {
  orderId: string
  date: string
  supplier: string
  name: string
  quantity: string
  unit: string
  price: string
}

interface Order {
  id: string
  date: string
  supplier: string
  items: string
  total: string
  status: string
}

interface Stats {
  totalOrders: number
  totalSpend: string
  supplierStats: Record<string, { count: number; total: number }>
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

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return dateStr }
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch { return dateStr }
}

export default function HistoryPage() {
  const [orders, setOrders]               = useState<Order[]>([])
  const [productsByOrder, setProductsByOrder] = useState<Record<string, Product[]>>({})
  const [stats, setStats]                 = useState<Stats | null>(null)
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState('Tous')
  const [search, setSearch]               = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showSearch, setShowSearch]       = useState(false)

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        setOrders(data.orders || [])
        setProductsByOrder(data.productsByOrder || {})
        setStats(data.stats || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Fournisseurs uniques pour le filtre
  const suppliers = ['Tous', ...Array.from(new Set(orders.map(o => o.supplier))).filter(Boolean)]

  // Filtrage
  const filtered = orders.filter(o => {
    const matchFilter   = filter === 'Tous' || o.supplier === filter
    const matchSearch   = !search || 
      o.supplier.toLowerCase().includes(search.toLowerCase()) ||
      o.items.toLowerCase().includes(search.toLowerCase()) ||
      o.date.includes(search) ||
      o.total.includes(search)
    return matchFilter && matchSearch
  })

  // Grouper par mois
  const grouped: Record<string, Order[]> = {}
  for (const o of filtered) {
    const key = o.date ? o.date.substring(0, 7) : 'Sans date'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(o)
  }

  function formatMonthKey(key: string) {
    if (key === 'Sans date') return key
    try {
      const [y, m] = key.split('-')
      const d = new Date(parseInt(y), parseInt(m) - 1)
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    } catch { return key }
  }

  const orderProducts = selectedOrder ? (productsByOrder[selectedOrder.id] || []) : []

  return (
    <>
      <AppHeader
        title="Historique"
        subtitle={stats ? `${stats.totalOrders} commandes · ${stats.totalSpend} €` : 'Vos factures importées'}
      />

      {/* Detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-cream-50 animate-fade-up">
          {/* Header */}
          <div className="sticky top-0 bg-cream-50/95 backdrop-blur-md border-b border-forest-100/30 px-5 py-4 flex items-center gap-3">
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-8 h-8 rounded-full bg-forest-100 flex items-center justify-center active:scale-90 transition-transform"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="#1e4d1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <h2 className="font-display text-lg text-forest-800 font-medium leading-tight">
                {getSupplier(selectedOrder.supplier).emoji} {selectedOrder.supplier}
              </h2>
              <p className="text-xs text-stone-warm/60 font-body">{formatDate(selectedOrder.date)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-display text-lg text-forest-800 font-medium">{selectedOrder.total}</p>
              <span className="text-[10px] bg-forest-100 text-forest-600 px-2 py-0.5 rounded-full font-body">
                {selectedOrder.status}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 pb-10">

            {/* Résumé */}
            <div className="card px-4 py-3.5">
              <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body mb-2">Résumé</p>
              <p className="text-sm text-stone-warm/80 font-body leading-relaxed">{selectedOrder.items}</p>
            </div>

            {/* Articles détaillés */}
            {orderProducts.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-stone-warm/50 uppercase tracking-wider font-body mb-2">
                  {orderProducts.length} articles détaillés
                </p>
                <div className="card divide-y divide-forest-100/30">
                  {orderProducts.map((p, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-forest-800 font-body font-medium truncate">{p.name}</p>
                        {(p.quantity || p.unit) && (
                          <p className="text-xs text-stone-warm/60 font-body">{p.quantity} {p.unit}</p>
                        )}
                      </div>
                      {p.price && (
                        <p className="text-sm font-medium text-forest-700 font-body flex-shrink-0">{p.price}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card px-4 py-4 text-center">
                <p className="text-sm text-stone-warm/50 font-body">
                  Détail des articles non disponible pour cette commande
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-5 py-5 space-y-5">

        {/* Stats rapides */}
        {stats && !loading && (
          <div className="animate-fade-up">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="card px-4 py-3.5 text-center">
                <p className="font-display text-2xl text-forest-800 font-medium">{stats.totalOrders}</p>
                <p className="text-xs text-stone-warm/60 font-body mt-0.5">Commandes</p>
              </div>
              <div className="card px-4 py-3.5 text-center">
                <p className="font-display text-2xl text-forest-800 font-medium">{stats.totalSpend} €</p>
                <p className="text-xs text-stone-warm/60 font-body mt-0.5">Total dépensé</p>
              </div>
            </div>

            {/* Par fournisseur */}
            {Object.keys(stats.supplierStats).length > 0 && (
              <div className="card px-4 py-3.5">
                <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body mb-3">
                  Par fournisseur
                </p>
                <div className="space-y-2.5">
                  {Object.entries(stats.supplierStats)
                    .sort(([,a], [,b]) => b.total - a.total)
                    .map(([name, s]) => {
                      const config = getSupplier(name)
                      const maxTotal = Math.max(...Object.values(stats.supplierStats).map(x => x.total))
                      const pct = maxTotal > 0 ? (s.total / maxTotal) * 100 : 0
                      return (
                        <div key={name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{config.emoji}</span>
                              <span className="text-xs font-medium text-forest-800 font-body">{name}</span>
                              <span className="text-[10px] text-stone-warm/50 font-body">({s.count} cmd)</span>
                            </div>
                            <span className="text-xs font-medium text-forest-700 font-body">
                              {s.total.toFixed(2)} €
                            </span>
                          </div>
                          <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: config.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Barre recherche + filtres */}
        <div className="space-y-3 animate-fade-up animate-delay-100">
          {/* Recherche */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-warm/40" fill="none" viewBox="0 0 24 24">
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher une facture, un produit…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10 text-sm"
            />
          </div>

          {/* Filtres fournisseurs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
            {suppliers.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium font-body transition-all',
                  filter === s
                    ? 'bg-forest-700 text-cream-50'
                    : 'bg-white text-stone-warm border border-forest-100'
                )}
              >
                {s !== 'Tous' && getSupplier(s).emoji + ' '}{s}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-4 space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Liste groupée par mois */}
        {!loading && Object.keys(grouped).length === 0 && (
          <div className="card px-5 py-10 text-center animate-fade-up">
            <p className="text-3xl mb-3">📄</p>
            <p className="font-display text-base text-forest-800 mb-1">Aucune facture trouvée</p>
            <p className="text-sm text-stone-warm/60 font-body">
              {search ? 'Essayez un autre terme de recherche' : 'Importez vos premières factures PDF'}
            </p>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([monthKey, monthOrders], gi) => (
          <div key={monthKey} className="animate-fade-up" style={{ animationDelay: `${gi * 60}ms` }}>
            {/* Mois header */}
            <div className="flex items-center gap-3 mb-2.5">
              <p className="text-xs font-medium text-stone-warm/50 uppercase tracking-wider font-body">
                {formatMonthKey(monthKey)}
              </p>
              <div className="flex-1 h-px bg-forest-100/60" />
              <p className="text-xs text-stone-warm/40 font-body">
                {monthOrders.reduce((s, o) => {
                  const v = parseFloat(o.total?.replace(/[^0-9.]/g, '') || '0')
                  return s + (isNaN(v) ? 0 : v)
                }, 0).toFixed(2)} €
              </p>
            </div>

            {/* Commandes du mois */}
            <div className="space-y-2">
              {monthOrders.map((order, i) => {
                const config = getSupplier(order.supplier)
                const hasDetail = (productsByOrder[order.id] || []).length > 0
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="card w-full text-left overflow-hidden active:scale-[0.98] transition-transform"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="h-0.5 w-full" style={{ backgroundColor: config.color }} />
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: config.bg }}
                      >
                        {config.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-medium text-forest-800 font-body">{order.supplier}</p>
                          <p className="font-display text-sm font-medium text-forest-800">{order.total}</p>
                        </div>
                        <p className="text-xs text-stone-warm/60 font-body mb-1.5">{formatShortDate(order.date)}</p>
                        <p className="text-xs text-stone-warm/70 font-body leading-relaxed line-clamp-2">
                          {order.items}
                        </p>
                        {hasDetail && (
                          <p className="text-[10px] text-forest-500 font-body mt-1.5">
                            {(productsByOrder[order.id] || []).length} articles détaillés →
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

      </div>
    </>
  )
}

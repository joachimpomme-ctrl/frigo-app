'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Product {
  orderId: string
  date: string
  supplier: string
  name: string
  quantity: string
  unit: string
  price: string
  category?: string
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

// --- Catégorisation des produits ---
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Fruits':    ['pomme', 'banane', 'orange', 'fraise', 'raisin', 'poire', 'cerise', 'mangue', 'ananas', 'kiwi', 'citron', 'melon', 'pastèque', 'abricot', 'pêche', 'prune', 'fruit', 'clémentine', 'mandarine', 'grenade', 'figue', 'myrtille', 'framboise', 'mûre', 'cassis', 'nectarine', 'pamplemousse', 'avocat', 'litchi', 'datte', 'groseille', 'compote'],
  'Légumes':   ['tomate', 'carotte', 'courgette', 'aubergine', 'poivron', 'salade', 'concombre', 'oignon', 'ail', 'pomme de terre', 'haricot vert', 'petit pois', 'brocoli', 'chou', 'épinard', 'radis', 'navet', 'poireau', 'céleri', 'artichaut', 'champignon', 'légume', 'betterave', 'fenouil', 'endive', 'mâche', 'roquette', 'asperge', 'laitue', 'patate', 'courge', 'potiron', 'butternut', 'mais', 'maïs', 'haricot'],
  'Viande':    ['poulet', 'boeuf', 'bœuf', 'porc', 'veau', 'agneau', 'dinde', 'canard', 'saucisse', 'steak', 'filet', 'escalope', 'jambon', 'viande', 'lard', 'bacon', 'merguez', 'chipolata', 'côte', 'rôti', 'hachis', 'haché', 'nugget', 'cordon bleu', 'pâté', 'rillettes', 'charcuterie', 'chorizo', 'salami', 'coppa', 'bresaola', 'magret', 'cuisse'],
  'Poisson':   ['saumon', 'thon', 'cabillaud', 'crevette', 'moule', 'poisson', 'sardine', 'truite', 'bar', 'dorade', 'colin', 'lieu', 'merlu', 'sole', 'surimi', 'crabe', 'homard', 'huître', 'anchois', 'maquereau', 'hareng'],
  'Laitage':   ['lait', 'fromage', 'yaourt', 'yogourt', 'beurre', 'crème', 'camembert', 'comté', 'gruyère', 'mozzarella', 'parmesan', 'emmental', 'chèvre', 'raclette', 'mascarpone', 'ricotta', 'feta', 'roquefort', 'reblochon', 'brie', 'coulommiers', 'cheddar', 'gouda', 'edam', 'beaufort', 'cantal', 'tomme', 'pecorino', 'petit-suisse', 'faisselle', 'skyr', 'kéfir', 'cottage', 'philadelphia', 'kiri', 'vache qui rit', 'babybel'],
  'Épicerie':  ['pâtes', 'riz', 'farine', 'sucre', 'sel', 'huile', 'vinaigre', 'sauce', 'moutarde', 'ketchup', 'conserve', 'céréale', 'biscuit', 'chocolat', 'confiture', 'miel', 'café', 'thé', 'pain', 'épice', 'spaghetti', 'tagliatelle', 'penne', 'fusilli', 'macaroni', 'coquillette', 'nouille', 'semoule', 'quinoa', 'boulgour', 'lentille', 'pois chiche', 'noix', 'amande', 'noisette', 'olive', 'câpre', 'cornichon', 'levure', 'chapelure', 'bouillon', 'coulis', 'pesto', 'curry', 'cumin', 'paprika', 'poivre', 'curcuma', 'cannelle', 'muscade', 'gingembre', 'basilic', 'thym', 'romarin', 'origan', 'persil', 'ciboulette', 'aneth', 'coriandre', 'toast', 'cracker', 'galette', 'wrap', 'tortilla', 'pain de mie', 'brioche', 'croissant', 'cookie', 'gâteau', 'tablette'],
  'Boissons':  ['eau', 'jus', 'soda', 'bière', 'vin', 'coca', 'limonade', 'sirop', 'smoothie', 'boisson', 'sprite', 'fanta', 'perrier', 'badoit', 'evian', 'volvic', 'schweppes', 'orangina', 'oasis', 'ice tea', 'thé glacé', 'cidre', 'champagne', 'prosecco', 'whisky', 'vodka', 'rhum'],
  'Surgelés':  ['surgelé', 'glacé', 'glace', 'sorbet', 'pizza surgelée', 'congelé', 'frozen'],
  'Hygiène':   ['savon', 'shampo', 'dentifrice', 'papier', 'lessive', 'éponge', 'nettoyant', 'hygiène', 'sopalin', 'essuie', 'mouchoir', 'sac poubelle', 'liquide vaisselle', 'javel', 'déodorant', 'gel douche', 'brosse', 'coton'],
}

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  'Fruits':    { emoji: '🍎', color: '#c0392b', bg: '#fdecea' },
  'Légumes':   { emoji: '🥬', color: '#27ae60', bg: '#eafaf1' },
  'Viande':    { emoji: '🥩', color: '#a93226', bg: '#f9ebea' },
  'Poisson':   { emoji: '🐟', color: '#2980b9', bg: '#ebf5fb' },
  'Laitage':   { emoji: '🧀', color: '#f39c12', bg: '#fef9e7' },
  'Épicerie':  { emoji: '🫙', color: '#8e6e53', bg: '#f5f0ec' },
  'Boissons':  { emoji: '🥤', color: '#2471a3', bg: '#eaf2f8' },
  'Surgelés':  { emoji: '🧊', color: '#5dade2', bg: '#eaf2fa' },
  'Hygiène':   { emoji: '🧴', color: '#7d3c98', bg: '#f4ecf7' },
  'Autre':     { emoji: '📦', color: '#8c7b6b', bg: '#f5f0ec' },
}

function classifyProduct(name: string): string {
  const lower = name.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category
    }
  }
  return 'Autre'
}

type ViewMode = 'date' | 'product' | 'category'

export default function HistoryPage() {
  const searchParams = useSearchParams()
  const initialSupplier = searchParams.get('supplier') || 'Tous'

  const [orders, setOrders]               = useState<Order[]>([])
  const [productsByOrder, setProductsByOrder] = useState<Record<string, Product[]>>({})
  const [allProducts, setAllProducts]     = useState<Product[]>([])
  const [stats, setStats]                 = useState<Stats | null>(null)
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState(initialSupplier)
  const [search, setSearch]               = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [viewMode, setViewMode]           = useState<ViewMode>('date')
  const [deleting, setDeleting]           = useState<string | null>(null)
  const [toast, setToast]                 = useState<string | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        setOrders(data.orders || [])
        setProductsByOrder(data.productsByOrder || {})
        const all: Product[] = []
        for (const products of Object.values(data.productsByOrder || {})) {
          all.push(...(products as Product[]))
        }
        setAllProducts(all)
        setStats(data.stats || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const deleteOrder = async (order: Order) => {
    setDeleting(order.id)
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id }),
      })
      if (!res.ok) throw new Error()
      setOrders(prev => prev.filter(o => o.id !== order.id))
      setProductsByOrder(prev => {
        const next = { ...prev }
        delete next[order.id]
        return next
      })
      setSelectedOrder(null)
      setToast('Facture supprimée')
    } catch {
      setToast('Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  // Calcul du total à partir des produits (fallback si order.total est vide)
  const getOrderTotal = (order: Order): string => {
    if (order.total && order.total.trim() !== '' && order.total !== '0' && order.total !== '0.00') {
      return order.total
    }
    // Fallback : calculer depuis les produits
    const products = productsByOrder[order.id] || []
    if (products.length === 0) return '—'
    const total = products.reduce((sum, p) => {
      const price = parseFloat(p.price?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0')
      return sum + (isNaN(price) ? 0 : price)
    }, 0)
    return total > 0 ? `${total.toFixed(2)} €` : '—'
  }

  const suppliers = ['Tous', ...Array.from(new Set(orders.map(o => o.supplier))).filter(Boolean)]

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'Tous' || o.supplier === filter
    const matchSearch = !search ||
      o.supplier.toLowerCase().includes(search.toLowerCase()) ||
      o.items.toLowerCase().includes(search.toLowerCase()) ||
      o.date.includes(search) ||
      o.total.includes(search)
    return matchFilter && matchSearch
  })

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

  // Vue par produit
  const productGroups = useMemo(() => {
    const fp = allProducts.filter(p => {
      const matchFilter = filter === 'Tous' || p.supplier === filter
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      return matchFilter && matchSearch
    })
    const groups: Record<string, { name: string; purchases: Product[]; totalSpend: number }> = {}
    for (const p of fp) {
      const key = p.name.toLowerCase().trim()
      if (!groups[key]) groups[key] = { name: p.name, purchases: [], totalSpend: 0 }
      groups[key].purchases.push(p)
      const price = parseFloat(p.price?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0')
      if (!isNaN(price)) groups[key].totalSpend += price
    }
    return Object.values(groups).sort((a, b) => b.purchases.length - a.purchases.length)
  }, [allProducts, filter, search])

  // Vue par catégorie
  const categoryGroups = useMemo(() => {
    const fp = allProducts.filter(p => {
      const matchFilter = filter === 'Tous' || p.supplier === filter
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      return matchFilter && matchSearch
    })
    const groups: Record<string, { category: string; products: Product[]; totalSpend: number }> = {}
    for (const p of fp) {
      const cat = classifyProduct(p.name)
      if (!groups[cat]) groups[cat] = { category: cat, products: [], totalSpend: 0 }
      groups[cat].products.push(p)
      const price = parseFloat(p.price?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0')
      if (!isNaN(price)) groups[cat].totalSpend += price
    }
    return Object.values(groups).sort((a, b) => b.products.length - a.products.length)
  }, [allProducts, filter, search])

  const orderProducts = selectedOrder ? (productsByOrder[selectedOrder.id] || []) : []

  return (
    <>
      <AppHeader
        title="Historique"
        subtitle={stats ? `${stats.totalOrders} commandes · ${stats.totalSpend} €` : 'Vos factures importées'}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-forest-800 text-cream-50 text-sm font-body shadow-elevated animate-fade-up">
          {toast}
        </div>
      )}

      {/* Détail d'une commande (modal plein écran) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-cream-50 animate-fade-up">
          <div className="sticky top-0 bg-cream-50/95 backdrop-blur-md border-b border-forest-100/30 px-5 py-4 flex items-center gap-3">
            <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-full bg-forest-100 flex items-center justify-center active:scale-90 transition-transform">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#1e4d1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div>
              <h2 className="font-display text-lg text-forest-800 font-medium leading-tight">
                {getSupplier(selectedOrder.supplier).emoji} {selectedOrder.supplier}
              </h2>
              <p className="text-xs text-stone-warm/60 font-body">{formatDate(selectedOrder.date)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-display text-lg text-forest-800 font-medium">{getOrderTotal(selectedOrder)}</p>
              <span className="text-[10px] bg-forest-100 text-forest-600 px-2 py-0.5 rounded-full font-body">{selectedOrder.status}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 pb-28">
            <div className="card px-4 py-3.5">
              <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body mb-2">Résumé</p>
              <p className="text-sm text-stone-warm/80 font-body leading-relaxed">{selectedOrder.items}</p>
            </div>

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
                        <div className="flex items-center gap-2 mt-0.5">
                          {(p.quantity || p.unit) && <p className="text-xs text-stone-warm/60 font-body">{p.quantity} {p.unit}</p>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-100 text-stone-warm/50 font-body">
                            {CATEGORY_CONFIG[classifyProduct(p.name)]?.emoji} {classifyProduct(p.name)}
                          </span>
                        </div>
                      </div>
                      {p.price && <p className="text-sm font-medium text-forest-700 font-body flex-shrink-0">{p.price}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card px-4 py-4 text-center">
                <p className="text-sm text-stone-warm/50 font-body">Détail des articles non disponible pour cette commande</p>
              </div>
            )}
          </div>

          {/* Bouton supprimer fixe en bas — bien visible */}
          <div className="sticky bottom-0 bg-cream-50/95 backdrop-blur-md border-t border-forest-100/30 px-5 py-4">
            <button
              onClick={() => deleteOrder(selectedOrder)}
              disabled={deleting === selectedOrder.id}
              className="w-full py-3.5 rounded-xl bg-red-500 text-white text-sm font-medium font-body active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {deleting === selectedOrder.id ? 'Suppression en cours...' : 'Supprimer cette facture'}
            </button>
          </div>
        </div>
      )}

      <div className="px-5 py-5 space-y-5">

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

            {Object.keys(stats.supplierStats).length > 0 && (
              <div className="card px-4 py-3.5">
                <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body mb-3">Par fournisseur</p>
                <div className="space-y-2.5">
                  {Object.entries(stats.supplierStats).sort(([,a], [,b]) => b.total - a.total).map(([name, s]) => {
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
                          <span className="text-xs font-medium text-forest-700 font-body">{s.total.toFixed(2)} €</span>
                        </div>
                        <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: config.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 animate-fade-up animate-delay-100">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-warm/40" fill="none" viewBox="0 0 24 24">
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Rechercher une facture, un produit…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10 text-sm" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
            {suppliers.map(s => (
              <button key={s} onClick={() => setFilter(s)} className={cn(
                'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium font-body transition-all',
                filter === s ? 'bg-forest-700 text-cream-50' : 'bg-white text-stone-warm border border-forest-100'
              )}>
                {s !== 'Tous' && getSupplier(s).emoji + ' '}{s}
              </button>
            ))}
          </div>

          {/* View mode tabs */}
          <div className="flex gap-1.5 bg-cream-100 rounded-xl p-1">
            {([
              { key: 'date', label: 'Par date' },
              { key: 'product', label: 'Par produit' },
              { key: 'category', label: 'Par catégorie' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-medium font-body transition-all text-center',
                  viewMode === tab.key ? 'bg-forest-700 text-cream-50 shadow-sm' : 'text-stone-warm'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

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

        {/* VUE PAR DATE */}
        {!loading && viewMode === 'date' && (
          <>
            {Object.keys(grouped).length === 0 && (
              <div className="card px-5 py-10 text-center animate-fade-up">
                <p className="text-3xl mb-3">📄</p>
                <p className="font-display text-base text-forest-800 mb-1">Aucune facture trouvée</p>
                <p className="text-sm text-stone-warm/60 font-body">
                  {search ? 'Essayez un autre terme de recherche' : 'Importez vos premières factures PDF'}
                </p>
              </div>
            )}

            {Object.entries(grouped).map(([monthKey, monthOrders], gi) => (
              <div key={monthKey} className="animate-fade-up" style={{ animationDelay: `${gi * 60}ms` }}>
                <div className="flex items-center gap-3 mb-2.5">
                  <p className="text-xs font-medium text-stone-warm/50 uppercase tracking-wider font-body">{formatMonthKey(monthKey)}</p>
                  <div className="flex-1 h-px bg-forest-100/60" />
                  <p className="text-xs text-stone-warm/40 font-body">
                    {monthOrders.reduce((s, o) => {
                      const v = parseFloat(getOrderTotal(o)?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0')
                      return s + (isNaN(v) ? 0 : v)
                    }, 0).toFixed(2)} €
                  </p>
                </div>
                <div className="space-y-2">
                  {monthOrders.map((order, i) => {
                    const config = getSupplier(order.supplier)
                    const hasDetail = (productsByOrder[order.id] || []).length > 0
                    const total = getOrderTotal(order)
                    return (
                      <button key={order.id} onClick={() => setSelectedOrder(order)} className="card w-full text-left overflow-hidden active:scale-[0.98] transition-transform" style={{ animationDelay: `${i * 40}ms` }}>
                        <div className="h-0.5 w-full" style={{ backgroundColor: config.color }} />
                        <div className="px-4 py-3.5 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5" style={{ backgroundColor: config.bg }}>{config.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-sm font-medium text-forest-800 font-body">{order.supplier}</p>
                              <p className="font-display text-sm font-medium text-forest-800">{total}</p>
                            </div>
                            <p className="text-xs text-stone-warm/60 font-body mb-1.5">{formatShortDate(order.date)}</p>
                            <p className="text-xs text-stone-warm/70 font-body leading-relaxed line-clamp-2">{order.items}</p>
                            {hasDetail && (
                              <p className="text-[10px] text-forest-500 font-body mt-1.5">{(productsByOrder[order.id] || []).length} articles détaillés →</p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* VUE PAR PRODUIT */}
        {!loading && viewMode === 'product' && (
          <>
            {productGroups.length === 0 && (
              <div className="card px-5 py-10 text-center animate-fade-up">
                <p className="text-3xl mb-3">📦</p>
                <p className="font-display text-base text-forest-800 mb-1">Aucun produit trouvé</p>
                <p className="text-sm text-stone-warm/60 font-body">
                  {search ? 'Essayez un autre terme' : 'Les détails apparaîtront après import de factures'}
                </p>
              </div>
            )}

            <div className="space-y-2 animate-fade-up">
              {productGroups.map((group) => {
                const isExpanded = expandedProduct === group.name.toLowerCase()
                const cat = classifyProduct(group.name)
                const catConf = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Autre']
                return (
                  <div key={group.name.toLowerCase()}>
                    <button onClick={() => setExpandedProduct(isExpanded ? null : group.name.toLowerCase())} className="card w-full text-left px-4 py-3.5 active:scale-[0.98] transition-transform">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-forest-800 font-body truncate">{group.name}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-body flex-shrink-0" style={{ backgroundColor: catConf.bg, color: catConf.color }}>
                              {catConf.emoji} {cat}
                            </span>
                          </div>
                          <p className="text-xs text-stone-warm/60 font-body mt-0.5">
                            Acheté {group.purchases.length} fois · {group.totalSpend.toFixed(2)} €
                          </p>
                        </div>
                        <span className={cn('text-stone-warm/30 text-sm transition-transform', isExpanded && 'rotate-90')}>›</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 animate-scale-in">
                        {group.purchases.sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => {
                          const config = getSupplier(p.supplier)
                          return (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cream-100/60">
                              <span className="text-xs">{config.emoji}</span>
                              <span className="text-xs text-stone-warm/60 font-body flex-1">{formatShortDate(p.date)} · {p.supplier}</span>
                              <span className="text-xs text-stone-warm/50 font-body">{p.quantity} {p.unit}</span>
                              {p.price && <span className="text-xs font-medium text-forest-700 font-body">{p.price}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* VUE PAR CATÉGORIE */}
        {!loading && viewMode === 'category' && (
          <>
            {categoryGroups.length === 0 && (
              <div className="card px-5 py-10 text-center animate-fade-up">
                <p className="text-3xl mb-3">🏷️</p>
                <p className="font-display text-base text-forest-800 mb-1">Aucun produit trouvé</p>
                <p className="text-sm text-stone-warm/60 font-body">
                  {search ? 'Essayez un autre terme' : 'Les catégories apparaîtront après import de factures'}
                </p>
              </div>
            )}

            <div className="space-y-3 animate-fade-up">
              {categoryGroups.map((group) => {
                const catConf = CATEGORY_CONFIG[group.category] || CATEGORY_CONFIG['Autre']
                const isExpanded = expandedCategory === group.category

                // Dédupliquer les produits par nom dans cette catégorie
                const uniqueProducts: Record<string, { name: string; count: number; totalSpend: number; lastDate: string; suppliers: Set<string> }> = {}
                for (const p of group.products) {
                  const key = p.name.toLowerCase().trim()
                  if (!uniqueProducts[key]) {
                    uniqueProducts[key] = { name: p.name, count: 0, totalSpend: 0, lastDate: '', suppliers: new Set() }
                  }
                  uniqueProducts[key].count++
                  const price = parseFloat(p.price?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0')
                  if (!isNaN(price)) uniqueProducts[key].totalSpend += price
                  if (p.date > uniqueProducts[key].lastDate) uniqueProducts[key].lastDate = p.date
                  if (p.supplier) uniqueProducts[key].suppliers.add(p.supplier)
                }
                const sortedProducts = Object.values(uniqueProducts).sort((a, b) => b.count - a.count)

                return (
                  <div key={group.category}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : group.category)}
                      className="card w-full text-left overflow-hidden active:scale-[0.98] transition-transform"
                    >
                      <div className="h-1 w-full" style={{ backgroundColor: catConf.color }} />
                      <div className="px-4 py-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: catConf.bg }}>
                          {catConf.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-forest-800 font-body">{group.category}</p>
                          <p className="text-xs text-stone-warm/60 font-body mt-0.5">
                            {sortedProducts.length} produit{sortedProducts.length > 1 ? 's' : ''} · {group.products.length} achats · {group.totalSpend.toFixed(2)} €
                          </p>
                        </div>
                        <span className={cn('text-stone-warm/30 text-lg transition-transform', isExpanded && 'rotate-90')}>›</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="ml-2 mt-1.5 space-y-1 animate-scale-in">
                        {sortedProducts.map((product, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: catConf.bg + '60' }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-forest-800 font-body font-medium truncate">{product.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-stone-warm/50 font-body">
                                  {product.count}x achetés
                                </span>
                                {product.lastDate && (
                                  <>
                                    <span className="text-stone-warm/20">·</span>
                                    <span className="text-[10px] text-stone-warm/50 font-body">
                                      dernier : {formatShortDate(product.lastDate)}
                                    </span>
                                  </>
                                )}
                                {Array.from(product.suppliers).map(s => (
                                  <span key={s} className="text-[10px]">{getSupplier(s).emoji}</span>
                                ))}
                              </div>
                            </div>
                            {product.totalSpend > 0 && (
                              <span className="text-xs font-medium text-forest-700 font-body flex-shrink-0">
                                {product.totalSpend.toFixed(2)} €
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
    </>
  )
}

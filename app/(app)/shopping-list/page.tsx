'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const SUPPLIERS = ['Tous', 'Picnic', 'La Fourche', 'Le Fourgon', 'Marché']

interface ShoppingItem {
  id: string
  name: string
  quantity: string
  supplier: string
  checked: boolean
}

const supplierColor: Record<string, string> = {
  'Picnic': '#FF6B35',
  'La Fourche': '#2d6a2d',
  'Le Fourgon': '#1a3a5c',
  'Marché': '#c0622a',
}

const supplierEmoji: Record<string, string> = {
  'Picnic': '🛒',
  'La Fourche': '🌿',
  'Le Fourgon': '🚐',
  'Marché': '🥕',
}

export default function ShoppingListPage() {
  const [items, setItems]           = useState<ShoppingItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('Tous')
  const [showAdd, setShowAdd]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [newQty, setNewQty]         = useState('')
  const [newSupplier, setNewSupplier] = useState('Marché')
  const [syncing, setSyncing]       = useState<Set<string>>(new Set())
  const [clearing, setClearing]     = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  const fetchItems = useCallback(() => {
    fetch('/api/shopping-list')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.items) setItems(data.items)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const toggle = async (item: ShoppingItem) => {
    const newChecked = !item.checked

    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newChecked } : i))
    setSyncing(prev => new Set(prev).add(item.id))

    try {
      const res = await fetch('/api/shopping-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, checked: newChecked }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: item.checked } : i))
    } finally {
      setSyncing(prev => { const n = new Set(prev); n.delete(item.id); return n })
    }
  }

  const addItem = async () => {
    const name = newName.trim()
    if (!name) return

    const tempId = `temp-${Date.now()}`
    const newItem: ShoppingItem = {
      id: tempId,
      name,
      quantity: newQty.trim() || '1',
      supplier: newSupplier,
      checked: false,
    }

    // Optimistic add
    setItems(prev => [...prev, newItem])
    setNewName('')
    setNewQty('')
    setShowAdd(false)

    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ name: newItem.name, quantity: newItem.quantity, supplier: newItem.supplier }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.added === 0) {
        // Doublon, retirer l'item temp
        setItems(prev => prev.filter(i => i.id !== tempId))
        setToast('Cet article est déjà dans la liste')
      } else {
        // Refresh pour récupérer le vrai ID
        fetchItems()
        setToast('Article ajouté')
      }
    } catch {
      setItems(prev => prev.filter(i => i.id !== tempId))
      setToast('Erreur lors de l\'ajout')
    }
  }

  const clearChecked = async () => {
    const checkedCount = items.filter(i => i.checked).length
    if (checkedCount === 0) return

    setClearing(true)
    try {
      const res = await fetch('/api/shopping-list', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems(prev => prev.filter(i => !i.checked))
      setToast(`${checkedCount} article${checkedCount > 1 ? 's' : ''} supprimé${checkedCount > 1 ? 's' : ''}`)
    } catch {
      setToast('Erreur lors de la suppression')
    } finally {
      setClearing(false)
    }
  }

  const filteredItems = items.filter(item =>
    filter === 'Tous' || item.supplier === filter
  )

  const pending = filteredItems.filter(i => !i.checked)
  const done = filteredItems.filter(i => i.checked)
  const totalChecked = items.filter(i => i.checked).length
  const progress = items.length > 0
    ? Math.round((totalChecked / items.length) * 100)
    : 0

  // Fournisseurs actifs dans la liste
  const activeSuppliers = Array.from(new Set(items.map(i => i.supplier).filter(Boolean)))

  return (
    <>
      <AppHeader
        title="Liste de courses"
        subtitle={loading ? 'Chargement...' : `${items.length - totalChecked} article${items.length - totalChecked > 1 ? 's' : ''} restant${items.length - totalChecked > 1 ? 's' : ''}`}
      />

      <div className="px-5 py-5 space-y-5">

        {/* Toast */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-forest-800 text-cream-50 text-sm font-body shadow-elevated animate-fade-up">
            {toast}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card p-4 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* Empty state */}
            {items.length === 0 && (
              <div className="card px-5 py-10 text-center animate-fade-up">
                <p className="text-3xl mb-3">🛍️</p>
                <p className="font-display text-base text-forest-800 mb-1">Liste vide</p>
                <p className="text-sm text-stone-warm/60 font-body mb-4">
                  Ajoutez des articles ou consultez les recommandations
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowAdd(true)} className="btn-primary">
                    + Ajouter
                  </button>
                  <Link href="/recommendations" className="btn-secondary">
                    Recommandations
                  </Link>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <>
                {/* Progress bar */}
                <div className="card px-4 py-4 animate-fade-up">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-medium text-forest-700 font-body">Progression</span>
                    <span className="text-xs text-stone-warm/60 font-body">{progress}%</span>
                  </div>
                  <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-forest-600 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Supplier filter */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide animate-fade-up animate-delay-100">
                  {SUPPLIERS.filter(s => s === 'Tous' || activeSuppliers.includes(s)).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={cn(
                        'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium font-body transition-all duration-150',
                        filter === s
                          ? 'bg-forest-700 text-cream-50'
                          : 'bg-white text-stone-warm border border-forest-100'
                      )}
                    >
                      {s !== 'Tous' && supplierEmoji[s] ? `${supplierEmoji[s]} ` : ''}{s}
                    </button>
                  ))}
                </div>

                {/* Supplier breakdown (when filter = Tous) */}
                {filter === 'Tous' && activeSuppliers.length > 1 && (
                  <div className="flex gap-2 flex-wrap animate-fade-up animate-delay-100">
                    {activeSuppliers.map(s => {
                      const count = items.filter(i => i.supplier === s && !i.checked).length
                      if (count === 0) return null
                      return (
                        <button
                          key={s}
                          onClick={() => setFilter(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-100 text-xs font-body"
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: supplierColor[s] || '#8c7b6b' }} />
                          <span className="text-forest-800 font-medium">{s}</span>
                          <span className="text-stone-warm/50">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Pending items */}
                <div className="space-y-2 animate-fade-up animate-delay-200">
                  {pending.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => toggle(item)}
                      disabled={syncing.has(item.id)}
                      className={cn(
                        'card w-full px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left',
                        syncing.has(item.id) && 'opacity-60',
                      )}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-forest-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-forest-800 font-body truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.supplier && (
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: supplierColor[item.supplier] || '#8c7b6b' }}
                            />
                          )}
                          <p className="text-xs text-stone-warm/60 font-body">
                            {item.supplier ? `${item.supplier} · ` : ''}{item.quantity}
                          </p>
                        </div>
                      </div>
                      {syncing.has(item.id) && (
                        <div className="w-3 h-3 border border-forest-300 border-t-forest-600 rounded-full animate-spin flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Add item form */}
            {showAdd ? (
              <div className="card px-4 py-4 space-y-3 animate-scale-in">
                <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body">
                  Nouvel article
                </p>
                <input
                  autoFocus
                  className="input text-sm"
                  placeholder="Nom du produit"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                />
                <div className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    placeholder="Quantité"
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                  />
                  <select
                    className="input text-sm w-32"
                    value={newSupplier}
                    onChange={e => setNewSupplier(e.target.value)}
                  >
                    {SUPPLIERS.filter(s => s !== 'Tous').map(s => (
                      <option key={s} value={s}>{supplierEmoji[s] || ''} {s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAdd(false); setNewName(''); setNewQty('') }} className="btn-secondary flex-1">
                    Annuler
                  </button>
                  <button onClick={addItem} disabled={!newName.trim()} className="btn-primary flex-1 disabled:opacity-50">
                    + Ajouter
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 animate-fade-up animate-delay-300">
                <button onClick={() => setShowAdd(true)} className="btn-secondary flex-1">
                  + Ajouter un article
                </button>
                <Link href="/recommendations" className="btn-secondary flex-1 text-center">
                  Suggestions
                </Link>
              </div>
            )}

            {/* Done items */}
            {done.length > 0 && (
              <div className="space-y-2 animate-fade-up">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-warm/50 font-body uppercase tracking-wider">
                    Dans le panier ({done.length})
                  </p>
                  <button
                    onClick={clearChecked}
                    disabled={clearing}
                    className="text-xs text-terra-500 font-medium font-body disabled:opacity-50"
                  >
                    {clearing ? 'Suppression...' : 'Vider le panier'}
                  </button>
                </div>
                {done.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    disabled={syncing.has(item.id)}
                    className={cn(
                      'w-full px-4 py-3.5 flex items-center gap-3 rounded-xl bg-cream-100/60 active:scale-[0.98] transition-transform text-left',
                      syncing.has(item.id) && 'opacity-60',
                    )}
                  >
                    <div className="w-5 h-5 rounded-full bg-forest-600 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="8" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className="text-sm text-stone-warm/50 font-body line-through flex-1 truncate">{item.name}</p>
                    <p className="text-xs text-stone-warm/40 font-body flex-shrink-0">{item.quantity}</p>
                    {syncing.has(item.id) && (
                      <div className="w-3 h-3 border border-forest-300 border-t-forest-600 rounded-full animate-spin flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const SUPPLIERS = ['Tous', 'Picnic', 'La Fourche', 'Le Fourgon', 'Marché']

interface ShoppingItem {
  id: string
  name: string
  quantity: string
  supplier: string
  checked: boolean
  urgent?: boolean
}

// Données d'exemple - en prod, chargées depuis Google Sheets
const MOCK_ITEMS: ShoppingItem[] = [
  { id: '1', name: 'Lait entier bio', quantity: '2 L', supplier: 'La Fourche', checked: false, urgent: true },
  { id: '2', name: 'Œufs plein air', quantity: '12', supplier: 'La Fourche', checked: false, urgent: true },
  { id: '3', name: 'Yaourt nature', quantity: '8', supplier: 'Picnic', checked: false },
  { id: '4', name: 'Carottes', quantity: '1 kg', supplier: 'Marché', checked: false },
  { id: '5', name: 'Tomates cerise', quantity: '500 g', supplier: 'Marché', checked: false },
  { id: '6', name: 'Pâtes complètes', quantity: '2 paquets', supplier: 'La Fourche', checked: false },
  { id: '7', name: 'Huile d\'olive', quantity: '1 bouteille', supplier: 'La Fourche', checked: true },
]

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>(MOCK_ITEMS)
  const [filter, setFilter] = useState('Tous')
  const [newItem, setNewItem] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const toggle = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  const filteredItems = items.filter(item =>
    filter === 'Tous' || item.supplier === filter
  )

  const pending = filteredItems.filter(i => !i.checked)
  const done = filteredItems.filter(i => i.checked)
  const progress = Math.round((items.filter(i => i.checked).length / items.length) * 100)

  const supplierColor: Record<string, string> = {
    'Picnic': '#FF6B35',
    'La Fourche': '#2d6a2d',
    'Le Fourgon': '#1a3a5c',
    'Marché': '#c0622a',
  }

  return (
    <>
      <AppHeader title="Liste de courses" subtitle={`${pending.length} articles restants`} />

      <div className="px-5 py-5 space-y-5">

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
          {SUPPLIERS.map(s => (
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
              {s}
            </button>
          ))}
        </div>

        {/* Items list - pending */}
        <div className="space-y-2 animate-fade-up animate-delay-200">
          {pending.map((item, i) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className="card w-full px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Checkbox */}
              <div className="w-5 h-5 rounded-full border-2 border-forest-300 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-forest-800 font-body truncate">{item.name}</p>
                  {item.urgent && (
                    <span className="text-[10px] bg-terra-100 text-terra-500 px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
                      urgent
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: supplierColor[item.supplier] || '#8c7b6b' }}
                  />
                  <p className="text-xs text-stone-warm/60 font-body">{item.supplier} · {item.quantity}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Add item */}
        {showAdd ? (
          <div className="card px-4 py-3 flex gap-2 animate-scale-in">
            <input
              autoFocus
              className="input flex-1 py-2.5"
              placeholder="Nom du produit…"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newItem.trim()) {
                  setItems(prev => [...prev, {
                    id: Date.now().toString(),
                    name: newItem.trim(),
                    quantity: '1',
                    supplier: 'Marché',
                    checked: false,
                  }])
                  setNewItem('')
                  setShowAdd(false)
                }
              }}
            />
            <button onClick={() => setShowAdd(false)} className="text-stone-warm/50 px-2">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="btn-secondary w-full animate-fade-up animate-delay-300"
          >
            + Ajouter un article
          </button>
        )}

        {/* Done items */}
        {done.length > 0 && (
          <div className="space-y-2 animate-fade-up">
            <p className="text-xs font-medium text-stone-warm/50 font-body uppercase tracking-wider">
              Dans le panier ({done.length})
            </p>
            {done.map(item => (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="w-full px-4 py-3.5 flex items-center gap-3 rounded-xl bg-cream-100/60 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-5 h-5 rounded-full bg-forest-600 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="8" fill="none" viewBox="0 0 10 8">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-sm text-stone-warm/50 font-body line-through">{item.name}</p>
                <p className="text-xs text-stone-warm/40 font-body ml-auto">{item.quantity}</p>
              </button>
            ))}
          </div>
        )}

      </div>
    </>
  )
}

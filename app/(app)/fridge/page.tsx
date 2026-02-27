'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

type AppStep = 'loading' | 'idle' | 'analyzing' | 'editing' | 'saving' | 'saved'

interface StockItem {
  id: string
  name: string
  quantity: string
  unit: string
  status: 'ok' | 'low' | 'missing'
  location: string
  source: 'scan' | 'manual'
  category: string
}

const STATUS_CONFIG = {
  ok:      { label: 'OK',        color: 'text-forest-600', bg: 'bg-forest-100',  dot: 'bg-forest-400',  border: 'border-forest-200', activeBg: 'bg-forest-200' },
  low:     { label: 'Stock bas', color: 'text-terra-500',  bg: 'bg-terra-100',   dot: 'bg-terra-300',   border: 'border-terra-200',  activeBg: 'bg-terra-200'  },
  missing: { label: 'Manquant',  color: 'text-red-500',    bg: 'bg-red-50',      dot: 'bg-red-400',     border: 'border-red-200',    activeBg: 'bg-red-100'    },
}

const LOCATIONS = [
  { id: 'frigo',   label: 'Frigo',    emoji: '🧊' },
  { id: 'placard', label: 'Placard',  emoji: '🗄️' },
  { id: 'congelateur', label: 'Congél.', emoji: '❄️' },
  { id: 'cave',    label: 'Cave',     emoji: '🍷' },
]

const CATEGORIES = [
  { id: 'Fruits',    label: 'Fruits',    emoji: '🍎' },
  { id: 'Légumes',   label: 'Légumes',   emoji: '🥬' },
  { id: 'Viande',    label: 'Viande',    emoji: '🥩' },
  { id: 'Poisson',   label: 'Poisson',   emoji: '🐟' },
  { id: 'Laitage',   label: 'Laitage',   emoji: '🧀' },
  { id: 'Épicerie',  label: 'Épicerie',  emoji: '🫙' },
  { id: 'Boissons',  label: 'Boissons',  emoji: '🥤' },
  { id: 'Surgelés',  label: 'Surgelés',  emoji: '🧊' },
  { id: 'Hygiène',   label: 'Hygiène',   emoji: '🧴' },
  { id: 'Autre',     label: 'Autre',     emoji: '📦' },
]

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

export default function FridgePage() {
  const [step, setStep]           = useState<AppStep>('loading')
  const [items, setItems]         = useState<StockItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [location, setLocation]   = useState('frigo')
  const [label, setLabel]         = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError]         = useState<string | null>(null)
  const [showAddManual, setShowAddManual] = useState(false)
  const [newItem, setNewItem]     = useState({ name: '', quantity: '', unit: '' })
  const [statusFilter, setStatusFilter] = useState<'ok' | 'low' | 'missing' | null>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [lastSavedLabel, setLastSavedLabel] = useState('')

  // --- Charger l'inventaire sauvegardé au montage ---
  useEffect(() => {
    fetch('/api/stock')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.sessions?.length) {
          setStep('idle')
          return
        }
        // Charger le dernier inventaire
        const latest = data.sessions[0]
        const loadedItems: StockItem[] = latest.items.map((item: any) => ({
          id:       makeId(),
          name:     item.name || '',
          quantity: item.quantity || '',
          unit:     item.unit || '',
          status:   item.status || 'ok',
          location: item.location || 'frigo',
          source:   'scan' as const,
          category: item.category || 'Autre',
        }))
        setItems(loadedItems)
        setSavedCount(loadedItems.length)
        setLastSavedLabel(latest.label || '')
        setStep('saved')
      })
      .catch(() => setStep('idle'))
  }, [])

  // --- Scan photos (multiple) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    // Copy files into an array BEFORE resetting (FileList is a live reference)
    const files = Array.from(fileList)
    // Reset input value so the same file can be selected again
    e.target.value = ''

    setStep('analyzing')
    setError(null)
    setPhotoCount(prev => prev + files.length)

    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append('image', file)
      }

      const res = await fetch('/api/scan-fridge', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()

      const newItems: StockItem[] = (data.items || []).map((item: any) => ({
        id:       makeId(),
        name:     item.name || '',
        quantity: item.quantity || '',
        unit:     '',
        status:   item.status || 'ok',
        location,
        source:   'scan',
        category: item.category || 'Autre',
      }))

      setItems(prev => {
        const existingNames = prev.map(i => i.name.toLowerCase())
        const toAdd = newItems.filter(i => !existingNames.includes(i.name.toLowerCase()))
        const updated = prev.map(p => {
          const match = newItems.find(n => n.name.toLowerCase() === p.name.toLowerCase())
          return match ? { ...p, quantity: match.quantity, status: match.status } : p
        })
        return [...updated, ...toAdd]
      })

      setStep('editing')
    } catch {
      setError('Impossible d\'analyser la photo. Réessayez.')
      setStep(items.length > 0 ? 'editing' : 'idle')
    }
  }

  // --- Édition d'un item ---
  const updateItem = (id: string, changes: Partial<StockItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i))
  }

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const cycleStatus = (id: string) => {
    const order: StockItem['status'][] = ['ok', 'low', 'missing']
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const next = order[(order.indexOf(i.status) + 1) % order.length]
      return { ...i, status: next }
    }))
  }

  // --- Ajout manuel ---
  const addManualItem = () => {
    if (!newItem.name.trim()) return
    setItems(prev => [...prev, {
      id:       makeId(),
      name:     newItem.name.trim(),
      quantity: newItem.quantity,
      unit:     newItem.unit,
      status:   'ok',
      location,
      source:   'manual',
      category: 'Autre',
    }])
    setNewItem({ name: '', quantity: '', unit: '' })
    setShowAddManual(false)
  }

  // --- Sauvegarde ---
  const handleSave = async () => {
    if (items.length === 0) return
    setStep('saving')

    try {
      const res = await fetch('/api/stock', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items: items.map(({ name, quantity, unit, status, location, category }) =>
            ({ name, quantity, unit, status, location, category })
          ),
          label: label || `Inventaire ${new Date().toLocaleDateString('fr-FR')}`,
        }),
      })

      if (!res.ok) throw new Error('Erreur sauvegarde')
      const data = await res.json()
      setSavedCount(data.saved || items.length)
      setLastSavedLabel(label || `Inventaire ${new Date().toLocaleDateString('fr-FR')}`)
      setStep('saved')
    } catch {
      setError('Erreur lors de la sauvegarde. Réessayez.')
      setStep('editing')
    }
  }

  const reset = () => {
    setStep('idle')
    setItems([])
    setEditingId(null)
    setLabel('')
    setError(null)
    setShowAddManual(false)
    setStatusFilter(null)
    setPhotoCount(0)
  }

  // Go back to editing from saved (keep items)
  const continueEditing = () => {
    setStep('editing')
    setStatusFilter(null)
  }

  const counts = {
    ok:      items.filter(i => i.status === 'ok').length,
    low:     items.filter(i => i.status === 'low').length,
    missing: items.filter(i => i.status === 'missing').length,
  }

  // Filtered items for display
  const displayItems = statusFilter ? items.filter(i => i.status === statusFilter) : items

  // Toggle status filter
  const toggleStatusFilter = (s: 'ok' | 'low' | 'missing') => {
    setStatusFilter(prev => prev === s ? null : s)
  }

  return (
    <>
      <AppHeader
        title="Inventaire"
        subtitle={
          step === 'loading' ? 'Chargement…' :
          items.length > 0 ? `${items.length} produits${photoCount > 0 ? ` · ${photoCount} photo${photoCount > 1 ? 's' : ''}` : ''}` :
          'Scanner & gérer vos stocks'
        }
      />

      {/* Hidden file inputs — positioned offscreen for reliable label triggering on mobile */}
      <input
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />
      <input
        id="gallery-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />
      <input
        id="addmore-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />

      <div className="px-5 py-5 space-y-5">

        {/* LOADING */}
        {step === 'loading' && (
          <div className="space-y-3 animate-fade-in">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4 space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* IDLE */}
        {step === 'idle' && (
          <div className="animate-fade-up space-y-4">
            <div className="card flex flex-col items-center justify-center py-10 px-8 text-center
                              border-2 border-dashed border-forest-200">
              <div className="w-20 h-20 rounded-3xl bg-forest-100 flex items-center justify-center mb-5">
                <span className="text-4xl">📷</span>
              </div>
              <h2 className="font-display text-xl text-forest-800 mb-2">Scanner un emplacement</h2>
              <p className="text-sm text-stone-warm/70 font-body mb-2 max-w-xs">
                Prenez une photo ou choisissez depuis votre galerie
              </p>
              <p className="text-xs text-stone-warm/50 font-body mb-6 max-w-xs">
                Vous pourrez ajouter d'autres photos après l'analyse
              </p>
              <div className="flex gap-3 w-full max-w-xs">
                <label
                  htmlFor="camera-input"
                  className="btn-primary flex-1 cursor-pointer"
                >
                  📷 Photo
                </label>
                <label
                  htmlFor="gallery-input"
                  className="btn-secondary flex-1 cursor-pointer"
                >
                  🖼️ Galerie
                </label>
              </div>
            </div>

            {/* Emplacement */}
            <div className="card px-4 py-4">
              <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body mb-3">
                Emplacement à scanner
              </p>
              <div className="grid grid-cols-4 gap-2">
                {LOCATIONS.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => setLocation(loc.id)}
                    className={cn(
                      'flex flex-col items-center py-2.5 px-1 rounded-xl transition-all text-center',
                      location === loc.id
                        ? 'bg-forest-700 text-cream-50'
                        : 'bg-cream-100 text-forest-700'
                    )}
                  >
                    <span className="text-xl mb-1">{loc.emoji}</span>
                    <span className="text-[10px] font-body font-medium">{loc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setStep('editing') }}
              className="btn-secondary w-full"
            >
              ✏️ Saisir manuellement sans photo
            </button>
          </div>
        )}

        {/* ANALYZING */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <div className="w-16 h-16 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin mb-6" />
            <p className="font-display text-lg text-forest-800 mb-1">Analyse en cours…</p>
            <p className="text-sm text-stone-warm/60 font-body">
              Claude identifie vos produits{photoCount > 1 ? ` (${photoCount} photos)` : ''}
            </p>
            {items.length > 0 && (
              <p className="text-xs text-stone-warm/40 font-body mt-2">
                {items.length} produits déjà dans l'inventaire
              </p>
            )}
          </div>
        )}

        {/* EDITING */}
        {(step === 'editing' || step === 'saving') && (
          <div className="space-y-5 animate-fade-up">

            {/* Erreur */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-terra-100 text-terra-500 text-sm font-body">
                {error}
              </div>
            )}

            {/* Label de l'inventaire */}
            <div className="card px-4 py-3.5">
              <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body mb-2">
                Nom de cet inventaire
              </p>
              <input
                className="input text-sm"
                placeholder={`Ex: Frigo ${new Date().toLocaleDateString('fr-FR')}`}
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>

            {/* Bouton ajouter des photos (toujours visible en mode editing) */}
            <label
              htmlFor="addmore-input"
              className="card block px-4 py-3.5 border-2 border-dashed border-forest-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-forest-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📷</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-forest-800 font-body">Ajouter des photos</p>
                  <p className="text-xs text-stone-warm/60 font-body">
                    Scannez un autre emplacement (placard, congélateur…)
                  </p>
                </div>
                <span className="text-forest-400 text-xl">+</span>
              </div>
            </label>

            {/* Stats rapides — cliquables pour filtrer */}
            {items.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {(['ok', 'low', 'missing'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => toggleStatusFilter(s)}
                    className={cn(
                      'rounded-xl px-3 py-2.5 text-center transition-all active:scale-95',
                      statusFilter === s
                        ? cn(STATUS_CONFIG[s].activeBg, 'ring-2 ring-offset-1', s === 'ok' ? 'ring-forest-400' : s === 'low' ? 'ring-terra-300' : 'ring-red-400')
                        : STATUS_CONFIG[s].bg,
                    )}
                  >
                    <p className={cn('font-display text-xl font-medium', STATUS_CONFIG[s].color)}>{counts[s]}</p>
                    <p className={cn('text-[10px] font-body', STATUS_CONFIG[s].color)}>{STATUS_CONFIG[s].label}</p>
                  </button>
                ))}
              </div>
            )}

            {statusFilter && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-warm/50 font-body">
                  Filtre : {STATUS_CONFIG[statusFilter].label}
                </span>
                <button onClick={() => setStatusFilter(null)} className="text-xs text-forest-600 font-body font-medium underline">
                  Tout afficher
                </button>
              </div>
            )}

            {/* Liste des items */}
            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-warm/50 uppercase tracking-wider font-body">
                  {statusFilter ? `${displayItems.length} / ${items.length} produits` : `${items.length} produits`} — appuyez pour modifier
                </p>

                {displayItems.map(item => (
                  <div key={item.id}>
                    {/* Item row */}
                    <div
                      className={cn(
                        'card border px-4 py-3 transition-all',
                        editingId === item.id ? 'border-forest-300 shadow-elevated' : STATUS_CONFIG[item.status].border
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status dot — tap to cycle */}
                        <button
                          onClick={() => cycleStatus(item.id)}
                          className={cn('w-3 h-3 rounded-full flex-shrink-0 active:scale-75 transition-transform', STATUS_CONFIG[item.status].dot)}
                          title="Changer le statut"
                        />

                        {editingId === item.id ? (
                          /* EDIT MODE */
                          <div className="flex-1 space-y-2">
                            <input
                              autoFocus
                              className="input text-sm py-2"
                              value={item.name}
                              onChange={e => updateItem(item.id, { name: e.target.value })}
                              placeholder="Nom du produit"
                            />
                            <div className="flex gap-2">
                              <input
                                className="input text-sm py-2 flex-1"
                                value={item.quantity}
                                onChange={e => updateItem(item.id, { quantity: e.target.value })}
                                placeholder="Quantité"
                              />
                              <input
                                className="input text-sm py-2 w-20"
                                value={item.unit}
                                onChange={e => updateItem(item.id, { unit: e.target.value })}
                                placeholder="Unité"
                              />
                            </div>
                            {/* Status selector */}
                            <div className="flex gap-1.5">
                              {(['ok', 'low', 'missing'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateItem(item.id, { status: s })}
                                  className={cn(
                                    'flex-1 py-1.5 rounded-lg text-xs font-body font-medium transition-all',
                                    item.status === s ? cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color) : 'bg-cream-100 text-stone-warm'
                                  )}
                                >
                                  {STATUS_CONFIG[s].label}
                                </button>
                              ))}
                            </div>
                            {/* Location */}
                            <div className="flex gap-1.5">
                              {LOCATIONS.map(loc => (
                                <button
                                  key={loc.id}
                                  onClick={() => updateItem(item.id, { location: loc.id })}
                                  className={cn(
                                    'flex-1 py-1.5 rounded-lg text-[10px] font-body font-medium transition-all',
                                    item.location === loc.id ? 'bg-forest-700 text-cream-50' : 'bg-cream-100 text-stone-warm'
                                  )}
                                >
                                  {loc.emoji} {loc.label}
                                </button>
                              ))}
                            </div>
                            {/* Category */}
                            <div className="flex flex-wrap gap-1.5">
                              {CATEGORIES.map(cat => (
                                <button
                                  key={cat.id}
                                  onClick={() => updateItem(item.id, { category: cat.id })}
                                  className={cn(
                                    'px-2 py-1.5 rounded-lg text-[10px] font-body font-medium transition-all',
                                    item.category === cat.id ? 'bg-terra-500 text-cream-50' : 'bg-cream-100 text-stone-warm'
                                  )}
                                >
                                  {cat.emoji} {cat.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => setEditingId(null)}
                                className="btn-primary flex-1 py-2.5 text-sm"
                              >
                                ✓ Valider
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="px-4 py-2.5 rounded-xl bg-red-50 text-red-400 text-sm font-body active:scale-95 transition-transform"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* READ MODE */
                          <button
                            className="flex-1 text-left"
                            onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-forest-800 font-body">{item.name}</p>
                              <div className="flex items-center gap-2">
                                <span className={cn('text-[10px] font-body px-2 py-0.5 rounded-md font-medium', STATUS_CONFIG[item.status].bg, STATUS_CONFIG[item.status].color)}>
                                  {STATUS_CONFIG[item.status].label}
                                </span>
                                <span className="text-stone-warm/30 text-sm">›</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-stone-warm/60 font-body">
                                {item.quantity} {item.unit}
                              </p>
                              {item.category && item.category !== 'Autre' && (
                                <span className="text-[10px] text-stone-warm/50 font-body">
                                  · {CATEGORIES.find(c => c.id === item.category)?.emoji} {item.category}
                                </span>
                              )}
                              {item.location && (
                                <span className="text-[10px] text-stone-warm/40 font-body">
                                  · {LOCATIONS.find(l => l.id === item.location)?.emoji} {LOCATIONS.find(l => l.id === item.location)?.label}
                                </span>
                              )}
                              {item.source === 'manual' && (
                                <span className="text-[10px] text-stone-warm/30 font-body">· Manuel</span>
                              )}
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ajouter manuellement */}
            {showAddManual ? (
              <div className="card px-4 py-4 space-y-3 animate-scale-in">
                <p className="text-xs font-medium text-forest-700 uppercase tracking-wider font-body">
                  Ajouter un produit
                </p>
                <input
                  autoFocus
                  className="input text-sm"
                  placeholder="Nom du produit"
                  value={newItem.name}
                  onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    placeholder="Quantité"
                    value={newItem.quantity}
                    onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
                  />
                  <input
                    className="input text-sm w-20"
                    placeholder="Unité"
                    value={newItem.unit}
                    onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addManualItem()}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddManual(false)} className="btn-secondary flex-1">Annuler</button>
                  <button onClick={addManualItem} className="btn-primary flex-1">+ Ajouter</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddManual(true)} className="btn-secondary w-full">
                ✏️ Ajouter un produit manuellement
              </button>
            )}

            {/* Actions finales */}
            <div className="flex gap-3 pt-2">
              <button onClick={reset} className="btn-secondary flex-1">
                ↩ Recommencer
              </button>
              <button
                onClick={handleSave}
                disabled={items.length === 0 || step === 'saving'}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {step === 'saving' ? (
                  <div className="w-4 h-4 border-2 border-cream-100/30 border-t-cream-50 rounded-full animate-spin" />
                ) : (
                  '💾 Sauvegarder'
                )}
              </button>
            </div>
          </div>
        )}

        {/* SAVED */}
        {step === 'saved' && (
          <div className="animate-fade-up space-y-5">
            <div className="card-elevated px-5 py-6 bg-forest-800 text-cream-50 text-center relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-forest-600/30" />
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-forest-600/40 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="20" fill="none" viewBox="0 0 24 20">
                    <path d="M2 10l7 7L22 2" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="font-display text-2xl text-cream-50 mb-1">
                  {lastSavedLabel || 'Inventaire sauvegardé'}
                </p>
                <p className="text-sm text-cream-100/60 font-body">
                  {savedCount} produits enregistrés
                </p>
              </div>
            </div>

            {/* Bouton ajouter des photos à l'inventaire */}
            <label
              htmlFor="addmore-input"
              className="card block px-4 py-4 border-2 border-dashed border-forest-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📷</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-forest-800 font-body">Ajouter d'autres photos</p>
                  <p className="text-xs text-stone-warm/60 font-body">
                    Scannez un placard, congélateur… Les nouveaux produits seront ajoutés à cet inventaire
                  </p>
                </div>
                <span className="text-forest-400 text-2xl font-light">+</span>
              </div>
            </label>

            {/* Résumé — cliquable pour filtrer */}
            <div className="grid grid-cols-3 gap-2">
              {(['ok', 'low', 'missing'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatusFilter(s)}
                  className={cn(
                    'rounded-xl px-3 py-3 text-center transition-all active:scale-95',
                    statusFilter === s
                      ? cn(STATUS_CONFIG[s].activeBg, 'ring-2 ring-offset-1', s === 'ok' ? 'ring-forest-400' : s === 'low' ? 'ring-terra-300' : 'ring-red-400')
                      : STATUS_CONFIG[s].bg,
                  )}
                >
                  <p className={cn('font-display text-2xl font-medium', STATUS_CONFIG[s].color)}>{counts[s]}</p>
                  <p className={cn('text-[10px] font-body', STATUS_CONFIG[s].color)}>{STATUS_CONFIG[s].label}</p>
                </button>
              ))}
            </div>

            {statusFilter && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-warm/50 font-body">
                  Filtre : {STATUS_CONFIG[statusFilter].label} ({displayItems.length} produits)
                </span>
                <button onClick={() => setStatusFilter(null)} className="text-xs text-forest-600 font-body font-medium underline">
                  Tout afficher
                </button>
              </div>
            )}

            {/* Liste filtrée des produits */}
            {displayItems.length > 0 && (
              <div className="space-y-1.5">
                {displayItems.map(i => (
                  <div key={i.id} className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl', STATUS_CONFIG[i.status].bg)}>
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_CONFIG[i.status].dot)} />
                    <span className="text-sm text-forest-800 font-body flex-1">{i.name}</span>
                    <span className="text-xs text-stone-warm/60 font-body">{i.quantity} {i.unit}</span>
                    {i.location && (
                      <span className="text-xs text-stone-warm/40">{LOCATIONS.find(l => l.id === i.location)?.emoji}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {counts.low + counts.missing > 0 && !statusFilter && (
              <div className="card px-4 py-4 border-l-4 border-l-terra-300">
                <p className="text-sm font-medium text-forest-800 font-body mb-1">
                  {counts.low + counts.missing} produits à réapprovisionner
                </p>
                <ul className="space-y-1">
                  {items.filter(i => i.status !== 'ok').map(i => (
                    <li key={i.id} className="text-xs text-stone-warm/70 font-body flex items-center gap-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_CONFIG[i.status].dot)} />
                      {i.name} {i.quantity && `— ${i.quantity} ${i.unit}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={continueEditing} className="btn-secondary flex-1">
                ✏️ Modifier l'inventaire
              </button>
              <button onClick={handleSave} className="btn-primary flex-1">
                💾 Re-sauvegarder
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={reset} className="btn-secondary flex-1">
                🆕 Nouvel inventaire
              </button>
              <a href="/shopping-list" className="btn-primary flex-1 text-center">
                🛍️ Voir les courses
              </a>
            </div>
          </div>
        )}

      </div>
    </>
  )
}

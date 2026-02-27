'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

type Step = 'loading' | 'ready' | 'empty' | 'error'

interface Meal {
  name: string
  description: string
  ingredients_from_stock: string[]
  ingredients_to_buy: string[]
  tags: string[]
}

interface DayPlan {
  date: string
  lunch: Meal
  dinner: Meal
}

interface MealPlan {
  days: DayPlan[]
  shopping_tip: string
}

const TAG_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'veggie':        { label: 'Végé',          bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'vegan':         { label: 'Vegan',         bg: 'bg-green-100',   text: 'text-green-700' },
  'poisson':       { label: 'Poisson',       bg: 'bg-blue-100',    text: 'text-blue-700' },
  'viande':        { label: 'Viande',        bg: 'bg-red-100',     text: 'text-red-700' },
  'rapide':        { label: 'Rapide',        bg: 'bg-amber-100',   text: 'text-amber-700' },
  'batch-cooking': { label: 'Batch',         bg: 'bg-purple-100',  text: 'text-purple-700' },
  'comfort-food':  { label: 'Comfort',       bg: 'bg-orange-100',  text: 'text-orange-700' },
  'léger':         { label: 'Léger',         bg: 'bg-sky-100',     text: 'text-sky-700' },
}

export default function MealsPage() {
  const [step, setStep]             = useState<Step>('loading')
  const [plan, setPlan]             = useState<MealPlan | null>(null)
  const [stockCount, setStockCount] = useState(0)
  const [stockHash, setStockHash]   = useState('')
  const [staleStock, setStaleStock] = useState(false)
  const [errorMsg, setErrorMsg]     = useState('')
  const [selectedDay, setSelectedDay] = useState(0)

  const fetchMeals = async () => {
    setStep('loading')
    setErrorMsg('')
    setStaleStock(false)

    try {
      const res = await fetch('/api/meal-suggestions')
      const data = await res.json()

      if (res.status === 404) {
        setStep('empty')
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erreur serveur')
      }

      setPlan(data.data)
      setStockCount(data.stockCount || 0)
      setStockHash(data.stockHash || '')
      setSelectedDay(0)
      setStep('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inattendue')
      setStep('error')
    }
  }

  // Vérifier si le stock a changé quand l'utilisateur revient sur la page
  const checkStockFreshness = async () => {
    if (!stockHash || step !== 'ready') return
    try {
      const res = await fetch('/api/meal-suggestions/check?hash=' + stockHash)
      const data = await res.json()
      if (data.changed) {
        setStaleStock(true)
      }
    } catch { /* silently ignore */ }
  }

  useEffect(() => { fetchMeals() }, [])

  // Re-vérifier quand la page reprend le focus (retour depuis /fridge par ex.)
  useEffect(() => {
    const onFocus = () => checkStockFreshness()
    window.addEventListener('focus', onFocus)
    // Aussi vérifier avec l'API de visibilité (changement d'onglet mobile)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkStockFreshness()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })

  const currentDay = plan?.days[selectedDay]

  return (
    <>
      <AppHeader title="Idées repas" subtitle="Basé sur votre stock" />

      <div className="px-5 py-6 space-y-5">

        {/* LOADING */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-16 h-16 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin mb-6" />
            <p className="font-display text-lg text-forest-800 mb-1">Préparation du menu…</p>
            <p className="text-sm text-stone-warm/60 font-body text-center max-w-xs">
              Claude consulte votre stock et compose des repas équilibrés
            </p>
          </div>
        )}

        {/* EMPTY — pas de stock */}
        {step === 'empty' && (
          <div className="animate-fade-up space-y-4">
            <div className="card flex flex-col items-center text-center px-6 py-12">
              <span className="text-5xl mb-4">🥗</span>
              <h2 className="font-display text-xl text-forest-800 mb-2">
                Pas de stock enregistré
              </h2>
              <p className="text-sm text-stone-warm/70 font-body max-w-xs mb-6">
                Scannez d'abord votre frigo pour que Claude puisse vous proposer des repas adaptés.
              </p>
              <a href="/fridge" className="btn-primary">
                ❄️ Scanner le frigo
              </a>
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="animate-fade-up space-y-4">
            <div className="card px-5 py-5 border-l-4 border-l-red-400">
              <p className="text-base font-medium text-forest-800 font-body mb-1">
                Impossible de générer les repas
              </p>
              <p className="text-sm text-stone-warm/70 font-body">
                {errorMsg}
              </p>
            </div>
            <button onClick={fetchMeals} className="btn-secondary w-full">
              Réessayer
            </button>
          </div>
        )}

        {/* READY — Plan de repas */}
        {step === 'ready' && plan && currentDay && (
          <div className="animate-fade-up space-y-5">

            {/* Bandeau stock mis à jour */}
            {staleStock && (
              <button
                onClick={fetchMeals}
                className="w-full card px-4 py-3 flex items-center gap-3 border-l-4 border-l-forest-500
                           active:bg-cream-50 transition-colors animate-fade-up"
              >
                <span className="text-lg">🔄</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-forest-800 font-body">
                    Stock mis à jour
                  </p>
                  <p className="text-xs text-stone-warm/60 font-body">
                    Appuyez pour actualiser les suggestions de repas
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-forest-500 flex-shrink-0">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Stock badge */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-warm/60 font-body">
                Basé sur {stockCount} aliments en stock
              </p>
              <button
                onClick={fetchMeals}
                className="text-xs font-medium text-forest-600 font-body active:text-forest-800"
              >
                Regénérer
              </button>
            </div>

            {/* Day selector — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
              {plan.days.map((day, i) => {
                const active = i === selectedDay
                // Extraire le jour de la semaine (avant l'espace)
                const shortDay = day.date.split(' ')[0].slice(0, 3)
                const dayNum = day.date.split(' ')[1]
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(i)}
                    className={cn(
                      'flex flex-col items-center px-4 py-2.5 rounded-2xl flex-shrink-0 transition-all',
                      active
                        ? 'bg-forest-700 text-cream-50 shadow-sm'
                        : 'bg-cream-100 text-forest-800 active:bg-cream-200'
                    )}
                  >
                    <span className={cn(
                      'text-[10px] font-body font-medium uppercase tracking-wider',
                      active ? 'text-cream-100/70' : 'text-stone-warm/50'
                    )}>
                      {shortDay}
                    </span>
                    <span className={cn(
                      'text-lg font-display font-semibold -mt-0.5',
                      active ? 'text-cream-50' : 'text-forest-800'
                    )}>
                      {dayNum}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Date complète */}
            <p className="font-display text-lg text-forest-800 capitalize">
              {currentDay.date}
            </p>

            {/* Déjeuner */}
            <MealCard meal={currentDay.lunch} mealType="Déjeuner" emoji="☀️" />

            {/* Dîner */}
            <MealCard meal={currentDay.dinner} mealType="Dîner" emoji="🌙" />

            {/* Astuce courses */}
            {plan.shopping_tip && (
              <div className="card px-4 py-4 border-l-4 border-l-terra-300">
                <p className="text-xs font-medium text-forest-700 font-body uppercase tracking-wider mb-1.5">
                  Courses à prévoir
                </p>
                <p className="text-sm text-stone-warm/70 font-body leading-relaxed">
                  {plan.shopping_tip}
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}

// ============================================================
// Composant carte repas
// ============================================================

function MealCard({ meal, mealType, emoji }: { meal: Meal; mealType: string; emoji: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-start gap-3 text-left active:bg-cream-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-2xl bg-cream-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-lg">{emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-body font-medium text-stone-warm/50 uppercase tracking-wider mb-0.5">
            {mealType}
          </p>
          <p className="text-base font-medium text-forest-800 font-body leading-snug">
            {meal.name}
          </p>
          <p className="text-sm text-stone-warm/60 font-body mt-0.5">
            {meal.description}
          </p>

          {/* Tags */}
          {meal.tags && meal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {meal.tags.map(tag => {
                const config = TAG_CONFIG[tag] || { label: tag, bg: 'bg-stone-100', text: 'text-stone-600' }
                return (
                  <span
                    key={tag}
                    className={cn('text-[10px] font-body font-medium px-2 py-0.5 rounded-full', config.bg, config.text)}
                  >
                    {config.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={cn(
            'text-stone-warm/40 flex-shrink-0 mt-3 transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Expanded: ingrédients */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 animate-fade-in">
          <div className="border-t border-forest-100/30 pt-3 space-y-3">

            {/* Ingrédients en stock */}
            {meal.ingredients_from_stock.length > 0 && (
              <div>
                <p className="text-[10px] font-body font-medium text-forest-600 uppercase tracking-wider mb-1.5">
                  En stock
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meal.ingredients_from_stock.map((ing, i) => (
                    <span key={i} className="text-xs font-body text-forest-700 bg-forest-50 px-2.5 py-1 rounded-lg">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ingrédients à acheter */}
            {meal.ingredients_to_buy.length > 0 && (
              <div>
                <p className="text-[10px] font-body font-medium text-terra-600 uppercase tracking-wider mb-1.5">
                  À acheter
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meal.ingredients_to_buy.map((ing, i) => (
                    <span key={i} className="text-xs font-body text-terra-700 bg-terra-50 px-2.5 py-1 rounded-lg border border-terra-200/50">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

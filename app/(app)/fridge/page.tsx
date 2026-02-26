'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface DetectedItem {
  name: string
  quantity: string
  status: 'ok' | 'low' | 'missing'
}

export default function FridgePage() {
  const [step, setStep] = useState<'idle' | 'preview' | 'analyzing' | 'results'>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [results, setResults] = useState<DetectedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImageUrl(URL.createObjectURL(file))
    setStep('preview')
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!imageFile) return
    setStep('analyzing')

    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const res = await fetch('/api/scan-fridge', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()
      setResults(data.items || [])
      setStep('results')
    } catch (err) {
      setError('Une erreur est survenue. Réessayez.')
      setStep('preview')
    }
  }

  const reset = () => {
    setStep('idle')
    setImageUrl(null)
    setImageFile(null)
    setResults([])
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const statusConfig = {
    ok:      { label: 'OK',       color: 'text-forest-600', bg: 'bg-forest-100', dot: 'bg-forest-400' },
    low:     { label: 'Stock bas', color: 'text-terra-500',  bg: 'bg-terra-100',  dot: 'bg-terra-300'  },
    missing: { label: 'Manquant', color: 'text-red-500',    bg: 'bg-red-50',     dot: 'bg-red-400'    },
  }

  return (
    <>
      <AppHeader title="Scanner le frigo" subtitle="Photo → inventaire automatique" />

      <div className="px-5 py-6">

        {/* STEP: idle */}
        {step === 'idle' && (
          <div className="animate-fade-up">
            <div className="card flex flex-col items-center justify-center py-16 px-8 text-center border-2 border-dashed border-forest-200">
              <div className="w-20 h-20 rounded-3xl bg-forest-100 flex items-center justify-center mb-5">
                <span className="text-4xl">📷</span>
              </div>
              <h2 className="font-display text-xl text-forest-800 mb-2">Photographiez votre frigo</h2>
              <p className="text-sm text-stone-warm/70 font-body mb-8 max-w-xs">
                Claude analysera le contenu et détectera ce qui manque
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="fridge-upload"
              />

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <label
                  htmlFor="fridge-upload"
                  className="btn-primary w-full cursor-pointer text-center"
                >
                  📷 Prendre une photo
                </label>
                <label
                  htmlFor="fridge-upload"
                  className="btn-secondary w-full cursor-pointer text-center"
                  onClick={(e) => {
                    // Remove capture to allow gallery
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture')
                    }
                  }}
                >
                  🖼️ Choisir depuis la galerie
                </label>
              </div>
            </div>

            <div className="mt-6 card px-4 py-4">
              <p className="text-xs font-medium text-forest-700 mb-2 font-body uppercase tracking-wider">Conseils</p>
              <ul className="space-y-1.5">
                {[
                  'Ouvrez bien toutes les clayettes',
                  'Bonne luminosité pour une meilleure détection',
                  'Prenez la photo de face, porte ouverte',
                ].map(tip => (
                  <li key={tip} className="flex gap-2 text-xs text-stone-warm/80 font-body">
                    <span className="text-forest-400">✓</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && imageUrl && (
          <div className="animate-scale-in space-y-4">
            <div className="card overflow-hidden">
              <img
                src={imageUrl}
                alt="Photo du frigo"
                className="w-full object-cover max-h-80"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-terra-100 text-terra-500 text-sm font-body text-center">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="btn-secondary flex-1">
                ↩ Reprendre
              </button>
              <button onClick={handleAnalyze} className="btn-primary flex-1">
                ✨ Analyser
              </button>
            </div>
          </div>
        )}

        {/* STEP: analyzing */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <div className="relative mb-6">
              {imageUrl && (
                <img src={imageUrl} alt="" className="w-24 h-24 rounded-2xl object-cover opacity-40" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-forest-200 border-t-forest-700 rounded-full animate-spin border-[3px]" />
              </div>
            </div>
            <p className="font-display text-lg text-forest-800 mb-1">Analyse en cours…</p>
            <p className="text-sm text-stone-warm/60 font-body">Claude identifie vos aliments</p>
          </div>
        )}

        {/* STEP: results */}
        {step === 'results' && (
          <div className="animate-fade-up space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg text-forest-800">{results.length} produits détectés</h2>
                <p className="text-xs text-stone-warm/60 font-body">
                  {results.filter(r => r.status !== 'ok').length} à surveiller
                </p>
              </div>
              <button onClick={reset} className="text-xs text-forest-600 font-body font-medium">
                ← Nouveau scan
              </button>
            </div>

            {/* Image thumbnail */}
            {imageUrl && (
              <div className="card overflow-hidden">
                <img src={imageUrl} alt="Photo analysée" className="w-full object-cover max-h-40" />
              </div>
            )}

            {/* Results list */}
            <div className="space-y-2">
              {results.map((item, i) => {
                const config = statusConfig[item.status]
                return (
                  <div
                    key={i}
                    className="card px-4 py-3.5 flex items-center gap-3 animate-fade-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', config.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-forest-800 font-body">{item.name}</p>
                      <p className="text-xs text-stone-warm/60 font-body">{item.quantity}</p>
                    </div>
                    <span className={cn('text-xs font-medium font-body px-2 py-1 rounded-lg', config.bg, config.color)}>
                      {config.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Add missing to shopping list */}
            {results.some(r => r.status !== 'ok') && (
              <button className="btn-terra w-full">
                + Ajouter les manquants à la liste
              </button>
            )}
          </div>
        )}

      </div>
    </>
  )
}

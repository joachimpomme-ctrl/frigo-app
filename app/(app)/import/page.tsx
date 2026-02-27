'use client'

import { AppHeader } from '@/components/AppHeader'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import * as pdfjsLib from 'pdfjs-dist'

// Worker pour pdf.js (nécessaire pour le parsing)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

type Step = 'idle' | 'preview' | 'converting' | 'analyzing' | 'success' | 'duplicate' | 'error'

interface ParsedOrder {
  supplier: string
  date: string
  total: string
  status: string
  raw_items_summary: string
  items: Array<{ name: string; quantity: string; unit: string; price: string }>
}

const SUPPLIER_CONFIG: Record<string, { emoji: string; color: string }> = {
  'Picnic':      { emoji: '🛒', color: '#FF6B35' },
  'La Fourche':  { emoji: '🌿', color: '#2d6a2d' },
  'Le Fourgon':  { emoji: '🚐', color: '#1a3a5c' },
  'Marché':      { emoji: '🥕', color: '#c0622a' },
}

function getSupplierConfig(name: string) {
  return SUPPLIER_CONFIG[name] || { emoji: '📦', color: '#8c7b6b' }
}

export default function ImportPage() {
  const [step, setStep]       = useState<Step>('idle')
  const [file, setFile]       = useState<File | null>(null)
  const [result, setResult]   = useState<ParsedOrder | null>(null)
  const [itemsCount, setItemsCount] = useState(0)
  const fileInputRef          = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setStep('preview')
    setResult(null)
  }

  // Convertir un PDF en images PNG (base64) via pdf.js dans le navigateur
  const pdfToImages = async (pdfFile: File): Promise<string[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const images: string[] = []

    // Limiter à 10 pages max pour éviter les timeouts
    const pageCount = Math.min(pdf.numPages, 10)

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      // Scale 2x pour une bonne lisibilité par Claude
      const scale = 2
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!

      await page.render({ canvasContext: ctx, viewport }).promise

      // Convertir en JPEG base64 (bien plus léger que PNG pour l'envoi)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = dataUrl.split(',')[1]
      images.push(base64)
    }

    return images
  }

  const handleAnalyze = async () => {
    if (!file) return

    try {
      // Étape 1 : convertir le PDF en images côté navigateur
      setStep('converting')
      const images = await pdfToImages(file)

      // Étape 2 : envoyer les images au serveur
      setStep('analyzing')
      const res = await fetch('/api/import-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, filename: file.name }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erreur serveur')

      setResult(data.data)
      setItemsCount(data.itemsCount || 0)

      if (data.duplicate) {
        setStep('duplicate')
      } else {
        setStep('success')
      }

    } catch (err) {
      setStep('error')
    }
  }

  const reset = () => {
    setStep('idle')
    setFile(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const supplierConfig = result ? getSupplierConfig(result.supplier) : null

  return (
    <>
      <AppHeader title="Importer une facture" subtitle="PDF → historique automatique" />

      <div className="px-5 py-6 space-y-5">

        {/* IDLE */}
        {step === 'idle' && (
          <div className="animate-fade-up space-y-5">

            {/* Drop zone */}
            <label htmlFor="pdf-upload" className="block">
              <input
                ref={fileInputRef}
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFile}
                className="hidden"
              />
              <div className="card flex flex-col items-center justify-center py-14 px-8 text-center
                              border-2 border-dashed border-forest-200 active:border-forest-400
                              cursor-pointer transition-colors">
                <div className="w-20 h-20 rounded-3xl bg-forest-100 flex items-center justify-center mb-5">
                  <span className="text-4xl">📄</span>
                </div>
                <h2 className="font-display text-xl text-forest-800 mb-2">
                  Déposez une facture PDF
                </h2>
                <p className="text-sm text-stone-warm/70 font-body mb-6 max-w-xs">
                  Claude analyse automatiquement le fournisseur, la date, le total et tous les articles
                </p>
                <span className="btn-primary pointer-events-none">
                  📂 Choisir un PDF
                </span>
              </div>
            </label>

            {/* Supported suppliers */}
            <div className="card px-4 py-4">
              <p className="text-xs font-medium text-forest-700 mb-3 font-body uppercase tracking-wider">
                Fournisseurs reconnus
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SUPPLIER_CONFIG).map(([name, config]) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream-100">
                    <span>{config.emoji}</span>
                    <span className="text-sm font-body text-forest-800">{name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone-warm/50 font-body mt-3">
                + tout autre fournisseur détecté automatiquement
              </p>
            </div>

            {/* How it works */}
            <div className="space-y-2.5">
              {[
                { step: '1', text: 'Téléchargez la facture PDF depuis l\'email du fournisseur' },
                { step: '2', text: 'Importez-la ici — Claude lit et structure les données' },
                { step: '3', text: 'La commande apparaît dans votre historique' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-forest-700 text-cream-50 flex items-center justify-center flex-shrink-0 text-xs font-medium font-body mt-0.5">
                    {item.step}
                  </div>
                  <p className="text-sm text-stone-warm/80 font-body">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && file && (
          <div className="animate-scale-in space-y-4">
            <div className="card px-4 py-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-terra-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📄</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-forest-800 font-body truncate">{file.name}</p>
                <p className="text-xs text-stone-warm/60 font-body">
                  {(file.size / 1024).toFixed(0)} Ko · PDF
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={reset} className="btn-secondary flex-1">↩ Changer</button>
              <button onClick={handleAnalyze} className="btn-primary flex-1">✨ Analyser</button>
            </div>
          </div>
        )}

        {/* CONVERTING */}
        {step === 'converting' && (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <div className="w-16 h-16 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin mb-6" />
            <p className="font-display text-lg text-forest-800 mb-1">Lecture du PDF…</p>
            <p className="text-sm text-stone-warm/60 font-body text-center max-w-xs">
              Conversion des pages en images
            </p>
          </div>
        )}

        {/* ANALYZING */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <div className="w-16 h-16 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin mb-6" />
            <p className="font-display text-lg text-forest-800 mb-1">Analyse en cours…</p>
            <p className="text-sm text-stone-warm/60 font-body text-center max-w-xs">
              Claude lit votre facture et extrait les articles
            </p>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && result && supplierConfig && (
          <div className="animate-fade-up space-y-4">

            {/* Success banner */}
            <div className="card-elevated px-5 py-4 bg-forest-800 text-cream-50 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-forest-600/30" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-forest-400/30 flex items-center justify-center">
                    <svg width="14" height="12" fill="none" viewBox="0 0 14 12">
                      <path d="M1 6l4 4 8-9" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium font-body text-cream-100">Commande importée !</span>
                </div>
                <p className="font-display text-2xl text-cream-50 mb-0.5">{result.supplier}</p>
                <p className="text-sm text-cream-100/60 font-body">{result.date} · {result.total}</p>
              </div>
            </div>

            {/* Articles détectés */}
            <div className="card px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-forest-800 font-body">
                  {itemsCount} articles détectés
                </p>
                <span className="text-xs text-stone-warm/50 font-body">Stockés dans Sheets</span>
              </div>
              <p className="text-sm text-stone-warm/70 font-body leading-relaxed">
                {result.raw_items_summary}
              </p>
            </div>

            {/* Articles complets */}
            {result.items && result.items.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-stone-warm/50 uppercase tracking-wider font-body">
                  Détail complet
                </p>
                <div className="card divide-y divide-forest-100/30">
                  {result.items.slice(0, 8).map((item, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-forest-800 font-body">{item.name}</p>
                        <p className="text-xs text-stone-warm/50 font-body">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-forest-700 font-body">{item.price}</p>
                    </div>
                  ))}
                  {result.items.length > 8 && (
                    <div className="px-4 py-2.5">
                      <p className="text-xs text-stone-warm/50 font-body">
                        +{result.items.length - 8} autres articles
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button onClick={reset} className="btn-secondary w-full">
              + Importer une autre facture
            </button>
          </div>
        )}

        {/* DUPLICATE */}
        {step === 'duplicate' && result && (
          <div className="animate-fade-up space-y-4">
            <div className="card px-5 py-5 border-l-4 border-l-terra-300">
              <p className="text-base font-medium text-forest-800 font-body mb-1">
                Commande déjà importée
              </p>
              <p className="text-sm text-stone-warm/70 font-body">
                {result.supplier} · {result.date} · {result.total}
              </p>
            </div>
            <button onClick={reset} className="btn-secondary w-full">
              ← Retour
            </button>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="animate-fade-up space-y-4">
            <div className="card px-5 py-5 border-l-4 border-l-red-400">
              <p className="text-base font-medium text-forest-800 font-body mb-1">
                Impossible d'analyser ce document
              </p>
              <p className="text-sm text-stone-warm/70 font-body">
                Vérifiez que le fichier est bien un PDF lisible (non scanné ou protégé).
              </p>
            </div>
            <button onClick={reset} className="btn-secondary w-full">
              ← Réessayer
            </button>
          </div>
        )}

      </div>
    </>
  )
}

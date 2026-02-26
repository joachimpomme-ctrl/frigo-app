'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
    // Detect auth error from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('error')) setError(true)
    }
  }, [status, router])

  const handleLogin = async () => {
    setLoading(true)
    setError(false)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      setLoading(false)
    }
  }

  if (status === 'loading') return null

  return (
    <main className="min-h-svh flex flex-col items-center justify-between bg-forest-800 px-6 py-safe">
      {/* Background texture */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Top: Logo area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        {/* Icon */}
        <div className="animate-fade-up mb-8">
          <div className="w-24 h-24 rounded-3xl bg-forest-600 flex items-center justify-center shadow-elevated mx-auto mb-6">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-cream-50">
              <path d="M12 8C12 8 8 12 8 20C8 28 12 32 12 32H36C36 32 40 28 40 20C40 12 36 8 36 8H12Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M20 8V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M28 8V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 32L10 44H38L40 32" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M18 20C18 20 20 22 24 22C28 22 30 20 30 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="18" cy="17" r="1.5" fill="currentColor"/>
              <circle cx="30" cy="17" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="font-display text-4xl text-cream-50 text-center font-medium tracking-tight leading-none">
            Frigo
          </h1>
          <p className="font-display text-terra-300 text-center italic text-lg mt-1 animate-fade-up animate-delay-100">
            Notre épicerie intelligente
          </p>
        </div>

        {/* Features list */}
        <div className="w-full space-y-3 mb-12 animate-fade-up animate-delay-200">
          {[
            { icon: '📦', text: 'Historique Picnic, La Fourche & Le Fourgon' },
            { icon: '📷', text: 'Scanner le frigo en photo' },
            { icon: '✨', text: 'Précos de courses intelligentes' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-cream-100/80 text-sm font-body">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Login button */}
      <div className="w-full max-w-sm pb-8 animate-fade-up animate-delay-300">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-terra-500/20 border border-terra-500/30 text-terra-300 text-sm text-center">
            Accès non autorisé. Contactez l'administrateur.
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                     bg-cream-50 text-forest-800 font-body font-medium text-base
                     active:scale-[0.98] transition-all duration-150 shadow-elevated
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-forest-700/30 border-t-forest-700 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Connexion...' : 'Continuer avec Google'}
        </button>
        <p className="text-center text-cream-100/30 text-xs mt-4 font-body">
          Accès réservé à notre famille 🌿
        </p>
      </div>
    </main>
  )
}

'use client'

import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'

interface AppHeaderProps {
  title: string
  subtitle?: string
  showProfile?: boolean
}

export function AppHeader({ title, subtitle, showProfile = true }: AppHeaderProps) {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur-md border-b border-forest-100/30">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="font-display text-xl text-forest-800 font-medium leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs text-stone-warm/70 font-body mt-0.5">{subtitle}</p>
          )}
        </div>

        {showProfile && session?.user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-forest-200 active:opacity-70 transition-opacity"
            >
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || ''}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-forest-600 flex items-center justify-center">
                  <span className="text-cream-50 text-sm font-medium">
                    {session.user.name?.[0] || '?'}
                  </span>
                </div>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-40 w-52 bg-white rounded-2xl shadow-elevated border border-forest-100/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-forest-100/30">
                    <p className="text-sm font-medium text-forest-800 font-body truncate">{session.user.name}</p>
                    <p className="text-xs text-stone-warm/70 font-body truncate">{session.user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full text-left px-4 py-3 text-sm text-terra-500 font-body
                               hover:bg-terra-100/50 active:bg-terra-100 transition-colors"
                  >
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

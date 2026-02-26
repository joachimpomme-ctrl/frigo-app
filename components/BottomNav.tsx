'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
          strokeLinejoin="round"/>
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/fridge',
    label: 'Frigo',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
        <path d="M4 10h16" stroke="currentColor" strokeWidth={active ? 2 : 1.5}/>
        <path d="M8 6.5v2M8 14v3" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/import',
    label: 'Factures',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
          strokeLinejoin="round"/>
        <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/shopping-list',
    label: 'Courses',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
          strokeLinejoin="round"/>
        <path d="M3 6h18M16 10a4 4 0 01-8 0"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/history',
    label: 'Historique',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="bg-white/95 backdrop-blur-md border-t border-forest-100/50 shadow-elevated">
        <div className="flex items-center justify-around px-1 h-16">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
                  'transition-all duration-200 active:scale-90',
                  active ? 'text-forest-700' : 'text-stone-warm/60'
                )}
              >
                {item.icon(active)}
                <span className={cn(
                  'text-[9px] font-body font-medium tracking-wide',
                  active ? 'text-forest-700' : 'text-stone-warm/50'
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

import { AppHeader } from '@/components/AppHeader'
import { StockAlertBanner } from '@/components/StockAlertBanner'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import Link from 'next/link'

const suppliers = [
  { name: 'Picnic', color: '#FF6B35', emoji: '🛒', connected: true },
  { name: 'La Fourche', color: '#2d6a2d', emoji: '🌿', connected: false },
  { name: 'Le Fourgon', color: '#1a3a5c', emoji: '🚐', connected: false },
  { name: 'Marché', color: '#c0622a', emoji: '🥕', connected: true },
]

const quickActions = [
  { href: '/fridge', label: 'Scanner le frigo', icon: '📷', description: 'Prendre une photo' },
  { href: '/shopping-list', label: 'Mes courses', icon: '🛍️', description: 'Voir la liste' },
  { href: '/analytics', label: 'Analyse IA', icon: '✨', description: 'Vos habitudes' },
  { href: '/history', label: 'Commandes', icon: '📦', description: 'Historique' },
]

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const firstName = session?.user?.name?.split(' ')[0] || 'là'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <>
      <AppHeader
        title="Frigo"
        subtitle={`${greeting}, ${firstName} 👋`}
      />

      <div className="px-5 py-6 space-y-7">

        {/* Stock alert banner — données en temps réel */}
        <StockAlertBanner />

        {/* Quick actions */}
        <section className="animate-fade-up animate-delay-100">
          <h2 className="font-display text-base text-forest-700 mb-3 font-medium">Actions rapides</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="card p-3.5 text-center active:scale-95 transition-transform duration-150">
                  <div className="text-2xl mb-2">{action.icon}</div>
                  <p className="text-[11px] font-medium text-forest-800 font-body leading-tight">{action.label}</p>
                  <p className="text-[10px] text-stone-warm/60 font-body mt-0.5">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Suppliers status */}
        <section className="animate-fade-up animate-delay-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base text-forest-700 font-medium">Fournisseurs</h2>
            <span className="text-xs text-stone-warm/60 font-body">2/4 connectés</span>
          </div>
          <div className="space-y-2.5">
            {suppliers.map((s) => (
              <div key={s.name} className="card px-4 py-3.5 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: s.color + '18' }}
                >
                  {s.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-forest-800 font-body">{s.name}</p>
                  <p className="text-xs text-stone-warm/60 font-body">
                    {s.connected ? 'Synchronisé' : 'Non connecté'}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.connected ? 'bg-forest-400' : 'bg-cream-200'}`} />
              </div>
            ))}
          </div>
        </section>

        {/* Analyse IA teaser */}
        <section className="animate-fade-up animate-delay-300">
          <h2 className="font-display text-base text-forest-700 mb-3 font-medium">Intelligence courses</h2>
          <Link href="/analytics">
            <div className="card-elevated px-5 py-4 bg-forest-800 text-cream-50 relative overflow-hidden active:scale-[0.98] transition-transform">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-forest-600/40" />
              <div className="absolute -right-4 -bottom-8 w-24 h-24 rounded-full bg-terra-500/20" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">✨</span>
                  <span className="text-sm font-medium font-body text-cream-100">Analyse IA</span>
                </div>
                <p className="font-display text-xl font-medium text-cream-50 mb-1">
                  Découvrez vos habitudes d'achat
                </p>
                <p className="text-xs text-cream-100/60 font-body">
                  Fréquence de commande, produits favoris, suggestions personnalisées
                </p>
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-terra-300 font-body">
                    Voir l'analyse complète →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>

      </div>
    </>
  )
}

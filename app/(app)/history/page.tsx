import { AppHeader } from '@/components/AppHeader'

const MOCK_ORDERS = [
  {
    id: '1',
    date: '2025-01-14',
    supplier: 'Picnic',
    emoji: '🛒',
    color: '#FF6B35',
    total: '67,40 €',
    items: ['Lait x3', 'Fromage', 'Légumes', '+8 articles'],
    status: 'livré',
  },
  {
    id: '2',
    date: '2025-01-08',
    supplier: 'La Fourche',
    emoji: '🌿',
    color: '#2d6a2d',
    total: '124,20 €',
    items: ['Huile d\'olive', 'Pâtes x4', 'Conserves', '+12 articles'],
    status: 'livré',
  },
  {
    id: '3',
    date: '2025-01-06',
    supplier: 'Marché',
    emoji: '🥕',
    color: '#c0622a',
    total: '28,50 €',
    items: ['Carottes', 'Poireaux', 'Pommes', 'Fromage fermier'],
    status: 'livré',
  },
  {
    id: '4',
    date: '2024-12-28',
    supplier: 'Picnic',
    emoji: '🛒',
    color: '#FF6B35',
    total: '54,80 €',
    items: ['Yaourts x8', 'Jus d\'orange', 'Pain', '+5 articles'],
    status: 'livré',
  },
]

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function HistoryPage() {
  return (
    <>
      <AppHeader title="Historique" subtitle="Vos dernières commandes" />

      <div className="px-5 py-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 animate-fade-up">
          {[
            { label: 'Ce mois', value: '274 €' },
            { label: 'Commandes', value: '4' },
            { label: 'Moy./semaine', value: '68 €' },
          ].map(stat => (
            <div key={stat.label} className="card px-3 py-3.5 text-center">
              <p className="font-display text-xl text-forest-800 font-medium">{stat.value}</p>
              <p className="text-[10px] text-stone-warm/60 font-body mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Orders list */}
        <div className="space-y-3 animate-fade-up animate-delay-100">
          {MOCK_ORDERS.map((order, i) => (
            <div
              key={order.id}
              className="card overflow-hidden animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Supplier bar */}
              <div className="h-1" style={{ backgroundColor: order.color }} />

              <div className="px-4 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: order.color + '15' }}
                    >
                      {order.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-forest-800 font-body">{order.supplier}</p>
                      <p className="text-xs text-stone-warm/60 font-body">{formatDate(order.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base text-forest-800 font-medium">{order.total}</p>
                    <span className="text-[10px] bg-forest-100 text-forest-600 px-2 py-0.5 rounded-full font-body">
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Items preview */}
                <div className="flex flex-wrap gap-1.5">
                  {order.items.map(item => (
                    <span
                      key={item}
                      className="text-[11px] text-stone-warm/70 font-body bg-cream-100 px-2 py-0.5 rounded-lg"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Connect more */}
        <div className="card px-5 py-5 bg-forest-800 text-cream-50 text-center animate-fade-up animate-delay-300">
          <p className="font-display text-base mb-1">Connectez La Fourche & Le Fourgon</p>
          <p className="text-xs text-cream-100/60 font-body mb-4">
            Pour importer l'historique complet et avoir des précos précises
          </p>
          <button className="text-sm font-medium text-terra-300 font-body">
            Configurer les connexions →
          </button>
        </div>

      </div>
    </>
  )
}

import { requireAuth } from '@/lib/auth'
import { BottomNav } from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()

  return (
    <div className="min-h-svh bg-cream-50">
      <main className="pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getStock } from '@/lib/sheets'
import crypto from 'crypto'

/**
 * Endpoint léger : compare le hash du stock actuel avec celui fourni par le client.
 * Permet de détecter si l'inventaire a changé depuis la dernière génération de repas
 * sans re-générer tout le plan (pas d'appel Claude).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const clientHash = req.nextUrl.searchParams.get('hash') || ''

  if (!clientHash) {
    return NextResponse.json({ changed: false })
  }

  try {
    const stock = await getStock()
    const currentHash = computeStockHash(stock.filter(s => s.quantity > 0))

    return NextResponse.json({
      changed: currentHash !== clientHash,
      stockCount: stock.filter(s => s.quantity > 0).length,
    })
  } catch {
    // En cas d'erreur, ne pas bloquer — on considère pas de changement
    return NextResponse.json({ changed: false })
  }
}

function computeStockHash(stock: Array<{ name: string; quantity: number; unit: string }>): string {
  const data = stock
    .map(s => `${s.name}:${s.quantity}:${s.unit}`)
    .sort()
    .join('|')
  return crypto.createHash('md5').update(data).digest('hex').slice(0, 12)
}

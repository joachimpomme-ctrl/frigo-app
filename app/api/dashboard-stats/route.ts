import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange } from '@/lib/sheets'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const [orderRows, stockRows] = await Promise.all([
      readRange('Commandes!A2:F500'),
      readRange('Stock!A2:H500'),
    ])

    // Dépenses du mois en cours
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    let monthlySpend = 0
    const supplierSpend: Record<string, number> = {}

    for (const row of orderRows) {
      if (!row[0] || !row[1]) continue
      const date = row[1] // YYYY-MM-DD
      if (!date.startsWith(currentMonth)) continue

      const amount = parseFloat(row[4]?.replace(/[^0-9.]/g, '') || '0')
      if (isNaN(amount)) continue

      monthlySpend += amount
      const supplier = row[2] || ''
      if (supplier) {
        supplierSpend[supplier] = (supplierSpend[supplier] || 0) + amount
      }
    }

    // Niveaux de stock (dernier état connu par produit)
    const latestStock = new Map<string, string>()
    for (const row of stockRows) {
      if (!row[1]) continue
      // Clé unique par produit, on garde le dernier
      latestStock.set(row[1].toLowerCase().trim(), row[5] || 'ok')
    }

    let stockOk = 0
    let stockLow = 0
    let stockMissing = 0

    latestStock.forEach((status) => {
      if (status === 'low') stockLow++
      else if (status === 'missing') stockMissing++
      else stockOk++
    })

    return NextResponse.json({
      monthlySpend,
      supplierSpend,
      stockOk,
      stockLow,
      stockMissing,
      stockTotal: latestStock.size,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

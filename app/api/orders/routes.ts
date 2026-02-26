import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange } from '@/lib/sheets'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Récupérer toutes les commandes
    const orderRows = await readRange('Commandes!A2:F500')
    const orders = orderRows
      .filter(row => row.length > 0 && row[0])
      .map(row => ({
        id:       row[0] || '',
        date:     row[1] || '',
        supplier: row[2] || '',
        items:    row[3] || '',
        total:    row[4] || '',
        status:   row[5] || 'livré',
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    // Récupérer tous les articles détaillés
    const productRows = await readRange('Produits!A2:G2000')
    const products = productRows
      .filter(row => row.length > 0 && row[0])
      .map(row => ({
        orderId:  row[0] || '',
        date:     row[1] || '',
        supplier: row[2] || '',
        name:     row[3] || '',
        quantity: row[4] || '',
        unit:     row[5] || '',
        price:    row[6] || '',
      }))

    // Grouper les articles par commande
    const productsByOrder: Record<string, typeof products> = {}
    for (const p of products) {
      if (!productsByOrder[p.orderId]) productsByOrder[p.orderId] = []
      productsByOrder[p.orderId].push(p)
    }

    // Stats globales
    const totalSpend = orders.reduce((sum, o) => {
      const amount = parseFloat(o.total?.replace(/[^0-9.]/g, '') || '0')
      return sum + (isNaN(amount) ? 0 : amount)
    }, 0)

    const supplierStats: Record<string, { count: number; total: number }> = {}
    for (const o of orders) {
      if (!supplierStats[o.supplier]) supplierStats[o.supplier] = { count: 0, total: 0 }
      supplierStats[o.supplier].count++
      const amount = parseFloat(o.total?.replace(/[^0-9.]/g, '') || '0')
      supplierStats[o.supplier].total += isNaN(amount) ? 0 : amount
    }

    return NextResponse.json({
      orders,
      productsByOrder,
      stats: {
        totalOrders: orders.length,
        totalSpend: totalSpend.toFixed(2),
        supplierStats,
      }
    })

  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

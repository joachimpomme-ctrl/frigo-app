import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange, writeRange } from '@/lib/sheets'

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

// DELETE — Supprimer une commande et ses produits associés
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

    // Supprimer de Commandes
    const orderRows = await readRange('Commandes!A2:F500')
    const remainingOrders = orderRows.filter(row => row[0] !== id)

    if (remainingOrders.length === orderRows.length) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 })
    }

    // Réécrire les commandes
    if (remainingOrders.length > 0) {
      await writeRange(`Commandes!A2:F${remainingOrders.length + 1}`, remainingOrders)
    }
    // Effacer les lignes en trop
    if (remainingOrders.length < orderRows.length) {
      const emptyRows = Array(orderRows.length - remainingOrders.length).fill(['', '', '', '', '', ''])
      await writeRange(
        `Commandes!A${remainingOrders.length + 2}:F${orderRows.length + 1}`,
        emptyRows
      )
    }

    // Supprimer les produits associés
    const productRows = await readRange('Produits!A2:G2000')
    const remainingProducts = productRows.filter(row => row[0] !== id)

    if (remainingProducts.length < productRows.length) {
      if (remainingProducts.length > 0) {
        await writeRange(`Produits!A2:G${remainingProducts.length + 1}`, remainingProducts)
      }
      const emptyProductRows = Array(productRows.length - remainingProducts.length).fill(['', '', '', '', '', '', ''])
      await writeRange(
        `Produits!A${remainingProducts.length + 2}:G${productRows.length + 1}`,
        emptyProductRows
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Orders DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

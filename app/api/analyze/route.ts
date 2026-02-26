import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange } from '@/lib/sheets'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Lire les commandes et les produits depuis Google Sheets
    const [orderRows, productRows, inventoryRows] = await Promise.all([
      readRange('Commandes!A2:F500'),
      readRange('Produits!A2:G2000'),
      readRange('Inventaire!A2:I500'),
    ])

    const orders = orderRows
      .filter(row => row.length > 0 && row[0])
      .map(row => ({
        id: row[0],
        date: row[1] || '',
        supplier: row[2] || '',
        items: row[3] || '',
        total: row[4] || '',
        status: row[5] || '',
      }))

    const products = productRows
      .filter(row => row.length > 0 && row[0])
      .map(row => ({
        orderId: row[0],
        date: row[1] || '',
        supplier: row[2] || '',
        name: row[3] || '',
        quantity: row[4] || '',
        unit: row[5] || '',
        price: row[6] || '',
      }))

    const inventory = inventoryRows
      .filter(row => row.length > 0 && row[0])
      .map(row => ({
        sessionId: row[0],
        date: row[1] || '',
        time: row[2] || '',
        label: row[3] || '',
        location: row[4] || '',
        name: row[5] || '',
        quantity: row[6] || '',
        unit: row[7] || '',
        status: row[8] || '',
      }))

    // Si pas assez de données, retourner un état vide
    if (orders.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: 'Pas encore assez de données. Importez vos premières factures !',
      })
    }

    // Calculer les stats côté serveur (rapide, sans IA)
    const topProducts = computeTopProducts(products)
    const supplierFrequency = computeSupplierFrequency(orders)
    const monthlySpending = computeMonthlySpending(orders)
    const lowStockItems = inventory.filter(i => i.status === 'low' || i.status === 'missing')

    // Préparer le contexte pour Claude
    const dataContext = JSON.stringify({
      orders_count: orders.length,
      orders_summary: orders.slice(0, 50).map(o => ({
        date: o.date,
        supplier: o.supplier,
        total: o.total,
      })),
      top_products: topProducts.slice(0, 20),
      supplier_frequency: supplierFrequency,
      monthly_spending: monthlySpending,
      low_stock: lowStockItems.slice(0, 10).map(i => ({
        name: i.name,
        status: i.status,
        location: i.location,
      })),
      today: new Date().toISOString().split('T')[0],
    })

    // Demander à Claude d'analyser les patterns
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Tu es un assistant d'analyse de courses familiales. On te donne les données d'achat d'une famille.
Analyse les patterns et donne des recommandations pratiques.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication.
Format exact :
{
  "insights": [
    { "type": "frequency", "icon": "📅", "title": "Titre court", "description": "Description en 1-2 phrases" }
  ],
  "next_orders": [
    { "supplier": "Nom", "suggested_date": "YYYY-MM-DD", "reason": "Explication courte", "confidence": "high|medium|low" }
  ],
  "savings_tips": [
    { "tip": "Conseil pratique en 1 phrase" }
  ],
  "summary": "Résumé global en 2-3 phrases des habitudes de la famille"
}

Règles :
- 3 à 5 insights maximum
- 1 à 4 next_orders (un par fournisseur actif)
- 2 à 3 savings_tips
- Dates au format YYYY-MM-DD
- Les types d'insights possibles : "frequency", "spending", "pattern", "alert"
- Les icônes possibles : 📅 (fréquence), 💰 (dépense), 🔄 (pattern), ⚠️ (alerte), 🛒 (courses)
- Sois concret : donne des jours, des montants, des noms de produits
- Parle en français`,
      messages: [
        {
          role: 'user',
          content: `Voici les données de courses de la famille. Analyse les habitudes et donne des recommandations :\n\n${dataContext}`,
        },
      ],
    })

    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Réponse invalide de Claude')
    }

    const cleanJson = textContent.text.replace(/```json\n?|```\n?/g, '').trim()
    const aiAnalysis = JSON.parse(cleanJson)

    return NextResponse.json({
      hasData: true,
      stats: {
        totalOrders: orders.length,
        totalSpend: orders.reduce((sum, o) => {
          const v = parseFloat(o.total?.replace(/[^0-9.]/g, '') || '0')
          return sum + (isNaN(v) ? 0 : v)
        }, 0).toFixed(2),
        topProducts: topProducts.slice(0, 10),
        supplierFrequency,
        monthlySpending,
      },
      ai: aiAnalysis,
    })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 })
  }
}

// --- Fonctions de calcul côté serveur ---

function computeTopProducts(products: Array<{ name: string; quantity: string; price: string; supplier: string }>) {
  const counts: Record<string, { count: number; totalSpent: number; suppliers: Set<string> }> = {}

  for (const p of products) {
    const key = p.name.toLowerCase().trim()
    if (!key) continue
    if (!counts[key]) counts[key] = { count: 0, totalSpent: 0, suppliers: new Set() }
    counts[key].count++
    const price = parseFloat(p.price?.replace(/[^0-9.]/g, '') || '0')
    if (!isNaN(price)) counts[key].totalSpent += price
    if (p.supplier) counts[key].suppliers.add(p.supplier)
  }

  return Object.entries(counts)
    .map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count: data.count,
      totalSpent: parseFloat(data.totalSpent.toFixed(2)),
      suppliers: Array.from(data.suppliers),
    }))
    .sort((a, b) => b.count - a.count)
}

function computeSupplierFrequency(orders: Array<{ date: string; supplier: string; total: string }>) {
  const bySupplier: Record<string, { dates: string[]; totals: number[] }> = {}

  for (const o of orders) {
    if (!o.supplier || !o.date) continue
    if (!bySupplier[o.supplier]) bySupplier[o.supplier] = { dates: [], totals: [] }
    bySupplier[o.supplier].dates.push(o.date)
    const v = parseFloat(o.total?.replace(/[^0-9.]/g, '') || '0')
    if (!isNaN(v)) bySupplier[o.supplier].totals.push(v)
  }

  const result: Record<string, {
    orderCount: number
    avgDaysBetween: number | null
    avgSpend: number
    lastOrder: string
  }> = {}

  for (const [supplier, data] of Object.entries(bySupplier)) {
    const sorted = data.dates.sort()
    let avgDays: number | null = null

    if (sorted.length >= 2) {
      const diffs: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1]).getTime()
        const d2 = new Date(sorted[i]).getTime()
        if (!isNaN(d1) && !isNaN(d2)) {
          diffs.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
        }
      }
      if (diffs.length > 0) {
        avgDays = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
      }
    }

    const avgSpend = data.totals.length > 0
      ? data.totals.reduce((a, b) => a + b, 0) / data.totals.length
      : 0

    result[supplier] = {
      orderCount: sorted.length,
      avgDaysBetween: avgDays,
      avgSpend: parseFloat(avgSpend.toFixed(2)),
      lastOrder: sorted[sorted.length - 1] || '',
    }
  }

  return result
}

function computeMonthlySpending(orders: Array<{ date: string; total: string }>) {
  const byMonth: Record<string, number> = {}

  for (const o of orders) {
    if (!o.date) continue
    const key = o.date.substring(0, 7) // YYYY-MM
    if (!byMonth[key]) byMonth[key] = 0
    const v = parseFloat(o.total?.replace(/[^0-9.]/g, '') || '0')
    if (!isNaN(v)) byMonth[key] += v
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: parseFloat(total.toFixed(2)) }))
}

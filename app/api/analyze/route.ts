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
    // Lire les commandes, produits, inventaire et feedback
    const [orderRows, productRows, inventoryRows, feedbackRows] = await Promise.all([
      readRange('Commandes!A2:F500'),
      readRange('Produits!A2:G2000'),
      readRange('Inventaire!A2:I2000'),
      readRange('Feedback!A2:D2000').catch(() => [] as string[][]),
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

    // Calculer la vélocité de consommation depuis l'historique des scans
    const consumptionInsights = computeConsumptionVelocity(inventory)

    // Résumer le feedback utilisateur (quels produits sont acceptés/rejetés)
    const feedbackSummary = computeFeedbackSummary(feedbackRows)

    // Préparer le contexte enrichi pour Claude
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
      consumption_velocity: consumptionInsights.slice(0, 15),
      feedback_summary: feedbackSummary,
      today: new Date().toISOString().split('T')[0],
    })

    // Demander à Claude d'analyser les patterns
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Tu es un assistant d'analyse de courses familiales. On te donne les données d'achat d'une famille,
l'état de leurs stocks (issu de scans photo du frigo), la vélocité de consommation estimée par produit,
et le feedback de l'utilisateur sur les recommandations passées (acceptées ou rejetées).

Croise ces données pour donner des recommandations pertinentes et personnalisées.

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
- Les types d'insights possibles : "frequency", "spending", "pattern", "alert", "consumption"
- Les icônes possibles : 📅 (fréquence), 💰 (dépense), 🔄 (pattern), ⚠️ (alerte), 🛒 (courses), 📉 (consommation)
- Sois concret : donne des jours, des montants, des noms de produits
- Utilise la vélocité de consommation (consumption_velocity) pour prédire les ruptures imminentes
- Tiens compte du feedback : si un produit est souvent rejeté, ne le recommande pas ; si accepté, priorise-le
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

// --- Vélocité de consommation : croise les scans d'inventaire successifs ---
function computeConsumptionVelocity(
  inventory: Array<{ sessionId: string; date: string; name: string; status: string }>
) {
  // Grouper par session
  const sessions: Record<string, { date: string; items: Map<string, string> }> = {}
  for (const item of inventory) {
    if (!item.sessionId) continue
    if (!sessions[item.sessionId]) {
      sessions[item.sessionId] = { date: item.date, items: new Map() }
    }
    if (item.name) {
      sessions[item.sessionId].items.set(item.name.toLowerCase().trim(), item.status)
    }
  }

  const sorted = Object.values(sessions).sort((a, b) => b.date.localeCompare(a.date))
  if (sorted.length < 2) return []

  // Pour chaque produit, observer les transitions ok → low/missing
  const productTransitions: Record<string, { avgDays: number; occurrences: number }> = {}

  // Collecter tous les noms de produits
  const allProducts = new Set<string>()
  for (const s of sorted) {
    s.items.forEach((_, name) => allProducts.add(name))
  }

  for (const product of Array.from(allProducts)) {
    const history: Array<{ date: string; status: string }> = []
    for (const s of sorted) {
      const status = s.items.get(product)
      if (status) {
        history.push({ date: s.date, status })
      }
    }

    if (history.length < 2) continue

    const transitions: number[] = []
    for (let i = 0; i < history.length - 1; i++) {
      if (
        history[i].status === 'ok' &&
        (history[i + 1].status === 'low' || history[i + 1].status === 'missing')
      ) {
        const d1 = new Date(history[i].date).getTime()
        const d2 = new Date(history[i + 1].date).getTime()
        if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
          transitions.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
        }
      }
    }

    if (transitions.length > 0) {
      productTransitions[product] = {
        avgDays: Math.round(transitions.reduce((a, b) => a + b, 0) / transitions.length),
        occurrences: transitions.length,
      }
    }
  }

  return Object.entries(productTransitions)
    .map(([name, data]) => ({
      product: name.charAt(0).toUpperCase() + name.slice(1),
      avg_days_to_depletion: data.avgDays,
      observed_cycles: data.occurrences,
    }))
    .sort((a, b) => a.avg_days_to_depletion - b.avg_days_to_depletion)
}

// --- Résumé du feedback utilisateur ---
function computeFeedbackSummary(feedbackRows: string[][]) {
  const byProduct: Record<string, { accepted: number; rejected: number; snoozed: number }> = {}

  for (const row of feedbackRows) {
    if (!row[1] || !row[2]) continue
    const key = row[1].toLowerCase().trim()
    if (!byProduct[key]) byProduct[key] = { accepted: 0, rejected: 0, snoozed: 0 }
    const action = row[2] as 'accepted' | 'rejected' | 'snoozed'
    if (byProduct[key][action] !== undefined) {
      byProduct[key][action]++
    }
  }

  const entries = Object.entries(byProduct)
  if (entries.length === 0) return null

  return {
    total_feedback: entries.reduce((sum, [, v]) => sum + v.accepted + v.rejected + v.snoozed, 0),
    most_accepted: entries
      .filter(([, v]) => v.accepted > 0)
      .sort(([, a], [, b]) => b.accepted - a.accepted)
      .slice(0, 5)
      .map(([name, v]) => ({ product: name, accepted: v.accepted })),
    most_rejected: entries
      .filter(([, v]) => v.rejected > 0)
      .sort(([, a], [, b]) => b.rejected - a.rejected)
      .slice(0, 5)
      .map(([name, v]) => ({ product: name, rejected: v.rejected })),
  }
}

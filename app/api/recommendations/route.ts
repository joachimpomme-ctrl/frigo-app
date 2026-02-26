import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange } from '@/lib/sheets'

export interface Recommendation {
  id: string
  name: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
  source: 'inventory' | 'frequency' | 'history'
  supplier: string
  suggestedQuantity: string
  lastSeen: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const [inventoryRows, productRows, stockRows, listRows] = await Promise.all([
      readRange('Inventaire!A2:I2000'),
      readRange('Produits!A2:G2000'),
      readRange('Stock!A2:H500'),
      readRange('Liste!A2:E200'),
    ])

    // 1. Dernier inventaire : items low/missing
    const inventoryAlerts = getInventoryAlerts(inventoryRows)

    // 2. Produits fréquents absents du dernier inventaire
    const frequencyAlerts = getFrequencyAlerts(productRows, inventoryRows)

    // 3. Produits dans le stock avec statut "low"
    const stockAlerts = getStockAlerts(stockRows)

    // Fusionner et dédupliquer
    const allRecs = mergeRecommendations([
      ...inventoryAlerts,
      ...frequencyAlerts,
      ...stockAlerts,
    ])

    // Retirer les produits déjà dans la liste de courses
    const listNames = new Set(
      listRows
        .filter(r => r.length > 1 && r[1])
        .map(r => r[1].toLowerCase().trim())
    )
    const filtered = allRecs.filter(r => !listNames.has(r.name.toLowerCase().trim()))

    // Trier : high > medium > low
    const urgencyOrder = { high: 0, medium: 1, low: 2 }
    filtered.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

    return NextResponse.json({
      recommendations: filtered,
      counts: {
        high: filtered.filter(r => r.urgency === 'high').length,
        medium: filtered.filter(r => r.urgency === 'medium').length,
        low: filtered.filter(r => r.urgency === 'low').length,
        total: filtered.length,
      },
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// --- Items low/missing du dernier inventaire ---
function getInventoryAlerts(rows: string[][]): Recommendation[] {
  // Trouver la session la plus récente
  const sessions: Record<string, { date: string; items: Array<{ name: string; status: string; location: string; quantity: string; unit: string }> }> = {}

  for (const row of rows) {
    if (!row[0]) continue
    const sid = row[0]
    if (!sessions[sid]) sessions[sid] = { date: row[1] || '', items: [] }
    sessions[sid].items.push({
      name: row[5] || '',
      quantity: row[6] || '',
      unit: row[7] || '',
      status: row[8] || 'ok',
      location: row[4] || '',
    })
  }

  const sorted = Object.entries(sessions).sort(([, a], [, b]) => b.date.localeCompare(a.date))
  if (sorted.length === 0) return []

  const [, latest] = sorted[0]
  const recs: Recommendation[] = []

  for (const item of latest.items) {
    if (item.status === 'missing') {
      recs.push({
        id: `inv-${item.name}`,
        name: item.name,
        reason: `Manquant lors du dernier inventaire`,
        urgency: 'high',
        source: 'inventory',
        supplier: '',
        suggestedQuantity: item.quantity || '1',
        lastSeen: latest.date,
      })
    } else if (item.status === 'low') {
      recs.push({
        id: `inv-${item.name}`,
        name: item.name,
        reason: `Stock bas (${item.quantity} ${item.unit})`,
        urgency: 'medium',
        source: 'inventory',
        supplier: '',
        suggestedQuantity: item.quantity || '1',
        lastSeen: latest.date,
      })
    }
  }

  return recs
}

// --- Produits achetés régulièrement mais absents du dernier inventaire ---
function getFrequencyAlerts(productRows: string[][], inventoryRows: string[][]): Recommendation[] {
  // Compter la fréquence d'achat de chaque produit
  const productFreq: Record<string, { count: number; lastDate: string; supplier: string; quantity: string; unit: string }> = {}

  for (const row of productRows) {
    if (!row[3]) continue
    const key = row[3].toLowerCase().trim()
    if (!productFreq[key]) {
      productFreq[key] = { count: 0, lastDate: '', supplier: '', quantity: '', unit: '' }
    }
    productFreq[key].count++
    if (row[1] > productFreq[key].lastDate) {
      productFreq[key].lastDate = row[1] || ''
      productFreq[key].supplier = row[2] || ''
      productFreq[key].quantity = row[4] || '1'
      productFreq[key].unit = row[5] || ''
    }
  }

  // Produits achetés 3+ fois = réguliers
  const regularProducts = Object.entries(productFreq)
    .filter(([, data]) => data.count >= 3)

  if (regularProducts.length === 0) return []

  // Noms des produits vus dans le dernier inventaire
  const lastInventoryNames = getLastInventoryProductNames(inventoryRows)

  const recs: Recommendation[] = []
  for (const [name, data] of regularProducts) {
    if (!lastInventoryNames.has(name)) {
      recs.push({
        id: `freq-${name}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        reason: `Acheté ${data.count} fois, absent du dernier inventaire`,
        urgency: 'low',
        source: 'frequency',
        supplier: data.supplier,
        suggestedQuantity: data.quantity,
        lastSeen: data.lastDate,
      })
    }
  }

  return recs
}

function getLastInventoryProductNames(rows: string[][]): Set<string> {
  const sessions: Record<string, { date: string; names: string[] }> = {}
  for (const row of rows) {
    if (!row[0]) continue
    const sid = row[0]
    if (!sessions[sid]) sessions[sid] = { date: row[1] || '', names: [] }
    if (row[5]) sessions[sid].names.push(row[5].toLowerCase().trim())
  }

  const sorted = Object.entries(sessions).sort(([, a], [, b]) => b.date.localeCompare(a.date))
  if (sorted.length === 0) return new Set()
  return new Set(sorted[0][1].names)
}

// --- Items dans Stock avec statut low ---
function getStockAlerts(stockRows: string[][]): Recommendation[] {
  const recs: Recommendation[] = []

  for (const row of stockRows) {
    if (!row[1]) continue
    const status = row[5] || 'ok'
    if (status === 'low' || status === 'missing') {
      recs.push({
        id: `stock-${row[1]}`,
        name: row[1],
        reason: status === 'missing' ? 'Absent du stock actuel' : `Stock bas`,
        urgency: status === 'missing' ? 'high' : 'medium',
        source: 'history',
        supplier: row[6] || '',
        suggestedQuantity: '1',
        lastSeen: row[7] || '',
      })
    }
  }

  return recs
}

// --- Dédupliquer par nom (garder la plus urgente) ---
function mergeRecommendations(recs: Recommendation[]): Recommendation[] {
  const urgencyOrder = { high: 0, medium: 1, low: 2 }
  const map = new Map<string, Recommendation>()

  for (const rec of recs) {
    const key = rec.name.toLowerCase().trim()
    const existing = map.get(key)
    if (!existing || urgencyOrder[rec.urgency] < urgencyOrder[existing.urgency]) {
      map.set(key, rec)
    }
  }

  return Array.from(map.values())
}

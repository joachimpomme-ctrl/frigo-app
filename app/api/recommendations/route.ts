import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange } from '@/lib/sheets'

export interface Recommendation {
  id: string
  name: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
  source: 'inventory' | 'frequency' | 'history' | 'prediction'
  supplier: string
  suggestedQuantity: string
  lastSeen: string
  confidence: number // 0-100, score de pertinence
}

interface FeedbackEntry {
  timestamp: string
  productName: string
  action: 'accepted' | 'rejected' | 'snoozed'
}

interface InventorySnapshot {
  sessionId: string
  date: string
  items: Array<{ name: string; status: string; quantity: string; location: string }>
}

interface ProductPurchase {
  name: string
  date: string
  supplier: string
  quantity: string
  unit: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Charger toutes les données en parallèle (y compris feedback)
    const [inventoryRows, productRows, stockRows, listRows, feedbackRows] = await Promise.all([
      readRange('Inventaire!A2:I2000'),
      readRange('Produits!A2:G2000'),
      readRange('Stock!A2:H500'),
      readRange('Liste!A2:E200'),
      readRange('Feedback!A2:D2000').catch(() => [] as string[][]),
    ])

    // Parser les données
    const inventorySnapshots = parseInventorySnapshots(inventoryRows)
    const purchases = parsePurchases(productRows)
    const feedback = parseFeedback(feedbackRows)

    // 1. Alertes d'inventaire (stock bas/manquant du dernier scan photo)
    const inventoryAlerts = getInventoryAlerts(inventorySnapshots)

    // 2. Prédictions par vélocité de consommation (croisement multi-scans)
    const consumptionPredictions = getConsumptionPredictions(inventorySnapshots, purchases)

    // 3. Produits à cycle d'achat régulier, en retard de réapprovisionnement
    const cyclePredictions = getCyclePredictions(purchases)

    // 4. Alertes stock (sheet Stock)
    const stockAlerts = getStockAlerts(stockRows)

    // Fusionner, dédupliquer, puis pondérer par feedback
    const allRecs = mergeRecommendations([
      ...inventoryAlerts,
      ...consumptionPredictions,
      ...cyclePredictions,
      ...stockAlerts,
    ])

    const weighted = applyFeedbackWeights(allRecs, feedback)

    // Retirer les produits déjà dans la liste de courses
    const listNames = new Set(
      listRows
        .filter(r => r.length > 1 && r[1])
        .map(r => r[1].toLowerCase().trim())
    )
    const filtered = weighted.filter(r => !listNames.has(r.name.toLowerCase().trim()))

    // Trier : urgence d'abord, puis confiance décroissante
    const urgencyOrder = { high: 0, medium: 1, low: 2 }
    filtered.sort((a, b) => {
      const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      if (urgDiff !== 0) return urgDiff
      return b.confidence - a.confidence
    })

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

// ============================================================
// Parsers
// ============================================================

function parseInventorySnapshots(rows: string[][]): InventorySnapshot[] {
  const sessions: Record<string, InventorySnapshot> = {}

  for (const row of rows) {
    if (!row[0]) continue
    const sid = row[0]
    if (!sessions[sid]) {
      sessions[sid] = { sessionId: sid, date: row[1] || '', items: [] }
    }
    sessions[sid].items.push({
      name: row[5] || '',
      quantity: row[6] || '',
      status: row[8] || 'ok',
      location: row[4] || '',
    })
  }

  return Object.values(sessions).sort((a, b) => b.date.localeCompare(a.date))
}

function parsePurchases(rows: string[][]): ProductPurchase[] {
  return rows
    .filter(r => r.length >= 4 && r[3])
    .map(r => ({
      name: r[3],
      date: r[1] || '',
      supplier: r[2] || '',
      quantity: r[4] || '',
      unit: r[5] || '',
    }))
}

function parseFeedback(rows: string[][]): FeedbackEntry[] {
  return rows
    .filter(r => r.length >= 3 && r[0])
    .map(r => ({
      timestamp: r[0],
      productName: r[1] || '',
      action: r[2] as FeedbackEntry['action'],
    }))
}

// ============================================================
// 1. Alertes d'inventaire (dernier scan photo)
// ============================================================

function getInventoryAlerts(snapshots: InventorySnapshot[]): Recommendation[] {
  if (snapshots.length === 0) return []

  const latest = snapshots[0]
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
        suggestedQuantity: '1',
        lastSeen: latest.date,
        confidence: 90,
      })
    } else if (item.status === 'low') {
      recs.push({
        id: `inv-${item.name}`,
        name: item.name,
        reason: `Stock bas (${item.quantity})`,
        urgency: 'medium',
        source: 'inventory',
        supplier: '',
        suggestedQuantity: '1',
        lastSeen: latest.date,
        confidence: 85,
      })
    }
  }

  return recs
}

// ============================================================
// 2. Prédictions par vélocité de consommation
//    Compare les scans d'inventaire successifs pour estimer
//    la vitesse à laquelle chaque produit est consommé
// ============================================================

function getConsumptionPredictions(snapshots: InventorySnapshot[], purchases: ProductPurchase[]): Recommendation[] {
  if (snapshots.length < 2) return []

  const recs: Recommendation[] = []
  const latest = snapshots[0]
  const today = new Date()

  for (const item of latest.items) {
    if (item.status !== 'ok') continue

    // Chercher ce produit dans les inventaires précédents
    const key = item.name.toLowerCase().trim()
    const history: Array<{ date: string; status: string }> = []

    for (const snapshot of snapshots) {
      const found = snapshot.items.find(i => i.name.toLowerCase().trim() === key)
      if (found) {
        history.push({ date: snapshot.date, status: found.status })
      }
    }

    if (history.length < 2) continue

    // Calculer le temps moyen entre statut "ok" et "low"/"missing"
    // (= durée de vie moyenne observée)
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

    if (transitions.length === 0) continue

    const avgDaysToDepletion = Math.round(
      transitions.reduce((a, b) => a + b, 0) / transitions.length
    )

    // Jours depuis le dernier scan
    const lastScanDate = new Date(latest.date).getTime()
    const daysSinceScan = Math.round((today.getTime() - lastScanDate) / (1000 * 60 * 60 * 24))
    const daysLeft = avgDaysToDepletion - daysSinceScan

    const supplierForProduct = findPreferredSupplier(key, purchases)

    if (daysLeft <= 2) {
      recs.push({
        id: `pred-${key}`,
        name: item.name,
        reason: `Consommé en ~${avgDaysToDepletion}j, probablement épuisé`,
        urgency: 'high',
        source: 'prediction',
        supplier: supplierForProduct,
        suggestedQuantity: '1',
        lastSeen: latest.date,
        confidence: Math.min(80, 50 + transitions.length * 10),
      })
    } else if (daysLeft <= 5) {
      recs.push({
        id: `pred-${key}`,
        name: item.name,
        reason: `Consommé en ~${avgDaysToDepletion}j, ~${daysLeft}j restants`,
        urgency: 'medium',
        source: 'prediction',
        supplier: supplierForProduct,
        suggestedQuantity: '1',
        lastSeen: latest.date,
        confidence: Math.min(75, 45 + transitions.length * 10),
      })
    }
  }

  return recs
}

// ============================================================
// 3. Prédictions par cycle d'achat
//    Détecte les produits achetés régulièrement et signale
//    ceux qui sont en retard par rapport au rythme habituel
// ============================================================

function getCyclePredictions(purchases: ProductPurchase[]): Recommendation[] {
  // Grouper les achats par produit
  const byProduct: Record<string, { dates: string[]; supplier: string; quantity: string }> = {}

  for (const p of purchases) {
    const key = p.name.toLowerCase().trim()
    if (!key) continue
    if (!byProduct[key]) byProduct[key] = { dates: [], supplier: '', quantity: '' }
    byProduct[key].dates.push(p.date)
    // Garder le fournisseur du dernier achat
    if (p.date > (byProduct[key].dates[byProduct[key].dates.length - 2] || '')) {
      byProduct[key].supplier = p.supplier
      byProduct[key].quantity = p.quantity
    }
  }

  const today = new Date()
  const recs: Recommendation[] = []

  for (const [name, data] of Object.entries(byProduct)) {
    const dates = data.dates.filter(Boolean).sort()
    if (dates.length < 3) continue // 3+ achats pour un cycle fiable

    // Calculer l'intervalle moyen entre achats
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      const d1 = new Date(dates[i - 1]).getTime()
      const d2 = new Date(dates[i]).getTime()
      if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
        intervals.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
      }
    }

    if (intervals.length < 2) continue

    const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    if (avgInterval <= 0 || avgInterval > 90) continue

    // Jours depuis le dernier achat
    const lastPurchase = new Date(dates[dates.length - 1]).getTime()
    const daysSinceLastPurchase = Math.round((today.getTime() - lastPurchase) / (1000 * 60 * 60 * 24))
    const daysOverdue = daysSinceLastPurchase - avgInterval

    // Régularité du cycle (écart-type bas = très régulier)
    const mean = avgInterval
    const variance = intervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    const regularity = Math.max(0, 100 - (stdDev / mean) * 100)

    const displayName = name.charAt(0).toUpperCase() + name.slice(1)

    if (daysOverdue > 3 && regularity > 30) {
      recs.push({
        id: `cycle-${name}`,
        name: displayName,
        reason: `Acheté tous les ~${avgInterval}j, dernier achat il y a ${daysSinceLastPurchase}j`,
        urgency: daysOverdue > avgInterval * 0.5 ? 'high' : 'medium',
        source: 'frequency',
        supplier: data.supplier,
        suggestedQuantity: data.quantity || '1',
        lastSeen: dates[dates.length - 1],
        confidence: Math.min(85, Math.round(40 + regularity * 0.3 + dates.length * 3)),
      })
    } else if (daysOverdue > -3 && daysOverdue <= 3 && regularity > 40) {
      recs.push({
        id: `cycle-${name}`,
        name: displayName,
        reason: `Achat habituel tous les ~${avgInterval}j, prochain achat imminent`,
        urgency: 'low',
        source: 'frequency',
        supplier: data.supplier,
        suggestedQuantity: data.quantity || '1',
        lastSeen: dates[dates.length - 1],
        confidence: Math.min(70, Math.round(30 + regularity * 0.25 + dates.length * 2)),
      })
    }
  }

  return recs
}

// ============================================================
// 4. Alertes stock (sheet Stock)
// ============================================================

function getStockAlerts(stockRows: string[][]): Recommendation[] {
  const recs: Recommendation[] = []

  for (const row of stockRows) {
    if (!row[1]) continue
    const status = row[5] || 'ok'
    if (status === 'low' || status === 'missing') {
      recs.push({
        id: `stock-${row[1]}`,
        name: row[1],
        reason: status === 'missing' ? 'Absent du stock actuel' : 'Stock bas',
        urgency: status === 'missing' ? 'high' : 'medium',
        source: 'history',
        supplier: '',
        suggestedQuantity: '1',
        lastSeen: row[7] || '',
        confidence: 70,
      })
    }
  }

  return recs
}

// ============================================================
// Helpers
// ============================================================

function findPreferredSupplier(productKey: string, purchases: ProductPurchase[]): string {
  const supplierCounts: Record<string, number> = {}
  for (const p of purchases) {
    if (p.name.toLowerCase().trim() === productKey && p.supplier) {
      supplierCounts[p.supplier] = (supplierCounts[p.supplier] || 0) + 1
    }
  }
  const sorted = Object.entries(supplierCounts).sort(([, a], [, b]) => b - a)
  return sorted[0]?.[0] || ''
}

function mergeRecommendations(recs: Recommendation[]): Recommendation[] {
  const urgencyOrder = { high: 0, medium: 1, low: 2 }
  const map = new Map<string, Recommendation>()

  for (const rec of recs) {
    const key = rec.name.toLowerCase().trim()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, rec)
    } else {
      // Garder le plus urgent ; à urgence égale, la meilleure confiance
      if (urgencyOrder[rec.urgency] < urgencyOrder[existing.urgency]) {
        map.set(key, { ...rec, confidence: Math.max(rec.confidence, existing.confidence) })
      } else if (rec.confidence > existing.confidence && rec.urgency === existing.urgency) {
        map.set(key, rec)
      }
    }
  }

  return Array.from(map.values())
}

// ============================================================
// Pondération par feedback
// Réduit l'urgence des produits régulièrement rejetés,
// booste les produits acceptés = apprentissage continu
// ============================================================

function applyFeedbackWeights(recs: Recommendation[], feedback: FeedbackEntry[]): Recommendation[] {
  if (feedback.length === 0) return recs

  // Fenêtre glissante de 30 jours
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentFeedback: Record<string, { accepted: number; rejected: number; snoozed: number }> = {}

  for (const fb of feedback) {
    const fbDate = new Date(fb.timestamp)
    if (fbDate < thirtyDaysAgo) continue

    const key = fb.productName.toLowerCase().trim()
    if (!recentFeedback[key]) recentFeedback[key] = { accepted: 0, rejected: 0, snoozed: 0 }
    recentFeedback[key][fb.action]++
  }

  return recs
    .map(rec => {
      const key = rec.name.toLowerCase().trim()
      const fb = recentFeedback[key]
      if (!fb) return rec

      let adjustedConfidence = rec.confidence

      // Accepté → la recommandation était pertinente, boost
      adjustedConfidence += fb.accepted * 5

      // Rejeté → pénalité forte
      adjustedConfidence -= fb.rejected * 15

      // Snoozé → pénalité légère
      adjustedConfidence -= fb.snoozed * 8

      adjustedConfidence = Math.max(5, Math.min(100, adjustedConfidence))

      // Si la confiance chute trop, rétrograder l'urgence
      let urgency = rec.urgency
      if (adjustedConfidence < 20 && urgency === 'high') urgency = 'medium'
      if (adjustedConfidence < 10) urgency = 'low'

      return { ...rec, confidence: adjustedConfidence, urgency }
    })
    // Filtrer les recommandations massivement rejetées
    .filter(rec => rec.confidence > 5)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { appendRows, readRange, writeRange } from '@/lib/sheets'
import { correctCategory, deduplicationKey } from '@/lib/product-utils'

export interface StockItem {
  name: string
  quantity: string
  unit: string
  status: 'ok' | 'low' | 'missing'
  location: string // 'frigo', 'placard', 'cave', etc.
  category?: string
}

// POST — Sauvegarder un inventaire
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { items, label } = await req.json() as { items: StockItem[]; label: string }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Aucun article à sauvegarder' }, { status: 400 })
    }

    const now       = new Date()
    const dateStr   = now.toISOString().split('T')[0]
    const timeStr   = now.toTimeString().split(' ')[0].substring(0, 5)
    const sessionId = `stock-${Date.now()}`

    // === ÉTAPE 1 : Corriger les catégories ===
    const correctedItems = items.map(item => ({
      ...item,
      category: correctCategory(item.name, item.category || 'Autre'),
    }))

    // === ÉTAPE 2 : Dédupliquer par nom similaire ===
    const mergedItems = deduplicateItems(correctedItems)

    // Écrire dans l'onglet Inventaire (historique — on garde tout)
    const rows = mergedItems.map(item => [
      sessionId,
      dateStr,
      timeStr,
      label || 'Inventaire',
      item.location || 'frigo',
      item.name,
      item.quantity,
      item.unit || '',
      item.status,
      item.category || 'Autre',
    ])

    await appendRows('Inventaire!A:J', rows)

    // === ÉTAPE 3 : Mettre à jour l'onglet Stock (fusion avec l'existant) ===
    await updateStockSheet(mergedItems, dateStr)

    return NextResponse.json({ success: true, sessionId, saved: mergedItems.length })

  } catch (error) {
    console.error('Save stock error:', error)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}

// GET — Récupérer l'historique des inventaires
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const rows = await readRange('Inventaire!A2:J2000')

    // Grouper par session
    const sessions: Record<string, {
      sessionId: string
      date: string
      time: string
      label: string
      items: StockItem[]
    }> = {}

    for (const row of rows) {
      if (!row[0]) continue
      const sessionId = row[0]
      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          sessionId,
          date:  row[1] || '',
          time:  row[2] || '',
          label: row[3] || 'Inventaire',
          items: [],
        }
      }
      sessions[sessionId].items.push({
        location: row[4] || 'frigo',
        name:     row[5] || '',
        quantity: row[6] || '',
        unit:     row[7] || '',
        status:   (row[8] as 'ok' | 'low' | 'missing') || 'ok',
        category: row[9] || 'Autre',
      })
    }

    // Trier par date décroissante
    const sorted = Object.values(sessions).sort((a, b) =>
      `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)
    )

    return NextResponse.json({ sessions: sorted })

  } catch (error) {
    console.error('Get stock history error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ============================================================
// Déduplication : fusionner les items avec le même nom
// ============================================================

function deduplicateItems(items: StockItem[]): StockItem[] {
  const merged = new Map<string, StockItem>()

  for (const item of items) {
    const key = deduplicationKey(item.name)
    const existing = merged.get(key)

    if (existing) {
      // Fusionner : additionner les quantités si possible, garder le meilleur statut
      existing.quantity = mergeQuantities(existing.quantity, item.quantity)
      existing.status = bestStatus(existing.status, item.status)
      // Garder le nom le plus long (souvent le plus descriptif)
      if (item.name.length > existing.name.length) {
        existing.name = item.name
      }
    } else {
      merged.set(key, { ...item })
    }
  }

  return Array.from(merged.values())
}

function mergeQuantities(a: string, b: string): string {
  const numA = parseFloat(a)
  const numB = parseFloat(b)
  if (!isNaN(numA) && !isNaN(numB)) {
    const sum = numA + numB
    return sum === Math.floor(sum) ? sum.toString() : sum.toFixed(1)
  }
  if (a && b && a !== b) return `${a} + ${b}`
  return a || b
}

function bestStatus(a: StockItem['status'], b: StockItem['status']): StockItem['status'] {
  const priority = { ok: 2, low: 1, missing: 0 }
  return priority[a] >= priority[b] ? a : b
}

// ============================================================
// Mise à jour intelligente de l'onglet Stock (fusion avec existant)
// ============================================================

async function updateStockSheet(newItems: StockItem[], dateStr: string): Promise<void> {
  // Lire le stock existant
  const existingRows = await readRange('Stock!A2:H')

  // Indexer l'existant par clé de déduplication
  const stockMap = new Map<string, string[]>()
  for (const row of existingRows) {
    if (!row[1]) continue
    const key = deduplicationKey(row[1])
    stockMap.set(key, row)
  }

  // Fusionner les nouveaux items
  for (const item of newItems) {
    const key = deduplicationKey(item.name)

    if (item.status === 'missing') {
      // Retirer du stock les items manquants
      stockMap.delete(key)
      continue
    }

    const correctedCategory = correctCategory(item.name, item.category || 'Autre')

    stockMap.set(key, [
      `${item.name}-${item.location}`,
      item.name,
      item.location || 'frigo',
      item.quantity,
      item.unit || '',
      item.status,
      correctedCategory,
      dateStr,
    ])
  }

  // Réécrire tout l'onglet Stock
  const header = [['id', 'name', 'category', 'quantity', 'unit', 'status', 'supplier', 'lastUpdated']]
  const allRows = Array.from(stockMap.values())

  if (allRows.length > 0) {
    await writeRange('Stock!A1:H1', header)
    await writeRange(`Stock!A2:H${allRows.length + 1}`, allRows)

    // Effacer les lignes en trop (si le stock a rétréci)
    const oldCount = existingRows.length
    if (oldCount > allRows.length) {
      const emptyRows = Array.from({ length: oldCount - allRows.length }, () =>
        ['', '', '', '', '', '', '', '']
      )
      await writeRange(`Stock!A${allRows.length + 2}:H${oldCount + 1}`, emptyRows)
    }
  }
}

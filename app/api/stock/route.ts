import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { appendRows, readRange } from '@/lib/sheets'

export interface StockItem {
  name: string
  quantity: string
  unit: string
  status: 'ok' | 'low' | 'missing'
  location: string // 'frigo', 'placard', 'cave', etc.
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

    // Écrire dans l'onglet Inventaire
    const rows = items.map(item => [
      sessionId,
      dateStr,
      timeStr,
      label || 'Inventaire',
      item.location || 'frigo',
      item.name,
      item.quantity,
      item.unit || '',
      item.status,
    ])

    await appendRows('Inventaire!A:I', rows)

    // Mettre à jour aussi l'onglet Stock (état actuel)
    // On écrase les items existants du même emplacement
    const stockRows = items
      .filter(i => i.status !== 'missing')
      .map(item => [
        `${item.name}-${item.location}`,
        item.name,
        item.location || 'frigo',
        item.quantity,
        item.unit || '',
        item.status,
        '',
        dateStr,
      ])

    if (stockRows.length > 0) {
      await appendRows('Stock!A:H', stockRows)
    }

    return NextResponse.json({ success: true, sessionId, saved: items.length })

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
    const rows = await readRange('Inventaire!A2:I2000')

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

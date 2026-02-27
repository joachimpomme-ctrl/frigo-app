import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { appendRows, readRange } from '@/lib/sheets'

// POST — Enregistrer un feedback sur une recommandation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { productName, action, source } = await req.json() as {
      productName: string
      action: 'accepted' | 'rejected' | 'snoozed'
      source: string
    }

    if (!productName || !action) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const now = new Date()
    const rows = [[
      now.toISOString(),
      productName.toLowerCase().trim(),
      action,
      source || '',
    ]]

    await appendRows('Feedback!A:D', rows)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET — Lire l'historique de feedback
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const rows = await readRange('Feedback!A2:D2000')

    const feedback = rows
      .filter(r => r.length >= 3 && r[0])
      .map(r => ({
        timestamp: r[0],
        productName: r[1] || '',
        action: r[2] as 'accepted' | 'rejected' | 'snoozed',
        source: r[3] || '',
      }))

    return NextResponse.json({ feedback })
  } catch (error) {
    // Si l'onglet Feedback n'existe pas encore, retourner un tableau vide
    console.error('Feedback GET error:', error)
    return NextResponse.json({ feedback: [] })
  }
}

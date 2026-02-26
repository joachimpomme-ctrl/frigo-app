import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readRange, appendRows, writeRange } from '@/lib/sheets'

// GET — Récupérer la liste de courses
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const rows = await readRange('Liste!A2:E500')
    const items = rows
      .filter(row => row.length > 0 && row[0])
      .map((row, index) => ({
        id: row[0] || '',
        name: row[1] || '',
        quantity: row[2] || '',
        supplier: row[3] || '',
        checked: row[4] === 'TRUE',
        rowIndex: index + 2, // Pour les updates
      }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Shopping list GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — Ajouter des articles à la liste
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { items } = await req.json() as {
      items: Array<{ name: string; quantity: string; supplier: string }>
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Aucun article' }, { status: 400 })
    }

    // Vérifier les doublons existants
    const existing = await readRange('Liste!A2:E500')
    const existingNames = new Set(
      existing
        .filter(r => r.length > 1 && r[1] && r[4] !== 'TRUE')
        .map(r => r[1].toLowerCase().trim())
    )

    const toAdd = items.filter(item =>
      !existingNames.has(item.name.toLowerCase().trim())
    )

    if (toAdd.length === 0) {
      return NextResponse.json({
        success: true,
        added: 0,
        message: 'Ces articles sont déjà dans la liste',
      })
    }

    const rows = toAdd.map(item => [
      `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item.name,
      item.quantity || '1',
      item.supplier || '',
      'FALSE',
    ])

    await appendRows('Liste!A:E', rows)

    return NextResponse.json({
      success: true,
      added: toAdd.length,
      message: `${toAdd.length} article${toAdd.length > 1 ? 's' : ''} ajouté${toAdd.length > 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('Shopping list POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH — Cocher/décocher un article
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id, checked } = await req.json() as { id: string; checked: boolean }

    // Lire toutes les lignes pour trouver l'index
    const rows = await readRange('Liste!A2:E500')
    const rowIndex = rows.findIndex(r => r[0] === id)

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Article non trouvé' }, { status: 404 })
    }

    // Mettre à jour la colonne E (checked)
    const sheetRow = rowIndex + 2 // +2 pour header + 0-index
    await writeRange(`Liste!E${sheetRow}`, [[checked ? 'TRUE' : 'FALSE']])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shopping list PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — Supprimer les articles cochés
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const rows = await readRange('Liste!A2:E500')
    const remaining = rows.filter(r => r[4] !== 'TRUE')

    // Réécrire la feuille sans les items cochés
    // D'abord, écrire les items restants
    if (remaining.length > 0) {
      await writeRange(`Liste!A2:E${remaining.length + 1}`, remaining)
    }

    // Effacer les lignes en trop
    if (remaining.length < rows.length) {
      const emptyRows = Array(rows.length - remaining.length).fill(['', '', '', '', ''])
      await writeRange(
        `Liste!A${remaining.length + 2}:E${rows.length + 1}`,
        emptyRows
      )
    }

    const deleted = rows.length - remaining.length
    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted} article${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('Shopping list DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

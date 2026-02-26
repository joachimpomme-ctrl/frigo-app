import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { appendRows, readRange } from '@/lib/sheets'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de factures et confirmations de commande.
Tu reçois un document PDF (facture, bon de commande, confirmation de livraison).

Extrais les informations suivantes et réponds UNIQUEMENT avec un JSON valide, sans markdown.

Format exact :
{
  "supplier": "Nom du fournisseur (Picnic, La Fourche, Le Fourgon, ou autre)",
  "date": "YYYY-MM-DD",
  "total": "XX.XX €",
  "status": "livré",
  "items": [
    { "name": "Nom du produit", "quantity": "2", "unit": "kg", "price": "3.50 €" }
  ],
  "raw_items_summary": "Résumé court des 5 premiers articles max, ex: Lait x2, Œufs x12, ..."
}

Règles :
- Si tu ne trouves pas une info, mets une chaîne vide ""
- Le champ "items" doit lister TOUS les articles trouvés
- "raw_items_summary" est une version courte pour l'affichage (5 articles max puis "+X autres")
- Pour le fournisseur : détecte-le automatiquement depuis le document
- Pour le statut : "livré" si c'est une facture/confirmation, "en attente" si c'est une commande`

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // Convertir le PDF en base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Analyser avec Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Analyse cette facture et extrais toutes les informations.',
            },
          ],
        },
      ],
    })

    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Réponse invalide de Claude')
    }

    const cleanJson = textContent.text.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    // Générer un ID unique
    const orderId = `${parsed.supplier?.toLowerCase().replace(/\s/g, '-')}-${parsed.date}-${Date.now()}`

    // Vérifier les doublons (même fournisseur + même date + même total)
    const existing = await readRange('Commandes!B2:E')
    const isDuplicate = existing.some(row =>
      row[0] === parsed.date &&
      row[1] === parsed.supplier &&
      row[3] === parsed.total
    )

    if (isDuplicate) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        message: 'Cette commande semble déjà importée',
        data: parsed,
      })
    }

    // Écrire dans Google Sheets — onglet Commandes
    await appendRows('Commandes!A:F', [[
      orderId,
      parsed.date || '',
      parsed.supplier || '',
      parsed.raw_items_summary || '',
      parsed.total || '',
      parsed.status || 'livré',
    ]])

    // Écrire les articles détaillés dans un onglet Produits si dispo
    if (parsed.items && parsed.items.length > 0) {
      const productRows = parsed.items.map((item: any) => [
        orderId,
        parsed.date || '',
        parsed.supplier || '',
        item.name || '',
        item.quantity || '',
        item.unit || '',
        item.price || '',
      ])
      await appendRows('Produits!A:G', productRows)
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      orderId,
      itemsCount: parsed.items?.length || 0,
    })

  } catch (error) {
    console.error('PDF import error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du PDF" },
      { status: 500 }
    )
  }
}

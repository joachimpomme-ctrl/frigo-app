import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de réfrigérateurs et placards.
Quand tu reçois une ou plusieurs photos, tu dois :
1. Identifier tous les aliments visibles sur TOUTES les photos
2. Estimer leur quantité/niveau
3. Indiquer si le stock est OK, bas (moins d'1 portion) ou manquant
4. Attribuer une catégorie à chaque produit

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication.
Format exact :
{
  "items": [
    {"name": "Lait", "quantity": "1 litre environ", "status": "ok", "category": "Laitage"},
    {"name": "Beurre", "quantity": "presque terminé", "status": "low", "category": "Laitage"},
    {"name": "Yaourts", "quantity": "non visible", "status": "missing", "category": "Laitage"}
  ]
}

Les valeurs de status sont strictement : "ok", "low", "missing".
Les catégories possibles sont : "Fruits", "Légumes", "Viande", "Poisson", "Laitage", "Épicerie", "Boissons", "Surgelés", "Hygiène", "Autre".
Sois précis et exhaustif. Inclus tout ce que tu peux identifier sur toutes les photos.`

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const formData = await req.formData()

    // Support multiple images
    const imageFiles = formData.getAll('image') as File[]

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json({ error: 'Aucune image fournie' }, { status: 400 })
    }

    // Build content blocks for all images
    const contentBlocks: Anthropic.MessageCreateParams['messages'][0]['content'] = []

    for (const imageFile of imageFiles) {
      const arrayBuffer = await imageFile.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = (imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg'

      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64,
        },
      })
    }

    contentBlocks.push({
      type: 'text',
      text: imageFiles.length > 1
        ? `Analyse le contenu de ces ${imageFiles.length} photos (frigo, placard, etc.). Liste tous les produits visibles sur l'ensemble des photos.`
        : 'Analyse le contenu de ce réfrigérateur.',
    })

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    })

    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Réponse invalide de Claude')
    }

    const cleanJson = textContent.text.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Fridge scan error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'analyse", items: [] },
      { status: 500 }
    )
  }
}

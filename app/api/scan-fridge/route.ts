import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de réfrigérateurs.
Quand tu reçois une photo d'un réfrigérateur, tu dois :
1. Identifier tous les aliments visibles
2. Estimer leur quantité/niveau
3. Indiquer si le stock est OK, bas (moins d'1 portion) ou manquant

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication.
Format exact :
{
  "items": [
    {"name": "Lait", "quantity": "1 litre environ", "status": "ok"},
    {"name": "Beurre", "quantity": "presque terminé", "status": "low"},
    {"name": "Yaourts", "quantity": "non visible", "status": "missing"}
  ]
}

Les valeurs de status sont strictement : "ok", "low", "missing".
Sois précis et exhaustif. Inclus tout ce que tu peux identifier.`

export async function POST(req: NextRequest) {
  // Vérifier l'auth
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'Aucune image fournie' }, { status: 400 })
    }

    // Convertir en base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = (imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg'

    // Appel Claude Vision
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Analyse le contenu de ce réfrigérateur.',
            },
          ],
        },
      ],
    })

    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Réponse invalide de Claude')
    }

    // Parser le JSON
    const cleanJson = textContent.text.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Fridge scan error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse', items: [] },
      { status: 500 }
    )
  }
}

// Limite de taille des requêtes : 10MB
export const config = {
  api: {
    bodyParser: false,
  },
}

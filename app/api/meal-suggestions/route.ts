import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getStock } from '@/lib/sheets'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant culinaire pour une famille française.
Tu reçois la liste des aliments disponibles en stock (frigo, placard, congélateur).

Propose un plan de repas pour les jours demandés. Chaque jour a un déjeuner et un dîner.

IMPORTANT :
- Les repas doivent être ÉQUILIBRÉS (légumes, féculents, protéines)
- La famille mange PEU DE VIANDE : maximum 2 repas avec viande sur toute la semaine
- Privilégie les repas végétariens, à base de légumineuses, œufs, poisson, fromage
- Utilise en priorité les aliments EN STOCK pour éviter le gaspillage
- Si un ingrédient manque, tu peux le suggérer mais signale-le
- Les repas doivent être SIMPLES et RÉALISTES pour une famille
- Varie les saveurs et les cuisines (français, méditerranéen, asiatique, etc.)

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaire.

Format exact :
{
  "days": [
    {
      "date": "Lundi 3 mars",
      "lunch": {
        "name": "Nom du plat",
        "description": "Description courte (1 phrase)",
        "ingredients_from_stock": ["Tomates", "Pâtes", "Parmesan"],
        "ingredients_to_buy": ["Basilic frais"],
        "tags": ["veggie", "rapide"]
      },
      "dinner": {
        "name": "...",
        "description": "...",
        "ingredients_from_stock": [...],
        "ingredients_to_buy": [...],
        "tags": ["veggie"]
      }
    }
  ],
  "shopping_tip": "Résumé court des ingrédients manquants à acheter"
}

Tags possibles : "veggie", "vegan", "poisson", "viande", "rapide", "batch-cooking", "comfort-food", "léger"
`

export const maxDuration = 60

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    // Récupérer le stock actuel
    const stock = await getStock()

    if (stock.length === 0) {
      return NextResponse.json(
        { error: 'Aucun stock trouvé. Scannez d\'abord votre frigo !' },
        { status: 404 }
      )
    }

    // Formater le stock pour Claude
    const stockSummary = stock
      .filter(item => item.quantity > 0)
      .map(item => {
        const qty = item.quantity > 0 ? `${item.quantity} ${item.unit}` : ''
        return `- ${item.name} (${item.category})${qty ? ` : ${qty}` : ''}`
      })
      .join('\n')

    // Déterminer les jours à planifier (5 jours à partir d'aujourd'hui)
    const today = new Date()
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

    const days = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      days.push(`${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`)
    }

    const userPrompt = `Voici les aliments en stock dans notre cuisine :

${stockSummary}

Propose-nous des repas équilibrés pour les 5 prochains jours :
${days.map((d, i) => `Jour ${i + 1} : ${d}`).join('\n')}

Rappel : nous mangeons très peu de viande. Privilégie le végétarien, les œufs, le poisson, les légumineuses.`

    // Appel à Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = message.content.find((c: Anthropic.ContentBlock) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Impossible de générer les suggestions de repas.' },
        { status: 422 }
      )
    }

    // Extraction robuste du JSON
    const parsed = extractJson(textContent.text)

    if (!parsed || !parsed.days) {
      return NextResponse.json(
        { error: 'Réponse inattendue de l\'IA. Réessayez.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      stockCount: stock.filter(s => s.quantity > 0).length,
    })

  } catch (error: any) {
    console.error('Meal suggestions error:', error)

    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques secondes.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors de la génération des repas.' },
      { status: 500 }
    )
  }
}

function extractJson(text: string): any | null {
  let cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  return null
}

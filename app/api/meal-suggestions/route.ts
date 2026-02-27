import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getStock, StockItem } from '@/lib/sheets'
import crypto from 'crypto'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant culinaire pour une famille française.
Tu reçois la liste EXACTE et COMPLÈTE des aliments disponibles en stock (frigo, placard, congélateur).

Propose un plan de repas pour les jours demandés. Chaque jour a un déjeuner et un dîner.

RÈGLES CRITIQUES :
- Un ingrédient est "en stock" s'il apparaît dans la liste fournie. NE METS PAS un aliment en stock dans "ingredients_to_buy".
- "ingredients_to_buy" ne doit contenir QUE des ingrédients qui N'APPARAISSENT PAS du tout dans la liste de stock.
- Les repas doivent être ÉQUILIBRÉS (légumes, féculents, protéines)
- La famille mange PEU DE VIANDE : maximum 2 repas avec viande sur toute la semaine
- Privilégie les repas végétariens, à base de légumineuses, œufs, poisson, fromage
- Utilise en priorité les aliments EN STOCK pour éviter le gaspillage
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
  "shopping_tip": "Résumé court des VRAIS ingrédients manquants à acheter (ceux absents du stock)"
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

    const availableStock = stock.filter(item => item.quantity > 0)

    if (availableStock.length === 0) {
      return NextResponse.json(
        { error: 'Aucun stock trouvé. Scannez d\'abord votre frigo !' },
        { status: 404 }
      )
    }

    // Calculer un hash du stock pour détecter les changements côté client
    const stockHash = computeStockHash(availableStock)

    // Formater le stock pour Claude — liste numérotée pour plus de clarté
    const stockSummary = availableStock
      .map((item, i) => {
        const qty = `${item.quantity} ${item.unit}`.trim()
        return `${i + 1}. ${item.name} (${item.category}) — ${qty}`
      })
      .join('\n')

    // Construire un index de noms pour la vérification post-Claude
    const stockNames = availableStock.map(item => item.name.toLowerCase().trim())

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

    const userPrompt = `Voici la liste COMPLÈTE des ${availableStock.length} aliments actuellement en stock :

${stockSummary}

Propose-nous des repas équilibrés pour les 5 prochains jours :
${days.map((d, i) => `Jour ${i + 1} : ${d}`).join('\n')}

RAPPELS :
- Nous mangeons très peu de viande. Privilégie le végétarien, les œufs, le poisson, les légumineuses.
- Ne mets dans "ingredients_to_buy" QUE ce qui n'est PAS dans la liste ci-dessus.
- Tout aliment listé ci-dessus doit aller dans "ingredients_from_stock", jamais dans "ingredients_to_buy".`

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

    // === VÉRIFICATION POST-CLAUDE ===
    // Corriger les erreurs de Claude : si un ingrédient "to_buy" est en réalité en stock, le déplacer
    const correctedPlan = correctIngredients(parsed, stockNames)

    return NextResponse.json({
      success: true,
      data: correctedPlan,
      stockCount: availableStock.length,
      stockHash,
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

// ============================================================
// Vérification : croiser ingredients_to_buy avec le stock réel
// ============================================================

function correctIngredients(plan: any, stockNames: string[]): any {
  if (!plan.days || !Array.isArray(plan.days)) return plan

  // Recalculer le shopping_tip après corrections
  const allToBuy = new Set<string>()

  for (const day of plan.days) {
    for (const mealKey of ['lunch', 'dinner']) {
      const meal = day[mealKey]
      if (!meal) continue

      const fromStock: string[] = Array.isArray(meal.ingredients_from_stock) ? [...meal.ingredients_from_stock] : []
      const toBuy: string[] = Array.isArray(meal.ingredients_to_buy) ? [...meal.ingredients_to_buy] : []

      // Vérifier chaque ingrédient "to_buy" : est-il en stock ?
      const correctedToBuy: string[] = []
      for (const ingredient of toBuy) {
        if (isInStock(ingredient, stockNames)) {
          // Erreur de Claude : cet ingrédient est en stock → le déplacer
          if (!fromStock.some(s => s.toLowerCase() === ingredient.toLowerCase())) {
            fromStock.push(ingredient)
          }
        } else {
          correctedToBuy.push(ingredient)
          allToBuy.add(ingredient)
        }
      }

      meal.ingredients_from_stock = fromStock
      meal.ingredients_to_buy = correctedToBuy
    }
  }

  // Recalculer le résumé des courses
  const toBuyList = Array.from(allToBuy)
  if (toBuyList.length === 0) {
    plan.shopping_tip = 'Tout est en stock ! Aucun achat nécessaire pour ces 5 jours.'
  } else if (toBuyList.length <= 5) {
    plan.shopping_tip = `À acheter : ${toBuyList.join(', ')}`
  } else {
    const listed = toBuyList.slice(0, 5).join(', ')
    plan.shopping_tip = `À acheter : ${listed} + ${toBuyList.length - 5} autres`
  }

  return plan
}

/**
 * Vérifie si un ingrédient correspond à un item en stock.
 * Matching souple : "lait" matche "Lait demi-écrémé", "tomates" matche "Tomates cerises", etc.
 */
function isInStock(ingredient: string, stockNames: string[]): boolean {
  const needle = ingredient.toLowerCase().trim()

  for (const stockName of stockNames) {
    // Match exact
    if (stockName === needle) return true
    // Le stock contient l'ingrédient (ex: "Lait demi-écrémé" contient "lait")
    if (stockName.includes(needle)) return true
    // L'ingrédient contient le nom du stock (ex: "tomates fraîches" contient "tomates")
    if (needle.includes(stockName)) return true
    // Match sans accents et sans pluriel simple
    const normalizedStock = normalizeForMatch(stockName)
    const normalizedIngredient = normalizeForMatch(needle)
    if (normalizedStock === normalizedIngredient) return true
    if (normalizedStock.includes(normalizedIngredient)) return true
    if (normalizedIngredient.includes(normalizedStock)) return true
  }

  return false
}

/** Normalise un nom pour le matching : minuscule, sans accents, sans pluriel simple */
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
    .replace(/s$/, '') // Pluriel simple
    .trim()
}

// ============================================================
// Hash du stock pour détecter les changements
// ============================================================

function computeStockHash(stock: StockItem[]): string {
  const data = stock
    .map(s => `${s.name}:${s.quantity}:${s.unit}`)
    .sort()
    .join('|')
  return crypto.createHash('md5').update(data).digest('hex').slice(0, 12)
}

// ============================================================
// Extraction JSON robuste
// ============================================================

function extractJson(text: string): any | null {
  let cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  return null
}

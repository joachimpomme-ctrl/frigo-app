import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { appendRows, readRange } from '@/lib/sheets'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de factures et confirmations de commande.
Tu reçois les pages d'une facture sous forme d'images.

Extrais les informations suivantes et réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaire.

Format exact :
{
  "supplier": "Nom du fournisseur (Picnic, La Fourche, Le Fourgon, ou autre)",
  "date": "YYYY-MM-DD",
  "total": "XX.XX",
  "status": "livré",
  "items": [
    { "name": "Nom du produit", "quantity": "2", "unit": "kg", "price": "3.50" }
  ],
  "raw_items_summary": "Résumé court des 5 premiers articles max, ex: Lait x2, Œufs x12, ..."
}

Règles :
- Si tu ne trouves pas une info, mets une chaîne vide ""
- Le champ "items" doit lister TOUS les articles trouvés sur TOUTES les pages
- "raw_items_summary" est une version courte pour l'affichage (5 articles max puis "+X autres")
- Pour le fournisseur : détecte-le automatiquement depuis le document
- Pour le statut : "livré" si c'est une facture/confirmation, "en attente" si c'est une commande
- Les prix et le total sont des nombres décimaux sans symbole €
- Si l'image est floue ou illisible, extrais ce que tu peux et indique "?" pour les champs incertains`

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      images: string[]
      mediaType?: string
      filename?: string
    }

    const { images, mediaType = 'image/jpeg' } = body

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'Aucune image fournie' }, { status: 400 })
    }

    // Valider que les images sont du base64 valide et pas trop volumineuses
    for (let i = 0; i < images.length; i++) {
      if (!images[i] || typeof images[i] !== 'string') {
        return NextResponse.json(
          { error: `Image ${i + 1} invalide` },
          { status: 400 }
        )
      }
      // ~15 Mo max par image en base64
      if (images[i].length > 20_000_000) {
        return NextResponse.json(
          { error: `Image ${i + 1} trop volumineuse` },
          { status: 400 }
        )
      }
    }

    // Normaliser le media type
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
    type ValidMediaType = typeof validMediaTypes[number]
    const normalizedMediaType: ValidMediaType = validMediaTypes.includes(mediaType as ValidMediaType)
      ? mediaType as ValidMediaType
      : 'image/jpeg'

    // Construire le message avec une image par page
    const contentBlocks: Anthropic.MessageCreateParams['messages'][0]['content'] = []

    for (let i = 0; i < images.length; i++) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: normalizedMediaType,
          data: images[i],
        },
      })
    }

    contentBlocks.push({
      type: 'text',
      text: images.length > 1
        ? `Analyse ces ${images.length} pages de facture et extrais toutes les informations. Combine les articles de toutes les pages.`
        : 'Analyse cette facture et extrais toutes les informations.',
    })

    // Appel à Claude avec retry en cas d'erreur transitoire
    const message = await callClaudeWithRetry(contentBlocks)

    const textContent = message.content.find((c: Anthropic.ContentBlock) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Claude n\'a pas pu lire cette facture. Essayez avec une meilleure qualité d\'image.' },
        { status: 422 }
      )
    }

    // Extraction robuste du JSON depuis la réponse
    const parsed = extractJson(textContent.text)

    if (!parsed) {
      return NextResponse.json(
        { error: 'Impossible de structurer les données de cette facture. Le format n\'est peut-être pas reconnu.' },
        { status: 422 }
      )
    }

    // Normaliser et valider les données extraites
    const normalized = normalizeData(parsed)

    // Générer un ID unique
    const supplierSlug = normalized.supplier
      ? normalized.supplier.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      : 'inconnu'
    const orderId = `${supplierSlug}-${normalized.date || 'nodate'}-${Date.now()}`

    // Vérifier les doublons (même fournisseur + même date + total proche)
    const existing = await readRange('Commandes!B2:E')
    const isDuplicate = existing.some(row => {
      if (row[0] !== normalized.date || row[1] !== normalized.supplier) return false
      // Comparer les totaux numériquement (tolérance ±0.10)
      const existingTotal = parseFloat(row[3]?.replace(/[^0-9.]/g, '') || '0')
      const newTotal = parseFloat(normalized.total?.replace(/[^0-9.]/g, '') || '0')
      return Math.abs(existingTotal - newTotal) < 0.10
    })

    if (isDuplicate) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        message: 'Cette commande semble déjà importée',
        data: normalized,
      })
    }

    // Écrire dans Google Sheets — onglet Commandes
    await appendRows('Commandes!A:F', [[
      orderId,
      normalized.date || '',
      normalized.supplier || '',
      normalized.raw_items_summary || '',
      normalized.total || '',
      normalized.status || 'livré',
    ]])

    // Écrire les articles détaillés dans l'onglet Produits
    if (normalized.items && normalized.items.length > 0) {
      const productRows = normalized.items.map((item: any) => [
        orderId,
        normalized.date || '',
        normalized.supplier || '',
        item.name || '',
        item.quantity || '',
        item.unit || '',
        item.price || '',
      ])
      await appendRows('Produits!A:G', productRows)
    }

    return NextResponse.json({
      success: true,
      data: normalized,
      orderId,
      itemsCount: normalized.items?.length || 0,
    })

  } catch (error: any) {
    console.error('Invoice import error:', error)

    // Messages d'erreur spécifiques selon le type d'erreur
    if (error?.status === 413 || error?.message?.includes('too large')) {
      return NextResponse.json(
        { error: 'Les images sont trop volumineuses. Essayez avec un PDF de moins de pages.' },
        { status: 413 }
      )
    }
    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques secondes.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: "Erreur lors de l'analyse de la facture. Réessayez." },
      { status: 500 }
    )
  }
}

// ============================================================
// Appel Claude avec retry (1 retry sur erreur transitoire)
// ============================================================

async function callClaudeWithRetry(
  contentBlocks: Anthropic.MessageCreateParams['messages'][0]['content'],
  retries = 1,
): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    })
  } catch (error: any) {
    // Retry sur erreurs transitoires (500, 529, timeout)
    const status = error?.status || 0
    if (retries > 0 && (status >= 500 || status === 429)) {
      await new Promise(r => setTimeout(r, 2000))
      return callClaudeWithRetry(contentBlocks, retries - 1)
    }
    throw error
  }
}

// ============================================================
// Extraction robuste du JSON depuis la réponse de Claude
// ============================================================

function extractJson(text: string): any | null {
  // Nettoyage : retirer markdown
  let cleaned = text.replace(/```json\n?|```\n?/g, '').trim()

  // Tentative directe
  try {
    return JSON.parse(cleaned)
  } catch { /* continue */ }

  // Chercher un bloc JSON dans le texte
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch { /* continue */ }
  }

  // Dernière tentative : retirer les caractères de contrôle
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ' ')
  const lastMatch = cleaned.match(/\{[\s\S]*\}/)
  if (lastMatch) {
    try {
      return JSON.parse(lastMatch[0])
    } catch { /* give up */ }
  }

  return null
}

// ============================================================
// Normaliser les données extraites
// ============================================================

function normalizeData(parsed: any) {
  return {
    supplier: typeof parsed.supplier === 'string' ? parsed.supplier.trim() : '',
    date: normalizeDate(parsed.date),
    total: normalizePrice(parsed.total),
    status: parsed.status || 'livré',
    raw_items_summary: parsed.raw_items_summary || '',
    items: Array.isArray(parsed.items)
      ? parsed.items.map((item: any) => ({
          name: typeof item.name === 'string' ? item.name.trim() : '',
          quantity: String(item.quantity || '1').trim(),
          unit: typeof item.unit === 'string' ? item.unit.trim() : '',
          price: normalizePrice(item.price),
        }))
      : [],
  }
}

function normalizeDate(raw: any): string {
  if (!raw) return ''
  const str = String(raw).trim()
  // Déjà au format YYYY-MM-DD ?
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // DD/MM/YYYY ?
  const frMatch = str.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2].padStart(2, '0')}-${frMatch[1].padStart(2, '0')}`
  }
  return str
}

function normalizePrice(raw: any): string {
  if (!raw) return ''
  const str = String(raw).trim()
  // Extraire le nombre (gère "12,50 €", "12.50€", "12,50", etc.)
  const cleaned = str.replace(/[€\s]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return str
  return num.toFixed(2) + ' €'
}

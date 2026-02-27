/**
 * Table de correspondance nom de produit → catégorie attendue.
 * Utilisée pour corriger les erreurs de classification de Claude.
 * Chaque mot-clé est en minuscule, sans accents.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Viande': [
    'jambon', 'poulet', 'boeuf', 'bœuf', 'porc', 'veau', 'agneau', 'dinde',
    'saucisse', 'saucisson', 'merguez', 'lardon', 'bacon', 'steak', 'escalope',
    'filet', 'cote', 'roti', 'hache', 'nugget', 'chorizo', 'coppa', 'bresaola',
    'rosette', 'pate de campagne', 'rillettes', 'boudin', 'andouille', 'andouillette',
    'viande', 'charcuterie', 'chipolata',
  ],
  'Poisson': [
    'saumon', 'thon', 'cabillaud', 'crevette', 'moule', 'sardine', 'maquereau',
    'truite', 'bar', 'loup', 'sole', 'lieu', 'colin', 'merlu', 'anchois',
    'poisson', 'fruit de mer', 'calamar', 'poulpe', 'surimi', 'crabe',
    'coquille', 'huitre', 'bulot', 'gambas',
  ],
  'Laitage': [
    'lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'creme fraiche',
    'mozzarella', 'parmesan', 'emmental', 'gruyere', 'comte', 'chevre',
    'camembert', 'brie', 'roquefort', 'raclette', 'mascarpone', 'ricotta',
    'feta', 'kefir', 'skyr', 'faisselle', 'petit suisse', 'fromage blanc',
    'cheddar', 'gouda', 'reblochon', 'beaufort', 'saint-nectaire',
  ],
  'Fruits': [
    'pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'framboise',
    'cerise', 'peche', 'abricot', 'prune', 'raisin', 'kiwi', 'mangue',
    'ananas', 'melon', 'pasteque', 'myrtille', 'mure', 'clementine',
    'mandarine', 'pamplemousse', 'grenade', 'figue', 'fruit',
    'compote', 'litchi', 'noix de coco', 'avocat',
  ],
  'Légumes': [
    'tomate', 'carotte', 'pomme de terre', 'patate', 'oignon', 'ail',
    'courgette', 'aubergine', 'poivron', 'concombre', 'salade', 'laitue',
    'epinard', 'haricot vert', 'petit pois', 'brocoli', 'chou', 'chou-fleur',
    'artichaut', 'asperge', 'betterave', 'navet', 'radis', 'poireau',
    'celeri', 'fenouil', 'champignon', 'endive', 'mache', 'roquette',
    'legume', 'courge', 'butternut', 'potiron', 'potimarron', 'mais',
    'echalote',
  ],
  'Épicerie': [
    'pate', 'pates', 'riz', 'semoule', 'couscous', 'quinoa', 'boulgour',
    'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre',
    'sauce', 'ketchup', 'mayonnaise', 'moutarde', 'confiture',
    'miel', 'chocolat', 'cacao', 'cafe', 'the', 'cereale',
    'biscuit', 'gateau', 'pain', 'brioche', 'cracotte', 'biscottes',
    'conserve', 'lentille', 'pois chiche', 'haricot sec', 'flageolet',
    'tomate pelée', 'concentre', 'bouillon', 'herbe', 'epice',
    'curry', 'cumin', 'paprika', 'cannelle', 'thym', 'laurier',
    'basilic', 'persil', 'ciboulette', 'levure', 'maizena',
    'chapelure', 'noix', 'noisette', 'amande', 'pistache',
    'olive', 'cornichon', 'câpre',
  ],
  'Boissons': [
    'eau', 'jus', 'soda', 'coca', 'limonade', 'biere', 'vin',
    'sirop', 'smoothie', 'boisson', 'tisane', 'infusion',
    'lait de coco', 'lait d\'amande', 'lait d\'avoine', 'lait vegetal',
  ],
  'Surgelés': [
    'surgele', 'glace', 'sorbet', 'pizza surgelee', 'frites surgelees',
    'legume surgele', 'poisson surgele',
  ],
  'Hygiène': [
    'savon', 'shampoing', 'dentifrice', 'brosse a dent', 'deodorant',
    'papier toilette', 'essuie-tout', 'lessive', 'produit vaisselle',
    'sac poubelle', 'eponge', 'liquide vaisselle', 'nettoyant',
    'gel douche',
  ],
}

/**
 * Normalise un texte pour la comparaison : minuscule, sans accents.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Détermine la catégorie attendue pour un nom de produit.
 * Retourne null si aucune correspondance trouvée.
 */
export function inferCategory(productName: string): string | null {
  const normalized = normalize(productName)

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword)
      // Le nom du produit contient le mot-clé
      if (normalized.includes(normalizedKeyword)) {
        return category
      }
    }
  }

  return null
}

/**
 * Corrige la catégorie d'un produit si elle est incohérente.
 * Retourne la catégorie corrigée, ou la catégorie originale si elle semble correcte.
 */
export function correctCategory(productName: string, currentCategory: string): string {
  const inferred = inferCategory(productName)

  // Si on n'a pas d'avis, on garde la catégorie actuelle
  if (!inferred) return currentCategory

  // Si la catégorie actuelle est "Autre" ou ne correspond pas, corriger
  if (currentCategory === 'Autre' || currentCategory !== inferred) {
    return inferred
  }

  return currentCategory
}

/**
 * Normalise un nom de produit pour la déduplication.
 * Ex: "Lait demi-écrémé" et "lait demi écrémé" → même clé
 */
export function deduplicationKey(name: string): string {
  return normalize(name)
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return auth
}

export async function getSheets() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  return sheets
}

// Lire une plage de données
export async function readRange(range: string): Promise<string[][]> {
  const sheets = await getSheets()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  })
  return (response.data.values as string[][]) || []
}

// Écrire dans une plage
export async function writeRange(range: string, values: string[][]): Promise<void> {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
}

// Ajouter des lignes à la suite
export async function appendRows(range: string, values: string[][]): Promise<void> {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
}

// ============================================
// Fonctions métier
// ============================================

export interface StockItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minQuantity: number
  supplier: string
  lastUpdated: string
}

export async function getStock(): Promise<StockItem[]> {
  const rows = await readRange('Stock!A2:H')
  return rows.map(row => ({
    id: row[0] || '',
    name: row[1] || '',
    category: row[2] || '',
    quantity: parseFloat(row[3]) || 0,
    unit: row[4] || '',
    minQuantity: parseFloat(row[5]) || 0,
    supplier: row[6] || '',
    lastUpdated: row[7] || '',
  }))
}

export async function updateStockItem(item: StockItem): Promise<void> {
  // Trouver la ligne de l'item par son ID et la mettre à jour
  const rows = await readRange('Stock!A2:A')
  const rowIndex = rows.findIndex(row => row[0] === item.id)
  if (rowIndex === -1) return

  const range = `Stock!A${rowIndex + 2}:H${rowIndex + 2}`
  await writeRange(range, [[
    item.id, item.name, item.category,
    String(item.quantity), item.unit,
    String(item.minQuantity), item.supplier,
    new Date().toISOString()
  ]])
}

export interface Order {
  id: string
  date: string
  supplier: string
  items: string
  total: string
  status: string
}

export async function getOrders(limit = 50): Promise<Order[]> {
  const rows = await readRange(`Commandes!A2:F${limit + 1}`)
  return rows.map(row => ({
    id: row[0] || '',
    date: row[1] || '',
    supplier: row[2] || '',
    items: row[3] || '',
    total: row[4] || '',
    status: row[5] || '',
  }))
}

export async function getShoppingList() {
  const rows = await readRange('Liste!A2:E')
  return rows.map(row => ({
    id: row[0] || '',
    name: row[1] || '',
    quantity: row[2] || '',
    supplier: row[3] || '',
    checked: row[4] === 'TRUE',
  }))
}

export async function addToShoppingList(items: Array<{ name: string; quantity: string; supplier: string }>) {
  const rows = items.map(item => [
    Date.now().toString(),
    item.name,
    item.quantity,
    item.supplier,
    'FALSE',
  ])
  await appendRows('Liste!A:E', rows)
}

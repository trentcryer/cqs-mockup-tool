const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'your-store.myshopify.com'
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || ''
const API_VERSION = '2025-01'
const SHOP = DOMAIN.replace('.myshopify.com', '')

const FAKE_GROUPS = [
  'The Chord Busters',
  'Four on the Floor Quartet',
  'Pitch Perfect Gentlemen',
]

async function getToken() {
  const res = await fetch(`https://${SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  const { access_token } = await res.json()
  return access_token
}

async function createCollection(token, title) {
  const res = await fetch(`https://${DOMAIN}/admin/api/${API_VERSION}/custom_collections.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ custom_collection: { title } }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data.custom_collection
}

const token = await getToken()
console.log('Got token, creating collections...\n')

for (const name of FAKE_GROUPS) {
  const col = await createCollection(token, name)
  console.log(`✓ Created "${col.title}" (id: ${col.id})`)
}

console.log('\nDone — refresh /admin/collections to see them.')

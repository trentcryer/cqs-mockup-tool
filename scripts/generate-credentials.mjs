/**
 * Generate temporary passwords for all group accounts.
 *
 * Run with:  node scripts/generate-credentials.mjs
 *
 * What it does:
 *   1. Reads every profile from Supabase
 *   2. Generates a memorable temp password for each
 *   3. Sets that password on their Supabase Auth account
 *   4. Writes credentials/group-credentials-YYYY-MM-DD.txt  (human-readable)
 *      and  credentials/group-credentials-YYYY-MM-DD.csv  (spreadsheet-ready)
 *
 * Skips your own admin account (TRENT_EMAIL).
 * Re-running is safe — it just resets passwords again and writes a new dated file.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'

// Node 20.12+ built-in env loader — no dotenv needed
try { process.loadEnvFile('.env') } catch {}

const SUPABASE_URL             = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TRENT_EMAIL               = process.env.TRENT_EMAIL?.toLowerCase()

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Password generator ─────────────────────────────────────────────────────────
// Format: BlueChord4821!  — readable over the phone, strong enough for a temp pass

const WORDS1 = ['Bold','Blue','Gold','True','Grand','Swift','Bright','Deep','Rich','Clear','Royal','Sharp']
const WORDS2 = ['Note','Chord','Stage','Voice','Star','Crown','Song','Bell','Tune','Beat','Crest','Tone']

function genPassword() {
  const w1  = WORDS1[Math.floor(Math.random() * WORDS1.length)]
  const w2  = WORDS2[Math.floor(Math.random() * WORDS2.length)]
  const num = String(Math.floor(Math.random() * 9000) + 1000)
  return `${w1}${w2}${num}!`
}

// ── Username slug (for reference — login uses email) ──────────────────────────
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'unnamed'
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log('Fetching profiles…')

const { data: profiles, error: profileErr } = await supabase
  .from('profiles')
  .select('id, email, quartet_name, shopify_collection_title')
  .order('quartet_name', { ascending: true })

if (profileErr) {
  console.error('Could not fetch profiles:', profileErr.message)
  process.exit(1)
}

const groups = (profiles ?? []).filter(
  p => p.email?.toLowerCase() !== TRENT_EMAIL
)

console.log(`Found ${groups.length} group account(s). Generating credentials…\n`)

const results = []

for (const profile of groups) {
  const displayName = profile.quartet_name
    || profile.shopify_collection_title
    || profile.email
    || profile.id

  const slug     = slugify(profile.quartet_name || profile.shopify_collection_title || '')
  const password = genPassword()

  process.stdout.write(`  ${displayName.padEnd(40)} `)

  const { error } = await supabase.auth.admin.updateUserById(profile.id, { password })

  if (error) {
    console.log(`FAILED — ${error.message}`)
    results.push({ displayName, slug, email: profile.email, password: null, error: error.message })
  } else {
    console.log(`✓  ${password}`)
    results.push({ displayName, slug, email: profile.email, password, error: null })
  }
}

// ── Write output files ─────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10)
mkdirSync('credentials', { recursive: true })

// Plain text — easy to copy/paste and hand out
const lines = [
  `CQS Group Credentials — generated ${date}`,
  `${'─'.repeat(60)}`,
  `These are TEMPORARY passwords. Groups should be prompted`,
  `to change them after first login.`,
  `${'─'.repeat(60)}`,
  '',
  ...results.map(r => {
    if (r.error) return `✗ ${r.displayName}\n  ERROR: ${r.error}\n`
    return [
      r.displayName,
      `  Username / Login:  ${r.email}`,
      `  Slug (reference):  ${r.slug}`,
      `  Temp Password:     ${r.password}`,
      '',
    ].join('\n')
  }),
]
const txtPath = `credentials/group-credentials-${date}.txt`
writeFileSync(txtPath, lines.join('\n'))

// CSV — paste into Sheets / Excel
const csvRows = [
  ['Group Name', 'Email (login)', 'Username Slug', 'Temp Password', 'Error'],
  ...results.map(r => [
    `"${r.displayName}"`,
    `"${r.email}"`,
    `"${r.slug}"`,
    r.password ? `"${r.password}"` : '',
    r.error ? `"${r.error}"` : '',
  ].join(',')),
]
const csvPath = `credentials/group-credentials-${date}.csv`
writeFileSync(csvPath, csvRows.join('\n'))

// Summary
const ok     = results.filter(r => !r.error).length
const failed = results.filter(r =>  r.error).length

console.log(`\n${'─'.repeat(60)}`)
console.log(`Done.  ${ok} updated,  ${failed} failed.`)
console.log(`\n  📄  ${txtPath}`)
console.log(`  📊  ${csvPath}`)
if (failed > 0) {
  console.log(`\nFailed accounts:`)
  results.filter(r => r.error).forEach(r => console.log(`  • ${r.displayName}: ${r.error}`))
}

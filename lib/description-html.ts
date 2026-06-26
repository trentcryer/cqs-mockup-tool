// Pure, dependency-free helpers for turning Printful product data into the HTML
// that becomes a Shopify product's body_html. Kept out of printful.ts (which is
// server-only and bundles the API client) so the admin editor's client-side
// "published preview" can import them safely.

// Convert Printful's plain-text description into HTML (paragraphs + bullet list).
export function descriptionTextToHtml(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const bullets: string[] = []
  const intro: string[] = []
  for (const line of lines) {
    if (line.startsWith('•')) bullets.push(`<li>${line.slice(1).trim()}</li>`)
    else intro.push(`<p>${line}</p>`)
  }
  return intro.join('') + (bullets.length ? `<ul>${bullets.join('')}</ul>` : '')
}

// Build the "Size Guide (inches)" HTML table from Printful v2 size_tables.
export function sizeTablesToHtml(sizeTables: any[]): string {
  const table = sizeTables?.find((t: any) => t.type === 'product_measure' && t.unit === 'inches')
    || sizeTables?.[0]
  if (!table?.measurements?.length) return ''
  const sizes = table.measurements[0].values.map((v: any) => v.size)
  let rows = `<tr><th>Size</th>${sizes.map((s: string) => `<th>${s}</th>`).join('')}</tr>`
  for (const m of table.measurements) {
    const cells = m.values.map((v: any) => (v.value ? v.value : `${v.min_value}–${v.max_value}`))
    rows += `<tr><td>${m.type_label}</td>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
  }
  return `<h4>Size Guide (inches)</h4><table>${rows}</table>`
}

// Assemble the full body_html the publish flow ships to Shopify. Single source of
// truth so the editor preview matches exactly what gets published.
export function buildBodyHtml(opts: {
  notes?: string | null
  descriptionText?: string | null
  sizeTables?: any[]
  sizeGuideEnabled?: boolean
}): string {
  const notesHtml = opts.notes?.trim() ? `<p><em>${opts.notes.trim()}</em></p>` : ''
  const descriptionHtml = opts.descriptionText?.trim()
    ? descriptionTextToHtml(opts.descriptionText) : ''
  const sizeGuideHtml = (opts.sizeGuideEnabled !== false && opts.sizeTables?.length)
    ? sizeTablesToHtml(opts.sizeTables) : ''
  return [notesHtml, descriptionHtml, sizeGuideHtml].filter(Boolean).join('\n')
}

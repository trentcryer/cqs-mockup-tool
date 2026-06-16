# CQS Mockup Tool — Session Memory

Last updated: 2026-06-15

---

## What This App Does

Next.js 16.2.6 (Turbopack, App Router) tool that lets Trent:
1. Browse Printful's product catalog (`/studio/catalog`)
2. Upload a quartet logo and place it on a garment in the studio editor (`/studio/editor`)
3. Generate mockup images via Printful's mockup API
4. Approve and publish finished designs to Shopify (`/admin`)

Stack: Next.js 16 · Supabase (auth + DB) · Printful API · Shopify Admin API · Tailwind CSS

---

## Critical Next.js 16 Gotcha

Next.js 16 (Turbopack) uses **`proxy.ts`** instead of `middleware.ts`.
- `proxy.ts` already exists at the project root and handles Supabase session refresh.
- **Never create `middleware.ts`** — having both files causes all routes to 404.

---

## Database

Supabase `designs` table. Key columns:
- `id`, `product_id`, `color`, `variant_ids` (int[])
- `transform` (jsonb) — logo position/scale/rotation
- `placement` — e.g. `"front"`
- `mockup_urls` (jsonb[]) — array of `{ placement, mockup_url, color? }`
- `color_variant_map` (jsonb) — `{ "Black": [1234, 1235], "Gray": [2234, 2235] }`
- `logo_path` — Supabase storage path to the uploaded logo

### Pending Migration (MUST RUN if not done yet)
Run this in Supabase SQL Editor:
```sql
alter table public.designs
  add column if not exists color_variant_map jsonb;
```
File: `supabase/migrations/005_color_variant_map.sql`

---

## Per-Color Mockup System

When multiple colors are selected in the studio editor and "Generate Mockup" is clicked:
- A mockup is generated for **each** selected color in parallel (`Promise.all`)
- Each mockup object is tagged: `{ placement, mockup_url, color: "Black" }`
- Stored in `designs.mockup_urls` as an array

When "Approve & Publish" is run from the admin page:
- If `hasPerColorMockups` is true → `createProduct` is called with `images: []` (no unlinked images)
- Each color's mockup is then added via `addProductImage(productId, url, [shopifyVariantIds])` so it only shows for that color's variants
- This prevents the original color image showing underneath when switching swatches on the Shopify storefront

Key files:
- `app/studio/editor/StudioEditorClient.tsx` — `generateMockup()` function
- `app/admin/page.tsx` — `generateMockups` server action + `approveAndPublish` server action
- `lib/shopify.ts` — `createProduct`, `addProductImage`

---

## Catalog Page (`/studio/catalog`)

File: `app/studio/catalog/page.tsx`

### Category Tabs — Photo Feature (just added)
The category tabs now support background photos. Each tab:
- Renders a photo from `/catalog-tabs/{key}.jpg` if the file exists
- Falls back to the colored gradient if no photo is present yet
- Has a dark scrim overlay so the label is always readable

**To add photos:** Drop files into `public/catalog-tabs/` with these exact names:

| Filename | Tab |
|---|---|
| `tees.jpg` | T-Shirts |
| `polos.jpg` | Polos & Shirts |
| `hoodies.jpg` | Hoodies |
| `performance.jpg` | Performance |
| `jackets.jpg` | Jackets |
| `hats.jpg` | Hats & Caps |
| `accessories.jpg` | Accessories |
| `aop.jpg` | All-Over Print |
| `embroidery.jpg` | Embroidery |
| `all.jpg` | All Products (optional) |

JPG, PNG, and WebP all work. Tabs with no photo still show the gradient — add photos one at a time.

### Catalog Caching
`app/api/printful/catalog/route.ts` has a two-layer cache:
1. `unstable_cache` (in-memory, cleared on dev restart)
2. Disk cache at `/tmp/cqs-catalog-v2.json` (6-hour TTL, survives restarts)

First load after 6-hour expiry is slow (~10-20s hitting Printful). All subsequent loads within 6 hours are instant from disk.

Fetching is fully concurrent (`Promise.allSettled`) — no more sequential chunking.

---

## Printful Sync (Order Fulfillment)

Store: **Custom Quartet Stuff** · ID: `8720142` · Type: `shopify`
Env var: `PRINTFUL_STORE_ID=8720142` (in `.env`)

**How it works now (fixed):**
- Shopify product is created first (unchanged)
- After Shopify succeeds, logo is uploaded to Printful's file library (permanent URL)
- Printful sync product is created referencing the SAME Shopify product/variant IDs via `external_id`
- No duplicate Shopify products — Printful links to the existing one
- If Printful fails, Shopify product is already saved (non-fatal)

**Key files:** `lib/printful.ts` → `createSyncProduct()` (accepts `externalProductId` + `variantExternalIds`)
`app/admin/page.tsx` → `approveAndPublish()` (Printful sync block runs after image linking, ~line 389)

**What to test:** After Approve & Publish, check Printful dashboard → Store → Products. The design should appear there, synced with the right Shopify variants and the logo file attached.

---

## Admin Page (`/admin`)

- Protected route — requires Supabase session cookie
- If admin shows blank/redirect: sign in at `/login` first, then navigate to `/admin`
- After any code change to `app/admin/page.tsx`, **hard refresh the browser** (Ctrl+Shift+R / Cmd+Shift+R) to clear stale server action IDs — otherwise "NetworkError when attempting to fetch resource" appears

---

## Key Files Reference

| File | Purpose |
|---|---|
| `proxy.ts` | Supabase session refresh (Next.js 16 middleware equivalent) |
| `app/admin/page.tsx` | Admin queue, approve & publish, mockup generation |
| `app/admin/AdminQueueClient.tsx` | Admin UI client component |
| `app/studio/editor/StudioEditorClient.tsx` | Studio editor, logo upload, mockup generation |
| `app/studio/catalog/page.tsx` | Product catalog with category tabs |
| `app/api/printful/catalog/route.ts` | Printful catalog API with disk cache |
| `app/api/studio/generate-mockup/route.ts` | Mockup generation API route |
| `lib/printful.ts` | Printful API client |
| `lib/shopify.ts` | Shopify Admin API client |
| `supabase/migrations/` | DB migration files (001–005) |
| `public/catalog-tabs/` | Category tab photos (drop files here) |

---

## Side Project Note

There is a `SIDE_PROJECT.md` in the project root about building a Shopify App Store product (Collection Manager + Sales Report). Build this opportunistically alongside CQS work.

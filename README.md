# CQS Mockup Studio

**Production-ready customer mockup portal for Custom Quartet Stuff** — a barbershop merch Print-on-Demand business powered by Printful + Shopify.

Built as the evolution of the original Python/Streamlit `cqs-mockup-tool`. Fully private per-quartet workspaces, beautiful interactive logo placement, real Printful mockups, review workflow with email alerts, and admin push-to-Shopify.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Supabase** — Auth (email + magic links), PostgreSQL, Storage (private logos)
- **Printful API** — Full catalog, variants, placements, file uploads, mockup generation
- **Fabric.js** — Professional draggable, resizable, rotatable logo canvas
- **Resend** — Beautiful review request emails to Trent
- **Shopify Admin API** — One-click push of approved designs as draft products

## Key Features

- Private "My Quartet Studio" per authenticated user
- Reusable logo library (PNG/SVG with transparency preferred)
- Full Printful catalog browser (cached)
- **Interactive editor**: Real-time Fabric.js canvas with live transform, opacity, rotation
- High-quality mockup generation via Printful (the real photoreal renders)
- "Add to My Folder" with full placement + transform data persisted
- Request Review → emails Trent with all details + mockups
- Admin dashboard for Trent: see every customer's work, approve, push to Shopify store

## .env Compatibility (Critical)

**This project reuses and extends the exact same `.env` file** as the original Streamlit/Python tool.

```
# Existing key still works
PRINTFUL_API_KEY=8lhq1qXGyOz9ScqJfGFAWfmhieMcAEbItgh0DruX

# New keys (add these)
SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
TRENT_EMAIL=trent@...
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
```

See [.env.example](.env.example) for the complete list.

The legacy Python code continues to work unchanged.

## Local Development

### 1. Prerequisites

- Node 20+
- A Supabase project (free tier is perfect)
- Printful API key (you already have one)
- Resend account (free)
- (Optional) Shopify custom app with `write_products`

### 2. Setup

```bash
git clone <your-repo>
cd cqs-mockup-tool

# Install
npm install

# Copy and fill env (keep your existing PRINTFUL key)
cp .env.example .env
# edit .env — add Supabase, Resend, etc.
```

### 3. Supabase Setup (one-time)

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor** → paste and run the entire contents of:
   ```
   supabase/migrations/001_init.sql
   ```
3. Create a **private** Storage bucket named `cqs-assets`
4. Add the following Storage policies (via dashboard → Storage → Policies):

   - **INSERT**: `bucket_id = 'cqs-assets' AND auth.uid()::text = (storage.foldername(name))[2]`
   - **SELECT / UPDATE / DELETE**: same owner check on the `logos/` folder

5. In Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/callback`

### 4. Run

```bash
npm run dev
```

Visit http://localhost:3000 → Sign up with any email (magic link or password).

## Deployment (Vercel — Recommended)

1. Push to GitHub
2. Import repo in Vercel
3. Add **all** environment variables from `.env` (including the `NEXT_PUBLIC_` ones)
4. Deploy
5. Update Supabase redirect URLs to your production domain
6. (Optional) Add a custom domain

The app is fully serverless-ready.

## Migration from Streamlit

- All old Python code lives in `/legacy/` (untouched)
- Your existing `PRINTFUL_API_KEY` continues to work
- The new studio is a strict superset: more powerful editor, persistence, collaboration workflow
- You can run both tools side-by-side during transition

## Architecture Notes

- All sensitive API calls (Printful, Resend, Shopify, storage uploads) happen in Route Handlers / Server Actions
- RLS policies guarantee customers can **only** see their own designs and logos
- Admin area uses the service role key server-side only (never exposed)
- Fabric canvas transform data is stored as JSONB and mapped (approximately) to Printful print area coordinates when generating final mockups. The mapping can be refined with more printfiles data.

## Future Enhancements (ready for iteration)

- Multi-placement designs (front + back + sleeve in one saved record)
- Exact pixel-perfect overlay using Printful variant template coordinates
- Customer Shopify sync / order handoff
- Bulk CSV export for Trent
- Rate limiting + usage quotas per quartet
- Realtime collaboration on a design (Supabase Realtime + presence)

## License & Contact

Internal tool for Custom Quartet Stuff.
Questions? Reach out to Trent.

---

Built with ❤️ for barbershop harmony and beautiful merch.

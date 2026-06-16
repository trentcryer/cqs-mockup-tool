# Shopify App Store — Side Project Notes

## The Product
A standalone Shopify app built from the Collection Manager + Sales Report
already built for CQS. Target market: any Shopify merchant who sells
products across multiple collections (boutiques, merch stores, multi-brand shops).

## Sellable Features (already built)
- Collection Manager — bulk publish/unpublish, remove, smart vs custom collection handling
- Sales Report by collection — date range filter, stale product detection (60 days),
  one-click price suggestions (-15%), customer-friendly view toggle
- Collection thumbnail previews with logo fallback

## What Needs to Change for App Store (vs CQS version)

### Auth (biggest delta)
- CQS uses: client_credentials with hardcoded env vars (single tenant)
- App Store needs: Shopify OAuth install flow, per-merchant token stored in DB
- Key refactor: make shopify.ts functions accept a `token` param instead of
  reading module-level constants. When opportunity arises in CQS work, do this —
  it doesn't change CQS behavior at all (just pass the env var token in),
  but makes multi-tenancy trivial later.

### Billing
- Shopify Billing API for recurring subscription ($10-30/month per merchant)
- Add after core features are working

### Branding
- Strip CQS-specific copy, colors optional (merchants will expect their own branding)
- The UI components themselves are already generic — good

### Data layer
- CQS uses Supabase for user data — side project would need its own DB
  (or same Supabase project with merchant_id scoping)
- Sessions/installs table: { shop, access_token, installed_at, plan }

## Code to Keep Clean (flag when touching these)
- `lib/shopify.ts` — keep functions stateless, no side effects, easy to extract
- `app/admin/collections/` — no CQS-specific logic, already generic
- `app/api/admin/collection-manager/` — same
- `app/api/admin/sales-report/` — same

## Build-Both Opportunities
When working on CQS, if a feature applies to both:
- Refactoring shopify.ts to accept token param → do it, zero CQS impact
- Any improvement to Collection Manager UI → directly reusable
- Any improvement to Sales Report → directly reusable
- Adding more collection actions (sort order, bulk tag, etc.) → reusable

## Revenue Estimate (rough)
- 50 merchants × $15/month = $750/month
- 200 merchants × $15/month = $3,000/month
- Shopify takes 20% (on basic partner plan) → 80% to you

## Status
- [ ] Refactor shopify.ts to accept token param
- [ ] OAuth install flow
- [ ] Merchant sessions table
- [ ] Shopify Billing API
- [ ] App listing / screenshots

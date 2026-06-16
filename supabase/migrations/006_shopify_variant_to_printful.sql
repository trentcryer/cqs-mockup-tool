alter table public.designs
  add column if not exists shopify_variant_to_printful jsonb;

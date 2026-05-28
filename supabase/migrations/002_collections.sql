-- ============================================
-- CQS Mockup Studio - Schema v2
-- Run in Supabase dashboard → SQL Editor
-- ============================================

-- Shopify collection assignment per quartet
alter table public.profiles
  add column if not exists shopify_collection_id bigint,
  add column if not exists shopify_collection_title text;

-- Track which Printful sync product was created on approval
alter table public.designs
  add column if not exists printful_sync_product_id bigint;

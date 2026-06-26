-- Admin-editable publish overrides for a design.
-- Stores the values the admin tweaks on /admin/editor/[designId] before publishing:
--   {
--     "printful_description": "edited plain-text description (overrides Printful's)",
--     "size_guide_enabled": true,
--     "selected_colors": ["Black", "Navy"],   -- subset of color_variant_map keys; null/absent = all
--     "selected_sizes": ["S", "M", "L", "XL"]  -- subset of available sizes; null/absent = all
--   }
-- The publish flow (approveAndPublish) reads these to build the Shopify product.
alter table public.designs
  add column if not exists publish_overrides jsonb;

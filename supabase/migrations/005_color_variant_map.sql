-- Store all selected colors + their variant IDs in a single design row.
-- Keyed by color name, value is array of Printful variant IDs for that color.
-- Example: { "Black": [1234, 1235, 1236], "Gray": [2234, 2235, 2236] }
alter table public.designs
  add column if not exists color_variant_map jsonb;

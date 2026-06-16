-- Add admin-set retail price to designs
alter table public.designs
  add column if not exists retail_price numeric(10,2);

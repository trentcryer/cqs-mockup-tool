-- Add booking configuration to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS booking_tier_type TEXT DEFAULT 'single'; -- 'single' or 'multi'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS booking_contact_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS booking_tiers JSONB; -- Array of tier objects

-- Create bookings table for storing booking requests
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  selected_tier TEXT NOT NULL,
  requested_date DATE NOT NULL,
  event_details TEXT,
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for queries
CREATE INDEX IF NOT EXISTS idx_booking_requests_group_id ON public.booking_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON public.booking_requests(status);

-- RLS policies
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can create booking requests
CREATE POLICY "Enable insert for booking requests" ON public.booking_requests
  FOR INSERT WITH CHECK (TRUE);

-- Groups can only see their own booking requests
CREATE POLICY "Groups can view their bookings" ON public.booking_requests
  FOR SELECT USING (
    group_id = auth.uid() OR
    group_id IN (
      SELECT id FROM public.profiles WHERE id = auth.uid() AND group_type IS NOT NULL
    )
  );

COMMENT ON TABLE public.booking_requests IS 'Stores booking requests from customers to groups';
COMMENT ON COLUMN public.profiles.booking_enabled IS 'Whether this group accepts bookings';
COMMENT ON COLUMN public.profiles.booking_tier_type IS 'Single or multi-tier booking options';
COMMENT ON COLUMN public.profiles.booking_contact_email IS 'Email where booking requests are sent';
COMMENT ON COLUMN public.profiles.booking_tiers IS 'JSON array of booking tier objects with name, price, description';

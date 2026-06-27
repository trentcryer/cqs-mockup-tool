// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Calendar, DollarSign, Check, X } from 'lucide-react';

interface BookingRequest {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  selected_tier: string;
  requested_date: string;
  event_details?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [profile, setProfile] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Load bookings for this group
      const { data: bookingsData, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('group_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setBookings(bookingsData || []);
      }
      setLoading(false);
    }

    loadData();
  }, []);

  const updateStatus = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled') => {
    const { error } = await supabase
      .from('booking_requests')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (!error) {
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    }
  };

  const filteredBookings = filterStatus === 'all'
    ? bookings
    : bookings.filter(b => b.status === filterStatus);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f3ee] p-6 flex items-center justify-center">
        <p className="text-[#9b8c7a]">Loading...</p>
      </div>
    );
  }

  const statusColors = {
    pending: 'badge-review',
    confirmed: 'badge-approved',
    cancelled: 'badge-draft',
  };

  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Booking Requests
        </h1>
        <p className="text-[#9b8c7a] mb-8">
          Manage and respond to booking requests from customers
        </p>

        {!profile?.booking_enabled && (
          <div className="card bg-[#fef3c7] border-l-4 border-[#f59e0b] p-4 mb-8">
            <p className="text-sm text-[#92400e]">
              ⚠️ Bookings are currently disabled. <a href="/studio/bookings" className="underline font-semibold">Enable bookings</a> to start receiving requests.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {['all', 'pending', 'confirmed', 'cancelled'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-4 py-2 text-sm font-semibold transition ${
                filterStatus === status
                  ? 'bg-[#1c1412] text-white'
                  : 'bg-white text-[#1c1412] border border-[#e8e0d8] hover:bg-[#f7f5f2]'
              }`}
            >
              {status === 'all' ? 'All Requests' : statusLabels[status as keyof typeof statusLabels]}
              {filterStatus === status && ` (${filteredBookings.length})`}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-[#9b8c7a] mb-2">No {filterStatus === 'all' ? 'booking requests' : filterStatus + ' bookings'} yet</p>
            <p className="text-sm text-[#9b8c7a]">
              Share your booking page on social media to start receiving requests
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map(booking => (
              <div key={booking.id} className="card p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-[#e8e0d8]">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#1c1412]">{booking.customer_name}</h3>
                    <p className="text-sm text-[#9b8c7a] flex items-center gap-2 mt-1">
                      <Mail size={14} />
                      {booking.customer_email}
                    </p>
                    {booking.customer_phone && (
                      <p className="text-sm text-[#9b8c7a]">
                        📱 {booking.customer_phone}
                      </p>
                    )}
                  </div>
                  <span className={`badge ${statusColors[booking.status]}`}>
                    {statusLabels[booking.status]}
                  </span>
                </div>

                {/* Details */}
                <div className="grid md:grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#9b8c7a] mb-1 uppercase">Package</p>
                    <p className="flex items-center gap-2 text-[#1c1412]">
                      <DollarSign size={16} className="text-[#9b1c1c]" />
                      {booking.selected_tier}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9b8c7a] mb-1 uppercase">Requested Date</p>
                    <p className="flex items-center gap-2 text-[#1c1412]">
                      <Calendar size={16} className="text-[#9b1c1c]" />
                      {new Date(booking.requested_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9b8c7a] mb-1 uppercase">Requested</p>
                    <p className="text-sm text-[#1c1412]">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Event Details */}
                {booking.event_details && (
                  <div className="bg-[#f7f5f2] p-4 rounded border border-[#e8e0d8]">
                    <p className="text-xs font-semibold text-[#9b8c7a] mb-2 uppercase">Event Details</p>
                    <p className="text-sm text-[#1c1412]">{booking.event_details}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-[#e8e0d8]">
                  <a
                    href={`mailto:${booking.customer_email}?subject=Re: Your Booking Request`}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e8e0d8] text-[#1c1412] hover:bg-[#f7f5f2] transition text-sm font-semibold"
                  >
                    <Mail size={14} />
                    Contact Customer
                  </a>

                  {booking.status !== 'confirmed' && (
                    <button
                      onClick={() => updateStatus(booking.id, 'confirmed')}
                      className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] text-[#065f46] hover:bg-[#a7f3d0] transition text-sm font-semibold"
                    >
                      <Check size={14} />
                      Confirm
                    </button>
                  )}

                  {booking.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatus(booking.id, 'cancelled')}
                      className="flex items-center gap-2 px-4 py-2 bg-[#fee2e2] text-[#7f1d1d] hover:bg-[#fecaca] transition text-sm font-semibold"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {bookings.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-12">
            <div className="card p-6 text-center">
              <p className="text-3xl font-bold text-[#1c1412]">
                {bookings.filter(b => b.status === 'pending').length}
              </p>
              <p className="text-sm text-[#9b8c7a] mt-2">Pending Requests</p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-3xl font-bold text-[#1c1412]">
                {bookings.filter(b => b.status === 'confirmed').length}
              </p>
              <p className="text-sm text-[#9b8c7a] mt-2">Confirmed Bookings</p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-3xl font-bold text-[#1c1412]">
                {bookings.length}
              </p>
              <p className="text-sm text-[#9b8c7a] mt-2">Total Requests</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

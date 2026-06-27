// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, Save, Plus, Trash2 } from 'lucide-react';

type TierType = 'single' | 'multi';

interface Tier {
  name: string;
  price: string;
  description: string;
}

export default function BookingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [tierType, setTierType] = useState<TierType>('single');
  const [contactEmail, setContactEmail] = useState('');
  const [tiers, setTiers] = useState<Tier[]>([
    { name: 'Standard', price: '', description: '' },
  ]);

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setBookingEnabled(data.booking_enabled || false);
        setTierType(data.booking_tier_type || 'single');
        setContactEmail(data.booking_contact_email || '');
        setTiers(data.booking_tiers || [{ name: 'Standard', price: '', description: '' }]);
      }
      setLoading(false);
    }

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          booking_enabled: bookingEnabled,
          booking_tier_type: tierType,
          booking_contact_email: contactEmail,
          booking_tiers: tiers,
        })
        .eq('id', profile.id);

      if (error) throw error;

      alert('Booking settings saved!');
    } catch (err: any) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateTier = (idx: number, field: keyof Tier, value: string) => {
    const updated = [...tiers];
    updated[idx][field] = value;
    setTiers(updated);
  };

  const removeTier = (idx: number) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== idx));
    }
  };

  const addTier = () => {
    if (tiers.length < 3) {
      setTiers([...tiers, { name: '', price: '', description: '' }]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ee]">
        <p className="text-[#9b8c7a]">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ee]">
        <p className="text-red-600">Could not load profile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Booking & Events
        </h1>
        <p className="text-[#9b8c7a] mb-8">
          Let customers book your {profile.group_type} for events and performances
        </p>

        <div className="card p-8 space-y-8">
          {/* Enable Bookings */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bookingEnabled}
                onChange={(e) => setBookingEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-semibold">Enable bookings for your group</span>
            </label>
            <p className="text-sm text-[#9b8c7a] ml-8">
              When enabled, customers will see a "Book this group" option on your retail page
            </p>
          </div>

          {bookingEnabled && (
            <>
              {/* Contact Email */}
              <div className="space-y-3 border-t pt-8">
                <label className="block font-semibold text-sm">Contact Email for Booking Requests</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="bookings@yourgroup.com"
                  className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-white"
                  style={{ borderRadius: '4px' }}
                />
                <p className="text-xs text-[#9b8c7a]">
                  Booking requests will be sent to this email address
                </p>
              </div>

              {/* Tier Type Selection */}
              <div className="space-y-4 border-t pt-8">
                <label className="block font-semibold text-sm">Booking Price Tiers</label>
                <p className="text-sm text-[#9b8c7a]">Choose how customers can book your group</p>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border border-[#e8e0d8] cursor-pointer hover:bg-[#faf9f7]">
                    <input
                      type="radio"
                      value="single"
                      checked={tierType === 'single'}
                      onChange={(e) => {
                        setTierType(e.target.value as TierType);
                        setTiers([{ name: 'Standard', price: '', description: '' }]);
                      }}
                    />
                    <div>
                      <span className="font-semibold block">Single Price</span>
                      <span className="text-xs text-[#9b8c7a]">One booking option with one price</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 border border-[#e8e0d8] cursor-pointer hover:bg-[#faf9f7]">
                    <input
                      type="radio"
                      value="multi"
                      checked={tierType === 'multi'}
                      onChange={(e) => {
                        setTierType(e.target.value as TierType);
                        if (tiers.length === 1) {
                          setTiers([
                            { name: 'Basic', price: '', description: '' },
                            { name: 'Standard', price: '', description: '' },
                            { name: 'Premium', price: '', description: '' },
                          ]);
                        }
                      }}
                    />
                    <div>
                      <span className="font-semibold block">Tiered Pricing (Up to 3 options)</span>
                      <span className="text-xs text-[#9b8c7a]">Multiple booking packages with different prices</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tier Configurations */}
              <div className="space-y-4 border-t pt-8">
                <label className="block font-semibold text-sm">
                  {tierType === 'single' ? 'Booking Details' : 'Tier Details'}
                </label>

                <div className="space-y-6">
                  {tiers.map((tier, idx) => (
                    <div key={idx} className="bg-[#f7f5f2] p-6 space-y-4 border border-[#e8e0d8]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {tierType === 'single' ? 'Booking Option' : `Tier ${idx + 1}`}
                        </span>
                        {tiers.length > 1 && (
                          <button
                            onClick={() => removeTier(idx)}
                            className="text-red-600 hover:text-red-700 flex items-center gap-1 text-xs"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#9b8c7a] mb-1">
                            Name (e.g., "Basic", "Full Performance")
                          </label>
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => updateTier(idx, 'name', e.target.value)}
                            placeholder="e.g., Standard Booking"
                            className="w-full border border-[#e8e0d8] px-4 py-2 text-[14px] focus:outline-none focus:border-[#1c1412] bg-white"
                            style={{ borderRadius: '4px' }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#9b8c7a] mb-1">
                            Price ($)
                          </label>
                          <input
                            type="number"
                            value={tier.price}
                            onChange={(e) => updateTier(idx, 'price', e.target.value)}
                            placeholder="e.g., 500"
                            className="w-full border border-[#e8e0d8] px-4 py-2 text-[14px] focus:outline-none focus:border-[#1c1412] bg-white"
                            style={{ borderRadius: '4px' }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#9b8c7a] mb-1">
                            Description (What's included)
                          </label>
                          <textarea
                            value={tier.description}
                            onChange={(e) => updateTier(idx, 'description', e.target.value)}
                            placeholder="e.g., 30-minute performance, up to 5 songs, includes sound check"
                            className="w-full border border-[#e8e0d8] px-4 py-2 text-[14px] focus:outline-none focus:border-[#1c1412] bg-white"
                            style={{ borderRadius: '4px' }}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {tierType === 'multi' && tiers.length < 3 && (
                  <button
                    onClick={addTier}
                    className="flex items-center gap-2 text-[#9b1c1c] hover:text-[#7a1515] font-semibold text-sm"
                  >
                    <Plus size={16} />
                    Add Another Tier
                  </button>
                )}
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="border-t pt-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Booking Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { GROUP_TYPES, type GroupType, groupLabel } from '@/lib/group-type'

type AccountType = 'group' | 'customer'

export default function SignupPage() {
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState<GroupType>('quartet')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!accountType) {
      toast.error('Please select an account type')
      return
    }
    setLoading(true)

    const authData: Record<string, any> = {
      account_type: accountType,
    }

    if (accountType === 'group') {
      authData.quartet_name = groupName.trim() || `My ${groupLabel(groupType)}`
      authData.group_type = groupType
    } else {
      authData.display_name = displayName.trim() || 'Barbershopper'
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: authData,
      },
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account created! Check your email to confirm.', { duration: 6000 })
      router.push('/login?confirmed=true')
    }
    setLoading(false)
  }

  const label = groupLabel(groupType)

  if (!accountType) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#f7f5f2]">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="eyebrow mb-3">Custom Quartet Stuff</div>
            <Link href="/" className="inline-block">
              <span className="font-bold text-3xl tracking-tight text-[#1c1412]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>CQS</span>
            </Link>
          </div>

          <div className="card p-8">
            <h1 className="text-xl font-bold tracking-tight text-[#1c1412] mb-1">Choose your path</h1>
            <p className="text-[13px] text-[#9b8c7a] mb-8">Join as a creator or as a Barbershopper</p>

            <div className="space-y-3">
              <button
                onClick={() => setAccountType('group')}
                className="w-full p-4 border-2 border-[#e8e0d8] hover:border-[#1c1412] hover:bg-[#faf9f7] transition text-left"
                style={{ borderRadius: 4 }}
              >
                <div className="font-semibold text-[#1c1412]">My Studio</div>
                <p className="text-[12px] text-[#9b8c7a] mt-0.5">Create and sell custom merch for your group</p>
              </button>

              <button
                onClick={() => setAccountType('customer')}
                className="w-full p-4 border-2 border-[#e8e0d8] hover:border-[#1c1412] hover:bg-[#faf9f7] transition text-left"
                style={{ borderRadius: 4 }}
              >
                <div className="font-semibold text-[#1c1412]">Barbershopper</div>
                <p className="text-[12px] text-[#9b8c7a] mt-0.5">Shop, follow groups, and discover the Barber Feed</p>
              </button>
            </div>

            <p className="text-[11px] text-center mt-6 text-[#9b8c7a]">
              You can always change your path later
            </p>
          </div>

          <p className="text-center text-[13px] mt-6 text-[#9b8c7a]">
            Already have access? <Link href="/login" className="text-[#1c1412] underline underline-offset-2">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f7f5f2]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="eyebrow mb-3">Custom Quartet Stuff</div>
          <Link href="/" className="inline-block">
            <span className="font-bold text-3xl tracking-tight text-[#1c1412]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>CQS</span>
          </Link>
        </div>

        <div className="card p-8">
          <button
            onClick={() => setAccountType(null)}
            className="text-[12px] text-[#9b8c7a] hover:text-[#1c1412] mb-4 flex items-center gap-1"
          >
            ← Back
          </button>

          <h1 className="text-xl font-bold tracking-tight text-[#1c1412] mb-1">
            {accountType === 'group' ? 'Create your studio' : 'Join as a Barbershopper'}
          </h1>
          <p className="text-[13px] text-[#9b8c7a] mb-7">
            {accountType === 'group'
              ? 'Private workspace for your group'
              : 'Shop, follow groups, and explore the Barber Feed'}
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
            {accountType === 'group' ? (
              <>
                {/* Group type selector */}
                <div>
                  <label className="eyebrow block mb-2">We are a…</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GROUP_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setGroupType(type)}
                        className={`py-3 border-2 font-medium capitalize transition-all text-[13px] ${
                          groupType === type
                            ? 'border-[#1c1412] bg-[#1c1412] text-white'
                            : 'border-[#e8e0d8] text-[#9b8c7a] hover:border-[#1c1412] bg-white'
                        }`}
                        style={{ borderRadius: 4 }}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="eyebrow block mb-1.5">{label} Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                    style={{ borderRadius: 4 }}
                    placeholder={
                      groupType === 'chorus' ? 'The Harmony Chorus'
                        : groupType === 'district' ? 'Sunshine District'
                        : groupType === 'region' ? 'Pioneer Region'
                        : groupType === 'other' ? 'Your group name'
                        : 'The Harmony Kings'
                    }
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="eyebrow block mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                  style={{ borderRadius: 4 }}
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="eyebrow block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                style={{ borderRadius: 4 }}
                placeholder={accountType === 'group' ? 'contact@yourgroup.com' : 'your@email.com'}
              />
            </div>

            <div>
              <label className="eyebrow block mb-1.5">Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                style={{ borderRadius: 4 }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 disabled:opacity-60 mt-2"
            >
              {loading
                ? (accountType === 'group' ? 'Creating studio…' : 'Creating account…')
                : (accountType === 'group' ? `Create my ${label} studio` : 'Become a Barbershopper')
              }
            </button>
          </form>

          <p className="text-[11px] text-center mt-4 text-[#9b8c7a]">
            You'll receive a confirmation email. Magic links also supported.
          </p>
        </div>

        <p className="text-center text-[13px] mt-6 text-[#9b8c7a]">
          Already have access? <Link href="/login" className="text-[#1c1412] underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

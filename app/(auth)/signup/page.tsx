'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { GROUP_TYPES, type GroupType, groupLabel } from '@/lib/group-type'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState<GroupType>('quartet')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const name = groupName.trim() || `My ${groupLabel(groupType)}`

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { quartet_name: name, group_type: groupType },
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

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f7f5f2]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="eyebrow mb-3">Custom Quartet Stuff</div>
          <Link href="/" className="inline-block">
            <span className="font-bold text-3xl tracking-tight text-[#1c1412]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>CQS Studio</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold tracking-tight text-[#1c1412] mb-1">Create your studio</h1>
          <p className="text-[13px] text-[#9b8c7a] mb-7">Private workspace for your group</p>

          <form onSubmit={handleSignup} className="space-y-4">
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

            <div>
              <label className="eyebrow block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                style={{ borderRadius: 4 }}
                placeholder="contact@yourgroup.com"
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
              {loading ? 'Creating studio…' : `Create my ${label} studio`}
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

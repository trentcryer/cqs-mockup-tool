'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [quartetName, setQuartetName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { quartet_name: quartetName || 'My Quartet' },
      },
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account created! Check your email to confirm.', { duration: 6000 })
      // Supabase will create profile via trigger
      router.push('/login?confirmed=true')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f7f3ee]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[#1c1412]">
            <span className="font-semibold text-2xl tracking-tight">CQS Mockup Studio</span>
          </Link>
          <p className="text-[#6b5f54] mt-1 text-sm tracking-widest">CUSTOM QUARTET STUFF</p>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-semibold mb-1 tracking-tight">Create your studio</h1>
          <p className="text-sm text-[#6b5f54] mb-6">Private workspace for your quartet or chorus</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#9b1c1c] mb-1.5">Quartet / Chorus Name</label>
              <input
                type="text"
                value={quartetName}
                onChange={(e) => setQuartetName(e.target.value)}
                className="w-full border border-[#d4c5b0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#b8892a]"
                placeholder="The Harmony Kings"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-[#9b1c1c] mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#d4c5b0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#b8892a]"
                placeholder="contact@quartet.com"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-[#9b1c1c] mb-1.5">Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#d4c5b0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#b8892a]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl disabled:opacity-60 mt-2"
            >
              {loading ? 'Creating studio…' : 'Create my private studio'}
            </button>
          </form>

          <p className="text-[11px] text-center mt-4 text-[#8a7660]">
            You’ll receive a confirmation email. Magic links also supported.
          </p>
        </div>

        <p className="text-center text-sm mt-6 text-[#6b5f54]">
          Already have access? <Link href="/login" className="text-[#9b1c1c] underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

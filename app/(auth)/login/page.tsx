'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Welcome back!')
      router.push('/studio')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleMagicLink() {
    if (!email) {
      toast.error('Please enter your email first')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      toast.error(error.message)
    } else {
      setMagicSent(true)
      toast.success('Magic link sent! Check your inbox.')
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
          <h1 className="text-2xl font-semibold mb-1 tracking-tight">Welcome back</h1>
          <p className="text-sm text-[#6b5f54] mb-6">Sign in to your private quartet studio</p>

          {magicSent ? (
            <div className="text-center py-8">
              <p className="text-lg">Check your email for the magic link.</p>
              <button onClick={() => setMagicSent(false)} className="mt-4 text-sm underline">Use password instead</button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#9b1c1c] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-[#d4c5b0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#b8892a]"
                  placeholder="you@quartet.com"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-[#9b1c1c] mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-[#d4c5b0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#b8892a]"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 rounded-xl disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleMagicLink}
                  className="text-sm text-[#b8892a] hover:underline"
                >
                  Send magic link instead
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-6 text-[#6b5f54]">
          New here? <Link href="/signup" className="text-[#9b1c1c] underline">Create your quartet studio</Link>
        </p>
      </div>
    </div>
  )
}

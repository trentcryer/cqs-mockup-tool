'use client'

import { useState, useEffect } from 'react'
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

  // Dev switcher — only visible when ENABLE_DEV_SWITCHER=true is set server-side
  const [devCollections, setDevCollections] = useState<{ id: number; title: string }[]>([])
  const [devSelected, setDevSelected] = useState('')
  const [devSwitching, setDevSwitching] = useState(false)

  useEffect(() => {
    fetch('/api/dev/users')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.collections?.length) setDevCollections(data.collections) })
      .catch(() => {})
  }, [])

  async function handleDevSwitch() {
    if (!devSelected) return
    setDevSwitching(true)
    try {
      const res = await fetch('/api/dev/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: parseInt(devSelected) }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'No account linked to this collection yet')
        setDevSwitching(false)
      }
    } catch {
      toast.error('Dev switch failed')
      setDevSwitching(false)
    }
  }

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
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f7f5f2]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="eyebrow mb-3">Custom Quartet Stuff</div>
          <Link href="/" className="inline-block">
            <span className="font-bold text-3xl tracking-tight text-[#1c1412]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>CQS Studio</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold tracking-tight text-[#1c1412] mb-1">Welcome back</h1>
          <p className="text-[13px] text-[#9b8c7a] mb-7">Sign in to your private studio</p>

          {magicSent ? (
            <div className="text-center py-8">
              <p className="text-[15px] text-[#1c1412] font-medium">Check your email for the magic link.</p>
              <button onClick={() => setMagicSent(false)} className="mt-4 text-[13px] text-[#9b8c7a] underline">Use password instead</button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="eyebrow block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                  style={{ borderRadius: 4 }}
                  placeholder="you@quartet.com"
                />
              </div>

              <div>
                <label className="eyebrow block mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
                  style={{ borderRadius: 4 }}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleMagicLink}
                  className="text-[13px] text-[#9b8c7a] hover:text-[#1c1412] transition underline underline-offset-2"
                >
                  Send magic link instead
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[13px] mt-6 text-[#9b8c7a]">
          New here? <Link href="/signup" className="text-[#1c1412] underline underline-offset-2">Create your studio</Link>
        </p>

        {/* Dev switcher — only renders when ENABLE_DEV_SWITCHER=true */}
        {devCollections.length > 0 && (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5">
            <p className="text-[9px] uppercase tracking-[2px] font-bold text-amber-700 mb-3">
              ⚡ Dev Mode · Jump to Collection
            </p>
            <div className="flex gap-2">
              <select
                value={devSelected}
                onChange={e => setDevSelected(e.target.value)}
                className="flex-1 border border-amber-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-amber-400"
              >
                <option value="">Jump to Collection…</option>
                {devCollections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <button
                onClick={handleDevSwitch}
                disabled={!devSelected || devSwitching}
                className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 transition whitespace-nowrap"
              >
                {devSwitching ? '…' : 'Go →'}
              </button>
            </div>
            <p className="text-[9px] text-amber-600 mt-2">
              Logs you in as that group via magic link. Remove ENABLE_DEV_SWITCHER before launch.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

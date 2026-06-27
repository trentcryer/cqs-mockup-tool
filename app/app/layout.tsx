import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Home, Zap, ShoppingBag, User, LogOut } from 'lucide-react'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const accountType = (profile as any)?.account_type
  if (accountType !== 'customer') {
    redirect('/studio')
  }

  const displayName = (profile as any)?.display_name || 'Barbershopper'

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-3">
            <img src="/cqs-logo.png" alt="CQS" className="h-8 w-8 rounded" />
            <div>
              <div className="font-semibold text-base tracking-tight text-zinc-900">CQS</div>
              <div className="text-[8px] text-zinc-500 tracking-[1.5px] uppercase">Barber Shopping</div>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/app" className="flex items-center gap-2 px-3 py-2 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded transition text-sm">
              <Home size={16} /> Home
            </Link>
            <Link href="/app/barber-feed" className="flex items-center gap-2 px-3 py-2 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded transition text-sm">
              <Zap size={16} /> Barber Feed
            </Link>
            <Link href="/app/shop" className="flex items-center gap-2 px-3 py-2 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded transition text-sm">
              <ShoppingBag size={16} /> Shop
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right text-sm">
              <div className="font-medium text-zinc-900">{displayName}</div>
              <div className="text-xs text-zinc-500">{user.email}</div>
            </div>
            <Link href="/app/account" className="flex items-center gap-2 px-3 py-2 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded transition">
              <User size={18} />
            </Link>
            <form action="/auth/signout" method="POST">
              <button className="flex items-center gap-2 px-3 py-2 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded transition">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-zinc-600">
          <p>© 2025 CQS. Barber Shopping made easy.</p>
        </div>
      </footer>
    </div>
  )
}

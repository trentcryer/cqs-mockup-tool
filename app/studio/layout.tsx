// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LogOut, User } from 'lucide-react'

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
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

  const quartetName = (profile as any)?.quartet_name || 'My Quartet'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Studio Header */}
      <header className="cqs-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/studio" className="flex items-center gap-3">
              <img src="/cqs-logo.png" alt="CQS" className="h-9 w-9 rounded" />
              <div>
                <div className="font-semibold text-lg tracking-tight text-white">CQS Mockup Studio</div>
                <div className="text-[10px] text-[#b8892a] -mt-1">CUSTOM QUARTET STUFF</div>
              </div>
            </Link>
            <div className="ml-3 pl-3 border-l border-white/20 text-sm text-white/90">
              {quartetName}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/studio/catalog" className="text-white/90 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition">Browse Catalog</Link>
            <Link href="/studio" className="text-white/90 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition">My Studio</Link>
            <Link href="/admin" className="text-[#b8892a] hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition text-xs tracking-widest">ADMIN</Link>

            <form action="/auth/signout" method="POST">
              <button className="flex items-center gap-1.5 text-white/70 hover:text-white pl-3 border-l border-white/20">
                <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <footer className="text-center py-6 text-xs text-[#8a7660] border-t border-[#d4c5b0]">
        Private workspace for {quartetName} • Powered by Printful + Supabase
      </footer>
    </div>
  )
}

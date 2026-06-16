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

  const groupType: string = (profile as any)?.group_type || 'quartet'
  const groupLabel = groupType === 'chorus' ? 'Chorus' : 'Quartet'
  const groupName = (profile as any)?.quartet_name || `My ${groupLabel}`

  return (
    <div className="min-h-screen flex flex-col">
      {/* Studio Header */}
      <header className="cqs-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/studio" className="flex items-center gap-3">
              <img src="/cqs-logo.png" alt="CQS" className="h-8 w-8 rounded" />
              <div>
                <div className="font-semibold text-base tracking-tight text-white leading-tight">CQS Mockup Studio</div>
                <div className="text-[9px] text-white/40 tracking-[2.5px] uppercase">Custom Quartet Stuff</div>
              </div>
            </Link>
            <div className="pl-5 border-l border-white/15 text-sm text-white/60 font-medium">
              {groupName}
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm">
            <Link href="/studio/catalog" className="text-white/75 hover:text-white px-3 py-2 rounded hover:bg-white/8 transition text-[13px]">Catalog</Link>
            <Link href="/studio" className="text-white/75 hover:text-white px-3 py-2 rounded hover:bg-white/8 transition text-[13px]">My Studio</Link>
            <Link href="/studio/promote" className="text-white/75 hover:text-white px-3 py-2 rounded hover:bg-white/8 transition text-[13px]">Promote</Link>
            <Link href="/admin" className="text-white/40 hover:text-white/75 px-3 py-2 rounded hover:bg-white/8 transition text-[11px] tracking-[1.5px] uppercase ml-2">Admin</Link>

            <form action="/auth/signout" method="POST" className="ml-3 pl-3 border-l border-white/15">
              <button className="flex items-center gap-1.5 text-white/50 hover:text-white/90 transition text-[13px]">
                <LogOut size={14} /> <span className="hidden sm:inline">Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {children}
      </main>

      <footer className="text-center py-8 text-[11px] text-[#9b8c7a] border-t border-[#e8e0d8]">
        Private workspace · {groupName} · CQS
      </footer>
    </div>
  )
}

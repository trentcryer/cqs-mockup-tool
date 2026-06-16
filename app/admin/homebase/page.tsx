import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomebaseClient from './HomebaseClient'

export const dynamic = 'force-dynamic'

export default async function HombasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-semibold mb-2">Not authorized</h1>
          <p className="text-gray-500">This area is restricted to CQS administrators.</p>
        </div>
      </div>
    )
  }

  return <HomebaseClient />
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Get user's account type to determine redirect
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', user.id)
          .single()

        const accountType = (profile as any)?.account_type || 'group'
        const redirectPath = next ?? (accountType === 'customer' ? '/app' : '/studio')
        return NextResponse.redirect(`${origin}${redirectPath}`)
      }

      // Fallback if no user found
      const fallbackPath = next ?? '/studio'
      return NextResponse.redirect(`${origin}${fallbackPath}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

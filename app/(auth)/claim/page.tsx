import Link from 'next/link'
import ClaimForm from './ClaimForm'

export const metadata = {
  title: 'Activate your studio • Custom Quartet Stuff',
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; group?: string; email?: string }>
}) {
  const { token_hash = '', group = '', email = '' } = await searchParams

  const groupName = group.trim()

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
          {!token_hash ? (
            <>
              <h1 className="text-xl font-bold tracking-tight text-[#1c1412] mb-1">Link incomplete</h1>
              <p className="text-[13px] text-[#9b8c7a] mb-6">
                This activation link is missing its security token. Please use the most recent
                invite email, or ask CQS to resend it.
              </p>
              <Link href="/login" className="btn-secondary w-full py-3 inline-block text-center">
                Go to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight text-[#1c1412] mb-1">
                Set up your studio
              </h1>
              <p className="text-[13px] text-[#9b8c7a] mb-7">
                {groupName ? (
                  <>Create a password for <span className="font-semibold text-[#1c1412]">{groupName}</span>. Your designs and inventory are already waiting inside.</>
                ) : (
                  <>Create a password to access your group&apos;s studio. Your designs and inventory are already waiting inside.</>
                )}
              </p>

              <ClaimForm tokenHash={token_hash} email={email} />
            </>
          )}
        </div>

        <p className="text-center text-[13px] mt-6 text-[#9b8c7a]">
          Already set a password? <Link href="/login" className="text-[#1c1412] underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

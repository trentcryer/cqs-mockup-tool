'use client'

import { useActionState } from 'react'
import { activateAccount, type ClaimState } from './actions'

export default function ClaimForm({
  tokenHash,
  email,
}: {
  tokenHash: string
  email: string
}) {
  const [state, formAction, pending] = useActionState<ClaimState, FormData>(
    activateAccount,
    {}
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />

      {email && (
        <div>
          <label className="eyebrow block mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            readOnly
            disabled
            className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] bg-[#f0ece6] text-[#6b5f54] cursor-not-allowed"
            style={{ borderRadius: 4 }}
          />
        </div>
      )}

      <div>
        <label className="eyebrow block mb-1.5">Create Password (min 6 chars)</label>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoFocus
          className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
          style={{ borderRadius: 4 }}
        />
      </div>

      <div>
        <label className="eyebrow block mb-1.5">Confirm Password</label>
        <input
          type="password"
          name="confirm"
          required
          minLength={6}
          className="w-full border border-[#e8e0d8] px-4 py-3 text-[14px] focus:outline-none focus:border-[#1c1412] bg-[#faf9f7]"
          style={{ borderRadius: 4 }}
        />
      </div>

      {state.error && (
        <p className="text-[13px] text-[#9b1c1c] bg-[#fbeaea] border border-[#e8c5c5] px-3 py-2" style={{ borderRadius: 4 }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full py-3.5 disabled:opacity-60 mt-2"
      >
        {pending ? 'Activating studio…' : 'Activate Studio →'}
      </button>
    </form>
  )
}

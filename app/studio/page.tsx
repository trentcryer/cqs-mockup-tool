// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit2, Trash2, Send } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { sendReviewRequestEmail } from '@/lib/resend'

export default async function MyStudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: logosRaw } = await supabase.from('logos').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  const { data: designs } = await supabase.from('designs').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  // Generate signed URLs for private storage bucket so logo thumbnails actually display
  const logos = await Promise.all((logosRaw || []).map(async (logo: any) => {
    const { data: signed } = await supabase.storage
      .from('cqs-assets')
      .createSignedUrl(logo.storage_path, 60 * 60) // 1 hour
    return {
      ...logo,
      displayUrl: signed?.signedUrl || null,
    }
  }))

  // Server action: update quartet name
  async function updateQuartetName(formData: FormData) {
    'use server'
    const name = formData.get('quartet_name') as string
    const sb = await createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) return
    await (sb.from('profiles') as any).update({ quartet_name: name.trim() || 'My Quartet', updated_at: new Date().toISOString() }).eq('id', u.id)
    revalidatePath('/studio')
  }

  // Server action: request review (sends email + updates status)
  async function requestReview(designId: string) {
    'use server'
    const sb = await createClient()
    const admin = createAdminClient()

    const { data: design } = await sb.from('designs').select('*').eq('id', designId).single()
    if (!design) return

    const { data: prof } = await (sb.from('profiles') as any).select('email, quartet_name').eq('id', (design as any).user_id).single()

    const trentEmail = process.env.TRENT_EMAIL || 'trent@example.com'

    await (admin.from('designs') as any).update({ status: 'review_requested' }).eq('id', designId)

    try {
      await sendReviewRequestEmail({
        to: trentEmail,
        quartetName: prof?.quartet_name || (design as any).quartet_name || 'A quartet',
        userEmail: prof?.email || user?.email || 'unknown',
        designId,
        productTitle: (design as any).product_title,
        placement: (design as any).placement,
        color: (design as any).color,
        notes: (design as any).notes,
        mockupUrls: ((design as any).mockup_urls as any[])?.map((m: any) => m.mockup_url) || [],
      })
    } catch (e) {
      console.error('Email send failed', e)
    }

    revalidatePath('/studio')
    revalidatePath('/admin')
  }

  async function deleteDesign(designId: string) {
    'use server'
    const sb = await createClient()
    await sb.from('designs').delete().eq('id', designId)
    revalidatePath('/studio')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="uppercase text-xs tracking-[2px] text-[#9b1c1c]">Private Workspace</div>
          <h1 className="text-4xl font-semibold tracking-tight text-[#1c1412]">My Quartet Studio</h1>
        </div>
        <Link href="/studio/catalog" className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 text-sm">
          <Plus size={18} /> New Design from Catalog
        </Link>
      </div>

      {/* Quartet name editor */}
      <div className="card p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="font-medium text-sm text-[#9b1c1c] uppercase tracking-widest w-40">Quartet Name</div>
        <form action={updateQuartetName} className="flex-1 flex gap-3">
          <input
            name="quartet_name"
            defaultValue={(profile as any)?.quartet_name || 'My Quartet'}
            className="flex-1 border border-[#d4c5b0] rounded-lg px-4 py-2 text-lg font-medium focus:border-[#b8892a] outline-none"
          />
          <button type="submit" className="btn-secondary px-6 rounded-lg">Save</button>
        </form>
      </div>

      {/* Logo Library */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-lg tracking-tight">My Logo Library</div>
          <Link href="/studio/catalog" className="text-sm flex items-center gap-1 text-[#9b1c1c] hover:underline">+ Start new design (adds logo when saved)</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {logos && logos.length > 0 ? logos.map((logo: any) => (
            <div key={logo.id} className="card p-3 group flex flex-col">
              <div className="aspect-square bg-[#f9f6f0] rounded flex items-center justify-center overflow-hidden mb-2">
                {logo.displayUrl ? (
                  <img
                    src={logo.displayUrl}
                    alt={logo.filename}
                    className="max-h-[110px] object-contain"
                  />
                ) : (
                  <div className="text-xs text-[#b8892a]">Logo unavailable</div>
                )}
              </div>
              <div className="text-xs truncate text-[#6b5f54] mb-2">{logo.filename}</div>
              <Link
                href="/studio/catalog"
                className="mt-auto text-[10px] text-center bg-[#f9f6f0] hover:bg-[#b8892a] hover:text-white transition text-[#9b1c1c] py-1.5 rounded-lg border border-[#d4c5b0]"
              >
                Use for new design →
              </Link>
            </div>
          )) : (
            <div className="col-span-full text-sm text-[#6b5f54] py-4">No logos yet. Upload your first one when creating a design.</div>
          )}
        </div>
      </div>

      {/* My Designs */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <div className="font-semibold text-lg tracking-tight">My Designs &amp; Mockups</div>
          <div className="text-xs text-[#8a7660]">{designs?.length || 0} total</div>
        </div>

        {designs && designs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {designs.map((d: any) => {
              const status = d.status
              const mockups = (d.mockup_urls as any[]) || []
              const firstMock = mockups[0]?.mockup_url

              return (
                <div key={d.id} className="card overflow-hidden flex flex-col">
                  <div className="h-48 bg-[#f9f6f0] relative flex items-center justify-center">
                    {firstMock ? (
                      <img src={firstMock} alt={d.product_title} className="max-h-full object-contain" />
                    ) : (
                      <div className="text-center text-[#b8892a] text-sm tracking-widest">NO MOCKUP YET<br />Open editor to generate</div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={`badge badge-${status === 'review_requested' ? 'review' : status === 'approved' ? 'approved' : status === 'pushed_to_shopify' ? 'pushed' : 'draft'}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <div>
                      <div className="font-semibold tracking-tight">{d.product_title}</div>
                      <div className="text-sm text-[#6b5f54]">{d.color || '—'} • {d.placement}</div>
                    </div>

                    {d.notes && <div className="mt-2 text-xs line-clamp-2 text-[#6b5f54] italic">“{d.notes}”</div>}

                    <div className="mt-auto pt-4 flex gap-2 flex-wrap">
                      <Link href={`/studio/editor?designId=${d.id}`} className="btn-secondary flex-1 text-center py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs">
                        <Edit2 size={14} /> Edit
                      </Link>

                      {status === 'draft' && (
                        <form action={async () => { 'use server'; await requestReview(d.id) }}>
                          <button className="btn-primary flex-1 text-center py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs">
                            <Send size={14} /> Request Review
                          </button>
                        </form>
                      )}

                      <form action={async () => { 'use server'; await deleteDesign(d.id) }}>
                        <button className="p-2 text-[#9b1c1c] hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </form>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <p className="text-lg mb-4">No designs yet.</p>
            <Link href="/studio/catalog" className="btn-primary inline-block px-8 py-3 rounded-xl">Browse the catalog and create your first mockup</Link>
          </div>
        )}
      </div>
    </div>
  )
}

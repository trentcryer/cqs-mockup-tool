'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageIcon, X, Check } from 'lucide-react'

interface SavedLogo {
  id: string
  filename: string
  storagePath: string
  displayUrl: string | null
}

interface Props {
  groupName: string
  profileLogoUrl: string | null
  userId: string
}

async function updateProfileLogo(storagePath: string) {
  const res = await fetch('/api/studio/profile-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  })
  return res.ok
}

export function GroupLogoButton({ groupName, profileLogoUrl, userId }: Props) {
  const [open, setOpen] = useState(false)
  const [logos, setLogos] = useState<SavedLogo[]>([])
  const [currentUrl, setCurrentUrl] = useState<string | null>(profileLogoUrl)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function loadLogos() {
    const { data } = await supabase
      .from('logos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!data?.length) return

    const paths = data.map((l: any) => l.storage_path)
    const { data: signed } = await supabase.storage
      .from('cqs-assets')
      .createSignedUrls(paths, 3600)
    const signedMap: Record<string, string> = {}
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
    }
    setLogos(data.map((l: any) => ({
      id: l.id,
      filename: l.filename,
      storagePath: l.storage_path,
      displayUrl: signedMap[l.storage_path] ?? null,
    })))
  }

  useEffect(() => {
    if (open) loadLogos()
  }, [open])

  async function selectLogo(logo: SavedLogo) {
    setSaving(true)
    const ok = await updateProfileLogo(logo.storagePath)
    if (ok) setCurrentUrl(logo.displayUrl)
    setSaving(false)
    setOpen(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `logos/${userId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('cqs-assets').upload(path, file, { upsert: true })
    if (!error) {
      await supabase.from('logos').insert({ user_id: userId, storage_path: path, filename: file.name })
      const ok = await updateProfileLogo(path)
      if (ok) {
        const { data: signed } = await supabase.storage.from('cqs-assets').createSignedUrls([path], 3600)
        const url = signed?.[0]?.signedUrl ?? null
        setCurrentUrl(url)
      }
    }
    setUploading(false)
    setOpen(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pl-5 border-l border-white/15 flex items-center gap-2.5 group"
        title="Change group logo"
      >
        <div className="w-7 h-7 rounded overflow-hidden bg-white/10 flex items-center justify-center shrink-0 group-hover:ring-2 ring-white/30 transition-all">
          {currentUrl
            ? <img src={currentUrl} alt={groupName} className="w-full h-full object-contain p-0.5" />
            : <span className="text-[11px] font-bold text-white/50 leading-none">{groupName[0]?.toUpperCase() ?? '?'}</span>
          }
        </div>
        <span className="text-sm text-white/60 font-medium group-hover:text-white/80 transition">{groupName}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="bg-white w-full max-w-md shadow-2xl overflow-hidden"
            style={{ borderRadius: 6 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0ece6]">
              <div>
                <p className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold mb-0.5">Group Profile</p>
                <h3 className="text-lg font-semibold text-[#1c1412] tracking-tight">Set Your Group Logo</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#9b8c7a] hover:text-[#1c1412] transition p-1">
                <X size={18} />
              </button>
            </div>

            {/* Logo library */}
            <div className="px-6 py-5 max-h-72 overflow-y-auto">
              {logos.length === 0 ? (
                <p className="text-sm text-[#9b8c7a] text-center py-4">No logos uploaded yet.</p>
              ) : (
                <>
                  <p className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold mb-3">Your Logo Library</p>
                  <div className="grid grid-cols-4 gap-3">
                    {logos.map(logo => {
                      const isCurrent = logo.displayUrl === currentUrl
                      return (
                        <button
                          key={logo.id}
                          onClick={() => selectLogo(logo)}
                          disabled={saving}
                          className={`relative aspect-square bg-[#f7f5f2] overflow-hidden transition-all border-2 ${
                            isCurrent ? 'border-[#1c1412]' : 'border-transparent hover:border-[#1c1412]/30'
                          }`}
                          style={{ borderRadius: 4 }}
                          title={logo.filename}
                        >
                          {logo.displayUrl
                            ? <img src={logo.displayUrl} alt={logo.filename} className="w-full h-full object-contain p-2" />
                            : <div className="w-full h-full flex items-center justify-center text-[#c4b49f] text-[10px]">?</div>
                          }
                          {isCurrent && (
                            <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#1c1412] rounded-full flex items-center justify-center">
                              <Check size={9} className="text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Upload new */}
            <div className="px-6 pb-6">
              <p className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold mb-3">Upload New Logo</p>
              <label className="flex items-center gap-3 border-2 border-dashed border-[#d4c5b0] px-4 py-3 cursor-pointer hover:border-[#1c1412] hover:bg-[#f7f5f2] transition-all">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                <div className="w-8 h-8 bg-[#f0ece6] flex items-center justify-center shrink-0">
                  <ImageIcon size={16} className="text-[#9b8c7a]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1c1412]">{uploading ? 'Uploading…' : 'Upload a logo'}</div>
                  <div className="text-xs text-[#8a7660] mt-0.5">PNG, JPG, SVG</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

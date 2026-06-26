'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface FacebookPageSelectorProps {
  pageId: string | null
  pageName: string | null
}

export default function FacebookPageSelector({ pageId, pageName }: FacebookPageSelectorProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([])
  const [selectedPageId, setSelectedPageId] = useState<string | null>(pageId)
  const [isSavingPage, setIsSavingPage] = useState(false)

  async function connectFacebook() {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/auth/facebook/login')
      const data = await res.json()
      if (data.loginUrl) {
        window.location.href = data.loginUrl
      } else {
        toast.error('Failed to get Facebook login URL')
      }
    } catch (e: any) {
      toast.error('Connection failed: ' + e.message)
      setIsConnecting(false)
    }
  }

  async function disconnectFacebook() {
    try {
      const res = await fetch('/api/admin/facebook/disconnect', {
        method: 'POST',
      })
      if (res.ok) {
        setSelectedPageId(null)
        setPages([])
        toast.success('Facebook disconnected')
      } else {
        toast.error('Failed to disconnect')
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    }
  }

  async function savePageSelection(newPageId: string) {
    setIsSavingPage(true)
    try {
      const res = await fetch('/api/admin/facebook/set-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: newPageId }),
      })
      if (res.ok) {
        setSelectedPageId(newPageId)
        toast.success('Default page updated')
      } else {
        toast.error('Failed to save page selection')
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setIsSavingPage(false)
    }
  }

  if (!pageId) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">📘 Facebook</h3>
            <p className="text-xs text-zinc-400">Connect your Facebook account to post directly to your page.</p>
          </div>
          <button
            onClick={connectFacebook}
            disabled={isConnecting}
            className="w-full px-4 py-2.5 bg-[#1877f2] hover:bg-[#165ee3] text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Facebook Page'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">📘 Facebook</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Default page: <span className="text-white font-medium">{pageName}</span></p>
          </div>
          <button
            onClick={disconnectFacebook}
            className="text-xs text-zinc-400 hover:text-red-400 transition"
          >
            Disconnect
          </button>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500 block mb-2">Change Default Page</label>
          <p className="text-xs text-zinc-400 mb-2">Your pages will load here when you reconnect.</p>
          <button
            onClick={connectFacebook}
            disabled={isConnecting}
            className="w-full px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition disabled:opacity-50"
          >
            {isConnecting ? 'Loading...' : 'Refresh Pages'}
          </button>
        </div>
      </div>
    </div>
  )
}

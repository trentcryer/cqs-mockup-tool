'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import PostCreator from '@/components/barber-feed/PostCreator'
import { BarberFeedPost } from '@/types/barber-feed'

export default function CreatePostPage() {
  const [postCreated, setPostCreated] = useState(false)

  const handlePostCreated = (post: BarberFeedPost) => {
    setPostCreated(true)
    toast.success('Post created and shared! 🎉')
    setTimeout(() => {
      window.location.href = '/studio/barber-feed'
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/studio/barber-feed" className="flex items-center gap-1 text-sm text-[#9b8c7a] hover:text-[#1c1412]">
          <ArrowLeft size={16} /> Back to Feed
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1c1412]">Create a Post</h1>
        <p className="text-sm text-[#9b8c7a] mt-2">Share videos and images to the Barber Feed and your social media</p>
      </div>

      {/* PostCreator Modal - shown as main content */}
      <PostCreator
        open={true}
        onOpenChange={() => {
          window.location.href = '/studio/barber-feed'
        }}
        onPostCreated={handlePostCreated}
      />
    </div>
  )
}

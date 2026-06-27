'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { BarberFeedPost, BarberFeedResponse } from '@/types/barber-feed'

export default function BarberFeedPage() {
  const [posts, setPosts] = useState<BarberFeedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const LIMIT = 20

  const fetchFeed = useCallback(async (currentOffset: number, currentLimit: number): Promise<BarberFeedResponse> => {
    const res = await fetch(`/api/barber-feed/posts/feed?limit=${currentLimit}&offset=${currentOffset}`)
    if (!res.ok) throw new Error('Failed to fetch feed')
    return res.json()
  }, [])

  const handleLike = useCallback(async (postId: string) => {
    try {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: !p.liked_by_user, like_count: p.liked_by_user ? p.like_count - 1 : p.like_count + 1 }
            : p
        )
      )

      const res = await fetch('/api/barber-feed/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      })
      if (!res.ok) throw new Error('Failed to like')
    } catch {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: !p.liked_by_user, like_count: p.liked_by_user ? p.like_count - 1 : p.like_count + 1 }
            : p
        )
      )
      toast.error('Could not like post')
    }
  }, [])

  const handleShare = useCallback(async (post: BarberFeedPost) => {
    try {
      // Generate pre-written caption
      const caption = `Just discovered this fire new app from @CQS! 🔥\n\nBrowse the latest apparel drops from my favorite groups + catch the Barber Feed. All in one place.\n\nDownload now and join the community! 🎵\n\n#CQS #BarberShopping #BarbershopQuartets`

      // Try native share if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Check out this post on CQS`,
            text: caption,
            url: `${window.location.origin}/app/barber-feed/${post.id}`,
          })
          return
        } catch (e) {
          // User cancelled or share failed, continue to copy
        }
      }

      // Fallback: copy to clipboard
      const shareUrl = `${window.location.origin}/app/barber-feed/${post.id}`
      const fullText = `${caption}\n\n${shareUrl}`
      navigator.clipboard.writeText(fullText)
      toast.success('Post link and caption copied! Share on your socials to support this creator 🎵')
    } catch {
      toast.error('Could not share post')
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      const data = await fetchFeed(offset, LIMIT)
      setPosts(prev => [...prev, ...data.posts])
      setHasMore(data.has_more)
      setOffset(prev => prev + LIMIT)
    } catch {
      setError('Failed to load more posts')
    } finally {
      setIsLoading(false)
    }
  }, [offset, hasMore, isLoading, fetchFeed])

  const handleInfiniteScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 200
    ) {
      loadMore()
    }
  }, [loadMore])

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchFeed(0, LIMIT)
        setPosts(data.posts)
        setHasMore(data.has_more)
        setOffset(LIMIT)
      } catch {
        setError('Could not load the feed. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    loadInitial()
  }, [fetchFeed])

  useEffect(() => {
    window.addEventListener('scroll', handleInfiniteScroll)
    return () => window.removeEventListener('scroll', handleInfiniteScroll)
  }, [handleInfiniteScroll])

  if (error && posts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Barber Feed</h1>
          <p className="text-zinc-600 mt-1">Discover what your favorite groups are up to</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {isLoading && posts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonGrid count={6} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-2xl text-zinc-400">No posts yet.</p>
          <p className="text-zinc-500 mt-2">Follow some groups to see their posts here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-400 transition">
              {/* Media */}
              <div className="relative aspect-video bg-zinc-200 overflow-hidden group">
                {post.media_public_url && (
                  <img
                    src={post.media_public_url}
                    alt={post.caption}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                )}
                {/* View count */}
                <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 text-xs text-white">
                  {post.view_count.toLocaleString()} views
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-sm text-zinc-700 line-clamp-2 mb-3">{post.caption}</p>

                {/* Actions */}
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1 hover:text-red-600 transition"
                  >
                    ❤️ {post.like_count}
                  </button>
                  <button
                    onClick={() => handleShare(post)}
                    className="flex items-center gap-1 hover:text-blue-600 transition"
                  >
                    <Share2 size={14} /> {post.share_count}
                  </button>
                </div>

                {/* Share message */}
                <p className="text-[10px] text-zinc-400 mt-3 italic">
                  Click share to support this creator 🎵
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && posts.length > 0 && (
        <div className="flex justify-center py-8">
          <RefreshCw className="animate-spin text-zinc-400" size={24} />
        </div>
      )}
    </div>
  )
}

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-zinc-100 rounded-lg overflow-hidden animate-pulse">
          <div className="aspect-video bg-zinc-200" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-zinc-200 rounded w-3/4" />
            <div className="h-3 bg-zinc-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  )
}

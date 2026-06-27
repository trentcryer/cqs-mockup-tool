'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Video } from 'lucide-react';
import { toast } from 'sonner';
import { BarberFeedPost, BarberFeedResponse } from '@/types/barber-feed';
import FeedPost from '@/components/barber-feed/FeedPost';

export default function BarberFeedPage() {
  const [posts, setPosts] = useState<BarberFeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchFeed = useCallback(async (currentOffset: number, currentLimit: number): Promise<BarberFeedResponse> => {
    const res = await fetch(`/api/barber-feed/posts/feed?limit=${currentLimit}&offset=${currentOffset}`);
    if (!res.ok) throw new Error('Failed to fetch feed');
    return res.json();
  }, []);

  const handleLike = useCallback(async (postId: string) => {
    try {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: !p.liked_by_user, like_count: p.liked_by_user ? p.like_count - 1 : p.like_count + 1 }
            : p
        )
      );

      const res = await fetch('/api/barber-feed/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error('Failed to like');
    } catch {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: !p.liked_by_user, like_count: p.liked_by_user ? p.like_count - 1 : p.like_count + 1 }
            : p
        )
      );
      toast.error('Could not like post');
    }
  }, []);

  const handleShare = useCallback(async (postId: string) => {
    try {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, shared_by_user: !p.shared_by_user, share_count: p.shared_by_user ? p.share_count - 1 : p.share_count + 1 }
            : p
        )
      );

      const res = await fetch('/api/barber-feed/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error('Failed to share');
      toast.success('Post shared!');
    } catch {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, shared_by_user: !p.shared_by_user, share_count: p.shared_by_user ? p.share_count - 1 : p.share_count + 1 }
            : p
        )
      );
      toast.error('Could not share post');
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const data = await fetchFeed(offset, LIMIT);
      setPosts(prev => [...prev, ...data.posts]);
      setHasMore(data.has_more);
      setOffset(prev => prev + LIMIT);
    } catch (err) {
      setError('Failed to load more posts');
    } finally {
      setIsLoading(false);
    }
  }, [offset, hasMore, isLoading, fetchFeed]);

  const handleInfiniteScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 200
    ) {
      loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchFeed(0, LIMIT);
        setPosts(data.posts);
        setHasMore(data.has_more);
        setOffset(LIMIT);
      } catch (err) {
        setError('Could not load the feed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitial();
  }, [fetchFeed]);

  useEffect(() => {
    window.addEventListener('scroll', handleInfiniteScroll);
    return () => window.removeEventListener('scroll', handleInfiniteScroll);
  }, [handleInfiniteScroll]);

  if (error && posts.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <Link href="/studio" className="hover:text-white">My Studio</Link>
          <span>/</span>
          <span className="text-white font-medium">Barber Feed</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Barber Feed</h1>
            <p className="text-zinc-400 mt-1">Discover harmony from groups across the world</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/studio/post" className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl text-sm font-medium transition">
              <Video size={16} /> Create Post
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Feed Container */}
        {isLoading && posts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonGrid count={6} />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-zinc-400">No posts yet.</p>
            <p className="text-zinc-500 mt-2">Be the first to share something amazing!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <FeedPost
                key={post.id}
                post={post}
                onLike={handleLike}
                onShare={handleShare}
              />
            ))}
          </div>
        )}

        {isLoading && posts.length > 0 && (
          <div className="flex justify-center mt-8">
            <RefreshCw className="animate-spin" size={24} />
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 animate-pulse">
          <div className="aspect-video bg-zinc-800" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-1/3" />
            <div className="h-3 bg-zinc-800 rounded w-2/3" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}
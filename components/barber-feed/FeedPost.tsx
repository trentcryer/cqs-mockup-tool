'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Share2 } from 'lucide-react';
import { BarberFeedPost } from '@/types/barber-feed';

interface FeedPostProps {
  post: BarberFeedPost;
  onLike: (postId: string) => Promise<void>;
  onShare: (postId: string) => Promise<void>;
  onProductClick?: (productId: number) => void;
}

export default function FeedPost({ post, onLike, onShare, onProductClick }: FeedPostProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    try {
      await onLike(post.id);
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSharing) return;
    setIsSharing(true);
    try {
      await onShare(post.id);
    } finally {
      setIsSharing(false);
    }
  };

  const handleProductClick = () => {
    if (post.product_id && onProductClick) {
      onProductClick(post.product_id);
    }
  };

  const timeAgo = (date: string) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return postDate.toLocaleDateString();
  };

  return (
    <div className="group bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-200">
      {/* Group Header */}
      <div className="flex items-center gap-3 p-4">
        <Link href={`/studio/groups/${post.group_id}`} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
            {post.group_avatar_url ? (
              <img src={post.group_avatar_url} alt={post.group_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-700" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm text-white">{post.group_name}</div>
            <div className="text-[10px] text-zinc-500">{timeAgo(post.created_at)}</div>
          </div>
        </Link>
      </div>

      {/* Media */}
      <div className="relative aspect-video bg-zinc-950 overflow-hidden">
        {post.content_type === 'video' ? (
          <video
            src={post.media_public_url || post.media_url}
            className="w-full h-full object-cover"
            controls={false}
            muted
            playsInline
          />
        ) : (
          <img
            src={post.media_public_url || post.media_url}
            alt={post.caption || 'Barber feed post'}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        )}

        {/* View count overlay */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white flex items-center gap-1">
          {post.view_count.toLocaleString()} views
        </div>

        {/* Product badge */}
        {post.product_id && post.product_title && (
          <div
            onClick={handleProductClick}
            className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] rounded font-medium cursor-pointer flex items-center gap-1 transition"
          >
            Shop {post.product_title}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {post.caption && (
          <p className="text-sm text-zinc-200 line-clamp-3 mb-3">{post.caption}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={isLiking}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-red-500 disabled:opacity-50 transition"
            >
              <Heart size={16} className={post.liked_by_user ? 'fill-red-500 text-red-500' : ''} />
              <span>{post.like_count}</span>
            </button>

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-blue-400 disabled:opacity-50 transition"
            >
              <Share2 size={16} />
              <span>{post.share_count}</span>
            </button>
          </div>

          <div className="text-zinc-500 tabular-nums">{post.view_count} views</div>
        </div>
      </div>
    </div>
  );
}

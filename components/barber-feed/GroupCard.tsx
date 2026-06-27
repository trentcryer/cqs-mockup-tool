'use client';

import React from 'react';
import Link from 'next/link';
import FollowButton from './FollowButton';

interface GroupCardProps {
  groupId: string;
  groupName: string;
  avatarUrl?: string;
  followerCount: number;
  isFollowing: boolean;
  onFollowChange: (isFollowing: boolean) => Promise<void>;
}

export default function GroupCard({
  groupId,
  groupName,
  avatarUrl,
  followerCount,
  isFollowing,
  onFollowChange,
}: GroupCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
      <Link href={`/groups/${groupId}`} className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden ring-1 ring-white/10">
          {avatarUrl ? (
            <img src={avatarUrl} alt={groupName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-700" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-white truncate">{groupName}</div>
          <div className="text-xs text-zinc-500">{followerCount.toLocaleString()} followers</div>
        </div>
      </Link>

      <div className="mt-auto">
        <FollowButton
          groupId={groupId}
          isFollowing={isFollowing}
          onFollowChange={onFollowChange}
        />
      </div>
    </div>
  );
}

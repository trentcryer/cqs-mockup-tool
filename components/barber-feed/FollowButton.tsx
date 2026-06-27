'use client';

import React, { useState } from 'react';
import { UserPlus, UserCheck } from 'lucide-react';

interface FollowButtonProps {
  groupId: string;
  isFollowing: boolean;
  onFollowChange: (isFollowing: boolean) => Promise<void>;
}

export default function FollowButton({ groupId, isFollowing, onFollowChange }: FollowButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) return;

    setIsPending(true);
    try {
      await onFollowChange(!isFollowing);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-60 ${
        isFollowing
          ? 'bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700'
          : 'bg-white text-zinc-900 border-white hover:bg-zinc-100'
      }`}
    >
      {isFollowing ? (
        <>
          <UserCheck size={15} /> Following
        </>
      ) : (
        <>
          <UserPlus size={15} /> Follow
        </>
      )}
    </button>
  );
}

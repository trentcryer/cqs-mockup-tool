'use client';

import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon, Video } from 'lucide-react';
import { SocialPlatform } from '@/types/social';
import { BarberFeedPost } from '@/types/barber-feed';

interface PostCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: (post: BarberFeedPost) => void;
  defaultProduct?: { id: number; title: string; image_url: string };
}

export default function PostCreator({
  open,
  onOpenChange,
  onPostCreated,
  defaultProduct,
}: PostCreatorProps) {
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(defaultProduct?.id || null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['barber-feed']);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_CAPTION = 500;
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  const availablePlatforms: SocialPlatform[] = [
    'barber-feed', 'facebook', 'instagram', 'tiktok', 'x', 'linkedin'
  ];

  if (!open) return null;

  const handleMediaUpload = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Max 100MB.');
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setError('Please upload an image or video file.');
      return;
    }

    setMediaFile(file);
    setError(null);

    const url = URL.createObjectURL(file);
    setMediaPreviewUrl(url);
  };

  const togglePlatform = (platform: SocialPlatform) => {
    if (platform === 'barber-feed') return; // Always required

    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePost = async () => {
    if (!mediaFile && !mediaPreviewUrl) {
      setError('Please upload media');
      return;
    }
    if (caption.length > MAX_CAPTION) {
      setError('Caption too long');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      let mediaUrl = mediaPreviewUrl || '';

      // Upload media to storage if not already uploaded
      if (mediaFile) {
        const formData = new FormData();
        formData.append('file', mediaFile);
        formData.append('bucketName', 'cqs-assets');
        formData.append('uploadPath', `barber-feed/${Date.now()}-${mediaFile.name}`);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('Upload failed');
        const uploadData = await uploadRes.json();
        mediaUrl = uploadData.publicUrl || uploadData.path;
      }

      if (!mediaUrl) throw new Error('Media URL not available');

      // Call the social posting API
      const postRes = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: caption || undefined,
          media_url: mediaUrl,
          content_type: mediaFile?.type.startsWith('video') ? 'video' : 'image',
          product_id: selectedProductId || undefined,
          product_title: defaultProduct?.title,
          platforms: selectedPlatforms,
        }),
      });

      if (!postRes.ok) throw new Error('Failed to create post');
      const postData = await postRes.json();

      // Create local post object for immediate UI update
      const newPost: BarberFeedPost = {
        id: postData.barber_feed_post_id || crypto.randomUUID(),
        group_id: 'current-group',
        group_name: 'Demo Group',
        content_type: mediaFile?.type.startsWith('video') ? 'video' : 'image',
        media_url: mediaUrl as string,
        media_public_url: mediaUrl as string,
        caption: caption || undefined,
        product_id: selectedProductId || undefined,
        product_title: defaultProduct?.title,
        view_count: 0,
        like_count: 0,
        share_count: 0,
        liked_by_user: false,
        shared_by_user: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onPostCreated(newPost);
      onOpenChange(false);

      // Reset form
      setCaption('');
      setMediaFile(null);
      setMediaPreviewUrl(null);
      setSelectedProductId(defaultProduct?.id || null);
      setSelectedPlatforms(['barber-feed']);
    } catch (e: any) {
      setError(e.message || 'Failed to create post');
    } finally {
      setIsUploading(false);
    }
  };

  const close = () => {
    if (!isUploading) onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4" onClick={close}>
      <div
        className="bg-zinc-900 text-white w-full max-w-3xl rounded-2xl overflow-hidden border border-zinc-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="font-semibold text-lg">Create Post</h3>
          <button onClick={close} disabled={isUploading} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Preview */}
          <div className="bg-zinc-950 p-6 flex items-center justify-center min-h-[320px]">
            {mediaPreviewUrl ? (
              mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreviewUrl} controls className="max-h-[280px] rounded-lg" />
              ) : (
                <img src={mediaPreviewUrl} alt="Preview" className="max-h-[280px] object-contain rounded-lg" />
              )
            ) : (
              <div className="text-center text-zinc-500">
                <Upload size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Upload image or video to preview</p>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {/* Media Upload */}
            <div>
              <label className="block text-xs font-semibold tracking-widest text-zinc-400 mb-2">MEDIA</label>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaUpload(file);
                }}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="flex items-center justify-center gap-2 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl py-4 cursor-pointer text-sm"
              >
                <ImageIcon size={18} /> Choose image or video
              </label>
              <p className="text-[10px] text-zinc-500 mt-1">Max 100MB • JPG, PNG, MP4</p>
            </div>

            {/* Caption */}
            <div>
              <label className="block text-xs font-semibold tracking-widest text-zinc-400 mb-2">CAPTION</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={MAX_CAPTION}
                rows={3}
                placeholder="Tell the story behind this post..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm resize-y focus:outline-none focus:border-zinc-500"
              />
              <div className="text-right text-[10px] text-zinc-500 mt-0.5">
                {caption.length}/{MAX_CAPTION}
              </div>
            </div>

            {/* Optional Product */}
            <div>
              <label className="block text-xs font-semibold tracking-widest text-zinc-400 mb-2">LINK PRODUCT (OPTIONAL)</label>
              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="">No product linked</option>
                {defaultProduct && (
                  <option value={defaultProduct.id}>{defaultProduct.title}</option>
                )}
              </select>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold tracking-widest text-zinc-400 mb-2">SHARE TO</label>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => {
                  const isChecked = selectedPlatforms.includes(platform);
                  const isBarberFeed = platform === 'barber-feed';
                  return (
                    <label
                      key={platform}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition ${
                        isChecked
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                      } ${isBarberFeed ? 'opacity-100' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isBarberFeed}
                        onChange={() => togglePlatform(platform)}
                        className="accent-white"
                      />
                      <span className="capitalize">{platform}</span>
                      {isBarberFeed && <span className="text-[10px] text-emerald-400">(default)</span>}
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Barber-Feed is always included</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                className="flex-1 py-2.5 text-sm border border-zinc-700 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={isUploading || !mediaFile}
                className="flex-1 py-2.5 text-sm bg-white text-black font-semibold rounded-xl disabled:opacity-60 hover:bg-zinc-200"
              >
                {isUploading ? 'Posting...' : 'Post Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

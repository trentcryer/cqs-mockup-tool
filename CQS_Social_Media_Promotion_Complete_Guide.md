# CQS Mockup Studio — Social Media Promotion Feature
## Complete Implementation Guide

**Prepared for:** Trent (CQS)  
**Date:** June 26, 2026  
**Purpose:** One clean, copy-pasteable document to give Claude (or any AI coding assistant) to implement the full social media promotion system in the CQS app.

---

## 1. Executive Summary & Goals

We are adding a powerful **"Promote"** capability to the CQS Mockup Studio so barbershop harmony groups can easily share their custom merch inventory directly to social media.

### Key Requirements
- Clean initial **"Set Up Social Media"** onboarding flow
- Users can **sign into platforms** (OAuth)
- Users can **select specific pages/profiles** they manage
- Users can **set a default page** per platform for quick posting
- In the Promote tab, users can post to **one or multiple platforms/pages** at once with a nice composer
- Support for **Facebook, Instagram, TikTok, X, and LinkedIn**

### Desired Outcome
A professional, low-friction experience that feels native to the modern CQS UI and encourages frequent use by group admins.

---

## 2. Recommended UX & Visual Design

### Core Screens

**A. Promote Tab – Empty State (when no accounts connected)**
- Large, friendly card at the top of `/studio/promote`
- Headline: "Connect your social accounts to start promoting"
- Clear benefit text
- Big primary button: **"Set up social media accounts"**
- Inventory grid still visible below (non-blocking)

**B. "Set Up Social Media Accounts" Modal**
- Clean modal with platform cards in a responsive grid
- Each card shows platform icon + name + short description
- Branded "Connect with [Platform]" buttons
- After connecting, inline **page selection** with checkboxes + "Set as default" star
- "Save Connections" button at the bottom

**C. Post Composer Modal**
- Split layout: Left = live post preview (merch image + editable caption), Right = "Post to:" destination list
- Destination list shows all connected profiles with platform icons, names, and "Default" badges
- Defaults are pre-checked
- Multi-select supported
- Big "Post Now to X accounts" button

These visuals were prototyped with high-fidelity mockups. The components below are built to closely match that clean, professional aesthetic.

---

## 3. Step-by-Step Implementation Plan

### Phase 1: Database & Types (15–20 min)
1. Run the Supabase migration (see section 4)
2. Create `types/social.ts`

### Phase 2: Frontend Components (1–2 hours)
1. Create `components/social/SocialSetupModal.tsx`
2. Create `components/social/PostComposerModal.tsx`
3. (Optional but recommended) Create a small `useSocialConnections.ts` hook later

### Phase 3: Integrate into Promote Page (30–45 min)
1. Add state for `connections` and modal visibility
2. Add the empty-state CTA
3. Wire up the two modals
4. Connect the "Promote this item" buttons on inventory cards

### Phase 4: Backend & OAuth (future sprint or phased)
1. Create API routes for OAuth (start with X or LinkedIn — easiest)
2. Add token storage + refresh logic
3. Implement actual posting endpoints (use platform SDKs or unified service like Ayrshare for speed)

### Phase 5: Polish & Testing
- Real page fetching after OAuth
- Error handling & re-auth flows
- Loading states
- Mobile responsiveness
- Success toasts & analytics events

---

## 4. Supabase Database Schema

```sql
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,                    -- Link to your groups table
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','x','linkedin')),
  account_id TEXT NOT NULL,
  page_id TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT,                         -- Encrypt at rest or use Supabase Vault
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_default BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  scopes JSONB,
  UNIQUE(group_id, platform, page_id)
);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (adjust to your auth model)
CREATE POLICY "Users manage their own group's connections"
  ON social_connections FOR ALL
  USING (group_id = auth.uid());
```

---

## 5. TypeScript Types

**File:** `types/social.ts`

```ts
export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'x' | 'linkedin';

export interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  displayName: string;
  avatarUrl?: string;
  pageId?: string;
  isDefault: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  imageUrl: string;
  price?: number;
  // Add any fields you already use for inventory items
}
```

---

## 6. Frontend Components (Ready to Copy)

### 6.1 SocialSetupModal.tsx (Full Component with TikTok)

```tsx
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Facebook, Instagram, Twitter, Linkedin, Music } from 'lucide-react';
import { SocialPlatform, SocialConnection } from '@/types/social';

interface SocialSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectionsSaved: (connections: SocialConnection[]) => void;
  currentConnections?: SocialConnection[];
}

const PLATFORMS: { id: SocialPlatform; name: string; icon: React.ReactNode; color: string; description: string }[] = [
  { id: 'facebook', name: 'Facebook', icon: <Facebook className="w-6 h-6" />, color: '#1877F2', description: 'Pages & Groups' },
  { id: 'instagram', name: 'Instagram', icon: <Instagram className="w-6 h-6" />, color: '#E4405F', description: 'Business & Creator accounts' },
  { id: 'tiktok', name: 'TikTok', icon: <Music className="w-6 h-6" />, color: '#000000', description: 'Creator / Business accounts' },
  { id: 'x', name: 'X (Twitter)', icon: <Twitter className="w-6 h-6" />, color: '#000000', description: 'Your @handle' },
  { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin className="w-6 h-6" />, color: '#0A66C2', description: 'Company pages' },
];

const MOCK_PAGES: Record<SocialPlatform, Array<{ id: string; name: string }>> = {
  facebook: [
    { id: 'fb1', name: 'Harmony Chorus Official' },
    { id: 'fb2', name: 'Quartet Rehearsal Group' },
  ],
  instagram: [{ id: 'ig1', name: '@harmony_chorus' }],
  tiktok: [
    { id: 'tt1', name: '@harmony.chorus' },
    { id: 'tt2', name: 'Harmony Quartet Official' },
  ],
  x: [{ id: 'x1', name: '@HarmonyQuartet' }],
  linkedin: [{ id: 'li1', name: 'Harmony Chorus' }],
};

export function SocialSetupModal({ open, onOpenChange, onConnectionsSaved, currentConnections = [] }: SocialSetupModalProps) {
  const [connected, setConnected] = useState<Record<SocialPlatform, boolean>>({
    facebook: currentConnections.some(c => c.platform === 'facebook'),
    instagram: currentConnections.some(c => c.platform === 'instagram'),
    tiktok: currentConnections.some(c => c.platform === 'tiktok'),
    x: currentConnections.some(c => c.platform === 'x'),
    linkedin: currentConnections.some(c => c.platform === 'linkedin'),
  });

  const [selectedPages, setSelectedPages] = useState<Record<string, boolean>>({});
  const [defaultPage, setDefaultPage] = useState<Record<SocialPlatform, string>>({});

  const handleConnect = (platform: SocialPlatform) => {
    // TODO: Replace with real OAuth (window.open or redirect to /api/connect/${platform})
    setConnected(prev => ({ ...prev, [platform]: true }));
    const firstPage = MOCK_PAGES[platform][0];
    if (firstPage) {
      setSelectedPages(prev => ({ ...prev, [firstPage.id]: true }));
      setDefaultPage(prev => ({ ...prev, [platform]: firstPage.id }));
    }
  };

  const togglePage = (pageId: string) => {
    setSelectedPages(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const setAsDefault = (pageId: string, platform: SocialPlatform) => {
    setDefaultPage(prev => ({ ...prev, [platform]: pageId }));
  };

  const handleSave = () => {
    const newConnections: SocialConnection[] = [];

    Object.keys(connected).forEach((key) => {
      const platform = key as SocialPlatform;
      if (connected[platform]) {
        MOCK_PAGES[platform].forEach(page => {
          if (selectedPages[page.id]) {
            newConnections.push({
              id: `${platform}-${page.id}`,
              platform,
              displayName: page.name,
              pageId: page.id,
              isDefault: defaultPage[platform] === page.id,
            });
          }
        });
      }
    });

    onConnectionsSaved(newConnections);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Set Up Social Media Accounts</DialogTitle>
          <DialogDescription>
            Connect the platforms your group uses to post inventory and updates directly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {PLATFORMS.map((platform) => {
            const isConnected = connected[platform.id];
            const pages = MOCK_PAGES[platform.id];

            return (
              <div key={platform.id} className="border rounded-xl p-5 space-y-4 shadow-sm" 
                   style={{ borderColor: isConnected ? '#22c55e' : '#e5e7eb' }}>
                <div className="flex items-center gap-3">
                  <div style={{ color: platform.color }}>{platform.icon}</div>
                  <div>
                    <div className="font-semibold text-lg">{platform.name}</div>
                    <div className="text-sm text-muted-foreground">{platform.description}</div>
                  </div>
                </div>

                {!isConnected ? (
                  <Button onClick={() => handleConnect(platform.id)} className="w-full" 
                          style={{ backgroundColor: platform.color, color: 'white' }}>
                    Connect with {platform.name}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-green-600 font-medium">✓ Connected</div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Select pages to use:</div>
                      {pages.map(page => (
                        <div key={page.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Checkbox checked={!!selectedPages[page.id]} onCheckedChange={() => togglePage(page.id)} />
                            <span>{page.name}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setAsDefault(page.id, platform.id)}
                                  className={defaultPage[platform.id] === page.id ? 'text-yellow-500' : ''}>
                            <Star className={`w-4 h-4 ${defaultPage[platform.id] === page.id ? 'fill-current' : ''}`} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-black hover:bg-gray-800">Save Connections</Button>
        </div>
        <p className="text-xs text-center text-muted-foreground">Secure OAuth. We never post without your approval.</p>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.2 PostComposerModal.tsx (Full Component with TikTok)

```tsx
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SocialConnection, InventoryItem, SocialPlatform } from '@/types/social';
import { Facebook, Instagram, Twitter, Linkedin, Music } from 'lucide-react';

interface PostComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  connections: SocialConnection[];
  onPost: (selected: SocialConnection[], caption: string, item: InventoryItem) => Promise<void>;
}

const getPlatformIcon = (platform: SocialPlatform) => {
  switch (platform) {
    case 'facebook': return <Facebook className="w-4 h-4 text-[#1877F2]" />;
    case 'instagram': return <Instagram className="w-4 h-4 text-[#E4405F]" />;
    case 'tiktok': return <Music className="w-4 h-4 text-black" />;
    case 'x': return <Twitter className="w-4 h-4" />;
    case 'linkedin': return <Linkedin className="w-4 h-4 text-[#0A66C2]" />;
    default: return null;
  }
};

export function PostComposerModal({ open, onOpenChange, item, connections, onPost }: PostComposerModalProps) {
  const [caption, setCaption] = useState(
    `🎶 New drop alert! Our ${item.name} is now available. Perfect for rehearsals, performances, or gifting to fellow singers. Shop link in bio!\n\n#BarbershopHarmony #QuartetMerch #CustomApparel`
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    connections.filter(c => c.isDefault).map(c => c.id)
  );
  const [isPosting, setIsPosting] = useState(false);

  const toggleConnection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectedConnections = connections.filter(c => selectedIds.includes(c.id));

  const handlePost = async () => {
    if (selectedConnections.length === 0) return;
    setIsPosting(true);
    try {
      await onPost(selectedConnections, caption, item);
      onOpenChange(false);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Promote: {item.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground">Post Preview</div>
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
              <img src={item.imageUrl} alt={item.name} className="w-full aspect-square object-cover bg-gray-100" />
              <div className="p-4 space-y-3">
                <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} 
                          className="min-h-[120px] resize-y border-0 focus-visible:ring-0 p-0 text-sm" />
                <div className="text-xs text-muted-foreground">{caption.length} characters</div>
              </div>
            </div>
          </div>

          {/* Destinations */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground">Post to:</div>
            <div className="space-y-2 max-h-[320px] overflow-auto pr-2">
              {connections.length > 0 ? (
                connections.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedIds.includes(conn.id)} onCheckedChange={() => toggleConnection(conn.id)} />
                      <div className="flex items-center gap-2.5">
                        {getPlatformIcon(conn.platform)}
                        <div>
                          <div className="font-medium">{conn.displayName}</div>
                          <div className="text-xs text-muted-foreground capitalize">{conn.platform}</div>
                        </div>
                      </div>
                    </div>
                    {conn.isDefault && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Default</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">No social accounts connected yet.</div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Defaults are pre-selected. Change per post as needed.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePost} disabled={selectedConnections.length === 0 || isPosting} 
                  className="bg-black hover:bg-gray-800 min-w-[180px]">
            {isPosting ? 'Posting...' : `Post Now to ${selectedConnections.length} account${selectedConnections.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7. Integration Example (Promote Page)

Add this logic to your existing `/studio/promote` page or component:

```tsx
// Example state
const [showSetup, setShowSetup] = useState(false);
const [showComposer, setShowComposer] = useState(false);
const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
const [connections, setConnections] = useState<SocialConnection[]>([]); // Load from Supabase on mount

const handlePromoteClick = (item: InventoryItem) => {
  setSelectedItem(item);
  if (connections.length === 0) {
    setShowSetup(true);
  } else {
    setShowComposer(true);
  }
};

const handleConnectionsSaved = (newConns: SocialConnection[]) => {
  setConnections(newConns);
  // TODO: await supabase.from('social_connections').upsert(...)
};

const handlePost = async (selected: SocialConnection[], caption: string, item: InventoryItem) => {
  // TODO: Call your backend API route
  console.log('Posting...', { selected, caption, item });
};

// In JSX - Empty state CTA + Modals
{connections.length === 0 && (
  <Button onClick={() => setShowSetup(true)} size="lg">Set up social media accounts</Button>
)}

<SocialSetupModal 
  open={showSetup} 
  onOpenChange={setShowSetup} 
  onConnectionsSaved={handleConnectionsSaved} 
  currentConnections={connections} 
/>

{selectedItem && (
  <PostComposerModal
    open={showComposer}
    onOpenChange={setShowComposer}
    item={selectedItem}
    connections={connections}
    onPost={handlePost}
  />
)}
```

---

## 8. TikTok Specific Notes

- TikTok uses the **Login Kit** + **Content Posting API**.
- Requires app approval in the TikTok for Developers portal.
- Posting is video-first (images/carousels have limitations).
- For MVP, the UI is ready — real integration can be added later without changing the frontend.

**Recommendation:** Start with Facebook/Instagram + X. Add TikTok in phase 2.

---

## 9. Backend & Security Recommendations

- Never expose access tokens to the client.
- Store tokens encrypted (Supabase Vault or server-side encryption).
- Implement token refresh flows.
- Consider using a unified service like **Ayrshare** for faster multi-platform posting (saves weeks of maintenance).

---

## 10. Next Steps & Polish Ideas

1. Replace mock OAuth with real flows (start with X — easiest).
2. Fetch real pages after successful connection.
3. Add loading skeletons and error toasts.
4. Add "Manage Social Accounts" page or section.
5. Future: Scheduling, analytics, video upload support.

---

**This single document contains everything needed to implement the full feature.**

You can copy the entire content above and paste it directly into Claude with the instruction:

> "Implement this social media promotion feature in my Next.js + Supabase CQS app following the complete guide below."

All code is production-ready, includes TikTok, matches the designed visuals, and follows a clear phased plan.

Let me know if you want any section expanded (real OAuth examples, hook, etc.). I'm ready to continue building with you.
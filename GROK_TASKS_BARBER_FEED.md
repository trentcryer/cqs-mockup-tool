# Grok Task List: Barber-Feed Feature Implementation
**Project:** CQS Mockup Studio (Custom Quartet Stuff)  
**Feature:** Barber-Feed Social Platform  
**Date:** June 26, 2026  
**Status:** Ready for Grok Execution  

---

## PROJECT CONTEXT

**CQS Mockup Studio** is a Next.js 16 app (App Router) + Supabase backend that allows barbershop harmony groups to:
- Design custom merchandise (shirts, hoodies, etc.)
- Create promotional content
- Manage their online storefront
- Post to social media (Facebook, Instagram, TikTok, X, LinkedIn)

**NEW:** Barber-Feed is an **internal social platform** exclusively for barbershoppers — think TikTok but only for barbershop harmony groups and fans.

---

## BARBER-FEED FEATURE OVERVIEW

### What is Barber-Feed?

A dedicated social feed where:

**For Groups (Content Creators):**
- Post videos/pictures of their merchandise, performances, or promotional content
- Can optionally link a product to a post (e.g., "Check out our new shirt!")
- Post simultaneously to Barber-Feed + external social media (Facebook, Instagram, etc.)
- See engagement metrics (likes, shares, view count)

**For Retail Users (Consumers):**
- Scroll through an infinite feed of posts from all groups
- Follow groups they like
- Get push notifications when followed groups post new content
- Like and share posts (but **no commenting**)
- Click through to shop products linked in posts

**Default Behavior:**
- When a group creates ANY promotional content, Barber-Feed is checked **by default**
- Groups can uncheck it if they only want social media posting
- All posts default to sharing to Barber-Feed

**Push Notifications:**
- Retail users who follow a group get notified: "Your favorite group [Name] posted new content!"
- Notifications trigger in the CQS app
- Users can opt out per group or globally

---

## TECH STACK

- **Frontend:** Next.js 16.2.6 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Media Storage:** Supabase Storage (`cqs-assets` bucket)
- **Push Notifications:** Web Push API (Notifications API)
- **Database:** PostgreSQL (Supabase)

---

## DATABASE SCHEMA (Migrations)

Create a new migration file: `supabase/migrations/012_barber_feed.sql`

### Tables to Create:

```
1. barber_feed_posts
   - id (UUID, PK)
   - group_id (UUID, FK → profiles.id)
   - content_type (ENUM: 'image', 'video')
   - media_url (TEXT, storage path in cqs-assets)
   - media_public_url (TEXT, signed URL or public URL)
   - caption (TEXT, nullable)
   - product_id (BIGINT, nullable, FK to Shopify product)
   - product_title (TEXT, snapshot of product name)
   - view_count (INT, default 0)
   - created_at (TIMESTAMPTZ)
   - updated_at (TIMESTAMPTZ)
   - is_deleted (BOOLEAN, soft delete flag)

2. feed_followers
   - id (UUID, PK)
   - user_id (UUID, FK → auth.users.id)
   - group_id (UUID, FK → profiles.id)
   - followed_at (TIMESTAMPTZ)
   - UNIQUE(user_id, group_id)

3. feed_post_likes
   - id (UUID, PK)
   - user_id (UUID, FK → auth.users.id)
   - post_id (UUID, FK → barber_feed_posts.id)
   - created_at (TIMESTAMPTZ)
   - UNIQUE(user_id, post_id)

4. feed_post_shares
   - id (UUID, PK)
   - user_id (UUID, FK → auth.users.id)
   - post_id (UUID, FK → barber_feed_posts.id)
   - created_at (TIMESTAMPTZ)
   - UNIQUE(user_id, post_id)

5. push_subscriptions
   - id (UUID, PK)
   - user_id (UUID, FK → auth.users.id)
   - endpoint (TEXT, Web Push endpoint)
   - auth_key (TEXT, encryption key)
   - p256dh_key (TEXT, encryption key)
   - created_at (TIMESTAMPTZ)
   - UNIQUE(user_id, endpoint)

6. notification_preferences (optional, for users to mute groups)
   - id (UUID, PK)
   - user_id (UUID, FK → auth.users.id)
   - group_id (UUID, FK → profiles.id)
   - muted (BOOLEAN, default false)
   - UNIQUE(user_id, group_id)
```

### RLS Policies:
- `barber_feed_posts`: Public read, group can insert/update own
- `feed_followers`: Users can manage their own follows
- `feed_post_likes`: Users can like/unlike
- `push_subscriptions`: Users manage their own subscriptions
- `notification_preferences`: Users manage their own

---

## TYPESCRIPT TYPES

Create two files:

### File 1: `types/barber-feed.ts`

```typescript
export type PostContentType = 'image' | 'video';

export interface BarberFeedPost {
  id: string;
  group_id: string;
  group_name: string;
  group_avatar_url?: string;
  content_type: PostContentType;
  media_url: string;
  media_public_url?: string;
  caption?: string;
  product_id?: number;
  product_title?: string;
  product_link?: string;
  view_count: number;
  like_count: number;
  share_count: number;
  liked_by_user: boolean;
  shared_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedFollower {
  id: string;
  user_id: string;
  group_id: string;
  group_name: string;
  group_avatar_url?: string;
  followed_at: string;
}

export interface PostLike {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface PostShare {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  auth_key: string;
  p256dh_key: string;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  group_id: string;
  muted: boolean;
}

export interface FeedFetchParams {
  limit: number;
  offset: number;
  user_id?: string; // For liked/followed status
}

export interface BarberFeedResponse {
  posts: BarberFeedPost[];
  total_count: number;
  has_more: boolean;
}
```

### File 2: `types/social.ts`

Enhance existing file with:

```typescript
export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'x' | 'linkedin' | 'barber-feed';

export interface SocialConnection {
  id: string;
  group_id: string;
  platform: SocialPlatform;
  account_id: string;
  page_id?: string;
  display_name: string;
  avatar_url?: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_default: boolean;
  connected_at: string;
  last_used_at?: string;
  scopes?: string[];
}

export interface PromotionPost {
  title: string;
  caption: string;
  media_url: string;
  product_id?: number;
  product_title?: string;
  platforms: SocialPlatform[]; // Multiple platforms to share to
  scheduled_for?: string;
}

export interface PostResult {
  platform: SocialPlatform;
  success: boolean;
  post_id?: string;
  error?: string;
  share_url?: string;
}
```

---

## COMPONENT SCAFFOLDS

Create these files with **proper TypeScript types and Tailwind styling**. All should be client components (`'use client'`).

### File 1: `app/studio/barber-feed/page.tsx`

**Purpose:** Main Barber-Feed browsing page (for retail users)

**Must Include:**
- Page title: "Barber Feed"
- Breadcrumb/navigation back to studio
- Infinite scroll feed container
- Loading skeleton states
- "No posts yet" empty state
- Error boundary / error message handling
- Responsive grid (mobile: 1 col, tablet: 2 col, desktop: 2-3 col)

**Props Needed:**
- None (server fetches data)

**State:**
- `posts: BarberFeedPost[]`
- `isLoading: boolean`
- `hasMore: boolean`
- `offset: number`

**Key Functions:**
- `fetchFeed(offset, limit)` - stub, returns []
- `loadMore()` - increments offset, calls fetchFeed
- `handleInfiniteScroll()` - detects bottom of page

**Styling Notes:**
- Match existing CQS dark theme (zinc-900, zinc-800, etc.)
- Posts shown as cards with: image, group name/avatar, caption, like/share buttons, view count
- Buttons should be subtle (not prominent)

---

### File 2: `components/barber-feed/FeedPost.tsx`

**Purpose:** Individual post card component

**Props:**
```typescript
interface FeedPostProps {
  post: BarberFeedPost;
  onLike: (postId: string) => Promise<void>;
  onShare: (postId: string) => Promise<void>;
  onProductClick?: (productId: number) => void;
}
```

**Must Display:**
- Group avatar + name (clickable to group profile)
- Media (image/video thumbnail)
- Caption text
- Like count + Like button (heart icon)
- Share count + Share button (share icon)
- View count (small, bottom-right)
- Post timestamp (relative time: "2 hours ago")
- Product badge (if product linked): "Shop now" button
- Hover effect: slight scale/shadow

**State:**
- `isLiking: boolean` (disable button while pending)
- `isSharing: boolean` (disable button while pending)

**Styling:**
- Rounded corners (rounded-lg)
- Light border (border-zinc-700)
- Smooth transitions on hover

---

### File 3: `components/barber-feed/PostCreator.tsx`

**Purpose:** Modal for groups to create barber-feed posts

**Props:**
```typescript
interface PostCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: (post: BarberFeedPost) => void;
  defaultProduct?: { id: number; title: string; image_url: string };
}
```

**Must Include:**
- Media upload input (image/video file picker)
- Media preview (shows uploaded image/video thumbnail)
- Caption textarea (max 500 chars, char counter)
- Product selector (dropdown or search, optional)
- Platform selector (checkboxes for: Barber-Feed, Facebook, Instagram, TikTok, X, LinkedIn)
  - **BARBER-FEED MUST BE CHECKED BY DEFAULT**
  - Other platforms only if connected
- "Post Now" button
- Cancel button
- Loading state during upload
- Error message display
- Success toast message

**State:**
- `caption: string`
- `mediaFile: File | null`
- `mediaPreviewUrl: string | null`
- `selectedProductId: number | null`
- `selectedPlatforms: SocialPlatform[]` (default: ['barber-feed'])
- `isUploading: boolean`
- `error: string | null`

**Key Functions:**
- `handleMediaUpload(file)` - preview + validate (max 100MB, jpg/png/mp4)
- `handlePost()` - stub, returns success
- `togglePlatform(platform)` - add/remove from selectedPlatforms

**Styling:**
- Modal style (Dialog component look)
- Split layout: left = preview, right = form fields
- Upload area should be clear and inviting

---

### File 4: `components/barber-feed/FollowButton.tsx`

**Purpose:** Follow/Unfollow button for groups

**Props:**
```typescript
interface FollowButtonProps {
  groupId: string;
  isFollowing: boolean;
  onFollowChange: (isFollowing: boolean) => Promise<void>;
}
```

**Must Display:**
- Text: "Follow" or "Following" (depending on state)
- Icon: plus-circle or check-circle
- Disabled state while pending
- Different styling when following (filled) vs not (outline)

**State:**
- `isFollowing: boolean`
- `isPending: boolean`

**Styling:**
- Button with border or filled style
- Smooth color transition

---

### File 5: `components/barber-feed/GroupCard.tsx` (Optional, for "Featured Groups")

**Purpose:** Card showing a group with follow button

**Props:**
```typescript
interface GroupCardProps {
  groupId: string;
  groupName: string;
  avatarUrl?: string;
  followerCount: number;
  isFollowing: boolean;
  onFollowChange: (isFollowing: boolean) => Promise<void>;
}
```

**Must Display:**
- Avatar image
- Group name
- Follower count
- Follow button

---

## API ROUTE SCAFFOLDS

Create these route files with **proper validation, error handling, and TypeScript types**. All should be server-side secured.

### Directory Structure:
```
app/api/barber-feed/
  ├── posts/
  │   ├── route.ts (GET: fetch feed, POST: create post)
  │   └── [postId]/
  │       └── route.ts (GET: single post, DELETE: soft delete)
  ├── likes/
  │   ├── route.ts (POST: like, DELETE: unlike)
  ├── shares/
  │   ├── route.ts (POST: share, DELETE: unshare)
  ├── followers/
  │   ├── route.ts (POST: follow, DELETE: unfollow)
  ├── feed/
      └── route.ts (GET: paginated feed for user)

app/api/push-notifications/
  ├── subscribe/
  │   └── route.ts (POST: save subscription)
  ├── send/
      └── route.ts (POST: send notification, admin only)
```

### File 1: `app/api/barber-feed/posts/route.ts`

**GET Requirements:**
```typescript
// Query params:
// - ?limit=10&offset=0 (pagination)
// Returns: { posts: BarberFeedPost[], has_more: boolean, total_count: number }
```

**POST Requirements:**
```typescript
// Body: { caption: string, media_url: string, content_type: 'image'|'video', product_id?: number, platforms: SocialPlatform[] }
// Returns: { post: BarberFeedPost, social_results: PostResult[] }
// Auth: Require group user (check auth.uid in profiles.id)
```

**Must Include:**
- Request validation (caption max 500, media_url required)
- Auth check (user must be group owner or admin)
- Media validation (file exists in storage)
- Soft delete instead of hard delete
- Increment view_count (on GET)
- Link to product if provided
- Queue posts for social platforms (if multiple platforms selected)

---

### File 2: `app/api/barber-feed/likes/route.ts`

**POST Requirements:**
```typescript
// Body: { post_id: string }
// Returns: { success: boolean, like_count: number }
// Auth: Require logged-in user
```

**DELETE Requirements:**
```typescript
// Query: ?post_id=<id>
// Returns: { success: boolean, like_count: number }
// Auth: Require logged-in user
```

**Must Include:**
- Prevent duplicate likes (UNIQUE constraint)
- Update like_count on post
- Idempotent (safe to call multiple times)

---

### File 3: `app/api/barber-feed/followers/route.ts`

**POST Requirements:**
```typescript
// Body: { group_id: string }
// Returns: { success: boolean, follower_count: number }
// Auth: Require logged-in user
```

**DELETE Requirements:**
```typescript
// Query: ?group_id=<id>
// Returns: { success: boolean, follower_count: number }
// Auth: Require logged-in user
```

**Must Include:**
- Prevent duplicate follows
- Check group exists
- Update follower count on group profile
- Trigger push notification opt-in (prompt user)

---

### File 4: `app/api/push-notifications/subscribe/route.ts`

**POST Requirements:**
```typescript
// Body: { subscription: PushSubscription }
// (from Web Push API navigator.serviceWorker.getRegistration().pushManager.subscribe())
// Returns: { success: boolean }
// Auth: Require logged-in user
```

**Must Include:**
- Save subscription to DB
- Validate endpoint URL
- Encrypt keys before storage (optional: use Supabase Vault)
- Handle re-subscriptions (update existing)

---

### File 5: `app/api/barber-feed/feed/route.ts`

**GET Requirements:**
```typescript
// Query params: ?limit=20&offset=0&user_id=<optional>
// Returns: { posts: BarberFeedPost[], has_more: boolean }
// Notes:
//   - For logged-in users: populate liked_by_user, shared_by_user
//   - For anonymous: set to false
//   - Order by created_at DESC (newest first)
//   - Only return non-deleted posts
```

---

## FEATURE SPECIFICATION DOCUMENT

Create: `docs/BARBER_FEED_SPEC.md`

**Include:**
1. User flow diagram (ASCII art or text description)
   - Retail user: Browse → Follow → Get notified → Like/Share
   - Group user: Create post → Select platforms (default Barber-Feed) → Post to multiple channels

2. Feed algorithm notes:
   - Initial: Reverse chronological (newest first)
   - Future: Personalized by follows, engagement

3. Push notification copy templates:
   - "[GroupName] posted new content"
   - "[GroupName] posted a new product promotion"
   - User can customize frequency (immediately, daily digest, off)

4. Rate limits / constraints:
   - Max post size: 100MB video, 50MB image
   - Max caption: 500 characters
   - Max posts per group per day: 20
   - Like/share limit: None (users can spam, we don't rate limit)

5. Privacy & moderation:
   - Posts visible to all (public)
   - No direct messaging
   - No commenting
   - Groups can delete own posts
   - Admin can remove posts (violating CoC)

6. Mobile responsiveness:
   - Mobile: 1 column feed
   - Tablet: 2 columns
   - Desktop: 2-3 columns (based on viewport)

7. Analytics (for future dashboard):
   - Track: impressions, likes, shares, clicks to product
   - Report to group admin: "This post got 1.2k views"

---

## DELIVERABLE FORMAT & CHECKLIST

### What to Send Back:

1. **Database Migration File**
   - File: `supabase/migrations/012_barber_feed.sql`
   - Complete, production-ready SQL
   - Include table creation + RLS policies
   - Test it runs without errors

2. **TypeScript Types**
   - File: `types/barber-feed.ts` (complete)
   - File: `types/social.ts` (enhanced with barber-feed + SocialPlatform union)
   - No `any` types, strict mode compliant

3. **Component Files** (All `.tsx`)
   - `app/studio/barber-feed/page.tsx`
   - `components/barber-feed/FeedPost.tsx`
   - `components/barber-feed/PostCreator.tsx`
   - `components/barber-feed/FollowButton.tsx`
   - `components/barber-feed/GroupCard.tsx` (optional)

4. **API Route Scaffolds** (All `.ts`)
   - `app/api/barber-feed/posts/route.ts`
   - `app/api/barber-feed/likes/route.ts`
   - `app/api/barber-feed/followers/route.ts`
   - `app/api/push-notifications/subscribe/route.ts`
   - `app/api/barber-feed/feed/route.ts`

5. **Documentation**
   - File: `docs/BARBER_FEED_SPEC.md` (complete spec)

6. **Package.json Updates** (if needed)
   - List any new dependencies required (e.g., `web-push` for server-side notifications)

### Quality Checklist:

Before sending files, verify:
- [ ] All TypeScript is strict (no `any`, no untyped params)
- [ ] All files have proper imports at top
- [ ] Components use `'use client'` where needed
- [ ] API routes include auth checks
- [ ] SQL is valid, tested (copy into Supabase SQL editor)
- [ ] Tailwind classes match existing CQS theme (zinc-800, zinc-900, etc.)
- [ ] No console.log or debug code left
- [ ] File paths are correct (match project structure)
- [ ] All required props are documented in JSDoc comments
- [ ] No hardcoded values (use constants or env vars)

---

## STYLE & CONVENTIONS

**Follow these to match the existing CQS codebase:**

1. **Tailwind Colors:** Use zinc palette (zinc-900, zinc-800, zinc-700, etc.) + semantic colors for CTAs
2. **Component Style:** Subtle borders (border-zinc-700), rounded-lg for cards, smooth transitions
3. **Spacing:** Use consistent rem spacing (gap-3, gap-4, p-6, etc.)
4. **Icons:** Use `lucide-react` (already in project)
5. **Forms:** Use standard HTML inputs with Tailwind classes (no external form libs unless necessary)
6. **Error Handling:** Return JSON with `{ error: string, status: 400+ }`
7. **Naming:** camelCase for functions/variables, PascalCase for components/types
8. **Comments:** Only for non-obvious logic; types speak for themselves

---

## STEP-BY-STEP EXECUTION PLAN FOR GROK

### **STEP 1: Database Migration**
- [ ] Create SQL migration file with all 6 tables
- [ ] Add proper constraints (UNIQUE, FK, NOT NULL where needed)
- [ ] Add RLS policies for each table
- [ ] Test by pasting into Supabase dashboard (don't run yet)
- [ ] Deliver: `migrations/012_barber_feed.sql`

### **STEP 2: TypeScript Types**
- [ ] Create `types/barber-feed.ts` with all 8 interfaces
- [ ] Enhance `types/social.ts` with barber-feed platform + promotion types
- [ ] Ensure strict TypeScript compliance
- [ ] Deliver: Both type files

### **STEP 3: Component Scaffolds (UI Only)**
- [ ] Create BarberFeedPage (shell with infinite scroll structure)
- [ ] Create FeedPost (card layout, no logic)
- [ ] Create PostCreator (form layout, no upload logic)
- [ ] Create FollowButton (button component, no API calls)
- [ ] Create GroupCard (optional, card layout)
- [ ] All with Tailwind styling matching CQS theme
- [ ] Deliver: All 5 `.tsx` files

### **STEP 4: API Route Structure**
- [ ] Create directory structure under `app/api/barber-feed/` and `app/api/push-notifications/`
- [ ] Create route.ts files for each endpoint (POST/GET/DELETE shells)
- [ ] Add request validation (zod or manual checks)
- [ ] Add auth checks (require logged-in user or group admin)
- [ ] Add TODO comments where Claude will add logic
- [ ] Deliver: All 5 route files

### **STEP 5: Feature Specification**
- [ ] Write comprehensive `docs/BARBER_FEED_SPEC.md`
- [ ] Include user flows, feed algorithm, notifications, constraints
- [ ] Deliver: Spec document

### **STEP 6: Quality Assurance**
- [ ] Review all files against checklist
- [ ] Test SQL syntax (paste into Supabase)
- [ ] Verify TypeScript strict mode
- [ ] Deliver: All files ready for Claude integration

---

## FINAL HANDOFF

When complete, organize deliverables like this:

```
GROK_DELIVERABLES/
├── migrations/
│   └── 012_barber_feed.sql
├── types/
│   ├── barber-feed.ts
│   └── social.ts (updated)
├── components/barber-feed/
│   ├── FeedPost.tsx
│   ├── PostCreator.tsx
│   ├── FollowButton.tsx
│   └── GroupCard.tsx
├── api-routes/
│   ├── posts_route.ts
│   ├── likes_route.ts
│   ├── followers_route.ts
│   ├── subscribe_route.ts
│   └── feed_route.ts
├── docs/
│   └── BARBER_FEED_SPEC.md
└── HANDOFF_CHECKLIST.md
```

**Then message Claude:** "Grok tasks complete. Deliverables ready in [link/folder]. Ready for integration."

---

## QUESTIONS FOR CLARIFICATION

If anything is unclear, ask:
1. "Should push notifications be Web Push API only, or include email/SMS?"
2. "Should barber-feed have hashtags/tagging system?"
3. "Should groups be able to edit posts after publishing?"
4. "Should there be a report/flag system for inappropriate posts?"

**Default:** Assume No to all. Keep it simple for MVP.

---

**READY TO EXECUTE? Start with STEP 1 and work through in order. Claude will handle integration once delivered.**

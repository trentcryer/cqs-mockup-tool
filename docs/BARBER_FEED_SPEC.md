# Barber Feed Specification

## 1. User Flows

**Retail User Flow:**
```
Browse Feed (infinite scroll)
  → View Post
    → Like / Share
    → Click product → Shop page
  → Follow Group
    → Receive Push Notification on new post
```

**Group User Flow:**
```
Create Promo Content
  → PostCreator modal
    → Upload media
    → Write caption
    → (Optional) Link product
    → Select platforms (Barber-Feed always checked by default)
  → Submit
    → Saved to barber_feed_posts
    → Optionally posted to external platforms
  → Metrics visible on post (views, likes, shares)
```

## 2. Feed Algorithm
- Current (MVP): Reverse chronological order (created_at DESC)
- Future: Personalized ranking based on follows + engagement signals

## 3. Push Notification Templates
- Basic: "[GroupName] posted new content"
- Promo: "[GroupName] posted a new product promotion"
- Users can set per-group frequency: Immediately | Daily Digest | Off

## 4. Rate Limits & Constraints
- Max file: 100MB (video), 50MB (image)
- Max caption: 500 characters
- Max posts per group per day: 20
- No rate limit on likes/shares (to keep simple for MVP)

## 5. Privacy & Moderation
- All posts are public
- No comments
- No direct messaging
- Groups can soft-delete their own posts
- Admin can hard-delete posts that violate Code of Conduct
- No private groups in v1

## 6. Mobile Responsiveness
- Mobile: 1 column, full-width cards
- Tablet (≥768px): 2 columns
- Desktop: 2–3 columns (auto based on container)

## 7. Analytics (Future)
Track per post:
- Impressions
- Likes
- Shares
- Product clicks

Report per group admin dashboard: "This post reached 1.2k views"

## 8. Data Model Notes
- Soft delete via `is_deleted` flag on posts
- View count incremented on every GET of post detail or feed item view
- Media stored in `cqs-assets` bucket under `barber-feed/{group_id}/`
- Snapshots of product_title at time of post (product can change later)

## 9. Integration Points
- Can be triggered from Promote tool
- Can be triggered from Editor when saving a new design
- Can be triggered from Studio when posting any content (default on)

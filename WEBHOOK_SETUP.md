# Shopify Webhook Setup

After deploying to Vercel, register this webhook in your Shopify Partner Dashboard
OR via the Shopify Admin API.

## Webhook to register

- **Topic:** `orders/create`
- **URL:** `https://your-vercel-url.vercel.app/api/webhooks/shopify/orders`
- **Format:** JSON

## How to register (Shopify Admin → Settings → Notifications → Webhooks)

1. Go to your Shopify Admin
2. Settings → Notifications → scroll to bottom → Webhooks
3. Create webhook → Topic: "Order creation"
4. URL: your deployed endpoint above
5. Save

## What it does

- Sends Trent a push notification for every new order ("New Order — $X.XX")
- Sends the relevant quartet a push notification if the order contains
  a line item property `_collection` matching their collection title
  ("New Sale! Someone just bought from your collection")

## Testing locally

Use the Shopify CLI or ngrok to expose localhost and register a test webhook:

```bash
ngrok http 3000
# Then use the ngrok URL as your webhook endpoint for testing
```

Or use Shopify's "Send test notification" button after registering.

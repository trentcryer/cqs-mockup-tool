'use client'

import Script from 'next/script'

/**
 * Tawk.to live chat widget.
 *
 * Renders nothing until both env vars are set, so it is safe to ship before
 * the account exists. To go live, set these in .env (and in Vercel):
 *   NEXT_PUBLIC_TAWK_PROPERTY_ID  - your tawk property id
 *   NEXT_PUBLIC_TAWK_WIDGET_ID    - the widget id (often "default" or a hash)
 *
 * Both ids come from the embed snippet tawk gives you:
 *   https://embed.tawk.to/<PROPERTY_ID>/<WIDGET_ID>
 *
 * Branding ("Chat with Trent", your photo, colors) is configured in the tawk
 * dashboard, not here.
 */
export default function TawkChat() {
  const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID
  const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID

  if (!propertyId || !widgetId) {
    return null
  }

  return (
    <Script
      id="tawk-to"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API = Tawk_API || {};
          var Tawk_LoadStart = new Date();
          (function () {
            var s1 = document.createElement("script"),
              s0 = document.getElementsByTagName("script")[0];
            s1.async = true;
            s1.src = "https://embed.tawk.to/${propertyId}/${widgetId}";
            s1.charset = "UTF-8";
            s1.setAttribute("crossorigin", "*");
            s0.parentNode.insertBefore(s1, s0);
          })();
        `,
      }}
    />
  )
}

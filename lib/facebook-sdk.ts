// Initialize Facebook SDK for sharing
export function initFacebookSDK(appId: string) {
  if (typeof window === 'undefined') return

  // Load SDK asynchronously
  (window as any).fbAsyncInit = function() {
    const FB = (window as any).FB
    if (FB) {
      FB.init({
        appId: appId,
        xfbml: true,
        version: 'v18.0',
      })
    }
  }

  // Load the SDK script
  if (!(window as any).FB) {
    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0'
    document.head.appendChild(script)
  }
}

// Share via Facebook SDK (opens native share dialog)
export function shareToFacebookSDK(url: string, pageId?: string) {
  if (!window || !(window as any).FB) {
    console.error('Facebook SDK not loaded')
    return
  }

  ;(window as any).FB.ui(
    {
      method: 'share',
      href: url,
      hashtag: '#CQS',
      // Note: Facebook's share dialog doesn't support pre-selecting a page
      // Users will see their pages in the dialog after authentication
    },
    function() {}
  )
}

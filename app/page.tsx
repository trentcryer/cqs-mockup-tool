import Link from 'next/link'
import Image from 'next/image'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="border-b border-[#d4c5b0] bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/cqs-logo.png" alt="CQS" width={42} height={42} className="rounded" />
            <div>
              <div className="font-semibold tracking-tight text-xl text-[#1c1412]">CQS Mockup Studio</div>
              <div className="text-[10px] text-[#b8892a] -mt-1 tracking-[2px]">CUSTOM QUARTET STUFF</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="px-5 py-2 rounded-md hover:bg-[#f7f3ee] transition">Log in</Link>
            <Link href="/signup" className="btn-primary px-5 py-2 rounded-md text-sm">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 pt-12 pb-20">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-[#d4c5b0] rounded-full px-4 py-1 text-xs tracking-widest text-[#9b1c1c] mb-6">
            PRINTFUL + SHOPIFY POWERED
          </div>

          <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter text-[#1c1412] leading-none mb-6">
            Design your quartet’s<br />merch in minutes.
          </h1>
          <p className="text-2xl text-[#6b5f54] max-w-lg mx-auto mb-10">
            Upload your logo. Place it on real Printful products.<br />
            Get pro mockups. Send to Trent for approval.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="btn-primary px-10 py-4 rounded-xl text-base inline-block">
              Start my studio →
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-4 rounded-xl text-base inline-block">
              I already have an account
            </Link>
          </div>

          <p className="mt-8 text-xs text-[#8a7660]">Trusted by barbershop quartets & choruses across North America</p>
        </div>
      </div>

      {/* Features strip */}
      <div className="border-t border-[#d4c5b0] bg-white py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 text-sm">
          <div>✓ 500+ Printful products</div>
          <div>✓ Drag-to-place logo editor</div>
          <div>✓ Real-time high-quality mockups</div>
          <div>✓ Private folders + one-click review</div>
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import Image from 'next/image'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5f2]">
      {/* Top nav */}
      <nav className="border-b border-[#e8e0d8] bg-[#f7f5f2]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/cqs-logo.png" alt="CQS" width={36} height={36} className="rounded" style={{ height: 'auto' }} />
            <div>
              <div className="font-bold tracking-tight text-[18px] text-[#1c1412]">CQS Mockup Studio</div>
              <div className="text-[8px] text-[#9b8c7a] tracking-[2.5px] uppercase -mt-0.5">Custom Quartet Stuff</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <Link href="/login" className="px-4 py-2 text-[#9b8c7a] hover:text-[#1c1412] transition">Sign in</Link>
            <Link href="/signup" className="btn-primary px-5 py-2 text-[13px]">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 pt-16 pb-24">
        <div className="max-w-2xl text-center">
          <div className="eyebrow mb-6 inline-block">Powered by CQS</div>

          <h1 className="text-[64px] sm:text-[80px] font-bold tracking-tight text-[#1c1412] leading-[0.95] mb-8" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Your quartet's<br />merch, made easy.
          </h1>
          <p className="text-[17px] text-[#9b8c7a] max-w-lg mx-auto mb-12 leading-relaxed">
            Upload your logo. Place it on real products. Get pro mockups. Send for approval.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="btn-primary px-10 py-4 text-[15px] inline-block">
              Start my studio
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-4 text-[15px] inline-block">
              Sign in
            </Link>
          </div>

          <p className="mt-10 text-[11px] text-[#c4b49f] tracking-[1px] uppercase">
            Trusted by barbershop quartets &amp; choruses
          </p>
        </div>
      </div>

      {/* Features strip */}
      <div className="border-t border-[#e8e0d8] py-8">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 text-[12px] text-[#9b8c7a]">
          <div>500+ products available</div>
          <div>Drag-to-place logo editor</div>
          <div>Real-time HD mockups</div>
          <div>One-click review workflow</div>
        </div>
      </div>
    </div>
  )
}

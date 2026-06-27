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

      {/* Two paths */}
      <div className="border-t border-[#e8e0d8] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-[#1c1412] text-center mb-12">What are you here to do?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Creators */}
            <div className="bg-[#faf9f7] p-8 rounded">
              <h3 className="text-xl font-semibold text-[#1c1412] mb-4">Creators</h3>
              <p className="text-[#9b8c7a] mb-6">
                Running a barbershop quartet or chorus? Design custom merch, manage your catalog, and connect with fans on the Barber Feed.
              </p>
              <ul className="space-y-2 text-[13px] text-[#9b8c7a] mb-6">
                <li>✓ 500+ customizable products</li>
                <li>✓ HD mockup previews</li>
                <li>✓ Admin approval workflow</li>
                <li>✓ Post to Barber Feed</li>
                <li>✓ Share to socials</li>
              </ul>
              <Link href="/signup" className="btn-primary px-6 py-3 inline-block">
                Start My Studio
              </Link>
            </div>

            {/* Barbersshopers */}
            <div className="bg-[#faf9f7] p-8 rounded">
              <h3 className="text-xl font-semibold text-[#1c1412] mb-4">Barbersshopers</h3>
              <p className="text-[#9b8c7a] mb-6">
                Love barbershop music? Browse the latest apparel from your favorite groups and stay connected on the Barber Feed.
              </p>
              <ul className="space-y-2 text-[13px] text-[#9b8c7a] mb-6">
                <li>✓ Shop from multiple groups</li>
                <li>✓ Unified cart & checkout</li>
                <li>✓ Explore Barber Feed</li>
                <li>✓ Follow favorite groups</li>
                <li>✓ Get notifications</li>
              </ul>
              <Link href="/signup" className="btn-primary px-6 py-3 inline-block">
                Join as Barbershopper
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { ImageResponse } from 'next/og'
import { getPlatform } from '@/lib/promo/platforms'
import type { PromoProduct } from '@/lib/promo/templates'
import { decodePromoData } from '@/lib/promo/encode'
import { createAdminClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const CQS_LOGO_DATA_URL = (() => {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'cqs-logo.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
})()

const COLORS = {
  cream: '#f5efe6',
  tan: '#d4c5b0',
  brown: '#6b5f54',
  red: '#9b1c1c',
  redDeep: '#5e1212',
  gold: '#d4a13d',
  goldDeep: '#8a661f',
  dark: '#1a120a',
  black: '#0d0905',
}

// ── Decorative primitives ──────────────────────────────────────────

function FullBleedBackground({ image, gradient }: { image?: string; gradient: string }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          backgroundImage: image ? `url(${image})` : `linear-gradient(160deg, ${COLORS.black}, #1a1a1a)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          backgroundImage: gradient,
        }}
      />
    </div>
  )
}

function CqsBrandRow({ width }: { width: number }) {
  const size = Math.round(width * 0.0828)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.85 }}>
      {CQS_LOGO_DATA_URL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={CQS_LOGO_DATA_URL}
          width={size}
          height={size}
          style={{ borderRadius: 9, objectFit: 'contain' }}
        />
      )}
      <div style={{ display: 'flex', fontSize: Math.round(width * 0.04416), fontWeight: 600, color: '#ffffff' }}>
        Custom Quartet Stuff
      </div>
    </div>
  )
}

function CTAPill({ text, width, pad }: { text: string; width: number; pad: number }) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        color: '#ffffff',
        fontSize: Math.round(width * 0.034),
        fontWeight: 700,
        padding: `${Math.round(pad * 0.5)}px 0`,
        borderRadius: 9999,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      }}
    >
      {text}
    </div>
  )
}

function Pill({ children, bg, color, border, fontSize }: { children: React.ReactNode; bg?: string; color: string; border?: string; fontSize: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color,
        fontSize,
        fontWeight: 800,
        letterSpacing: 3,
        textTransform: 'uppercase',
        padding: '10px 22px',
        borderRadius: 999,
        ...(bg ? { background: bg } : {}),
        ...(border ? { border } : {}),
      }}
    >
      {children}
    </div>
  )
}

function ProductCard({
  src,
  size,
  rotate = 0,
  shadowColor = 'rgba(0,0,0,0.45)',
}: {
  src: string
  size: number
  rotate?: number
  shadowColor?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        padding: Math.round(size * 0.05),
        borderRadius: 20,
        background: '#ffffff',
        boxShadow: `0 ${Math.round(size * 0.05)}px ${Math.round(size * 0.12)}px ${shadowColor}`,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: 'contain', width: '100%', height: '100%', borderRadius: 10 }}
      />
    </div>
  )
}

function PriceSticker({ price, size, rotate = 8 }: { price: string; size: number; rotate?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size,
        background: COLORS.red,
        border: `3px solid ${COLORS.cream}`,
        color: COLORS.cream,
        fontSize: Math.round(size * 0.28),
        fontWeight: 800,
        boxShadow: '0 8px 18px rgba(0,0,0,0.4)',
        transform: `rotate(${rotate}deg)`,
      }}
    >
      ${price}
    </div>
  )
}

function LogoBadge({ src, size, rotate = 0 }: { src: string; size: number; rotate?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size,
        background: '#ffffff',
        padding: Math.round(size * 0.14),
        boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
        border: `3px solid ${COLORS.gold}`,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: 'contain', width: '100%', height: '100%', borderRadius: size }}
      />
    </div>
  )
}

// ── Templates ───────────────────────────────────────────────────────
// All templates share the same visual language: full-bleed product photo,
// dark gradient overlay, bold sans headline, black CTA pill. Each one
// differs by content/accent badge, not by color scheme.

function spotlightLayout(groupName: string, products: PromoProduct[], width: number, height: number, logo?: string) {
  const p = products[0]
  const pad = Math.round(width * 0.06)
  const headlineSize = Math.round(width * 0.08)
  const subSize = Math.round(width * 0.034)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', overflow: 'hidden', fontFamily: 'sans-serif', color: '#ffffff' }}>
      <FullBleedBackground image={p?.image} gradient="linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.92) 100%)" />

      {p?.price && (
        <div style={{ position: 'absolute', top: pad * 0.7, left: pad * 0.7, display: 'flex' }}>
          <PriceSticker price={p.price} size={Math.round(width * 0.12)} rotate={-6} />
        </div>
      )}
      {logo && (
        <div style={{ position: 'absolute', top: pad * 0.7, right: pad * 0.7, display: 'flex' }}>
          <LogoBadge src={logo} size={Math.round(width * 0.13)} rotate={6} />
        </div>
      )}

      <div style={{ position: 'absolute', bottom: pad, left: pad, right: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(pad * 0.6) }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, textAlign: 'center' }}>
            {p?.title ?? 'New Design'}
          </div>
          <div style={{ display: 'flex', fontSize: subSize, opacity: 0.92, textAlign: 'center' }}>
            Now available for {groupName}
          </div>
        </div>
        <CTAPill text="Shop Now" width={width} pad={pad} />
        <CqsBrandRow width={width} />
      </div>
    </div>
  )
}

function gridLayout(groupName: string, products: PromoProduct[], width: number, height: number, logo?: string) {
  const items = products.slice(0, 4)
  const backdrop = items[0]
  const pad = Math.round(width * 0.06)
  const headlineSize = Math.round(width * 0.07)
  const n = Math.max(items.length, 1)
  const gap = Math.round(pad * 0.45)
  const availableWidth = width - pad * 2
  const cardSize = Math.round(Math.min(width * 0.24, (availableWidth - gap * (n - 1)) / n * 0.9))
  const rotations = [-6, 4, -3, 7]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', overflow: 'hidden', fontFamily: 'sans-serif', color: '#ffffff' }}>
      <FullBleedBackground image={backdrop?.image} gradient="linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.95) 100%)" />

      <div style={{ position: 'absolute', top: pad, left: pad, right: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 900, letterSpacing: -2 }}>NEW ARRIVALS</div>
        <div style={{ display: 'flex', fontSize: Math.round(width * 0.03), opacity: 0.85 }}>{groupName}</div>
      </div>

      <div style={{ position: 'absolute', bottom: pad, left: pad, right: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(pad * 0.6) }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap }}>
          {items.map((item, i) => (
            <ProductCard key={i} src={item.image} size={cardSize} rotate={rotations[i % rotations.length]} shadowColor="rgba(0,0,0,0.5)" />
          ))}
          {logo && (
            <div style={{ position: 'absolute', top: -Math.round(cardSize * 0.22), left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>
              <LogoBadge src={logo} size={Math.round(cardSize * 0.45)} rotate={-6} />
            </div>
          )}
        </div>
        <CTAPill text="Shop the Collection" width={width} pad={pad} />
        <CqsBrandRow width={width} />
      </div>
    </div>
  )
}

function droppedLayout(groupName: string, products: PromoProduct[], width: number, height: number, logo?: string) {
  const p = products[0]
  const pad = Math.round(width * 0.06)
  const headlineSize = Math.round(width * 0.085)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', overflow: 'hidden', fontFamily: 'sans-serif', color: '#ffffff' }}>
      <FullBleedBackground image={p?.image} gradient="linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.93) 100%)" />

      <div style={{ position: 'absolute', top: pad, left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>
        <Pill bg="#000000" color="#ffffff" fontSize={Math.round(width * 0.026)}>🔥 Just Dropped</Pill>
      </div>
      {logo && (
        <div style={{ position: 'absolute', top: pad * 0.7, right: pad * 0.7, display: 'flex' }}>
          <LogoBadge src={logo} size={Math.round(width * 0.13)} rotate={8} />
        </div>
      )}

      <div style={{ position: 'absolute', bottom: pad, left: pad, right: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(pad * 0.6) }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, textAlign: 'center' }}>
            {groupName}
          </div>
          <div style={{ display: 'flex', fontSize: Math.round(width * 0.034), opacity: 0.92, textAlign: 'center' }}>
            {p?.title ?? 'New merch just landed'}
          </div>
        </div>
        <CTAPill text="Shop Now" width={width} pad={pad} />
        <CqsBrandRow width={width} />
      </div>
    </div>
  )
}

function limitedLayout(groupName: string, products: PromoProduct[], width: number, height: number, logo?: string) {
  const p = products[0]
  const pad = Math.round(width * 0.06)
  const headlineSize = Math.round(width * 0.08)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', overflow: 'hidden', fontFamily: 'sans-serif', color: '#ffffff' }}>
      <FullBleedBackground image={p?.image} gradient="linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.94) 100%)" />

      <div style={{ position: 'absolute', top: pad, left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>
        <Pill bg="#000000" color={COLORS.gold} border={`2px solid ${COLORS.gold}`} fontSize={Math.round(width * 0.026)}>⏳ Limited Time</Pill>
      </div>
      {logo && (
        <div style={{ position: 'absolute', top: pad * 0.7, right: pad * 0.7, display: 'flex' }}>
          <LogoBadge src={logo} size={Math.round(width * 0.13)} rotate={-6} />
        </div>
      )}

      <div style={{ position: 'absolute', bottom: pad, left: pad, right: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(pad * 0.6) }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, textAlign: 'center' }}>
            {groupName}
          </div>
          <div style={{ display: 'flex', fontSize: Math.round(width * 0.034), opacity: 0.92, textAlign: 'center' }}>
            While supplies last
          </div>
        </div>
        <CTAPill text="Shop Now" width={width} pad={pad} />
        <CqsBrandRow width={width} />
      </div>
    </div>
  )
}

function heroShelfLayout(groupName: string, products: PromoProduct[], width: number, height: number, logo?: string) {
  const p = products[0]
  const shelfProducts = products.slice(0, 3)
  const pad = Math.round(width * 0.055)
  const headline = p?.title ?? 'New Gear Just Dropped'
  const subheadline = `Shop ${groupName} favorites today`
  const headlineSize = Math.round(width * 0.075)
  const subSize = Math.round(width * 0.034)
  const shelfHeight = Math.round(height * 0.15)
  const thumbSize = Math.round(shelfHeight * 0.55)
  const ctaFontSize = Math.round(width * 0.034)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        color: '#ffffff',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          backgroundImage: p ? `url(${p.image})` : `linear-gradient(to bottom, ${COLORS.black}, #1a1a1a)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      {logo && (
        <div style={{ position: 'absolute', top: pad * 0.7, right: pad * 0.7, display: 'flex' }}>
          <LogoBadge src={logo} size={Math.round(width * 0.13)} rotate={6} />
        </div>
      )}

      {/* Bottom content stacks via flex column with gap — never overlaps, unlike fixed `bottom` offsets */}
      <div
        style={{
          position: 'absolute',
          bottom: pad,
          left: pad,
          right: pad,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: Math.round(pad * 0.6),
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, textAlign: 'center' }}>
            {headline}
          </div>
          <div style={{ display: 'flex', fontSize: subSize, opacity: 0.92, textAlign: 'center' }}>
            {subheadline}
          </div>
        </div>

        {shelfProducts.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: shelfHeight,
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 28,
              padding: `0 ${Math.round(pad * 0.6)}px`,
              gap: Math.round(pad * 0.6),
            }}
          >
            {shelfProducts.map((prod, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={prod.image}
                  width={thumbSize}
                  height={thumbSize}
                  style={{ borderRadius: 16, objectFit: 'cover', width: thumbSize, height: thumbSize }}
                />
                {prod.price && (
                  <div style={{ display: 'flex', fontSize: Math.round(thumbSize * 0.22), fontWeight: 700, marginTop: 8, color: COLORS.dark }}>
                    ${prod.price}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000000',
            color: '#ffffff',
            fontSize: ctaFontSize,
            fontWeight: 700,
            padding: `${Math.round(pad * 0.5)}px 0`,
            borderRadius: 9999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
        >
          Shop Now
        </div>
        <CqsBrandRow width={width} />
      </div>
    </div>
  )
}

function buildLayout(templateId: string, groupName: string, products: PromoProduct[], width: number, height: number, logo?: string) {
  switch (templateId) {
    case 'spotlight':
      return spotlightLayout(groupName, products, width, height, logo)
    case 'grid':
      return gridLayout(groupName, products, width, height, logo)
    case 'dropped':
      return droppedLayout(groupName, products, width, height, logo)
    case 'heroShelf':
      return heroShelfLayout(groupName, products, width, height, logo)
    default:
      return limitedLayout(groupName, products, width, height, logo)
  }
}

async function resolveLogoDataUrl(logoPath: string): Promise<string | undefined> {
  try {
    const admin = createAdminClient()
    const { data: signedData } = await admin.storage.from('cqs-assets').createSignedUrl(logoPath, 300)
    if (!signedData?.signedUrl) return undefined
    const res = await fetch(signedData.signedUrl)
    if (!res.ok) return undefined
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return undefined
    const contentType = res.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch (e) {
    console.error('[CQS PROMO] logo fetch failed:', e)
    return undefined
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('data')
    if (!raw) return new Response('Missing data param', { status: 400 })

    const body = decodePromoData(raw)
    const platform = getPlatform(body.platformId)
    const logo = body.logoPath ? await resolveLogoDataUrl(body.logoPath) : undefined
    const layout = buildLayout(body.templateId, body.groupName, body.products || [], platform.width, platform.height, logo)

    return new ImageResponse(layout, {
      width: platform.width,
      height: platform.height,
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[CQS PROMO] image generation failed:', message)
    return new Response(`Failed to generate image: ${message}`, { status: 500 })
  }
}

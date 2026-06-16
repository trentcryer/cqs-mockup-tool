import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, Image, TextInput, ActivityIndicator, StyleSheet, Share } from 'react-native'
import type { PromoProduct, PromoLogo, PromoTemplateMeta, PromoPlatform } from '@/lib/types'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!

export default function PromoBuilder({
  groupName,
  collectionUrl,
  products,
  logos = [],
}: {
  groupName: string
  collectionUrl: string
  products: PromoProduct[]
  logos?: PromoLogo[]
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(products[0] ? [products[0].id] : [])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [platformId, setPlatformId] = useState<string | null>(null)
  const [logoId, setLogoId] = useState<string | null>(null)
  const [customCaption, setCustomCaption] = useState<string | null>(null)

  const [templates, setTemplates] = useState<PromoTemplateMeta[]>([])
  const [platforms, setPlatforms] = useState<PromoPlatform[]>([])
  const [metaLoading, setMetaLoading] = useState(true)

  const selectedLogo = logos.find(l => l.id === logoId) || null
  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.includes(p.id)),
    [products, selectedIds]
  )

  useEffect(() => {
    setMetaLoading(true)
    const productsParam = encodeURIComponent(JSON.stringify(
      selectedProducts.map(p => ({ title: p.title, image: p.image, price: p.price }))
    ))
    fetch(`${API_BASE_URL}/api/promo/meta?groupName=${encodeURIComponent(groupName)}&products=${productsParam}`)
      .then(res => res.json())
      .then(data => {
        setTemplates(data.templates || [])
        setPlatforms(data.platforms || [])
        setTemplateId(prev => prev ?? data.templates?.[0]?.id ?? null)
        setPlatformId(prev => prev ?? data.platforms?.[0]?.id ?? null)
      })
      .catch(() => {})
      .finally(() => setMetaLoading(false))
  }, [groupName, selectedProducts])

  function toggleProduct(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const template = templates.find(t => t.id === templateId)
  const caption = customCaption ?? template?.caption ?? ''
  const shopUrl = selectedProducts.length === 1 ? selectedProducts[0].url : collectionUrl

  const encodedData = useMemo(() => JSON.stringify({
    templateId,
    platformId,
    groupName,
    products: selectedProducts.map(p => ({ title: p.title, image: p.image, price: p.price })),
    logoPath: selectedLogo?.storagePath,
  }), [templateId, platformId, groupName, selectedProducts, selectedLogo])

  const imageUrl = templateId && platformId && selectedProducts.length > 0
    ? `${API_BASE_URL}/api/promo/image?data=${encodeURIComponent(encodedData)}`
    : null

  const landingUrl = imageUrl
    ? `${API_BASE_URL}/promo/view?data=${encodeURIComponent(encodedData)}&shop=${encodeURIComponent(shopUrl)}&caption=${encodeURIComponent(caption)}`
    : null

  async function onShare() {
    if (!landingUrl) return
    try {
      await Share.share({ message: `${caption}\n\n${landingUrl}`, url: landingUrl })
    } catch {}
  }

  if (products.length === 0) {
    return <Text style={styles.muted}>No products found in this collection yet.</Text>
  }

  return (
    <View>
      <Text style={styles.label}>Products</Text>
      <View style={styles.grid}>
        {products.map(p => {
          const checked = selectedIds.includes(p.id)
          return (
            <Pressable key={p.id} onPress={() => toggleProduct(p.id)} style={[styles.thumbWrap, checked && styles.thumbWrapActive]}>
              <Image source={{ uri: p.image }} style={styles.thumb} />
              {checked && <View style={styles.checkBadge}><Text style={styles.checkBadgeText}>✓</Text></View>}
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.label}>Templates</Text>
      {metaLoading ? <ActivityIndicator /> : (
        <View style={styles.chipWrap}>
          {templates.map(t => (
            <Pressable key={t.id} onPress={() => setTemplateId(t.id)} style={[styles.chip, templateId === t.id && styles.chipActive]}>
              <Text style={[styles.chipText, templateId === t.id && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Platform</Text>
      <View style={styles.chipWrap}>
        {platforms.map(pf => (
          <Pressable key={pf.id} onPress={() => setPlatformId(pf.id)} style={[styles.chip, platformId === pf.id && styles.chipActive]}>
            <Text style={[styles.chipText, platformId === pf.id && styles.chipTextActive]}>{pf.label}</Text>
          </Pressable>
        ))}
      </View>

      {logos.length > 0 && (
        <>
          <Text style={styles.label}>Logo (optional)</Text>
          <View style={styles.chipWrap}>
            <Pressable onPress={() => setLogoId(null)} style={[styles.logoThumb, logoId === null && styles.thumbWrapActive]}>
              <Text style={styles.muted}>None</Text>
            </Pressable>
            {logos.map(l => (
              <Pressable key={l.id} onPress={() => setLogoId(l.id)} style={[styles.logoThumb, logoId === l.id && styles.thumbWrapActive]}>
                {l.displayUrl && <Image source={{ uri: l.displayUrl }} style={styles.logoImage} />}
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Preview</Text>
      <View style={styles.previewWrap}>
        {imageUrl ? (
          <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <Text style={styles.muted}>Select a product to preview</Text>
        )}
      </View>

      <Text style={styles.label}>Caption</Text>
      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCustomCaption}
        multiline
        numberOfLines={4}
      />
      <Pressable onPress={() => setCustomCaption(null)}>
        <Text style={styles.linkText}>Reset to suggested wording</Text>
      </Pressable>

      {imageUrl && (
        <Pressable style={styles.shareBtn} onPress={onShare}>
          <Text style={styles.shareBtnText}>Share</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginTop: 22, marginBottom: 12 },
  muted: { fontSize: 13, color: '#9b8c7a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 68, height: 68, borderRadius: 4, borderWidth: 2, borderColor: '#e8e0d8', overflow: 'hidden', backgroundColor: '#fff' },
  thumbWrapActive: { borderColor: '#1c1412' },
  thumb: { width: '100%', height: '100%' },
  checkBadge: { position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#1c1412', alignItems: 'center', justifyContent: 'center' },
  checkBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 3, borderWidth: 1, borderColor: '#d4c5b0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  chipText: { fontSize: 12, color: '#4a3f35', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  logoThumb: { width: 58, height: 58, borderRadius: 4, borderWidth: 2, borderColor: '#e8e0d8', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  logoImage: { width: '80%', height: '80%', resizeMode: 'contain' },
  previewWrap: { backgroundColor: '#fff', borderRadius: 4, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 220, borderWidth: 1, borderColor: '#e8e0d8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  previewImage: { width: '100%', height: 320, borderRadius: 4 },
  captionInput: { borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 4, padding: 14, fontSize: 13, color: '#1c1412', textAlignVertical: 'top', minHeight: 90, backgroundColor: '#faf9f7', lineHeight: 20 },
  linkText: { fontSize: 12, color: '#9b8c7a', marginTop: 8 },
  shareBtn: { backgroundColor: '#1c1412', borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 30 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
})

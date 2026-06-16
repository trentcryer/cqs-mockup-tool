import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { apiFetch } from '@/lib/api'
import type { ProductDetails, ColorImage } from '@/lib/printful-types'

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>()
  const router = useRouter()
  const [details, setDetails] = useState<ProductDetails | null>(null)
  const [colors, setColors] = useState<ColorImage[]>([])
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    Promise.all([
      apiFetch<ProductDetails>(`/api/printful/product/${productId}/details`),
      apiFetch<{ colors: ColorImage[] }>(`/api/printful/product/${productId}/colors`),
    ])
      .then(([detailsData, colorsData]) => {
        if (cancelled) return
        setDetails(detailsData)
        setColors(colorsData.colors || [])
        setActiveImage(colorsData.colors?.[0]?.image ?? null)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error || !details) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load this product. Pull back and try again.</Text>
      </View>
    )
  }

  const sizeTable = details.sizeTables.find(t => t.type === 'product_measure' && t.unit === 'inches') ?? details.sizeTables[0]

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.imageWrap}>
        {activeImage ? (
          <Image source={{ uri: activeImage }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.center]}>
            <Text style={styles.muted}>NO IMAGE</Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 20 }}>
      <Text style={styles.eyebrow}>Printful Blank</Text>
      <Text style={styles.title}>{details.title}</Text>
      {activeColor && <Text style={styles.colorLabel}>{activeColor}</Text>}

      <Pressable
        onPress={() => router.push(`/(app)/editor/${productId}`)}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>Make a Design with This</Text>
      </Pressable>

      {colors.length > 0 && (
        <View style={styles.swatchRow}>
          {colors.map(c => (
            <Pressable
              key={c.name}
              onPress={() => { setActiveImage(c.image); setActiveColor(c.name) }}
              style={[
                styles.swatch,
                { backgroundColor: c.code },
                activeColor === c.name && styles.swatchActive,
              ]}
            />
          ))}
        </View>
      )}

      {details.introParagraphs.map((p, i) => (
        <Text key={i} style={styles.paragraph}>{p}</Text>
      ))}

      {details.bullets.length > 0 && (
        <View style={styles.bulletList}>
          {details.bullets.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {details.sizes.length > 0 && (
        <View style={styles.sizesRow}>
          {details.sizes.map(size => (
            <View key={size} style={styles.sizeChip}>
              <Text style={styles.sizeChipText}>{size}</Text>
            </View>
          ))}
        </View>
      )}

      {sizeTable && sizeTable.measurements.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionTitle}>Size Guide · {sizeTable.unit === 'inches' ? 'Inches' : 'cm'}</Text>
          <ScrollView horizontal style={styles.table}>
            <View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableHeaderCell, { width: 110 }]}>Measurement</Text>
                {sizeTable.measurements[0].values.map(v => (
                  <Text key={v.size} style={[styles.tableCell, styles.tableHeaderCell]}>{v.size}</Text>
                ))}
              </View>
              {sizeTable.measurements.map(m => (
                <View key={m.type_label} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: 110, fontWeight: '600' }]}>{m.type_label}</Text>
                  {m.values.map(v => (
                    <Text key={v.size} style={styles.tableCell}>
                      {v.value ?? (v.min_value && v.max_value ? `${v.min_value}–${v.max_value}` : '—')}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageWrap: { backgroundColor: '#f0ece6', marginBottom: 0 },
  image: { width: '100%', aspectRatio: 4 / 5 },
  eyebrow: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2.5, color: '#9b8c7a', fontWeight: '700', marginTop: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1412', marginTop: 4, letterSpacing: -0.3 },
  colorLabel: { fontSize: 12, color: '#9b8c7a', marginTop: 2 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#d4c5b0' },
  swatchActive: { borderColor: '#1c1412' },
  paragraph: { fontSize: 14, color: '#4a3f35', marginTop: 14, lineHeight: 22 },
  bulletList: { marginTop: 8, gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#9b8c7a', marginTop: 8 },
  bulletText: { fontSize: 14, color: '#4a3f35', flex: 1, lineHeight: 22 },
  sizesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  sizeChip: { borderWidth: 1, borderColor: '#d4c5b0', borderRadius: 2, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  sizeChipText: { fontSize: 12, color: '#4a3f35', fontWeight: '500' },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginBottom: 10, marginTop: 8 },
  table: { backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#e8e0d8' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0ece6' },
  tableCell: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: '#6b5f54', width: 70, textAlign: 'center' },
  tableHeaderCell: { fontWeight: '700', color: '#9b8c7a', textTransform: 'uppercase', fontSize: 9 },
  muted: { fontSize: 12, color: '#9b8c7a' },
  primaryBtn: { backgroundColor: '#1c1412', borderRadius: 4, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
})

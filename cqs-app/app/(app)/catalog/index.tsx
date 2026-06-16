import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, FlatList, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { apiFetch } from '@/lib/api'
import { CATEGORIES, PRINT_METHODS, PAGE_SIZE, matchesCategory, type PrintfulProduct } from '@/lib/catalog'

export default function CatalogScreen() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<PrintfulProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('favorites')
  const [printMethod, setPrintMethod] = useState('standard')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<{ products: PrintfulProduct[] }>('/api/printful/catalog')
      .then(data => { if (!cancelled) setProducts(data.products || []) })
      .catch(() => { if (!cancelled) setError('Could not load the product catalog.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => { setPage(1) }, [q, category, printMethod])

  const filtered = useMemo(() => {
    let r = products
    if (q) r = r.filter(p => p.title.toLowerCase().includes(q.toLowerCase()))
    if (category !== 'all') r = r.filter(p => matchesCategory(p, category))
    if (printMethod !== 'all') r = r.filter(p => (p.printMethod || 'standard') === printMethod)
    return r
  }, [products, q, category, printMethod])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  return (
    <View style={styles.container}>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search styles, fabrics, brands…"
          placeholderTextColor="#9b8c7a"
          value={q}
          onChangeText={setQ}
        />
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={styles.tabRowContent}
      >
        {CATEGORIES.map(item => {
          const active = category === item.key
          return (
            <Pressable key={item.key} onPress={() => setCategory(item.key)} style={styles.tab}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              {active && <View style={styles.tabUnderline} />}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Method tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.methodRow}
        contentContainerStyle={styles.tabRowContent}
      >
        {PRINT_METHODS.map(item => {
          const active = printMethod === item.key
          return (
            <Pressable key={item.key} onPress={() => setPrintMethod(item.key)} style={styles.methodTab}>
              <Text style={[styles.methodTabText, active && styles.methodTabTextActive]}>{item.label}</Text>
              {active && <View style={styles.methodUnderline} />}
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.divider} />

      {/* Result count */}
      {!loading && !error && (
        <Text style={styles.resultCount}>{filtered.length} styles</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#1c1412" />
          <Text style={styles.loadingText}>Loading catalog…</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore) setPage(p => p + 1) }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No styles found</Text>
              <Text style={styles.emptyBody}>Try a different category or clear your search.</Text>
            </View>
          }
          ListFooterComponent={hasMore ? <ActivityIndicator style={{ marginVertical: 24 }} color="#1c1412" /> : null}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(app)/catalog/${item.id}`)}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.imageFallback]}>
                  <Text style={styles.imageFallbackText}>CQS</Text>
                </View>
              )}
              {item.printMethod && item.printMethod !== 'standard' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.printMethod === 'embroidery' ? 'Embroidery' : 'All-Over'}
                  </Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },

  searchWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1c1412',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },

  tabRow: { flexGrow: 0, flexShrink: 0 },
  methodRow: { flexGrow: 0, flexShrink: 0, marginTop: 2 },
  tabRowContent: { paddingHorizontal: 16, gap: 0 },

  tab: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, alignItems: 'center' },
  tabText: { fontSize: 13, color: '#9b8c7a', fontWeight: '500', letterSpacing: 0.2 },
  tabTextActive: { color: '#1c1412', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, backgroundColor: '#9b1c1c', borderRadius: 1 },

  methodTab: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, alignItems: 'center' },
  methodTabText: { fontSize: 12, color: '#b8a898', fontWeight: '400', letterSpacing: 0.3 },
  methodTabTextActive: { color: '#1c1412', fontWeight: '600' },
  methodUnderline: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 1.5, backgroundColor: '#9b1c1c', borderRadius: 1 },

  divider: { height: 1, backgroundColor: '#e8e0d8', marginTop: 4, marginBottom: 8 },

  resultCount: { fontSize: 11, color: '#9b8c7a', letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 12 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#9b8c7a' },

  error: { color: '#9b1c1c', textAlign: 'center', marginTop: 24, fontSize: 13 },

  grid: { paddingHorizontal: 16, paddingBottom: 48 },
  row: { gap: 12, marginBottom: 16 },

  card: { flex: 1, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  cardImage: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#f0ece6' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: { fontSize: 11, fontWeight: '700', color: '#d4c5b0', letterSpacing: 3 },
  cardBody: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  cardTitle: { fontSize: 12, fontWeight: '500', color: '#1c1412', lineHeight: 17, letterSpacing: 0.1 },

  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#1c1412', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2 },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  emptyWrap: { paddingTop: 64, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1c1412', marginBottom: 8 },
  emptyBody: { fontSize: 13, color: '#9b8c7a', textAlign: 'center' },
})

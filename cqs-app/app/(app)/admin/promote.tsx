import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native'
import { apiFetch, ApiError } from '@/lib/api'
import PromoBuilder from '@/components/PromoBuilder'
import type { PromoProduct, PromoLogo } from '@/lib/types'

interface CollectionOption {
  id: number
  title: string
  handle: string
}

interface CollectionData {
  groupName: string
  collectionUrl: string
  products: PromoProduct[]
  logos: PromoLogo[]
}

export default function AdminPromoteScreen() {
  const [collections, setCollections] = useState<CollectionOption[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [data, setData] = useState<CollectionData | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCollections = useCallback(async () => {
    try {
      const res = await apiFetch<{ collections: CollectionOption[] }>('/api/admin/promote/collections')
      setCollections(res.collections)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load collections')
    }
  }, [])

  useEffect(() => { loadCollections().finally(() => setLoadingList(false)) }, [loadCollections])

  useEffect(() => {
    if (!selectedId) return
    setLoadingData(true)
    setData(null)
    apiFetch<CollectionData>(`/api/admin/promote/collection/${selectedId}`)
      .then(setData)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Failed to load collection'))
      .finally(() => setLoadingData(false))
  }, [selectedId])

  async function onRefresh() {
    setLoadingList(true)
    await loadCollections()
    setLoadingList(false)
  }

  if (loadingList) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loadingList} onRefresh={onRefresh} />}
    >
      <Text style={styles.label}>Collection</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.chipWrap}>
        {collections.map(c => (
          <Pressable
            key={c.id}
            onPress={() => setSelectedId(c.id)}
            style={[styles.chip, selectedId === c.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, selectedId === c.id && styles.chipTextActive]}>{c.title}</Text>
          </Pressable>
        ))}
      </View>

      {loadingData && <ActivityIndicator style={{ marginTop: 20 }} />}

      {data && (
        <PromoBuilder
          groupName={data.groupName}
          collectionUrl={data.collectionUrl}
          products={data.products}
          logos={data.logos}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  content: { padding: 20, paddingTop: 28, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginBottom: 12 },
  errorText: { fontSize: 13, color: '#9b1c1c', marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 3, borderWidth: 1, borderColor: '#d4c5b0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  chipText: { fontSize: 12, color: '#4a3f35', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
})

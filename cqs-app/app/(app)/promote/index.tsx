import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native'
import { apiFetch } from '@/lib/api'
import PromoBuilder from '@/components/PromoBuilder'
import type { PromoProduct, PromoLogo } from '@/lib/types'

interface PromoteData {
  groupName: string
  collectionId: number | null
  collectionUrl: string
  products: PromoProduct[]
  logos: PromoLogo[]
}

export default function PromoteScreen() {
  const [data, setData] = useState<PromoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<PromoteData>('/api/studio/promote-data')
      setData(res)
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.eyebrow}>Marketing</Text>
      <Text style={styles.h1}>Promote My Store</Text>
      <Text style={styles.subtitle}>Create a promo image for your collection to share on social media.</Text>

      {!data?.collectionId ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyBody}>Your group isn&apos;t linked to a collection yet — contact CQS to get set up.</Text>
        </View>
      ) : (
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
  eyebrow: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2.5, color: '#9b8c7a', fontWeight: '700' },
  h1: { fontSize: 28, fontWeight: '700', color: '#1c1412', marginTop: 4, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#9b8c7a', marginTop: 0, marginBottom: 24, lineHeight: 22 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 4, padding: 32, marginTop: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e8e0d8' },
  emptyBody: { fontSize: 13, color: '#9b8c7a', textAlign: 'center', lineHeight: 20 },
})

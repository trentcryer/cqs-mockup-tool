import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, Pressable, TextInput, Image,
  ActivityIndicator, StyleSheet, Alert, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSession } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { apiFetch, ApiError } from '@/lib/api'
import { deleteLogo, deleteDesign, updateGroupName } from '@/lib/actions'
import { loadSavedLogos } from '@/lib/logos'
import type { Profile, Logo, Design, GroupProduct, GroupReport } from '@/lib/types'
import type { ProductMeta } from '@/lib/printful-types'

type DashboardState = 'loading' | 'no-collection' | 'error' | 'ok'

export default function HomebaseScreen() {
  const { session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [refreshing, setRefreshing] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [logos, setLogos] = useState<Logo[]>([])
  const [designs, setDesigns] = useState<Design[]>([])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const [dashboardState, setDashboardState] = useState<DashboardState>('loading')
  const [products, setProducts] = useState<GroupProduct[]>([])
  const [report, setReport] = useState<GroupReport | null>(null)

  const [tab, setTab] = useState<'designs' | 'logos'>('designs')

  const load = useCallback(async () => {
    if (!user) return

    const [profileRes, savedLogos, designsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      loadSavedLogos(user.id),
      supabase.from('designs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    const prof = profileRes.data as Profile | null
    setProfile(prof)
    setNameInput(prof?.quartet_name || '')
    setDesigns((designsRes.data as Design[]) || [])
    setLogos(savedLogos)

    if (!prof?.shopify_collection_id) {
      setDashboardState('no-collection')
      return
    }

    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()
      const [productsData, reportData] = await Promise.all([
        apiFetch<{ products: GroupProduct[] }>('/api/group/products'),
        apiFetch<GroupReport>(`/api/group/report?startDate=${encodeURIComponent(sixtyDaysAgo)}&endDate=${encodeURIComponent(now)}`),
      ])
      setProducts(productsData.products)
      setReport(reportData)
      setDashboardState('ok')
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setDashboardState('no-collection')
      else setDashboardState('error')
    }
  }, [user])

  useEffect(() => { load() }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function saveName() {
    if (!user) return
    await updateGroupName(user.id, nameInput.trim() || 'My Quartet')
    setEditingName(false)
    load()
  }

  async function onDeleteLogo(logo: Logo) {
    if (!user) return
    await deleteLogo(logo.id, logo.storage_path, user.id)
    load()
  }

  async function onDeleteDesign(design: Design) {
    Alert.alert('Delete design?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDesign(design.id); load() } },
    ])
  }

  const [reviewDesign, setReviewDesign] = useState<Design | null>(null)
  const [reviewMeta, setReviewMeta] = useState<ProductMeta | null>(null)
  const [reviewColors, setReviewColors] = useState<string[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  function openReviewModal(design: Design) {
    setReviewDesign(design)
    setReviewMeta(null)
    setReviewColors(Object.keys(design.color_variant_map || (design.color ? { [design.color]: design.variant_ids || [] } : {})))
    setReviewLoading(true)
    apiFetch<ProductMeta>(`/api/printful/product/${design.product_id}`)
      .then(setReviewMeta)
      .catch(() => Alert.alert('Could not load color options'))
      .finally(() => setReviewLoading(false))
  }

  function closeReviewModal() { setReviewDesign(null) }

  function toggleReviewColor(color: string) {
    setReviewColors(prev => (prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]))
  }

  async function submitReview() {
    if (!reviewDesign || !reviewMeta || reviewColors.length === 0) {
      Alert.alert('Pick at least one color')
      return
    }
    setReviewSubmitting(true)
    try {
      const colorVariantMap: Record<string, number[]> = {}
      for (const c of reviewColors) colorVariantMap[c] = reviewMeta.colorMap[c] || []
      const primaryColor = reviewColors.includes(reviewDesign.color || '') ? reviewDesign.color! : reviewColors[0]
      const { error } = await supabase.from('designs').update({
        color_variant_map: colorVariantMap,
        color: primaryColor,
        variant_ids: colorVariantMap[primaryColor],
      }).eq('id', reviewDesign.id)
      if (error) throw error
      await apiFetch('/api/studio/request-review', { method: 'POST', body: JSON.stringify({ designId: reviewDesign.id }) })
      closeReviewModal()
      load()
    } catch (e: any) {
      Alert.alert('Submit failed', e.message || 'Please try again')
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (!profile && dashboardState === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1c1412" /></View>
  }

  const groupLabel = profile?.group_type === 'chorus' ? 'Chorus' : 'Quartet'
  const groupName = profile?.quartet_name || `My ${groupLabel}`
  const activeCount = products.filter(p => p.status === 'active').length
  const soldIds = new Set((report?.products || []).filter(p => p.unitsSold > 0).map(p => p.productId))
  const staleProducts = products.filter(p => !soldIds.has(p.id) && p.status === 'active')
  const bestSellers = (report?.products || []).filter(p => p.unitsSold > 0).slice(0, 5)

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1c1412" />}
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Private Workspace</Text>
          <Text style={styles.h1}>{groupName}</Text>
          <Pressable style={styles.newDesignBtn} onPress={() => router.push('/(app)/catalog')}>
            <Text style={styles.newDesignBtnText}>Browse Catalog & Design</Text>
          </Pressable>
        </View>

        {/* Group name editor */}
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput style={styles.nameInput} value={nameInput} onChangeText={setNameInput} autoFocus />
            <Pressable style={styles.saveBtn} onPress={saveName}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEditingName(true)} style={styles.renameRow}>
            <Text style={styles.renameHint}>{groupLabel} name · tap to change</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        {/* Storefront dashboard */}
        <Text style={styles.sectionLabel}>
          {profile?.shopify_collection_title || 'Storefront'} · Dashboard
        </Text>

        {dashboardState === 'no-collection' ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your storefront dashboard</Text>
            <Text style={styles.emptyBody}>Once your first design is approved and your collection goes live, you'll see live inventory, sales data, and trends right here.</Text>
          </View>
        ) : dashboardState === 'error' ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>Dashboard data temporarily unavailable — pull to refresh.</Text>
          </View>
        ) : dashboardState === 'loading' ? (
          <ActivityIndicator color="#1c1412" style={{ marginVertical: 24 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Products" value={String(products.length)} />
              <StatCard label="Active" value={String(activeCount)} />
              <StatCard label="Units · 60d" value={String(report?.totalUnits ?? 0)} />
              <StatCard label="Revenue · 60d" value={`$${(report?.totalRevenue ?? 0).toFixed(0)}`} />
            </View>

            {bestSellers.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Best Sellers · 60 Days</Text>
                <View style={styles.card}>
                  {bestSellers.map((item, i) => (
                    <View key={item.productId} style={[styles.listRow, i < bestSellers.length - 1 && styles.listRowBorder]}>
                      <Text style={styles.rank}>{i + 1}</Text>
                      {item.image && <Image source={{ uri: item.image }} style={styles.rowThumb} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Text style={styles.rowMeta}>{item.unitsSold} units · ${item.revenue.toFixed(0)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {staleProducts.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>No Sales in 60 Days</Text>
                <View style={styles.card}>
                  {staleProducts.slice(0, 5).map((p, i) => (
                    <View key={p.id} style={[styles.listRow, i < Math.min(staleProducts.length, 5) - 1 && styles.listRowBorder]}>
                      {p.image && <Image source={{ uri: p.image }} style={styles.rowThumb} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{p.title}</Text>
                        <Text style={styles.rowMeta}>${p.price}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {products.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Your Merch</Text>
                <View style={styles.merchGrid}>
                  {products.map(p => (
                    <View key={p.id} style={styles.merchCard}>
                      {p.image
                        ? <Image source={{ uri: p.image }} style={styles.merchImage} resizeMode="cover" />
                        : <View style={[styles.merchImage, styles.center]}><Text style={styles.mutedSmall}>CQS</Text></View>}
                      <Text style={styles.merchTitle} numberOfLines={2}>{p.title}</Text>
                      {p.price && <Text style={styles.merchPrice}>${p.price}</Text>}
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <View style={styles.divider} />

        {/* Designs / Logos tabs */}
        <View style={styles.tabRow}>
          {(['designs', 'logos'] as const).map(t => {
            const active = tab === t
            const label = t === 'designs' ? `My Designs (${designs.length})` : `Logo Library (${logos.length})`
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={styles.tabItem}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                {active && <View style={styles.tabUnderline} />}
              </Pressable>
            )
          })}
        </View>

        {tab === 'designs' ? (
          designs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyBody}>No designs yet. Browse the catalog to create your first mockup.</Text>
            </View>
          ) : (
            designs.map(d => {
              const firstMock = (d.mockup_urls as any[])?.[0]?.mockup_url
              const colorCount = Object.keys(d.color_variant_map || {}).length
              return (
                <Pressable key={d.id} style={styles.designCard} onPress={() => openReviewModal(d)}>
                  {firstMock
                    ? <Image source={{ uri: firstMock }} style={styles.designImage} resizeMode="cover" />
                    : <View style={[styles.designImage, styles.center]}><Text style={styles.mutedSmall}>NO MOCKUP YET</Text></View>}
                  <View style={styles.designMeta}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.designTitle}>{d.product_title}</Text>
                      <Text style={styles.designSub}>{colorCount > 1 ? `${colorCount} colors` : (d.color || '—')} · {d.placement}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{d.status.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <View style={styles.designActions}>
                    <Pressable onPress={e => { e.stopPropagation?.(); router.push(`/(app)/editor/${d.product_id}?designId=${d.id}`) }}>
                      <Text style={styles.actionLink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={e => { e.stopPropagation?.(); onDeleteDesign(d) }}>
                      <Text style={styles.actionDanger}>Delete</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )
            })
          )
        ) : (
          logos.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyBody}>Upload a logo when creating your first design — it's saved here automatically.</Text>
            </View>
          ) : (
            <View style={styles.logoGrid}>
              {logos.map(logo => (
                <View key={logo.id} style={styles.logoCard}>
                  {logo.displayUrl
                    ? <Image source={{ uri: logo.displayUrl }} style={styles.logoImage} resizeMode="contain" />
                    : <View style={[styles.logoImage, styles.center]}><Text style={styles.mutedSmall}>—</Text></View>}
                  <Text style={styles.logoName} numberOfLines={1}>{logo.filename}</Text>
                  <Pressable onPress={() => onDeleteLogo(logo)}>
                    <Text style={styles.actionDanger}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>

      {/* Submit for review modal */}
      <Modal visible={!!reviewDesign} animationType="slide" transparent onRequestClose={closeReviewModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <Pressable onPress={closeReviewModal} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
              {reviewDesign && (
                <>
                  {(reviewDesign.mockup_urls as any[])?.[0]?.mockup_url ? (
                    <Image source={{ uri: (reviewDesign.mockup_urls as any[])[0].mockup_url }} style={styles.modalImage} />
                  ) : (
                    <View style={[styles.modalImage, styles.center]}><Text style={styles.mutedSmall}>NO MOCKUP YET</Text></View>
                  )}
                  <Text style={styles.modalTitle}>{reviewDesign.product_title}</Text>
                  <Text style={styles.modalSub}>{reviewDesign.placement}</Text>

                  <Text style={styles.modalSectionLabel}>Select Colors</Text>
                  {reviewLoading ? (
                    <ActivityIndicator color="#1c1412" style={{ marginTop: 12 }} />
                  ) : reviewMeta ? (
                    <View style={styles.colorGrid}>
                      {Object.keys(reviewMeta.colorMap).sort().map(c => {
                        const checked = reviewColors.includes(c)
                        return (
                          <Pressable key={c} onPress={() => toggleReviewColor(c)} style={[styles.colorChip, checked && styles.colorChipActive]}>
                            <Text style={[styles.colorChipText, checked && styles.colorChipTextActive]}>{c}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  ) : (
                    <Text style={styles.muted}>Could not load color options.</Text>
                  )}

                  {reviewDesign.status === 'draft' ? (
                    <Pressable
                      onPress={submitReview}
                      disabled={reviewSubmitting || reviewLoading}
                      style={[styles.submitBtn, (reviewSubmitting || reviewLoading) && styles.btnDisabled]}
                    >
                      {reviewSubmitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.submitBtnText}>Submit for Review</Text>}
                    </Pressable>
                  ) : (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{reviewDesign.status.replace(/_/g, ' ')}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  content: { paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20, backgroundColor: '#1c1412' },
  eyebrow: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2.5, color: '#9b8c7a', marginBottom: 4 },
  h1: { fontSize: 30, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 20 },
  newDesignBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10 },
  newDesignBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },

  renameRow: { paddingHorizontal: 20, paddingVertical: 12 },
  renameHint: { fontSize: 12, color: '#9b8c7a' },
  nameEditRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  nameInput: { flex: 1, borderWidth: 1, borderColor: '#d4c5b0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#1c1412', paddingHorizontal: 16, borderRadius: 6, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  divider: { height: 1, backgroundColor: '#e8e0d8', marginVertical: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },

  emptyCard: { marginHorizontal: 20, marginBottom: 20, padding: 24, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e0d8', alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1c1412', marginBottom: 8 },
  emptyBody: { fontSize: 13, color: '#9b8c7a', textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 4, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1c1412', marginBottom: 2 },
  statLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#9b8c7a', textAlign: 'center' },

  card: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0ece6' },
  rank: { fontSize: 11, fontWeight: '700', color: '#c4b49f', width: 16 },
  rowThumb: { width: 40, height: 40, borderRadius: 4, backgroundColor: '#f0ece6' },
  rowTitle: { fontSize: 13, fontWeight: '500', color: '#1c1412', marginBottom: 2 },
  rowMeta: { fontSize: 11, color: '#9b8c7a' },

  merchGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  merchCard: { width: '30%' },
  merchImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: 4, backgroundColor: '#f0ece6', marginBottom: 6 },
  merchTitle: { fontSize: 11, fontWeight: '500', color: '#1c1412', lineHeight: 15 },
  merchPrice: { fontSize: 11, color: '#9b8c7a', marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e8e0d8', marginBottom: 16 },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 13, color: '#9b8c7a', fontWeight: '500' },
  tabTextActive: { color: '#1c1412', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#9b1c1c' },

  designCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  designImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#f0ece6' },
  designMeta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  designTitle: { fontSize: 14, fontWeight: '600', color: '#1c1412', marginBottom: 2 },
  designSub: { fontSize: 12, color: '#9b8c7a' },
  designActions: { flexDirection: 'row', gap: 20, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8 },
  actionLink: { fontSize: 12, color: '#1c1412', fontWeight: '600' },
  actionDanger: { fontSize: 12, color: '#9b1c1c' },

  statusPill: { backgroundColor: '#f0ece6', borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: '#8a7660' },

  logoGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  logoCard: { width: '30%', alignItems: 'center' },
  logoImage: { width: '100%', aspectRatio: 1, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e0d8', marginBottom: 6 },
  logoName: { fontSize: 10, color: '#9b8c7a', marginBottom: 4, textAlign: 'center' },

  muted: { fontSize: 13, color: '#9b8c7a' },
  mutedSmall: { fontSize: 10, color: '#c4b49f', letterSpacing: 2, textTransform: 'uppercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#f7f5f2', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  modalClose: { alignSelf: 'flex-end', marginBottom: 12 },
  modalCloseText: { fontSize: 13, color: '#9b8c7a', fontWeight: '600' },
  modalImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 4, backgroundColor: '#fff', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1c1412', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#9b8c7a', marginBottom: 4 },
  modalSectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginTop: 20, marginBottom: 12 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 3, borderWidth: 1, borderColor: '#d4c5b0', backgroundColor: '#fff' },
  colorChipActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  colorChipText: { fontSize: 13, color: '#4a3f35' },
  colorChipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: '#1c1412', borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.4 },
})

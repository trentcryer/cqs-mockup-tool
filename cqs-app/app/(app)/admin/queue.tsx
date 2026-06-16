import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, Pressable, TextInput, Image,
  ActivityIndicator, StyleSheet, Alert, Modal,
} from 'react-native'
import { apiFetch, ApiError } from '@/lib/api'
import PricingChartModal from '@/components/PricingChartModal'
import type { Design, Profile, PricingData } from '@/lib/types'

type QueueDesign = Design & {
  profile: (Pick<Profile, 'email' | 'quartet_name'> & { kickback_percentage?: number }) | null
}

export default function AdminQueueScreen() {
  const [designs, setDesigns] = useState<QueueDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [active, setActive] = useState<QueueDesign | null>(null)
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [pricingOpen, setPricingOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ designs: QueueDesign[] }>('/api/admin/designs?status=review_requested')
      setDesigns(res.designs)
    } catch (e) {
      Alert.alert('Failed to load queue', e instanceof ApiError ? e.message : 'Please try again')
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function openDesign(d: QueueDesign) {
    setActive(d)
    setRejectNotes('')
    const allColors = Object.keys(d.color_variant_map || (d.color ? { [d.color]: d.variant_ids || [] } : {}))
    setSelectedColors(allColors)
  }

  function toggleColor(color: string) {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    )
  }

  function buildColorVariantMap(): Record<string, number[]> | undefined {
    if (!active) return undefined
    const base: Record<string, number[]> = active.color_variant_map || (active.color ? { [active.color]: active.variant_ids || [] } : {})
    const filtered: Record<string, number[]> = {}
    for (const c of selectedColors) {
      if (base[c]) filtered[c] = base[c]
    }
    return Object.keys(filtered).length > 0 ? filtered : undefined
  }

  async function approve(pricing: PricingData, customTitle: string, saveKickback: string) {
    if (!active) return
    setBusy(true)
    try {
      const res = await apiFetch<{ ok: boolean; shopify_product_url: string | null }>(
        `/api/admin/designs/${active.id}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ pricing, customTitle, saveKickback, colorVariantMap: buildColorVariantMap() }),
        }
      )
      Alert.alert('Approved', res.shopify_product_url ? 'Pushed to Shopify successfully.' : 'Approved (Shopify push may have failed — check web admin).')
      setPricingOpen(false)
      setActive(null)
      load()
    } catch (e) {
      Alert.alert('Approve failed', e instanceof ApiError ? e.message : 'Please try again')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!active) return
    setBusy(true)
    try {
      await apiFetch(`/api/admin/designs/${active.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes: rejectNotes || undefined }),
      })
      setActive(null)
      load()
    } catch (e) {
      Alert.alert('Reject failed', e instanceof ApiError ? e.message : 'Please try again')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {designs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>No designs waiting for review.</Text>
          </View>
        ) : (
          designs.map(d => {
            const allColors = Object.keys(d.color_variant_map || (d.color ? { [d.color]: [] } : {}))
            const mock = (d.mockup_urls as any[])?.[0]?.mockup_url
            return (
              <Pressable key={d.id} style={styles.card} onPress={() => openDesign(d)}>
                {mock ? (
                  <Image source={{ uri: mock }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.center]}><Text style={styles.muted}>NO IMG</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{d.product_title}</Text>
                  <Text style={styles.itemMeta}>{d.profile?.quartet_name || 'Unknown group'}</Text>
                  <Text style={styles.itemMeta}>{allColors.length > 1 ? `${allColors.length} colors` : (d.color || '—')} · {d.placement}</Text>
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>

      <Modal visible={!!active} animationType="slide" transparent onRequestClose={() => setActive(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Pressable onPress={() => setActive(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>

              {active && (() => {
                const mockupsByColor = new Map<string, string>()
                for (const m of ((active.mockup_urls as any[]) ?? [])) {
                  if (m.color && m.mockup_url && !mockupsByColor.has(m.color)) {
                    mockupsByColor.set(m.color, m.mockup_url)
                  }
                }
                const allColors = Object.keys(active.color_variant_map || (active.color ? { [active.color]: [] } : {}))
                const hasMultiColor = allColors.length > 1
                const primaryMockup = mockupsByColor.get(active.color || '') || (active.mockup_urls as any[])?.[0]?.mockup_url

                return (
                  <>
                    {primaryMockup ? (
                      <Image source={{ uri: primaryMockup }} style={styles.modalImage} />
                    ) : (
                      <View style={[styles.modalImage, styles.center]}><Text style={styles.muted}>NO MOCKUP</Text></View>
                    )}

                    <Text style={styles.itemTitle}>{active.product_title}</Text>
                    <Text style={styles.itemMeta}>{active.profile?.quartet_name} · {active.profile?.email}</Text>
                    {active.notes && <Text style={styles.notes}>{active.notes}</Text>}

                    <Text style={styles.label}>
                      Colors to push {hasMultiColor ? `(${selectedColors.length} of ${allColors.length} selected)` : ''}
                    </Text>
                    <View style={styles.colorGrid}>
                      {allColors.map(color => {
                        const mockUrl = mockupsByColor.get(color)
                        const checked = selectedColors.includes(color)
                        return (
                          <Pressable key={color} onPress={() => toggleColor(color)} style={[styles.colorCard, checked && styles.colorCardActive]}>
                            {mockUrl ? (
                              <Image source={{ uri: mockUrl }} style={styles.colorThumb} />
                            ) : (
                              <View style={[styles.colorThumb, styles.center]}>
                                <Text style={styles.muted}>—</Text>
                              </View>
                            )}
                            <Text style={[styles.colorLabel, checked && styles.colorLabelActive]}>{color}</Text>
                            {checked && <View style={styles.checkBadge}><Text style={styles.checkMark}>✓</Text></View>}
                          </Pressable>
                        )
                      })}
                    </View>

                    <Pressable
                      style={[styles.approveBtn, selectedColors.length === 0 && styles.btnDisabled]}
                      disabled={selectedColors.length === 0}
                      onPress={() => setPricingOpen(true)}
                    >
                      <Text style={styles.approveBtnText}>Set Pricing & Approve</Text>
                    </Pressable>

                    <Text style={[styles.label, { marginTop: 20 }]}>Reject notes (optional)</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 60 }]}
                      value={rejectNotes}
                      onChangeText={setRejectNotes}
                      multiline
                    />
                    <Pressable style={[styles.rejectBtn, busy && styles.btnDisabled]} disabled={busy} onPress={reject}>
                      <Text style={styles.rejectBtnText}>Reject — back to Draft</Text>
                    </Pressable>
                  </>
                )
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {active && (
        <PricingChartModal
          design={active}
          defaultKickback={active.profile?.kickback_percentage ?? 0}
          visible={pricingOpen}
          onClose={() => setPricingOpen(false)}
          onConfirm={approve}
          busy={busy}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 12, color: '#9b8c7a' },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  thumb: { width: 60, height: 60, borderRadius: 4, backgroundColor: '#f0ece6' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1c1412', marginBottom: 2 },
  itemMeta: { fontSize: 12, color: '#9b8c7a' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 4, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#e8e0d8' },
  emptyBody: { fontSize: 13, color: '#9b8c7a', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#f7f5f2', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  modalCloseBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  modalCloseText: { color: '#9b8c7a', fontSize: 13, fontWeight: '600' },
  modalImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 4, backgroundColor: '#fff', marginBottom: 14 },
  notes: { fontSize: 13, color: '#4a3f35', fontStyle: 'italic', marginTop: 8, lineHeight: 20 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginTop: 18, marginBottom: 10 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorCard: { width: 82, borderRadius: 4, borderWidth: 2, borderColor: '#e8e0d8', overflow: 'hidden', backgroundColor: '#fff' },
  colorCardActive: { borderColor: '#1c1412' },
  colorThumb: { width: '100%', height: 82 },
  colorLabel: { fontSize: 10, textAlign: 'center', padding: 5, color: '#9b8c7a' },
  colorLabelActive: { color: '#1c1412', fontWeight: '600' },
  checkBadge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1c1412', alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 4, padding: 12, fontSize: 14, color: '#1c1412', backgroundColor: '#faf9f7', textAlignVertical: 'top' },
  approveBtn: { backgroundColor: '#1c1412', borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#9b1c1c', borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 24 },
  rejectBtnText: { color: '#9b1c1c', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
})

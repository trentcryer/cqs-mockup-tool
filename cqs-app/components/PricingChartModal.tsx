import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, Switch,
  ActivityIndicator, StyleSheet, Modal,
} from 'react-native'
import { apiFetch, ApiError } from '@/lib/api'
import type { AdminVariantPrice, PricingData, Design } from '@/lib/types'

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

export default function PricingChartModal({
  design,
  defaultKickback,
  visible,
  onClose,
  onConfirm,
  busy,
}: {
  design: Design
  defaultKickback: number
  visible: boolean
  onClose: () => void
  onConfirm: (pricing: PricingData, customTitle: string, saveKickback: string) => void
  busy: boolean
}) {
  const [variants, setVariants] = useState<AdminVariantPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'flat' | 'by_size'>('flat')
  const [markupMode, setMarkupMode] = useState<'percentage' | 'custom'>('percentage')
  const [markupPercent, setMarkupPercent] = useState('60')
  const [customPrice, setCustomPrice] = useState('')
  const [kickbackEnabled, setKickbackEnabled] = useState(defaultKickback > 0)
  const [kickbackPercent, setKickbackPercent] = useState(String(defaultKickback || 15))
  const [saveKickback, setSaveKickback] = useState(false)
  const [sizePrices, setSizePrices] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    setError(null)
    setVariants([])
    setMode('flat')
    setMarkupMode('percentage')
    setMarkupPercent('60')
    setCustomPrice('')
    setKickbackEnabled(defaultKickback > 0)
    setKickbackPercent(String(defaultKickback || 15))
    setSaveKickback(false)
    setSizePrices({})

    apiFetch<{ variants: AdminVariantPrice[] }>(
      `/api/admin/product-pricing?productId=${design.product_id}&variantIds=${(design.variant_ids || []).join(',')}`
    )
      .then(res => setVariants(res.variants || []))
      .catch(e => setError(e instanceof ApiError ? e.message : 'Failed to load Printful prices'))
      .finally(() => setLoading(false))
  }, [visible, design.product_id, design.variant_ids, defaultKickback])

  const sizeGroups = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const v of variants) {
      const key = v.size || 'One Size'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(v.printfulCost)
    }
    return Array.from(map.entries()).map(([size, costs]) => ({ size, cost: Math.max(...costs) }))
  }, [variants])

  const avgCost = useMemo(() => {
    if (!variants.length) return 0
    return variants.reduce((s, v) => s + v.printfulCost, 0) / variants.length
  }, [variants])

  function retailFor(cost: number): number {
    if (markupMode === 'custom') return parseFloat(customPrice) || 0
    return cost * (1 + (parseFloat(markupPercent) || 0) / 100)
  }

  const flatRetail = retailFor(avgCost)
  const kbPercent = parseFloat(kickbackPercent) || 0
  const flatKickback = kickbackEnabled ? flatRetail * (kbPercent / 100) : 0
  const flatMyCut = flatRetail - avgCost - flatKickback

  function sizeRowIds(size: string) {
    return variants.filter(v => (v.size || 'One Size') === size).map(v => v.variantId)
  }

  function setSizePrice(size: string, value: string) {
    const ids = sizeRowIds(size)
    setSizePrices(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = value })
      return next
    })
  }

  function buildPricingData(): PricingData {
    if (mode === 'flat') {
      return { mode: 'flat', flatPrice: flatRetail.toFixed(2), kickbackEnabled, kickbackPercent: kbPercent }
    }
    const variantPrices: Record<number, string> = {}
    for (const v of variants) {
      const custom = sizePrices[v.variantId]
      variantPrices[v.variantId] = custom
        ? parseFloat(custom).toFixed(2)
        : retailFor(v.printfulCost).toFixed(2)
    }
    return { mode: 'by_size', variantPrices, kickbackEnabled, kickbackPercent: kbPercent }
  }

  function handleConfirm() {
    onConfirm(buildPricingData(), title.trim(), saveKickback ? kickbackPercent : '')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>

            <Text style={styles.label}>Shopify Product Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={design.product_title} />

            {loading && <ActivityIndicator style={{ marginTop: 24 }} />}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {!loading && !error && (
              <>
                <Text style={styles.label}>Printful Fulfillment Costs</Text>
                <View style={styles.chipWrap}>
                  {sizeGroups.map(({ size, cost }) => (
                    <View key={size} style={styles.costChip}>
                      <Text style={styles.costChipText}>{size} · {fmt(cost)}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.label}>Pricing Mode</Text>
                <View style={styles.row}>
                  {(['flat', 'by_size'] as const).map(m => (
                    <Pressable key={m} onPress={() => setMode(m)} style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}>
                      <Text style={[styles.toggleBtnText, mode === m && styles.toggleBtnTextActive]}>
                        {m === 'flat' ? 'One flat price' : 'Price by size'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Markup</Text>
                <View style={styles.row}>
                  {(['percentage', 'custom'] as const).map(m => (
                    <Pressable key={m} onPress={() => setMarkupMode(m)} style={[styles.toggleBtn, markupMode === m && styles.toggleBtnActive]}>
                      <Text style={[styles.toggleBtnText, markupMode === m && styles.toggleBtnTextActive]}>
                        {m === 'percentage' ? '% Markup' : 'Custom Price'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {markupMode === 'percentage' && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Markup percentage</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={markupPercent}
                      onChangeText={setMarkupPercent}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.fieldLabel}>%</Text>
                  </View>
                )}

                {markupMode === 'custom' && mode === 'flat' && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>$</Text>
                    <TextInput
                      style={[styles.smallInput, { flex: 1 }]}
                      value={customPrice}
                      onChangeText={setCustomPrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                )}

                {markupMode === 'custom' && mode === 'by_size' && (
                  <View style={{ gap: 10 }}>
                    {sizeGroups.map(({ size, cost }) => {
                      const ids = sizeRowIds(size)
                      const val = sizePrices[ids[0]] ?? ''
                      return (
                        <View key={size} style={styles.sizeRow}>
                          <Text style={styles.sizeRowLabel}>{size}</Text>
                          <Text style={styles.sizeRowCost}>cost {fmt(cost)}</Text>
                          <TextInput
                            style={[styles.smallInput, { flex: 1 }]}
                            value={val}
                            onChangeText={v => setSizePrice(size, v)}
                            keyboardType="decimal-pad"
                            placeholder={retailFor(cost).toFixed(2)}
                          />
                        </View>
                      )
                    })}
                  </View>
                )}

                <View style={styles.kickbackCard}>
                  <View style={styles.kickbackHeader}>
                    <Text style={[styles.label, { flex: 1, marginTop: 0 }]}>Group Kickback</Text>
                    <Pressable onPress={() => setKickbackEnabled(v => !v)} style={styles.switchWrap} hitSlop={16}>
                      <Switch value={kickbackEnabled} onValueChange={setKickbackEnabled} />
                    </Pressable>
                  </View>
                  {kickbackEnabled && (
                    <>
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Kickback percentage</Text>
                        <TextInput
                          style={styles.smallInput}
                          value={kickbackPercent}
                          onChangeText={setKickbackPercent}
                          keyboardType="number-pad"
                        />
                        <Text style={styles.fieldLabel}>%</Text>
                      </View>
                      <Pressable style={styles.checkboxRow} onPress={() => setSaveKickback(s => !s)}>
                        <View style={[styles.checkbox, saveKickback && styles.checkboxChecked]} />
                        <Text style={styles.fieldLabel}>Save {kickbackPercent}% as default for this group</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <View style={styles.breakdownCard}>
                  <Text style={styles.label}>Live Breakdown</Text>
                  {mode === 'flat' ? (
                    <View style={{ gap: 4 }}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.fieldLabel}>Printful cost (avg)</Text>
                        <Text style={styles.fieldLabel}>{fmt(avgCost)}</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.fieldLabel}>Retail price</Text>
                        <Text style={styles.fieldLabel}>{fmt(flatRetail)}</Text>
                      </View>
                      {kickbackEnabled && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.kickbackText}>Group kickback ({kbPercent}%)</Text>
                          <Text style={styles.kickbackText}>− {fmt(flatKickback)}</Text>
                        </View>
                      )}
                      <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                        <Text style={styles.profitLabel}>My Profit</Text>
                        <Text style={[styles.profitLabel, flatMyCut < 0 && styles.negative]}>{fmt(flatMyCut)}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ gap: 6 }}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownHeader}>Size · Retail</Text>
                        <Text style={styles.breakdownHeader}>My Profit</Text>
                      </View>
                      {sizeGroups.map(({ size, cost }) => {
                        const ids = sizeRowIds(size)
                        const customVal = sizePrices[ids[0]]
                        const retail = customVal ? parseFloat(customVal) : retailFor(cost)
                        const kb = kickbackEnabled ? retail * (kbPercent / 100) : 0
                        const cut = retail - cost - kb
                        return (
                          <View key={size} style={styles.breakdownRow}>
                            <Text style={styles.fieldLabel}>{size} · {fmt(retail)}</Text>
                            <Text style={[styles.profitLabel, cut < 0 && styles.negative]}>{fmt(cut)}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.footer}>
                  <Pressable style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtn, busy && styles.btnDisabled]} disabled={busy} onPress={handleConfirm}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm & Publish</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#f7f5f2', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%' },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  closeBtnText: { color: '#9b8c7a', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginTop: 18, marginBottom: 10 },
  errorText: { fontSize: 13, color: '#9b1c1c', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 4, padding: 12, fontSize: 14, color: '#1c1412', backgroundColor: '#fff' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  costChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 3, paddingHorizontal: 12, paddingVertical: 6 },
  costChipText: { fontSize: 12, color: '#4a3f35' },
  row: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 3, borderWidth: 1, borderColor: '#d4c5b0', backgroundColor: '#fff' },
  toggleBtnActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  toggleBtnText: { fontSize: 12, color: '#4a3f35', fontWeight: '500' },
  toggleBtnTextActive: { color: '#fff', fontWeight: '600' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  fieldLabel: { fontSize: 12, color: '#4a3f35' },
  smallInput: { borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#1c1412', backgroundColor: '#fff', minWidth: 60 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sizeRowLabel: { width: 40, fontSize: 12, fontWeight: '600', color: '#1c1412' },
  sizeRowCost: { fontSize: 11, color: '#9b8c7a', width: 70 },
  kickbackCard: { borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 4, padding: 14, marginTop: 18, backgroundColor: '#fff' },
  kickbackHeader: { flexDirection: 'row', alignItems: 'center' },
  switchWrap: { paddingLeft: 12, paddingVertical: 8, paddingRight: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: '#d4c5b0' },
  checkboxChecked: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  breakdownCard: { backgroundColor: '#fff', borderRadius: 4, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#e8e0d8' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: '#e8e0d8', paddingTop: 8, marginTop: 6 },
  profitLabel: { fontSize: 14, fontWeight: '700', color: '#1c7a3a' },
  breakdownHeader: { fontSize: 9, fontWeight: '700', color: '#9b8c7a', textTransform: 'uppercase', letterSpacing: 1.5 },
  negative: { color: '#9b1c1c' },
  kickbackText: { fontSize: 12, color: '#9b8c7a' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: '#d4c5b0' },
  cancelBtnText: { fontSize: 14, color: '#4a3f35', fontWeight: '500' },
  confirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 4, backgroundColor: '#1c1412' },
  confirmBtnText: { fontSize: 14, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.5 },
})

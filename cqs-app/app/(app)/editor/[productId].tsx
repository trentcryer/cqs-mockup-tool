import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, Image, ScrollView, Pressable, TextInput, ActivityIndicator,
  StyleSheet, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import Slider from '@/components/Slider'
import { encode } from 'base64-arraybuffer'
import { useSession } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { apiFetch, apiUploadBinary } from '@/lib/api'
import { loadSavedLogos } from '@/lib/logos'
import { buildTransform, initFromTransform, findTemplate, type PrintfulTemplatesResponse } from '@/lib/transform'
import type { ProductMeta } from '@/lib/printful-types'
import type { Design, Logo } from '@/lib/types'

export default function EditorScreen() {
  const { productId, designId } = useLocalSearchParams<{ productId: string; designId?: string }>()
  const router = useRouter()
  const { session } = useSession()
  const user = session?.user

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [meta, setMeta] = useState<ProductMeta | null>(null)
  const [templatesResponse, setTemplatesResponse] = useState<PrintfulTemplatesResponse>({ templates: [], variant_mapping: [] })
  const [savedLogos, setSavedLogos] = useState<Logo[]>([])
  const [existingDesign, setExistingDesign] = useState<Design | null>(null)

  const [selectedColor, setSelectedColor] = useState('')
  const [extraColors, setExtraColors] = useState<string[]>([])
  const [selectedPlacement, setSelectedPlacement] = useState('')
  const [variantIds, setVariantIds] = useState<number[]>([])
  const [centerX, setCenterX] = useState(50)
  const [centerY, setCenterY] = useState(40)
  const [logoSize, setLogoSize] = useState(25)
  const [logoAspect, setLogoAspect] = useState(1)
  const [notes, setNotes] = useState('')

  const [logoBuffer, setLogoBuffer] = useState<ArrayBuffer | null>(null)
  const [logoMime, setLogoMime] = useState('image/png')
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null)
  const [savedLogoPath, setSavedLogoPath] = useState<string | null>(null)
  const [removingBg, setRemovingBg] = useState(false)
  const [bgRemoved, setBgRemoved] = useState(false)

  const [mockups, setMockups] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isAop = useMemo(() => {
    if (!meta) return false
    const placementKeys = Object.keys(meta.printfiles.available_placements || {})
    return placementKeys.some(k => k.includes('dtfabric')) || /all[\s-]over/i.test(meta.product.title || '')
  }, [meta])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(false)
    try {
      const [metaData, templatesData, logos, designResult] = await Promise.all([
        apiFetch<ProductMeta>(`/api/printful/product/${productId}`),
        apiFetch<PrintfulTemplatesResponse>(`/api/printful/product/${productId}/templates`),
        loadSavedLogos(user.id),
        designId
          ? supabase.from('designs').select('*').eq('id', designId).eq('user_id', user.id).single()
          : Promise.resolve({ data: null as Design | null }),
      ])

      setMeta(metaData)
      setTemplatesResponse(templatesData)
      setSavedLogos(logos)

      const design = (designResult as any)?.data as Design | null
      setExistingDesign(design)

      const initColor = design?.color || Object.keys(metaData.colorMap)[0] || ''
      const initPlacement = design?.placement || metaData.placements[0]?.key || ''
      const initVariantIds = design?.variant_ids || metaData.colorMap[initColor] || []
      setSelectedColor(initColor)
      setSelectedPlacement(initPlacement)
      setVariantIds(initVariantIds)
      const designColorMap = design?.color_variant_map as Record<string, number[]> | null
      setExtraColors(designColorMap ? Object.keys(designColorMap).filter(c => c !== initColor) : [])

      const slider = initFromTransform(design?.transform)
      setCenterX(slider.centerX)
      setCenterY(slider.centerY)
      setLogoSize(slider.logoSize)
      setLogoAspect(slider.logoAspect)
      setNotes(design?.notes || '')

      if (design?.logo_path) {
        setSavedLogoPath(design.logo_path)
        const { data: signed } = await supabase.storage.from('cqs-assets').createSignedUrl(design.logo_path, 3600)
        setLogoDataUri(signed?.signedUrl || null)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [user, productId, designId])

  useEffect(() => { load() }, [load])

  function handleColorChange(color: string) {
    setSelectedColor(color)
    setVariantIds(meta?.colorMap[color] || [])
    setExtraColors(prev => prev.filter(c => c !== color))
    setMockups([])
  }

  function toggleExtraColor(color: string) {
    setExtraColors(prev => (prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]))
    setMockups([])
  }

  function handlePlacementChange(placement: string) {
    setSelectedPlacement(placement)
    setCenterX(50)
    setCenterY(40)
    setMockups([])
  }

  function applyLogo(buffer: ArrayBuffer, mimeType: string) {
    setLogoBuffer(buffer)
    setLogoMime(mimeType)
    const dataUri = `data:${mimeType};base64,${encode(buffer)}`
    setLogoDataUri(dataUri)
    setSavedLogoPath(null)
    setMockups([])
    Image.getSize(dataUri, (w, h) => setLogoAspect(h / w), () => {})
  }

  function selectLibraryLogo(logo: Logo) {
    if (!logo.displayUrl) return
    setLogoBuffer(null)
    setSavedLogoPath(logo.storage_path)
    setLogoDataUri(logo.displayUrl)
    setMockups([])
    Image.getSize(logo.displayUrl, (w, h) => setLogoAspect(h / w), () => {})
  }

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a logo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType || 'image/png'
    const isSvg = mimeType === 'image/svg+xml'

    const res = await fetch(asset.uri)
    const arrayBuffer = await res.arrayBuffer()
    applyLogo(arrayBuffer, mimeType)

    if (isSvg) return

    setRemovingBg(true)
    setBgRemoved(false)
    try {
      const formData = new FormData()
      formData.append('image', { uri: asset.uri, name: asset.fileName || 'logo.png', type: mimeType } as any)
      const processed = await apiUploadBinary('/api/studio/remove-background', formData)
      applyLogo(processed, 'image/png')
      setBgRemoved(true)
    } catch {
      Alert.alert('Background removal failed', 'Using your original image instead.')
    } finally {
      setRemovingBg(false)
    }
  }

  function transform() {
    return buildTransform({ centerX, centerY, logoSize, logoAspect })
  }

  async function generateForColor(colorName: string, vIds: number[], logoBase64: string | null) {
    const body: any = {
      productId: Number(productId),
      variantIds: vIds,
      placement: selectedPlacement,
      transform: transform(),
      isAop,
      aopMode: 'straight',
      entireShirt: false,
      gapPct: 5,
    }
    if (logoBase64) body.logoBase64 = logoBase64
    else if (savedLogoPath) body.logoPath = savedLogoPath
    else throw new Error('Upload a logo first')

    const data = await apiFetch<{ mockups: any[] }>('/api/studio/generate-mockup', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return (data.mockups || []).map((m: any) => ({ ...m, color: colorName }))
  }

  async function generateMockup() {
    if (!logoDataUri || !meta) { Alert.alert('Upload a logo first'); return }
    setIsGenerating(true)
    try {
      const logoBase64 = logoBuffer ? encode(logoBuffer) : null
      const allColorEntries: [string, number[]][] = [
        [selectedColor, variantIds],
        ...extraColors.map(c => [c, meta.colorMap[c] || []] as [string, number[]]),
      ]
      const results = await Promise.all(allColorEntries.map(([colorName, vIds]) => generateForColor(colorName, vIds, logoBase64)))
      setMockups(results.flat())
    } catch (e: any) {
      Alert.alert('Generation failed', e.message || 'Please try again')
    } finally {
      setIsGenerating(false)
    }
  }

  async function saveDraft() {
    if (!logoDataUri && !savedLogoPath) { Alert.alert('Upload a logo first'); return }
    if (!user || !meta) return
    setIsSaving(true)
    try {
      let finalLogoPath = savedLogoPath

      if (logoBuffer) {
        finalLogoPath = `logos/${user.id}/${Date.now()}-logo.png`
        const { error } = await supabase.storage
          .from('cqs-assets')
          .upload(finalLogoPath, logoBuffer, { contentType: 'image/png', upsert: true })
        if (error) throw error
        await supabase.from('logos').insert({
          user_id: user.id,
          storage_path: finalLogoPath,
          filename: 'logo.png',
          mime_type: 'image/png',
          size_bytes: logoBuffer.byteLength,
        } as any)
        setSavedLogoPath(finalLogoPath)
        setLogoBuffer(null)
      }

      const { data: profile } = await supabase.from('profiles').select('quartet_name').eq('id', user.id).single()

      const colorVariantMap: Record<string, number[]> = { [selectedColor]: variantIds }
      for (const c of extraColors) colorVariantMap[c] = meta.colorMap[c] || []

      const payload = {
        user_id: user.id,
        quartet_name: (profile as any)?.quartet_name || 'My Quartet',
        product_id: Number(productId),
        product_title: meta.product.title,
        placement: selectedPlacement,
        logo_path: finalLogoPath,
        transform: transform(),
        notes: notes || null,
        status: 'draft',
        color: selectedColor,
        variant_ids: variantIds,
        color_variant_map: colorVariantMap,
        mockup_urls: mockups,
      }

      if (existingDesign?.id) {
        const { error } = await supabase.from('designs').update(payload).eq('id', existingDesign.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('designs').insert(payload)
        if (error) throw error
      }

      router.replace('/(app)/studio')
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Please try again')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>
  }

  if (loadError || !meta) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load the editor. Pull back and try again.</Text>
      </View>
    )
  }

  const colorNames = Object.keys(meta.colorMap).sort()
  const template = findTemplate(templatesResponse, selectedPlacement, variantIds)
  const liveTransform = transform()

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={styles.title}>{meta.product.title}</Text>
      <Text style={styles.subtitle}>{selectedPlacement.replace(/_/g, ' ')} · {selectedColor}</Text>

      {colorNames.length > 0 && (
        <Section title="Color">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {colorNames.map(c => (
              <Pressable
                key={c}
                onPress={() => handleColorChange(c)}
                style={[styles.chip, selectedColor === c && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedColor === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {colorNames.length > 1 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.muted}>Also available in:</Text>
              <View style={styles.checkboxWrap}>
                {colorNames.filter(c => c !== selectedColor).map(c => {
                  const checked = extraColors.includes(c)
                  return (
                    <Pressable key={c} onPress={() => toggleExtraColor(c)} style={styles.checkboxRow}>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>{c}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}
        </Section>
      )}

      {meta.placements.length > 0 && (
        <Section title="Placement">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {meta.placements.map(p => (
              <Pressable
                key={p.key}
                onPress={() => handlePlacementChange(p.key)}
                style={[styles.chip, selectedPlacement === p.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedPlacement === p.key && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

      <Section title="Your Logo">
        {logoDataUri ? (
          <View style={styles.logoRow}>
            <Image source={{ uri: logoDataUri }} style={styles.logoThumb} />
            <View style={{ flex: 1 }}>
              {removingBg ? (
                <Text style={styles.muted}>Removing background…</Text>
              ) : bgRemoved ? (
                <Text style={styles.success}>Background removed</Text>
              ) : (
                <Text style={styles.success}>Ready</Text>
              )}
            </View>
            <Pressable onPress={pickLogo} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={pickLogo} style={styles.uploadBox}>
            <Text style={styles.uploadText}>Upload a logo</Text>
            <Text style={styles.muted}>Background removed automatically</Text>
          </Pressable>
        )}

        {savedLogos.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Your Logo Library</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {savedLogos.map(logo => (
                <Pressable key={logo.id} onPress={() => selectLibraryLogo(logo)} style={styles.libraryThumbWrap}>
                  {logo.displayUrl && <Image source={{ uri: logo.displayUrl }} style={styles.libraryThumb} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Section>

      <Section title="Position & Size">
        {logoSize < 100 && (
          <>
            <SliderRow label="Left / Right" value={centerX} onChange={setCenterX} />
            <SliderRow label="Up / Down" value={centerY} onChange={setCenterY} />
          </>
        )}
        <SliderRow label="Logo Size" value={logoSize} onChange={setLogoSize} max={isAop ? 150 : 100} />
      </Section>

      <Text style={styles.sectionTitle}>Live Preview</Text>
      {template && logoDataUri ? (
        <View style={[styles.previewWrap, { aspectRatio: template.template_width / template.template_height }]}>
          <Image source={{ uri: template.image_url }} style={styles.previewImage} />
          <View
            style={{
              position: 'absolute',
              top: `${(template.print_area_top / template.template_height) * 100}%`,
              left: `${(template.print_area_left / template.template_width) * 100}%`,
              width: `${(template.print_area_width / template.template_width) * 100}%`,
              height: `${(template.print_area_height / template.template_height) * 100}%`,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: 'rgba(220,38,38,0.55)',
            }}
          >
            <Image
              source={{ uri: logoDataUri }}
              style={{
                position: 'absolute',
                left: `${liveTransform.normLeft * 100}%`,
                top: `${liveTransform.normTop * 100}%`,
                width: `${liveTransform.normWidth * 100}%`,
                aspectRatio: 1 / logoAspect,
                opacity: liveTransform.opacity,
              }}
              resizeMode="contain"
            />
          </View>
        </View>
      ) : (
        <View style={[styles.previewWrap, styles.center]}>
          <Text style={styles.muted}>
            {logoDataUri ? 'Preview not available for this product' : 'Upload your logo to see the preview'}
          </Text>
        </View>
      )}

      <Section title="Notes for Trent">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Special requests, preferred sizes, etc."
          multiline
          style={styles.notesInput}
        />
      </Section>

      {mockups.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Product Mockup</Text>
          {mockups.map((m, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              {m.color && <Text style={styles.mockupColorLabel}>{m.color}</Text>}
              <Image source={{ uri: m.mockup_url }} style={styles.mockupImage} />
            </View>
          ))}
        </>
      )}

      <Pressable onPress={generateMockup} disabled={isGenerating || !logoDataUri} style={[styles.primaryBtn, (isGenerating || !logoDataUri) && styles.btnDisabled]}>
        {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Generate Mockup</Text>}
      </Pressable>

      <Pressable onPress={saveDraft} disabled={isSaving || (!logoDataUri && !savedLogoPath)} style={[styles.secondaryBtnLarge, (isSaving || (!logoDataUri && !savedLogoPath)) && styles.btnDisabled]}>
        {isSaving ? <ActivityIndicator /> : <Text style={styles.secondaryBtnLargeText}>Save Draft</Text>}
      </Pressable>
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  )
}

function SliderRow({ label, value, onChange, max = 100 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.muted}>{label}</Text>
        <Text style={styles.sliderValue}>{value}%</Text>
      </View>
      <Slider
        minimumValue={0}
        maximumValue={max}
        value={value}
        onValueChange={v => onChange(Math.round(v))}
        minimumTrackTintColor="#b8892a"
        maximumTrackTintColor="#e0d8cf"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1412', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: '#9b8c7a', marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 3, borderWidth: 1, borderColor: '#d4c5b0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  chipText: { fontSize: 13, color: '#4a3f35', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoThumb: { width: 48, height: 48, borderRadius: 4, backgroundColor: '#f0ece6' },
  uploadBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#d4c5b0', borderRadius: 4, padding: 28, alignItems: 'center' },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#1c1412', marginBottom: 4 },
  success: { fontSize: 12, color: '#1c7a3a' },
  muted: { fontSize: 12, color: '#9b8c7a' },
  secondaryBtn: { borderWidth: 1, borderColor: '#d4c5b0', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 7 },
  secondaryBtnText: { fontSize: 12, color: '#1c1412', fontWeight: '500' },
  libraryThumbWrap: { width: 56, height: 56, borderRadius: 4, backgroundColor: '#f0ece6', overflow: 'hidden' },
  libraryThumb: { width: '100%', height: '100%' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderValue: { fontSize: 12, color: '#1c1412', fontWeight: '600' },
  notesInput: { borderWidth: 1, borderColor: '#e8e0d8', borderRadius: 4, padding: 12, minHeight: 80, fontSize: 14, textAlignVertical: 'top', backgroundColor: '#faf9f7' },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginBottom: 10 },
  previewWrap: { width: '100%', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e0d8', backgroundColor: '#fff', marginBottom: 16 },
  previewImage: { width: '100%', height: '100%', position: 'absolute' },
  mockupImage: { width: '100%', aspectRatio: 1, borderRadius: 4, backgroundColor: '#f0ece6' },
  mockupColorLabel: { fontSize: 10, fontWeight: '700', color: '#9b8c7a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5 },
  checkboxWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: '#d4c5b0', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  checkboxMark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  checkboxLabel: { fontSize: 13, color: '#4a3f35' },
  primaryBtn: { backgroundColor: '#1c1412', borderRadius: 4, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  secondaryBtnLarge: { borderWidth: 1, borderColor: '#d4c5b0', borderRadius: 4, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryBtnLargeText: { color: '#1c1412', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
})

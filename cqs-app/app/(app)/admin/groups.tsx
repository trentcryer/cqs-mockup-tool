import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator,
  StyleSheet, Alert, Modal,
} from 'react-native'
import { apiFetch, ApiError } from '@/lib/api'

interface UserRow {
  id: string
  email: string
  quartet_name: string
  shopify_collection_id: number | null
  shopify_collection_title: string | null
}

interface CollectionOption {
  id: number
  title: string
  handle: string
}

export default function AdminGroupsScreen() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [collections, setCollections] = useState<CollectionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [active, setActive] = useState<UserRow | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [usersRes, colRes] = await Promise.all([
        apiFetch<{ groups: UserRow[] }>('/api/admin/groups'),
        apiFetch<{ collections: CollectionOption[] }>('/api/admin/promote/collections'),
      ])
      setUsers(usersRes.groups)
      setCollections(colRes.collections)
    } catch (e) {
      Alert.alert('Failed to load', e instanceof ApiError ? e.message : 'Please try again')
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function openUser(u: UserRow) {
    setActive(u)
    setSelectedCollectionId(u.shopify_collection_id ?? null)
  }

  async function saveAssignment() {
    if (!active) return
    setSaving(true)
    try {
      const col = collections.find(c => c.id === selectedCollectionId)
      await apiFetch('/api/admin/group-directory', {
        method: 'PATCH',
        body: JSON.stringify({
          profileId: active.id,
          collectionId: selectedCollectionId,
          collectionTitle: col?.title ?? null,
        }),
      })
      setActive(null)
      load()
    } catch (e) {
      Alert.alert('Save failed', e instanceof ApiError ? e.message : 'Please try again')
    } finally {
      setSaving(false)
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
        {users.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>No groups found.</Text>
          </View>
        ) : (
          users.map(u => (
            <Pressable key={u.id} style={styles.card} onPress={() => openUser(u)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{u.quartet_name}</Text>
                <Text style={styles.itemMeta}>{u.email}</Text>
                {u.shopify_collection_title ? (
                  <Text style={styles.collectionBadge}>{u.shopify_collection_title}</Text>
                ) : (
                  <Text style={styles.unassigned}>No collection assigned</Text>
                )}
              </View>
              <Text style={styles.editHint}>Edit →</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={!!active} animationType="slide" transparent onRequestClose={() => setActive(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Pressable onPress={() => setActive(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>

              {active && (
                <>
                  <Text style={styles.modalTitle}>{active.quartet_name}</Text>
                  <Text style={styles.modalMeta}>{active.email}</Text>

                  <Text style={styles.label}>Assign Collection</Text>
                  <Pressable
                    style={[styles.collectionChip, selectedCollectionId === null && styles.collectionChipActive]}
                    onPress={() => setSelectedCollectionId(null)}
                  >
                    <Text style={[styles.chipText, selectedCollectionId === null && styles.chipTextActive]}>None</Text>
                  </Pressable>

                  {collections.map(c => (
                    <Pressable
                      key={c.id}
                      style={[styles.collectionChip, selectedCollectionId === c.id && styles.collectionChipActive]}
                      onPress={() => setSelectedCollectionId(c.id)}
                    >
                      <Text style={[styles.chipText, selectedCollectionId === c.id && styles.chipTextActive]}>{c.title}</Text>
                    </Pressable>
                  ))}

                  <Pressable
                    style={[styles.saveBtn, saving && styles.btnDisabled]}
                    disabled={saving}
                    onPress={saveAssignment}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Assignment</Text>}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1c1412', marginBottom: 2 },
  itemMeta: { fontSize: 12, color: '#9b8c7a', marginTop: 1 },
  collectionBadge: { fontSize: 12, color: '#1c1412', fontWeight: '600', marginTop: 4 },
  unassigned: { fontSize: 12, color: '#c4b49f', marginTop: 4 },
  editHint: { fontSize: 12, color: '#c4b49f' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 4, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#e8e0d8' },
  emptyBody: { fontSize: 13, color: '#9b8c7a', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#f7f5f2', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  closeBtnText: { color: '#9b8c7a', fontSize: 13, fontWeight: '600' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1c1412', letterSpacing: -0.3 },
  modalMeta: { fontSize: 13, color: '#9b8c7a', marginBottom: 4, marginTop: 2 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#9b8c7a', marginTop: 20, marginBottom: 12 },
  collectionChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 3, borderWidth: 1, borderColor: '#d4c5b0', marginBottom: 8, backgroundColor: '#fff' },
  collectionChipActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  chipText: { fontSize: 13, color: '#4a3f35' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: { backgroundColor: '#1c1412', borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 24 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.5 },
})

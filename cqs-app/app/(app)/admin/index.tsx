import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function AdminScreen() {
  const router = useRouter()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>CQS Internal</Text>
      <Text style={styles.h1}>Admin Dashboard</Text>

      <Pressable style={styles.card} onPress={() => router.push('/(app)/admin/queue')}>
        <Ionicons name="checkmark-done-circle-outline" size={24} color="#1c1412" />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Review Queue</Text>
          <Text style={styles.cardBody}>Approve or reject submitted designs and push them to Shopify.</Text>
        </View>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/(app)/admin/groups')}>
        <Ionicons name="people-outline" size={24} color="#1c1412" />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Groups</Text>
          <Text style={styles.cardBody}>View all groups, their accounts, and design counts.</Text>
        </View>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/(app)/admin/promote')}>
        <Ionicons name="megaphone-outline" size={24} color="#1c1412" />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Promote Any Group</Text>
          <Text style={styles.cardBody}>Create a promo image for any group's collection.</Text>
        </View>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  content: { padding: 20, paddingTop: 28, paddingBottom: 48 },
  eyebrow: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2.5, color: '#9b8c7a', fontWeight: '700' },
  h1: { fontSize: 28, fontWeight: '700', color: '#1c1412', marginTop: 4, marginBottom: 28, letterSpacing: -0.5 },
  card: { flexDirection: 'row', gap: 16, alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1c1412', marginBottom: 3 },
  cardBody: { fontSize: 12, color: '#9b8c7a', lineHeight: 18 },
})

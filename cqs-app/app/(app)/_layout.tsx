import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/lib/auth-context'

export default function AppLayout() {
  const { profile } = useSession()
  const isAdmin = !!profile?.is_admin

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#9b1c1c' }}>
      <Tabs.Screen
        name="studio/index"
        options={{
          title: 'Homebase',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="catalog/index"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="promote/index"
        options={{
          title: 'Promote',
          tabBarIcon: ({ color, size }) => <Ionicons name="megaphone" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="admin/index"
        options={{
          title: 'Admin',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="catalog/[productId]"
        options={{ href: null, headerShown: true, title: 'Product Details' }}
      />
      <Tabs.Screen
        name="editor/[productId]"
        options={{ href: null, headerShown: true, title: 'Design Studio' }}
      />
      <Tabs.Screen
        name="admin/queue"
        options={{ href: null, headerShown: true, title: 'Review Queue' }}
      />
      <Tabs.Screen
        name="admin/groups"
        options={{ href: null, headerShown: true, title: 'Groups' }}
      />
      <Tabs.Screen
        name="admin/promote"
        options={{ href: null, headerShown: true, title: 'Admin Promote' }}
      />
    </Tabs>
  )
}

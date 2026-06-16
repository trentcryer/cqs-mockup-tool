import { Redirect } from 'expo-router'
import { useSession } from '@/lib/auth-context'

export default function Index() {
  const { session } = useSession()
  return <Redirect href={session ? '/(app)/studio' : '/(auth)/login'} />
}

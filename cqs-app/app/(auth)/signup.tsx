import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'

export default function SignupScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [quartetName, setQuartetName] = useState('')
  const [groupType, setGroupType] = useState<'quartet' | 'chorus'>('quartet')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signUp() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { quartet_name: quartetName.trim() || 'My Quartet', group_type: groupType },
        emailRedirectTo: Linking.createURL('/auth/callback'),
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data.session) {
      Alert.alert('Check your email', 'Confirm your email to finish signing up, then come back and sign in.')
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Create your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Group name (e.g. The Sound Wave)"
        value={quartetName}
        onChangeText={setQuartetName}
      />

      <View style={styles.toggleRow}>
        {(['quartet', 'chorus'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setGroupType(t)}
            style={[styles.toggleButton, groupType === t && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, groupType === t && styles.toggleTextActive]}>
              {t === 'quartet' ? 'Quartet' : 'Chorus'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={signUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
      </Pressable>

      <Link href="/(auth)/login" style={styles.linkButton}>
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
      </Link>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 24, color: '#1c1412' },
  input: {
    borderWidth: 1,
    borderColor: '#d4c5b0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4c5b0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: '#1c1412', borderColor: '#1c1412' },
  toggleText: { color: '#4a3f35', fontSize: 14 },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#1c1412',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#9b1c1c', fontSize: 14 },
  error: { color: '#9b1c1c', fontSize: 13, marginBottom: 8 },
})

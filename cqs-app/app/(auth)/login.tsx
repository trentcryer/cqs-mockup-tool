import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  async function sendMagicLink() {
    if (!email) {
      setError('Enter your email first')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: Linking.createURL('/auth/callback') },
    })
    setLoading(false)
    if (error) setError(error.message)
    else Alert.alert('Check your email', 'We sent you a magic link to sign in.')
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Welcome back</Text>

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

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={signIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>

      <Pressable onPress={sendMagicLink} disabled={loading} style={styles.linkButton}>
        <Text style={styles.linkText}>Send me a magic link instead</Text>
      </Pressable>

      <Link href="/(auth)/signup" style={styles.linkButton}>
        <Text style={styles.linkText}>New here? Create an account</Text>
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

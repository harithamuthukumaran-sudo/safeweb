import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../src/context/AuthContext'
import { colors, gradients, spacing, radius, fontSize, shadow } from '../../src/constants/theme'

export default function ProfileScreen() {
  const { user, session, signOut, signInWithEmail, signUpWithEmail } = useAuth()
  const [tab,      setTab]      = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [msg,      setMsg]      = useState(null)

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) return
    setLoading(true); setError(null); setMsg(null)
    try {
      if (tab === 'signin') {
        const { error } = await signInWithEmail(email.trim(), password)
        if (error) throw error
      } else {
        const { error } = await signUpWithEmail(email.trim(), password)
        if (error) throw error
        setMsg('Account created! Check your email to confirm, then sign in.')
        setTab('signin')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  // ── Signed in view ─────────────────────────────────────────
  if (user) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                <Ionicons name="person" size={32} color={colors.bg} />
              </LinearGradient>
              <Text style={styles.emailLabel}>{user.email}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.emerald} />
                <Text style={styles.verifiedText}>Verified Account</Text>
              </View>
            </View>

            {/* Stats card */}
            <View style={styles.infoCard}>
              <Text style={styles.sectionLabel}>ACCOUNT INFO</Text>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoText}>
                  Member since {new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="key-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoText} numberOfLines={1}>
                  ID: {user.id.substring(0, 16)}…
                </Text>
              </View>
            </View>

            {/* Features */}
            <View style={styles.infoCard}>
              <Text style={styles.sectionLabel}>YOUR PLAN — FREE</Text>
              {[
                { icon: 'scan-outline',         text: 'Unlimited URL scans' },
                { icon: 'time-outline',          text: 'Scan history saved' },
                { icon: 'eye-outline',           text: 'Website monitoring' },
                { icon: 'notifications-outline', text: 'Safety alerts' },
                { icon: 'shield-outline',        text: 'Threat intelligence' },
              ].map(({ icon, text }) => (
                <View key={text} style={styles.featureRow}>
                  <Ionicons name={icon} size={16} color={colors.cyan} />
                  <Text style={styles.featureText}>{text}</Text>
                </View>
              ))}
            </View>

            {/* Sign out */}
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={18} color={colors.rose} />
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    )
  }

  // ── Guest / auth form ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
            {/* Logo */}
            <View style={styles.authLogo}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.authLogoBox}>
                <Ionicons name="shield-checkmark" size={28} color={colors.bg} />
              </LinearGradient>
              <Text style={styles.authTitle}>{tab === 'signin' ? 'Welcome back' : 'Create account'}</Text>
              <Text style={styles.authSub}>
                {tab === 'signin' ? 'Sign in to access your dashboard' : 'Free access to all SafeWeb features'}
              </Text>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              {['signin', 'signup'].map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => { setTab(t); setError(null); setMsg(null) }}
                  style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                    {t === 'signin' ? 'Sign in' : 'Sign up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Messages */}
            {error && (
              <View style={styles.errBox}>
                <Ionicons name="warning-outline" size={14} color={colors.rose} />
                <Text style={styles.errText}>{error}</Text>
              </View>
            )}
            {msg && (
              <View style={[styles.errBox, { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.emerald} />
                <Text style={[styles.errText, { color: colors.emerald }]}>{msg}</Text>
              </View>
            )}

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.inputWrapper, { marginTop: spacing.sm }]}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={tab === 'signup' ? 'Password (min 8 chars)' : 'Password'}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { flex: 1 }]}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={{ padding: spacing.xs }}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading || !email.trim() || !password.trim()}
              style={[styles.submitBtn, (loading || !email.trim()) && { opacity: 0.5 }]}
            >
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtnGrad}>
                <Text style={styles.submitBtnText}>
                  {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  container:   { flex: 1 },
  scroll:      { padding: spacing.md, paddingBottom: spacing.xxl },
  avatarSection:{ alignItems: 'center', paddingVertical: spacing.xl },
  avatar:      { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', ...shadow.cyan, marginBottom: spacing.md },
  emailLabel:  { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  verifiedText:{ color: colors.emerald, fontSize: 11, fontWeight: '600' },
  infoCard:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  sectionLabel:{ color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoText:    { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { color: colors.textSecondary, fontSize: fontSize.sm },
  signOutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)', borderRadius: radius.xl },
  signOutText: { color: colors.rose, fontSize: fontSize.base, fontWeight: '600' },
  // Auth form
  authScroll:  { padding: spacing.md, paddingBottom: spacing.xxl },
  authLogo:    { alignItems: 'center', paddingVertical: spacing.xl },
  authLogoBox: { width: 60, height: 60, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', ...shadow.cyan, marginBottom: spacing.md },
  authTitle:   { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  authSub:     { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' },
  tabRow:      { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 4, marginBottom: spacing.md },
  tabBtn:      { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.lg },
  tabBtnActive:{ backgroundColor: colors.surfaceAlt },
  tabBtnText:  { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabBtnTextActive:{ color: colors.cyan },
  errBox:      { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', backgroundColor: 'rgba(244,63,94,0.08)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  errText:     { color: colors.rose, fontSize: fontSize.xs, flex: 1 },
  inputGroup:  { marginBottom: spacing.md },
  inputWrapper:{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  inputIcon:   { marginRight: spacing.sm },
  input:       { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, paddingVertical: spacing.md },
  submitBtn:   { borderRadius: radius.lg, overflow: 'hidden' },
  submitBtnGrad:{ paddingVertical: spacing.md + 2, alignItems: 'center' },
  submitBtnText:{ color: colors.bg, fontWeight: '700', fontSize: fontSize.base },
})

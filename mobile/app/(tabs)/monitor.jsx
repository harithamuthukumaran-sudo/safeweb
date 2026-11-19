import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { fetchMonitoredSites, addMonitoredSite, removeMonitoredSite } from '../../src/lib/api'
import { colors, gradients, spacing, radius, fontSize } from '../../src/constants/theme'

const INTERVALS = [
  { label: '1 hour',   value: 1 },
  { label: '6 hours',  value: 6 },
  { label: '12 hours', value: 12 },
  { label: 'Daily',    value: 24 },
  { label: '3 days',   value: 72 },
  { label: 'Weekly',   value: 168 },
]

export default function MonitorScreen() {
  const { session, user } = useAuth()
  const router  = useRouter()
  const [sites,    setSites]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [url,      setUrl]      = useState('')
  const [label,    setLabel]    = useState('')
  const [interval, setInterval] = useState(24)
  const [adding,   setAdding]   = useState(false)
  const [error,    setError]    = useState(null)

  const load = () => {
    if (!session) return
    setLoading(true)
    fetchMonitoredSites(session).then(setSites).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [session])

  const handleAdd = async () => {
    if (!url.trim()) return
    setAdding(true)
    setError(null)
    try {
      await addMonitoredSite(url.trim(), label.trim() || null, interval, session)
      setUrl(''); setLabel('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = (site) => {
    Alert.alert('Stop Monitoring', `Remove "${site.label || site.url}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await removeMonitoredSite(site.id, session)
            setSites(prev => prev.filter(s => s.id !== site.id))
          } catch (err) {
            Alert.alert('Error', err.message)
          }
        },
      },
    ])
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={[colors.bg, colors.surface]} style={styles.centered}>
          <Ionicons name="eye-off-outline" size={40} color={colors.textMuted} />
          <Text style={styles.guestText}>Sign in to monitor websites</Text>
          <TouchableOpacity onPress={() => router.push('/auth')} style={styles.cta}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              <Text style={styles.ctaText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
        <FlatList
          data={sites}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListHeaderComponent={
            <View style={{ padding: spacing.md }}>
              <Text style={styles.pageTitle}>Site Monitor</Text>
              <Text style={styles.pageSub}>Automated checks with instant alerts</Text>

              {/* Add site form */}
              <View style={styles.formCard}>
                <Text style={styles.sectionLabel}>ADD SITE TO MONITOR</Text>
                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={14} color={colors.rose} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://yoursite.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="Label (optional)"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { marginTop: spacing.sm }]}
                />
                {/* Interval selector */}
                <View style={styles.intervalRow}>
                  {INTERVALS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setInterval(opt.value)}
                      style={[styles.intervalBtn, interval === opt.value && styles.intervalBtnActive]}
                    >
                      <Text style={[styles.intervalText, interval === opt.value && styles.intervalTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={handleAdd} disabled={adding || !url.trim()} style={[styles.addBtn, (adding || !url.trim()) && { opacity: 0.5 }]}>
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtnGrad}>
                    {adding
                      ? <ActivityIndicator size="small" color={colors.bg} />
                      : <><Ionicons name="add" size={18} color={colors.bg} /><Text style={styles.addBtnText}>Start Monitoring</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
                MONITORED SITES ({sites.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            !loading && (
              <Text style={[styles.pageSub, { textAlign: 'center', paddingHorizontal: spacing.md }]}>
                No sites yet. Add one above.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.siteRow}>
              <View style={[styles.statusDot, { backgroundColor: item.last_is_online == null ? colors.border : item.last_is_online ? colors.emerald : colors.rose }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.siteLabel} numberOfLines={1}>{item.label || item.url}</Text>
                {item.label && <Text style={styles.siteUrl} numberOfLines={1}>{item.url}</Text>}
                <Text style={styles.siteInfo}>
                  Every {item.check_interval_hours}h
                  {item.last_risk_score != null && ` · Score: ${item.last_risk_score}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.rose} />
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
        {loading && <ActivityIndicator style={styles.spinner} color={colors.cyan} />}
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  container:   { flex: 1 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  pageTitle:   { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '800', marginBottom: 4 },
  pageSub:     { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md },
  sectionLabel:{ color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  formCard:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  input:       { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, color: colors.textPrimary, fontSize: fontSize.sm },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  intervalBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  intervalBtnActive: { borderColor: colors.cyan, backgroundColor: 'rgba(0,212,255,0.1)' },
  intervalText: { color: colors.textMuted, fontSize: 11 },
  intervalTextActive: { color: colors.cyan, fontWeight: '600' },
  addBtn:      { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.xs },
  addBtnGrad:  { paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  addBtnText:  { color: colors.bg, fontWeight: '700', fontSize: fontSize.base },
  siteRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4 },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  siteLabel:   { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  siteUrl:     { color: colors.textMuted, fontSize: fontSize.xs },
  siteInfo:    { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  deleteBtn:   { padding: spacing.xs },
  separator:   { height: 1, backgroundColor: colors.border },
  spinner:     { position: 'absolute', top: '50%', alignSelf: 'center' },
  errorBox:    { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  errorText:   { color: colors.rose, fontSize: fontSize.xs, flex: 1 },
  guestText:   { color: colors.textSecondary, fontSize: fontSize.md, textAlign: 'center' },
  cta:         { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  ctaGrad:     { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  ctaText:     { color: colors.bg, fontWeight: '700', fontSize: fontSize.base },
})

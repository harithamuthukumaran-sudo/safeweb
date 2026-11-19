import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { fetchScanHistory } from '../../src/lib/api'
import { colors, gradients, spacing, radius, fontSize, classificationColors } from '../../src/constants/theme'

function StatCard({ label, value, color, icon }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={color} style={{ marginBottom: 4 }} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function ScanRow({ scan }) {
  const palette = classificationColors[scan.classification] || classificationColors.safe
  const date    = new Date(scan.scanned_at)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <View style={styles.scanRow}>
      <View style={[styles.scoreDot, { backgroundColor: palette.text }]}>
        <Text style={styles.scoreDotText}>{scan.risk_score}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.scanRowTop}>
          <View style={[styles.miniTag, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Text style={[styles.miniTagText, { color: palette.text }]}>{scan.classification}</Text>
          </View>
          <View style={styles.onlineDot}>
            <View style={[styles.dot, { backgroundColor: scan.uptime_is_online ? colors.emerald : colors.rose }]} />
            <Text style={styles.mutedText}>{scan.uptime_is_online ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <Text style={styles.scanUrl} numberOfLines={1}>{scan.url}</Text>
        {/* Score bar */}
        <View style={styles.scoreBarBg}>
          <View style={[styles.scoreBarFill, {
            width: `${scan.risk_score}%`,
            backgroundColor: palette.text,
          }]} />
        </View>
      </View>
      <Text style={[styles.mutedText, { marginLeft: spacing.sm }]}>{dateStr}</Text>
    </View>
  )
}

export default function DashboardScreen() {
  const { session, user } = useAuth()
  const router = useRouter()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    fetchScanHistory(session, 50)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={[colors.bg, colors.surface]} style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
          <Text style={styles.guestTitle}>Sign in to view your dashboard</Text>
          <TouchableOpacity onPress={() => router.push('/auth')} style={styles.signInBtn}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signInBtnGrad}>
              <Text style={styles.signInBtnText}>Sign in / Register</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    )
  }

  const dangerous   = history.filter(s => s.classification === 'dangerous').length
  const suspicious  = history.filter(s => s.classification === 'suspicious').length
  const avgScore    = history.length ? Math.round(history.reduce((a, s) => a + s.risk_score, 0) / history.length) : 0

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.pageTitle}>Dashboard</Text>
          <Text style={styles.emailText} numberOfLines={1}>{user.email}</Text>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={colors.cyan} size="large" /></View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.statsRow}>
                <StatCard label="Total Scans"    value={history.length} color={colors.cyan}    icon="shield-outline" />
                <StatCard label="Avg Score"      value={avgScore}       color={colors.purple}  icon="trending-up-outline" />
                <StatCard label="Suspicious"     value={suspicious}     color={colors.amber}   icon="alert-circle-outline" />
                <StatCard label="Dangerous"      value={dangerous}      color={colors.rose}    icon="warning-outline" />
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyText}>No scans yet. Use the Scanner tab.</Text>
              </View>
            }
            renderItem={({ item }) => <ScanRow scan={item} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  container:   { flex: 1 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  headerBar:   { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle:   { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  emailText:   { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  statsRow:    { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center',
  },
  statValue:   { fontSize: fontSize.xl, fontWeight: '800' },
  statLabel:   { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
  list:        { paddingBottom: spacing.xxl },
  scanRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  scoreDot:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scoreDotText:{ color: colors.bg, fontWeight: '800', fontSize: fontSize.xs },
  scanRowTop:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  scanUrl:     { color: colors.textSecondary, fontSize: fontSize.xs, marginBottom: 4 },
  scoreBarBg:  { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  scoreBarFill:{ height: '100%', borderRadius: 2 },
  miniTag:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  miniTagText: { fontSize: 9, fontWeight: '700' },
  onlineDot:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  mutedText:   { color: colors.textMuted, fontSize: fontSize.xs },
  separator:   { height: 1, backgroundColor: colors.border },
  empty:       { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyText:   { color: colors.textMuted, fontSize: fontSize.sm },
  guestTitle:  { color: colors.textSecondary, fontSize: fontSize.md, textAlign: 'center' },
  signInBtn:   { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  signInBtnGrad:{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  signInBtnText:{ color: colors.bg, fontWeight: '700', fontSize: fontSize.base },
})

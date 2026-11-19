import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { fetchAlerts, markAlertsRead } from '../../src/lib/api'
import { colors, gradients, spacing, radius, fontSize } from '../../src/constants/theme'

const SEVERITY = {
  critical: { color: colors.rose,    icon: 'warning',           bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.3)' },
  warning:  { color: colors.amber,   icon: 'alert-circle',      bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  info:     { color: colors.cyan,    icon: 'information-circle', bg: 'rgba(0,212,255,0.05)',  border: 'rgba(0,212,255,0.2)' },
}

function AlertCard({ alert, onMarkRead }) {
  const sev   = SEVERITY[alert.severity] || SEVERITY.info
  const time  = new Date(alert.triggered_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <TouchableOpacity onPress={() => !alert.is_read && onMarkRead(alert.id)} activeOpacity={0.8}>
      <View style={[styles.alertCard, { backgroundColor: sev.bg, borderColor: sev.border }, alert.is_read && styles.readCard]}>
        <View style={styles.alertHeader}>
          <Ionicons name={sev.icon} size={16} color={sev.color} />
          <Text style={[styles.alertTitle, { color: alert.is_read ? colors.textMuted : colors.textPrimary }]}>
            {alert.title}
          </Text>
          {!alert.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.alertMsg}>{alert.message}</Text>
        <View style={styles.alertFooter}>
          <Text style={styles.alertUrl} numberOfLines={1}>{alert.url}</Text>
          <Text style={styles.alertTime}>{time}</Text>
        </View>
        {alert.previous_risk_score != null && alert.new_risk_score != null && (
          <Text style={styles.scoreChange}>
            Score: {alert.previous_risk_score} → {alert.new_risk_score}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function AlertsScreen() {
  const { session, user } = useAuth()
  const router = useRouter()
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const load = () => {
    if (!session) return
    setLoading(true)
    fetchAlerts(session, false).then(setAlerts).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [session])

  const handleMarkRead = async (id) => {
    try {
      await markAlertsRead([id], session)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
    } catch {}
  }

  const handleMarkAllRead = async () => {
    const ids = alerts.filter(a => !a.is_read).map(a => a.id)
    if (!ids.length) return
    setMarking(true)
    try {
      await markAlertsRead(ids, session)
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    } finally {
      setMarking(false)
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={[colors.bg, colors.surface]} style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
          <Text style={styles.guestText}>Sign in to view alerts</Text>
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
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Alerts</Text>
            {unreadCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} disabled={marking} style={styles.markAllBtn}>
              {marking
                ? <ActivityIndicator size="small" color={colors.cyan} />
                : <><Ionicons name="checkmark-done-outline" size={16} color={colors.cyan} /><Text style={styles.markAllText}>Mark all read</Text></>
              }
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={colors.cyan} size="large" /></View>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>No alerts yet.</Text>
                <Text style={styles.emptySubText}>Alerts appear when monitored sites change.</Text>
              </View>
            }
            renderItem={({ item }) => <AlertCard alert={item} onMarkRead={handleMarkRead} />}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
  headerBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageTitle:   { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  countBadge:  { backgroundColor: 'rgba(244,63,94,0.2)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:{ color: colors.rose, fontSize: 11, fontWeight: '700' },
  markAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { color: colors.cyan, fontSize: fontSize.sm },
  list:        { paddingHorizontal: spacing.md, paddingBottom: 80 },
  alertCard:   { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 6 },
  readCard:    { opacity: 0.5 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alertTitle:  { flex: 1, fontSize: fontSize.sm, fontWeight: '700' },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
  alertMsg:    { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18 },
  alertFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertUrl:    { color: colors.textMuted, fontSize: 10, flex: 1 },
  alertTime:   { color: colors.textMuted, fontSize: 10 },
  scoreChange: { color: colors.amber, fontSize: 10, fontWeight: '600' },
  empty:       { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText:   { color: colors.textSecondary, fontSize: fontSize.base, fontWeight: '600' },
  emptySubText:{ color: colors.textMuted, fontSize: fontSize.sm },
  guestText:   { color: colors.textSecondary, fontSize: fontSize.md, textAlign: 'center' },
  cta:         { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  ctaGrad:     { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  ctaText:     { color: colors.bg, fontWeight: '700', fontSize: fontSize.base },
})

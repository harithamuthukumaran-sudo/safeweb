import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../src/context/AuthContext'
import { scanUrl } from '../../src/lib/api'
import { colors, gradients, spacing, radius, fontSize, shadow, classificationColors } from '../../src/constants/theme'

// ── Risk Score Arc (SVG-free, uses a styled View arc) ──────────────────────
function RiskGauge({ score = 0, classification = 'safe' }) {
  const palette = classificationColors[classification] || classificationColors.safe
  const pct     = score / 100
  const labels  = { safe: 'Low Risk', suspicious: 'Suspicious', dangerous: 'Dangerous' }

  return (
    <View style={styles.gaugeWrapper}>
      <LinearGradient
        colors={gradients[classification] || gradients.safe}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.gaugeBg, { borderColor: palette.border }]}
      >
        <Text style={[styles.gaugeScore, { color: palette.text }]}>{score}</Text>
        <Text style={styles.gaugeLabel}>/ 100</Text>
      </LinearGradient>
      <View style={[styles.gaugeBadge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.gaugeBadgeText, { color: palette.text }]}>{labels[classification]}</Text>
      </View>
    </View>
  )
}

// ── Detail Card ─────────────────────────────────────────────────────────────
function DetailCard({ icon, title, children }) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailCardHeader}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text style={styles.detailCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

export default function ScannerScreen() {
  const { session } = useAuth()
  const [url,     setUrl]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const handleScan = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await scanUrl(url.trim(), session)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Scan failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const ssl    = result?.ssl_details
  const uptime = result?.uptime_details
  const threat = result?.threat_intelligence
  const risk   = result?.risk_score

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBox}>
              <Ionicons name="shield-checkmark" size={22} color={colors.bg} />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>SafeWeb</Text>
              <Text style={styles.headerSub}>AI Website Safety Scanner</Text>
            </View>
          </View>

          {/* URL Input */}
          <View style={styles.inputRow}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              onSubmitEditing={handleScan}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleScan}
              disabled={loading || !url.trim()}
              style={[styles.scanBtn, (!url.trim() || loading) && styles.scanBtnDisabled]}
            >
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scanBtnGrad}>
                {loading
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Ionicons name="search" size={20} color={colors.bg} />}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={colors.rose} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Loading */}
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.cyan} />
              <Text style={styles.loadingText}>Running safety checks…</Text>
              {['Validating URL', 'Checking SSL', 'Threat intelligence', 'Calculating score'].map(s => (
                <Text key={s} style={styles.loadingStep}>· {s}</Text>
              ))}
            </View>
          )}

          {/* Result */}
          {result && !loading && (
            <View style={styles.resultWrapper}>
              {/* Risk gauge */}
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>RISK SCORE</Text>
                <RiskGauge score={risk?.score ?? 0} classification={risk?.classification ?? 'safe'} />
                {risk?.label && <Text style={styles.riskLabel}>{risk.label}</Text>}
              </View>

              {/* Disclaimer */}
              {risk?.disclaimer && (
                <View style={styles.disclaimer}>
                  <Ionicons name="information-circle-outline" size={13} color={colors.amber} style={{ marginTop: 1 }} />
                  <Text style={styles.disclaimerText}>{risk.disclaimer}</Text>
                </View>
              )}

              {/* SSL */}
              <DetailCard icon="lock-closed-outline" title="SSL CERTIFICATE">
                {ssl?.has_ssl ? (
                  <>
                    <View style={styles.row}>
                      <View style={[styles.miniTag, { backgroundColor: ssl.is_valid && !ssl.is_expired ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }]}>
                        <Text style={[styles.miniTagText, { color: ssl.is_valid && !ssl.is_expired ? colors.emerald : colors.amber }]}>
                          {ssl.is_expired ? 'Expired' : ssl.is_expiring_soon ? 'Expiring Soon' : 'Valid'}
                        </Text>
                      </View>
                      {ssl.protocol_version && <Text style={styles.mutedText}>{ssl.protocol_version}</Text>}
                    </View>
                    {ssl.issuer && <Text style={styles.mutedText} numberOfLines={1}>Issuer: {ssl.issuer}</Text>}
                    {ssl.days_until_expiry != null && (
                      <Text style={{ color: ssl.days_until_expiry < 14 ? colors.amber : colors.emerald, fontSize: fontSize.xs, marginTop: 4 }}>
                        {ssl.days_until_expiry} days remaining
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={{ color: colors.rose, fontSize: fontSize.xs }}>No SSL certificate</Text>
                )}
              </DetailCard>

              {/* Uptime */}
              <DetailCard icon="wifi-outline" title="UPTIME">
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: uptime?.is_online ? colors.emerald : colors.rose }]} />
                  <Text style={{ color: uptime?.is_online ? colors.emerald : colors.rose, fontWeight: '600', fontSize: fontSize.sm }}>
                    {uptime?.is_online ? 'Online' : 'Offline'}
                  </Text>
                  {uptime?.status_code && <Text style={styles.mutedText}>HTTP {uptime.status_code}</Text>}
                </View>
                {uptime?.response_time_ms != null && (
                  <Text style={styles.mutedText}>Response: {Math.round(uptime.response_time_ms)} ms · {uptime.latency_classification}</Text>
                )}
              </DetailCard>

              {/* Threat Intel */}
              <DetailCard icon="shield-outline" title="THREAT INTELLIGENCE">
                <Text style={styles.mutedText}>
                  Google Safe Browsing:{' '}
                  <Text style={{ color: threat?.google_safe_browsing?.is_dangerous ? colors.rose : colors.emerald }}>
                    {threat?.google_safe_browsing?.error ? 'Not checked' :
                     threat?.google_safe_browsing?.is_dangerous ? 'THREAT DETECTED' : 'Clean'}
                  </Text>
                </Text>
                <Text style={[styles.mutedText, { marginTop: 4 }]}>
                  VirusTotal:{' '}
                  <Text style={{ color: (threat?.virustotal?.positives ?? 0) > 0 ? colors.rose : colors.emerald }}>
                    {threat?.virustotal?.error ? 'Not checked' :
                     `${threat?.virustotal?.positives ?? 0}/${threat?.virustotal?.total ?? '?'} engines`}
                  </Text>
                </Text>
              </DetailCard>

              {/* Risk factors */}
              {risk?.factors?.length > 0 && (
                <DetailCard icon="list-outline" title="RISK FACTORS">
                  {risk.factors.map((f, i) => (
                    <View key={i} style={styles.factorRow}>
                      <View style={[styles.miniTag, {
                        backgroundColor: f.severity === 'critical' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)'
                      }]}>
                        <Text style={[styles.miniTagText, { color: f.severity === 'critical' ? colors.rose : colors.amber }]}>
                          {f.severity?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.mutedText, { flex: 1, marginLeft: 8 }]}>{f.description}</Text>
                    </View>
                  ))}
                </DetailCard>
              )}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  container:    { flex: 1 },
  scroll:       { padding: spacing.md, paddingBottom: spacing.xxl },
  header:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logoBox:      { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '800' },
  headerSub:    { color: colors.textMuted, fontSize: fontSize.xs },
  inputRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.textPrimary, fontSize: fontSize.sm,
  },
  scanBtn:        { borderRadius: radius.lg, overflow: 'hidden', ...shadow.cyan },
  scanBtnDisabled:{ opacity: 0.5 },
  scanBtnGrad:    { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  errorBox:     { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: 'rgba(244,63,94,0.1)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText:    { color: colors.rose, fontSize: fontSize.sm, flex: 1 },
  loadingBox:   { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  loadingText:  { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.sm },
  loadingStep:  { color: colors.textMuted, fontSize: fontSize.xs },
  resultWrapper:{ gap: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.md, alignItems: 'center',
  },
  sectionLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 1.2, marginBottom: spacing.sm },
  gaugeWrapper: { alignItems: 'center', gap: spacing.sm },
  gaugeBg: {
    width: 120, height: 120, borderRadius: 60, alignItems: 'center',
    justifyContent: 'center', borderWidth: 3, ...shadow.cyan,
  },
  gaugeScore:   { fontSize: 40, fontWeight: '900', lineHeight: 44 },
  gaugeLabel:   { color: colors.textMuted, fontSize: fontSize.xs },
  gaugeBadge:   { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1 },
  gaugeBadgeText:{ fontSize: fontSize.sm, fontWeight: '700' },
  riskLabel:    { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.sm },
  disclaimer:   { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, backgroundColor: 'rgba(245,158,11,0.05)', borderRadius: radius.md, alignItems: 'flex-start' },
  disclaimerText:{ color: colors.textMuted, fontSize: 11, flex: 1, fontStyle: 'italic' },
  detailCard:   { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md },
  detailCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  detailCardTitle:  { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  miniTag:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  miniTagText:  { fontSize: 10, fontWeight: '700' },
  mutedText:    { color: colors.textMuted, fontSize: fontSize.xs },
  factorRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
})

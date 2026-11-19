import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Shield, AlertTriangle, TrendingUp, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchScanHistory } from '../lib/api'

function classificationColor(c) {
  return { safe: 'text-emerald-400', suspicious: 'text-amber-400', dangerous: 'text-rose-400' }[c] || 'text-white/50'
}
function classificationBadge(c) {
  return { safe: 'badge-safe', suspicious: 'badge-suspicious', dangerous: 'badge-dangerous' }[c] || ''
}

function ScoreBar({ score, classification }) {
  const color = { safe: 'bg-emerald-500', suspicious: 'bg-amber-500', dangerous: 'bg-rose-500' }[classification] || 'bg-white/30'
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-bold ${classificationColor(classification)}`}>{score}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { session } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!session) return
    fetchScanHistory(session, 50)
      .then(setHistory)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [session])

  const totalScans     = history.length
  const dangerousCount = history.filter(s => s.classification === 'dangerous').length
  const suspiciousCount= history.filter(s => s.classification === 'suspicious').length
  const avgScore       = totalScans ? Math.round(history.reduce((a, s) => a + s.risk_score, 0) / totalScans) : 0

  if (loading) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="text-white/40 animate-pulse">Loading your dashboard…</div>
    </div>
  )

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-white/40 mb-8">Your scan history and site health overview.</p>

        {error && (
          <div className="glass border-amber-500/20 p-4 mb-6 flex gap-2 text-amber-400 text-sm">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Scans',   value: totalScans,      icon: Shield, color: 'text-brand-cyan' },
            { label: 'Avg Risk Score',value: avgScore,        icon: TrendingUp, color: 'text-brand-purple' },
            { label: 'Suspicious',    value: suspiciousCount, icon: AlertTriangle, color: 'text-amber-400' },
            { label: 'Dangerous',     value: dangerousCount,  icon: AlertTriangle, color: 'text-rose-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass p-5 animate-slide-up">
              <Icon size={20} className={`mb-2 ${color}`} />
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-white/40 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* History table */}
        <div className="glass overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock size={16} className="text-brand-cyan" />
              Scan History
            </div>
            <Link to="/" className="text-xs text-brand-cyan/70 hover:text-brand-cyan transition-colors">
              + New Scan
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center">
              <Shield size={40} className="mx-auto text-white/10 mb-4" />
              <p className="text-white/40 text-sm">No scans yet. <Link to="/" className="text-brand-cyan">Scan a website</Link> to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {history.map((scan) => (
                <div key={scan.id} className="px-5 py-4 hover:bg-white/3 transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classificationBadge(scan.classification)}`}>
                          {scan.classification}
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${scan.uptime_is_online ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${scan.uptime_is_online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {scan.uptime_is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm font-medium truncate">{scan.url}</p>
                      <ScoreBar score={scan.risk_score} classification={scan.classification} />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white/25 text-xs">
                        {new Date(scan.scanned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {scan.ssl_days_until_expiry != null && (
                        <p className={`text-xs mt-1 ${scan.ssl_days_until_expiry < 14 ? 'text-amber-400' : 'text-white/30'}`}>
                          SSL {scan.ssl_days_until_expiry}d
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

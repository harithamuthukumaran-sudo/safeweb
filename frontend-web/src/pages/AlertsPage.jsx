import React, { useEffect, useState } from 'react'
import { Bell, BellOff, CheckCheck, AlertTriangle, WifiOff, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchAlerts, markAlertsRead } from '../lib/api'

const SEVERITY_STYLES = {
  critical: 'border-rose-500/40 bg-rose-500/5',
  warning:  'border-amber-500/40 bg-amber-500/5',
  info:     'border-brand-cyan/20 bg-brand-cyan/3',
}
const SEVERITY_ICON = {
  critical: <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />,
  warning:  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />,
  info:     <Bell          size={16} className="text-brand-cyan/60 shrink-0 mt-0.5" />,
}
const TYPE_ICONS = {
  site_offline:        <WifiOff  size={14} className="text-rose-400" />,
  site_recovered:      <Shield   size={14} className="text-emerald-400" />,
  new_threat_detected: <AlertTriangle size={14} className="text-rose-400" />,
  threat_cleared:      <Shield   size={14} className="text-emerald-400" />,
  risk_score_increased:<AlertTriangle size={14} className="text-amber-400" />,
  ssl_expired:         <Shield   size={14} className="text-rose-400" />,
  ssl_expiring_soon:   <Shield   size={14} className="text-amber-400" />,
}

export default function AlertsPage() {
  const { session } = useAuth()
  const [alerts,      setAlerts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [unreadOnly,  setUnreadOnly]  = useState(false)
  const [selected,    setSelected]    = useState(new Set())
  const [marking,     setMarking]     = useState(false)

  const load = () => {
    if (!session) return
    setLoading(true)
    fetchAlerts(session, unreadOnly)
      .then(setAlerts)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [session, unreadOnly])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleMarkRead = async () => {
    const ids = selected.size > 0 ? [...selected] : alerts.filter(a => !a.is_read).map(a => a.id)
    if (!ids.length) return
    setMarking(true)
    try {
      await markAlertsRead(ids, session)
      setAlerts(prev => prev.map(a => ids.includes(a.id) ? { ...a, is_read: true } : a))
      setSelected(new Set())
    } finally {
      setMarking(false)
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Alerts
            {unreadCount > 0 && (
              <span className="text-sm bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`btn-ghost py-1.5 px-3 text-sm flex items-center gap-2 ${unreadOnly ? 'border-brand-cyan/40 text-brand-cyan' : ''}`}
            >
              {unreadOnly ? <Bell size={14} /> : <BellOff size={14} />}
              {unreadOnly ? 'Unread only' : 'All alerts'}
            </button>
            {(unreadCount > 0 || selected.size > 0) && (
              <button
                onClick={handleMarkRead}
                disabled={marking}
                className="btn-primary py-1.5 px-3 text-sm flex items-center gap-2"
              >
                <CheckCheck size={14} />
                {selected.size > 0 ? `Mark ${selected.size} read` : 'Mark all read'}
              </button>
            )}
          </div>
        </div>
        <p className="text-white/40 mb-8">Safety events triggered by your monitored sites.</p>

        {loading ? (
          <div className="text-center py-16 text-white/30 animate-pulse text-sm">Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div className="glass p-16 text-center">
            <Bell size={40} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/40 text-sm">No alerts yet.</p>
            <p className="text-white/25 text-xs mt-1">Alerts appear when monitored sites change safety status.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => toggleSelect(alert.id)}
                className={`glass border p-5 cursor-pointer transition-all duration-200
                  ${SEVERITY_STYLES[alert.severity] || ''}
                  ${!alert.is_read ? 'ring-1 ring-inset ring-white/5' : 'opacity-60'}
                  ${selected.has(alert.id) ? 'ring-2 ring-brand-cyan/40' : ''}
                  hover:bg-white/8
                `}
              >
                <div className="flex items-start gap-3">
                  {SEVERITY_ICON[alert.severity]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-white">{alert.title}</span>
                      {!alert.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan shrink-0" />
                      )}
                      <span className="flex items-center gap-1 text-xs text-white/30 ml-auto">
                        {TYPE_ICONS[alert.alert_type]}
                        {alert.alert_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-white/25 text-xs truncate">{alert.url}</p>
                      {alert.previous_risk_score != null && alert.new_risk_score != null && (
                        <p className="text-xs text-amber-400/70 shrink-0">
                          Score: {alert.previous_risk_score} → {alert.new_risk_score}
                        </p>
                      )}
                      <p className="text-white/20 text-xs ml-auto shrink-0">
                        {new Date(alert.triggered_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

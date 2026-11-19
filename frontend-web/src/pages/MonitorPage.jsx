import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchMonitoredSites, addMonitoredSite, removeMonitoredSite } from '../lib/api'

function StatusDot({ isOnline }) {
  if (isOnline === null || isOnline === undefined)
    return <span className="w-2 h-2 rounded-full bg-white/20" />
  return <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
}

export default function MonitorPage() {
  const { session } = useAuth()
  const [sites,   setSites]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState({ url: '', label: '', interval: '24' })
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(null)

  const loadSites = () => {
    if (!session) return
    setLoading(true)
    fetchMonitoredSites(session)
      .then(setSites)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSites() }, [session])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.url.trim()) return
    setAdding(true)
    setError(null)
    setSuccess(null)
    try {
      await addMonitoredSite(form.url.trim(), form.label.trim() || null, parseInt(form.interval), session)
      setSuccess(`Added ${form.url} to monitoring.`)
      setForm({ url: '', label: '', interval: '24' })
      loadSites()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (siteId, url) => {
    if (!confirm(`Stop monitoring "${url}"?`)) return
    try {
      await removeMonitoredSite(siteId, session)
      setSites(prev => prev.filter(s => s.id !== siteId))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Site Monitor</h1>
          <button onClick={loadSites} className="btn-ghost py-1.5 px-3 flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <p className="text-white/40 mb-8">Get alerted when your monitored sites become unsafe, go offline, or SSL expires.</p>

        {/* Add site form */}
        <div className="glass p-6 mb-8">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Add a site to monitor</h2>
          {error   && <div className="mb-4 flex gap-2 text-rose-400 text-sm"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}
          {success && <div className="mb-4 flex gap-2 text-emerald-400 text-sm"><CheckCircle size={14} className="mt-0.5 shrink-0" />{success}</div>}
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              id="monitor-url"
              type="text"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://yoursite.com"
              className="input-url md:col-span-2"
              required
            />
            <input
              id="monitor-label"
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Label (optional)"
              className="input-url"
            />
            <select
              id="monitor-interval"
              value={form.interval}
              onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
              className="input-url"
            >
              <option value="1">Every 1 hour</option>
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Daily</option>
              <option value="72">Every 3 days</option>
              <option value="168">Weekly</option>
            </select>
            <button
              type="submit"
              disabled={adding}
              className="btn-primary flex items-center justify-center gap-2 md:col-span-4"
            >
              {adding ? <span className="w-4 h-4 border-2 border-navy-950/40 border-t-navy-950 rounded-full animate-spin" /> : <Plus size={16} />}
              {adding ? 'Adding…' : 'Start Monitoring'}
            </button>
          </form>
        </div>

        {/* Sites list */}
        <div className="glass overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 text-sm font-semibold flex items-center gap-2">
            <Eye size={16} className="text-brand-purple" />
            Monitored Sites ({sites.length})
          </div>

          {loading ? (
            <div className="p-10 text-center text-white/30 animate-pulse text-sm">Loading…</div>
          ) : sites.length === 0 ? (
            <div className="p-12 text-center text-white/30 text-sm">
              No sites monitored yet. Add one above to get started.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sites.map(site => (
                <div key={site.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/3 transition-colors group">
                  <StatusDot isOnline={site.last_is_online} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{site.label || site.url}</p>
                    {site.label && <p className="text-white/30 text-xs truncate">{site.url}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-white/25 text-xs">Every {site.check_interval_hours}h</span>
                      {site.last_risk_score != null && (
                        <span className={`text-xs font-medium ${
                          site.last_risk_score >= 60 ? 'text-rose-400' :
                          site.last_risk_score >= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          Score: {site.last_risk_score}
                        </span>
                      )}
                      {site.last_checked_at && (
                        <span className="text-white/20 text-xs">
                          Checked {new Date(site.last_checked_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDelete(site.id, site.url)}
                      className="p-2 text-white/30 hover:text-rose-400 transition-colors"
                      title="Stop monitoring"
                    >
                      <Trash2 size={15} />
                    </button>
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

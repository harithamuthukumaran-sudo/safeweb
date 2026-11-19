import React from 'react'
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Info } from 'lucide-react'

function SslCard({ ssl }) {
  const ok = ssl?.has_ssl && ssl?.is_valid && !ssl?.is_expired
  return (
    <div className={`glass p-4 flex flex-col gap-2 animate-slide-up`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-white/50 uppercase tracking-wider">
        <ShieldCheck size={14} /> SSL Certificate
      </div>
      {ssl?.error_message && !ssl?.has_ssl ? (
        <p className="text-rose-400 text-sm">⚠ No SSL — {ssl.error_message}</p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'badge-safe' : 'badge-suspicious'}`}>
              {ssl?.is_expired ? 'Expired' : ssl?.is_expiring_soon ? 'Expiring Soon' : ssl?.is_valid ? 'Valid' : 'Invalid'}
            </span>
            {ssl?.protocol_version && (
              <span className="text-white/40 text-xs">{ssl.protocol_version}</span>
            )}
          </div>
          {ssl?.issuer && <p className="text-white/60 text-xs truncate">Issuer: {ssl.issuer}</p>}
          {ssl?.days_until_expiry != null && (
            <p className={`text-xs font-medium ${ssl.days_until_expiry < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {ssl.days_until_expiry} days remaining
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function UptimeCard({ uptime }) {
  const online = uptime?.is_online
  return (
    <div className="glass p-4 flex flex-col gap-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center gap-2 text-sm font-semibold text-white/50 uppercase tracking-wider">
        <Info size={14} /> Uptime
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
        <span className={`text-sm font-semibold ${online ? 'text-emerald-400' : 'text-rose-400'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
        {uptime?.status_code && <span className="text-white/30 text-xs">HTTP {uptime.status_code}</span>}
      </div>
      {uptime?.response_time_ms != null && (
        <p className="text-white/60 text-xs">
          Response: <span className="text-white font-medium">{Math.round(uptime.response_time_ms)} ms</span>
          {uptime.latency_classification && (
            <span className="text-white/40 ml-1">· {uptime.latency_classification}</span>
          )}
        </p>
      )}
    </div>
  )
}

function ThreatCard({ googleSafebrowsing, virustotal }) {
  const gsb = googleSafebrowsing
  const vt  = virustotal
  const anyThreat = gsb?.is_dangerous || (vt?.positives > 0)

  return (
    <div className="glass p-4 flex flex-col gap-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-2 text-sm font-semibold text-white/50 uppercase tracking-wider">
        {anyThreat ? <ShieldX size={14} className="text-rose-400" /> : <ShieldCheck size={14} />}
        Threat Intel
      </div>

      {/* Google Safe Browsing */}
      {gsb && (
        <div className="text-xs">
          <span className="text-white/40">Google Safe Browsing: </span>
          {gsb.is_dangerous ? (
            <span className="text-rose-400 font-semibold">{gsb.threats_found?.join(', ') || 'Threat detected'}</span>
          ) : gsb.error ? (
            <span className="text-white/30">Not checked</span>
          ) : (
            <span className="text-emerald-400 font-medium">Clean</span>
          )}
        </div>
      )}

      {/* VirusTotal */}
      {vt && (
        <div className="text-xs">
          <span className="text-white/40">VirusTotal: </span>
          {vt.error ? (
            <span className="text-white/30">Not checked</span>
          ) : vt.positives > 0 ? (
            <span className="text-rose-400 font-semibold">{vt.positives}/{vt.total} engines flagged</span>
          ) : (
            <span className="text-emerald-400 font-medium">
              0/{vt.total || '?'} engines flagged
            </span>
          )}
        </div>
      )}

      {!anyThreat && !gsb?.error && !vt?.error && (
        <p className="text-white/30 text-xs italic">No threats found — further monitoring recommended.</p>
      )}
    </div>
  )
}

export default function ScanResultCard({ result }) {
  if (!result) return null
  const { url, final_url, risk_score, ssl_details, uptime_details, threat_intelligence } = result

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Final URL */}
      <div className="glass p-4">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Scanned URL</p>
        <p className="text-sm text-white/80 break-all">{final_url || url}</p>
        {final_url && final_url !== url && (
          <p className="text-xs text-amber-400 mt-1">↳ Redirected from: {url}</p>
        )}
      </div>

      {/* Disclaimer */}
      {result.risk_score?.disclaimer && (
        <div className="flex gap-2 text-xs text-white/40 italic p-3 bg-white/3 rounded-xl border border-white/5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500/60" />
          {result.risk_score.disclaimer}
        </div>
      )}

      {/* Detail Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SslCard ssl={ssl_details} />
        <UptimeCard uptime={uptime_details} />
        <ThreatCard
          googleSafebrowsing={threat_intelligence?.google_safe_browsing}
          virustotal={threat_intelligence?.virustotal}
        />
      </div>

      {/* Risk factors list */}
      {result.risk_score?.factors && result.risk_score.factors.length > 0 && (
        <div className="glass p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Risk Factors Detected</p>
          <ul className="space-y-2">
            {result.risk_score.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${
                  f.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                  f.severity === 'high'     ? 'bg-orange-500/20 text-orange-400' :
                  f.severity === 'medium'   ? 'bg-amber-500/20 text-amber-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {f.severity?.toUpperCase()}
                </span>
                <span className="text-white/70">{f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { Search, Shield, Zap, Lock, Globe, ArrowRight, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { scanUrl } from '../lib/api'
import RiskScoreMeter from '../components/RiskScoreMeter'
import ScanResultCard from '../components/ScanResultCard'

const EXAMPLE_URLS = ['https://google.com', 'https://github.com', 'https://wikipedia.org']

function FeaturePill({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs text-white/50">
      <Icon size={12} className="text-brand-cyan" />
      {text}
    </div>
  )
}

export default function ScannerPage() {
  const { session } = useAuth()
  const [url,        setUrl]        = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)

  const handleScan = async (targetUrl) => {
    const cleanUrl = (targetUrl || url).trim()
    if (!cleanUrl) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await scanUrl(cleanUrl, session)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Scan failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleScan() }

  const riskScore     = result?.risk_score?.score        ?? 0
  const classification = result?.risk_score?.classification ?? 'safe'

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-xs text-brand-cyan/80 mb-6">
            <Shield size={12} />
            AI-Powered Website Safety Scanner
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 leading-tight">
            Is this website{' '}
            <span className="bg-gradient-to-r from-brand-cyan via-brand-purple to-brand-cyan bg-clip-text text-transparent animate-pulse-slow">
              safe?
            </span>
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Instant SSL inspection, malware detection, phishing analysis, and transparent risk scoring — 
            no guessing, no false safety claims.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 animate-fade-in">
          <FeaturePill icon={Lock}  text="SSL Inspection" />
          <FeaturePill icon={Shield} text="Malware Detection" />
          <FeaturePill icon={Zap}   text="Uptime Check" />
          <FeaturePill icon={Globe} text="Phishing Detection" />
        </div>

        {/* URL Input */}
        <div className="glass p-2 flex gap-2 animate-slide-up mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="w-full bg-transparent border-none outline-none pl-10 pr-4 py-3 text-white placeholder-white/25"
              disabled={loading}
            />
          </div>
          <button
            id="scan-btn"
            onClick={() => handleScan()}
            disabled={loading || !url.trim()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-navy-950/50 border-t-navy-950 rounded-full animate-spin" />
                Scanning…
              </>
            ) : (
              <>Scan Now <ArrowRight size={16} /></>
            )}
          </button>
        </div>

        {/* Example URLs */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {EXAMPLE_URLS.map(u => (
            <button
              key={u}
              onClick={() => { setUrl(u); handleScan(u) }}
              disabled={loading}
              className="text-xs text-white/30 hover:text-brand-cyan transition-colors disabled:opacity-30"
            >
              Try: {u}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="glass border-rose-500/30 p-4 flex gap-3 items-start mb-6 animate-fade-in">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-400 text-sm">Scan Error</p>
              <p className="text-white/50 text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Risk Score Gauge */}
            <div className="glass p-8 flex flex-col items-center gap-2">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Risk Score</p>
              <RiskScoreMeter score={riskScore} classification={classification} size={220} />
              <p className="text-white/60 text-sm text-center max-w-md mt-2">
                {result.risk_score?.label}
              </p>
            </div>

            {/* Detail Cards */}
            <ScanResultCard result={result} />

            {!session && (
              <div className="glass p-5 text-center animate-fade-in">
                <p className="text-white/50 text-sm mb-3">
                  💡 <strong className="text-white/70">Sign in</strong> to save this scan to your history and set up monitoring alerts.
                </p>
                <a href="/auth" className="btn-primary text-sm py-2 px-5 inline-flex">
                  Create Free Account
                </a>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="glass p-8 flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-full border-4 border-white/10 border-t-brand-cyan animate-spin" />
              <p className="text-white/40 text-sm">Running safety checks…</p>
              <div className="text-xs text-white/25 space-y-1 text-center">
                <p>• Validating URL and DNS</p>
                <p>• Inspecting SSL certificate</p>
                <p>• Querying threat intelligence</p>
                <p>• Calculating risk score</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

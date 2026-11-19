import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const { user, signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [tab,      setTab]      = useState(params.get('tab') === 'signup' ? 'signup' : 'signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [msg,      setMsg]      = useState(null)

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMsg(null)
    try {
      if (tab === 'signin') {
        const { error } = await signInWithEmail(email, password)
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { error } = await signUpWithEmail(email, password)
        if (error) throw error
        setMsg('Account created! Check your email to confirm your address, then sign in.')
        setTab('signin')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-purple items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,212,255,0.3)]">
            <Shield size={28} className="text-navy-950" />
          </div>
          <h1 className="text-2xl font-bold">
            {tab === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {tab === 'signin' ? 'Sign in to access your dashboard' : 'Free access to all SafeWeb features'}
          </p>
        </div>

        {/* Tabs */}
        <div className="glass flex p-1 rounded-xl mb-6">
          {['signin', 'signup'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setMsg(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                tab === t ? 'bg-gradient-to-r from-brand-cyan to-brand-purple text-navy-950 shadow' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 glass border-rose-500/30 p-3 flex gap-2 text-rose-400 text-sm animate-fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {msg && (
          <div className="mb-4 glass border-emerald-500/30 p-3 flex gap-2 text-emerald-400 text-sm animate-fade-in">
            <CheckCircle size={15} className="shrink-0 mt-0.5" />
            {msg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="input-url pl-10"
            />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              id="auth-password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'Password (min 8 characters)' : 'Password'}
              required
              minLength={8}
              className="input-url pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-navy-950/40 border-t-navy-950 rounded-full animate-spin" />
              : tab === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          By continuing you agree to our{' '}
          <Link to="/" className="text-brand-cyan/60 hover:text-brand-cyan">Terms of Service</Link>.
        </p>
      </div>
    </div>
  )
}

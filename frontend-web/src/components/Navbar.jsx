import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Bell, LogOut, User, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ alertCount = 0 }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
    setMenuOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-950/80 backdrop-blur-xl border-b border-white/8">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-purple flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all duration-300">
            <Shield size={16} className="text-navy-950" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent">
            SafeWeb
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-white/60 hover:text-white text-sm transition-colors">Scanner</Link>
          {user && (
            <>
              <Link to="/dashboard" className="text-white/60 hover:text-white text-sm transition-colors">Dashboard</Link>
              <Link to="/monitor" className="text-white/60 hover:text-white text-sm transition-colors">Monitor</Link>
            </>
          )}
        </div>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link to="/alerts" className="relative p-2 text-white/60 hover:text-white transition-colors">
                <Bell size={18} />
                {alertCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-xl">
                <User size={14} className="text-white/40" />
                <span className="text-white/60 text-xs max-w-[120px] truncate">{user.email}</span>
              </div>
              <button onClick={handleSignOut} className="btn-ghost text-sm flex items-center gap-2 py-1.5 px-3">
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className="btn-ghost text-sm py-1.5">Sign in</Link>
              <Link to="/auth?tab=signup" className="btn-primary text-sm py-1.5 px-4">Get Started</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-white/60" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-navy-900/95 backdrop-blur-xl border-b border-white/8 py-4 px-4 space-y-2 animate-fade-in">
          <Link to="/" onClick={() => setMenuOpen(false)} className="block py-2 text-white/70">Scanner</Link>
          {user && (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block py-2 text-white/70">Dashboard</Link>
              <Link to="/monitor" onClick={() => setMenuOpen(false)} className="block py-2 text-white/70">Monitor</Link>
              <Link to="/alerts" onClick={() => setMenuOpen(false)} className="block py-2 text-white/70">Alerts</Link>
            </>
          )}
          {user ? (
            <button onClick={handleSignOut} className="w-full text-left py-2 text-rose-400 text-sm">Sign out</button>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="block py-2 text-brand-cyan text-sm">Sign in / Register</Link>
          )}
        </div>
      )}
    </nav>
  )
}

import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { fetchAlerts } from './lib/api'

import Navbar       from './components/Navbar'
import ScannerPage  from './pages/ScannerPage'
import DashboardPage from './pages/DashboardPage'
import MonitorPage  from './pages/MonitorPage'
import AlertsPage   from './pages/AlertsPage'
import AuthPage     from './pages/AuthPage'

/** Wrapper that scrolls to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/** Guard that redirects unauthenticated users to /auth */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

function AppInner() {
  const { session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  // Poll for unread alert count every 2 minutes when logged in
  useEffect(() => {
    if (!session) { setUnreadCount(0); return }
    const load = () =>
      fetchAlerts(session, true).then(a => setUnreadCount(a.length)).catch(() => {})
    load()
    const id = setInterval(load, 120_000)
    return () => clearInterval(id)
  }, [session])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar alertCount={unreadCount} />
      <main>
        <Routes>
          <Route path="/"          element={<ScannerPage />} />
          <Route path="/auth"      element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/monitor"   element={<ProtectedRoute><MonitorPage /></ProtectedRoute>} />
          <Route path="/alerts"    element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

/**
 * Returns the Authorization header object if the user is signed in,
 * or an empty object for anonymous requests.
 */
function authHeaders(session) {
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }
  return {}
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.detail?.detail || data?.detail || `HTTP ${res.status}`
    throw new Error(message)
  }
  return data
}

// ─── Scanner ───────────────────────────────────────────────

/**
 * Performs a full website safety scan.
 * Sends the JWT if logged in (scan is saved to history).
 */
export async function scanUrl(url, session = null) {
  const res = await fetch(`${API_URL}/api/v1/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(session),
    },
    body: JSON.stringify({ url }),
  })
  return handleResponse(res)
}

// ─── Scan History ──────────────────────────────────────────

export async function fetchScanHistory(session, limit = 20, offset = 0) {
  const res = await fetch(
    `${API_URL}/api/v1/history?limit=${limit}&offset=${offset}`,
    { headers: authHeaders(session) }
  )
  return handleResponse(res)
}

export async function fetchScanDetail(scanId, session) {
  const res = await fetch(`${API_URL}/api/v1/history/${scanId}`, {
    headers: authHeaders(session),
  })
  return handleResponse(res)
}

// ─── Monitored Sites ───────────────────────────────────────

export async function fetchMonitoredSites(session) {
  const res = await fetch(`${API_URL}/api/v1/monitor`, {
    headers: authHeaders(session),
  })
  return handleResponse(res)
}

export async function addMonitoredSite(url, label, intervalHours = 24, session) {
  const res = await fetch(`${API_URL}/api/v1/monitor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(session),
    },
    body: JSON.stringify({ url, label, check_interval_hours: intervalHours }),
  })
  return handleResponse(res)
}

export async function removeMonitoredSite(siteId, session) {
  const res = await fetch(`${API_URL}/api/v1/monitor/${siteId}`, {
    method: 'DELETE',
    headers: authHeaders(session),
  })
  return handleResponse(res)
}

// ─── Alerts ────────────────────────────────────────────────

export async function fetchAlerts(session, unreadOnly = false) {
  const res = await fetch(
    `${API_URL}/api/v1/alerts?unread_only=${unreadOnly}`,
    { headers: authHeaders(session) }
  )
  return handleResponse(res)
}

export async function markAlertsRead(alertIds, session) {
  const res = await fetch(`${API_URL}/api/v1/alerts/mark-read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(session),
    },
    body: JSON.stringify({ alert_ids: alertIds }),
  })
  return handleResponse(res)
}

"""
Tests for Stage 3: Supabase Auth integration.

We test the authentication layer and new endpoints without an actual
Supabase connection (mocked throughout).
"""
import time
from unittest.mock import patch, AsyncMock, MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
_FAKE_SECRET = "test-jwt-secret-at-least-32-characters-long"
_FAKE_USER_ID = "00000000-0000-0000-0000-000000000001"
_FAKE_EMAIL = "test@safeweb.local"


def _make_token(
    user_id: str = _FAKE_USER_ID,
    secret: str = _FAKE_SECRET,
    role: str = "authenticated",
    exp_offset: int = 3600,
) -> str:
    """Generate a minimal Supabase-style JWT for testing."""
    payload = {
        "sub": user_id,
        "email": _FAKE_EMAIL,
        "role": role,
        "aud": "authenticated",
        "iat": int(time.time()),
        "exp": int(time.time()) + exp_offset,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


# ──────────────────────────────────────────────────────────────
# Health endpoint
# ──────────────────────────────────────────────────────────────

def test_health_includes_config_flags():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "supabase_configured" in data
    assert "virustotal_configured" in data
    assert "google_safe_browsing_configured" in data


# ──────────────────────────────────────────────────────────────
# Auth middleware tests
# ──────────────────────────────────────────────────────────────

def test_history_endpoint_requires_auth():
    """GET /api/v1/history without a token returns 401."""
    response = client.get("/api/v1/history")
    assert response.status_code == 401


def test_monitor_endpoint_requires_auth():
    """GET /api/v1/monitor without a token returns 401."""
    response = client.get("/api/v1/monitor")
    assert response.status_code == 401


def test_alerts_endpoint_requires_auth():
    """GET /api/v1/alerts without a token returns 401."""
    response = client.get("/api/v1/alerts")
    assert response.status_code == 401


def test_expired_token_returns_401():
    """A token with exp in the past should be rejected."""
    expired_token = _make_token(exp_offset=-1)
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        response = client.get(
            "/api/v1/history",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_invalid_token_returns_401():
    """A garbage token string should be rejected."""
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        response = client.get(
            "/api/v1/history",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
        )
    assert response.status_code == 401


def test_wrong_secret_returns_401():
    """A token signed with the wrong secret should be rejected."""
    good_token = _make_token(secret=_FAKE_SECRET)
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = "completely-different-secret-value-32chars"
        response = client.get(
            "/api/v1/history",
            headers={"Authorization": f"Bearer {good_token}"},
        )
    assert response.status_code == 401


# ──────────────────────────────────────────────────────────────
# History endpoint (authenticated)
# ──────────────────────────────────────────────────────────────

def test_history_returns_list_when_authenticated():
    """Authenticated user gets an empty list (DB mocked)."""
    token = _make_token()
    with patch("app.core.security.settings") as mock_settings, \
         patch("app.api.v1.history.get_scan_history", new_callable=AsyncMock) as mock_hist:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        mock_hist.return_value = []

        response = client.get(
            "/api/v1/history",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_history_returns_scans():
    """History endpoint returns whatever the DB service provides."""
    token = _make_token()
    fake_scans = [
        {"id": "abc", "url": "https://example.com", "risk_score": 0, "classification": "safe"},
    ]
    with patch("app.core.security.settings") as mock_settings, \
         patch("app.api.v1.history.get_scan_history", new_callable=AsyncMock) as mock_hist:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        mock_hist.return_value = fake_scans

        response = client.get(
            "/api/v1/history",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["url"] == "https://example.com"


# ──────────────────────────────────────────────────────────────
# Monitor endpoint (authenticated)
# ──────────────────────────────────────────────────────────────

def test_monitor_list_returns_empty():
    token = _make_token()
    with patch("app.core.security.settings") as mock_settings, \
         patch("app.api.v1.monitor.get_monitored_sites", new_callable=AsyncMock) as mock_sites:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        mock_sites.return_value = []

        response = client.get(
            "/api/v1/monitor",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert response.json() == []


def test_monitor_add_rejects_ssrf_url():
    """Adding an internal URL to monitoring is blocked by SSRF validation."""
    token = _make_token()
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        response = client.post(
            "/api/v1/monitor",
            json={"url": "http://192.168.1.100"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


def test_monitor_add_valid_url():
    token = _make_token()
    fake_site = {"id": "site-1", "url": "https://example.com", "check_interval_hours": 24}
    with patch("app.core.security.settings") as mock_settings, \
         patch("app.services.ssrf_validator.resolve_hostname_ips", return_value=["93.184.215.14"]), \
         patch("app.api.v1.monitor.add_monitored_site", new_callable=AsyncMock) as mock_add:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        mock_add.return_value = fake_site

        response = client.post(
            "/api/v1/monitor",
            json={"url": "https://example.com", "check_interval_hours": 24},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 201
    data = response.json()
    assert "added to your monitoring list" in data["message"]


# ──────────────────────────────────────────────────────────────
# Alerts endpoint (authenticated)
# ──────────────────────────────────────────────────────────────

def test_alerts_returns_list():
    token = _make_token()
    fake_alerts = [
        {
            "id": "alert-1",
            "url": "https://example.com",
            "alert_type": "site_offline",
            "severity": "critical",
            "title": "Site went offline",
            "is_read": False,
        }
    ]
    with patch("app.core.security.settings") as mock_settings, \
         patch("app.api.v1.alerts.get_alerts", new_callable=AsyncMock) as mock_alerts:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        mock_alerts.return_value = fake_alerts

        response = client.get(
            "/api/v1/alerts",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["alert_type"] == "site_offline"


def test_mark_alerts_read():
    token = _make_token()
    with patch("app.core.security.settings") as mock_settings, \
         patch("app.api.v1.alerts.mark_alerts_read", new_callable=AsyncMock) as mock_mark:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET
        mock_mark.return_value = None

        response = client.post(
            "/api/v1/alerts/mark-read",
            json={"alert_ids": ["alert-1", "alert-2"]},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert "2 alert(s) marked as read" in response.json()["message"]


# ──────────────────────────────────────────────────────────────
# Scan with save (optional auth)
# ──────────────────────────────────────────────────────────────

def test_scan_saves_to_db_when_authenticated():
    """Full scan with valid auth token also triggers DB save."""
    from app.models.schemas import SSLDetails

    token = _make_token()
    mock_ssl = SSLDetails(has_ssl=True, is_valid=True, issuer="DigiCert",
                          subject="example.com", days_until_expiry=120,
                          protocol_version="TLSv1.3", is_expired=False)
    mock_probe = {
        "url": "https://example.com",
        "final_url": "https://example.com/",
        "status_code": 200,
        "response_time_ms": 145.0,
        "redirect_count": 0,
        "content_length_bytes": 1024,
        "headers_sample": {"server": "ECS"},
    }

    with patch("app.core.security.settings") as mock_settings, \
         patch("app.services.ssrf_validator.resolve_hostname_ips", return_value=["93.184.215.14"]), \
         patch("app.services.url_scanner.safe_probe_url", new_callable=AsyncMock, return_value=mock_probe), \
         patch("app.services.url_scanner.check_ssl_certificate", return_value=mock_ssl), \
         patch("app.api.v1.scan.save_scan_to_db", new_callable=AsyncMock) as mock_save:
        mock_settings.SUPABASE_JWT_SECRET = _FAKE_SECRET

        response = client.post(
            "/api/v1/scan",
            json={"url": "https://example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    mock_save.assert_awaited_once()
    # Verify user_id was passed to save_scan_to_db
    call_args = mock_save.await_args
    assert call_args.args[1] == _FAKE_USER_ID


def test_scan_works_anonymously_no_save():
    """Full scan without token still works, but save receives user_id=None."""
    from app.models.schemas import SSLDetails

    mock_ssl = SSLDetails(has_ssl=True, is_valid=True, issuer="DigiCert",
                          subject="example.com", days_until_expiry=120,
                          protocol_version="TLSv1.3", is_expired=False)
    mock_probe = {
        "url": "https://example.com",
        "final_url": "https://example.com/",
        "status_code": 200,
        "response_time_ms": 100.0,
        "redirect_count": 0,
        "content_length_bytes": 512,
        "headers_sample": {},
    }

    with patch("app.services.ssrf_validator.resolve_hostname_ips", return_value=["93.184.215.14"]), \
         patch("app.services.url_scanner.safe_probe_url", new_callable=AsyncMock, return_value=mock_probe), \
         patch("app.services.url_scanner.check_ssl_certificate", return_value=mock_ssl), \
         patch("app.api.v1.scan.save_scan_to_db", new_callable=AsyncMock) as mock_save:

        response = client.post("/api/v1/scan", json={"url": "https://example.com"})

    assert response.status_code == 200
    mock_save.assert_awaited_once()
    # user_id should be None for anonymous scan
    assert mock_save.await_args.args[1] is None

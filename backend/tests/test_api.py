from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["ssrf_protection"] == "active"


def test_validate_url_rejects_localhost():
    response = client.post(
        "/api/v1/scan/validate-url",
        json={"url": "http://127.0.0.1:8000"},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_validate_url_rejects_cloud_metadata():
    response = client.post(
        "/api/v1/scan/validate-url",
        json={"url": "http://169.254.169.254/latest/meta-data/"},
    )
    assert response.status_code == 400


def test_validate_url_allows_public_domain():
    with patch("app.services.ssrf_validator.resolve_hostname_ips", return_value=["93.184.215.14"]):
        response = client.post(
            "/api/v1/scan/validate-url",
            json={"url": "https://example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_safe_to_request"] is True
        assert data["hostname"] == "example.com"
        assert data["port"] == 443
        assert data["resolved_ips"] == ["93.184.215.14"]


def test_scan_endpoint_rejects_ssrf():
    response = client.post(
        "/api/v1/scan",
        json={"url": "http://192.168.1.1"},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_scan_endpoint_full_pipeline_mocked():
    from app.models.schemas import SSLDetails

    mock_ssl = SSLDetails(
        has_ssl=True,
        is_valid=True,
        issuer="DigiCert",
        subject="example.com",
        days_until_expiry=120,
        protocol_version="TLSv1.3",
        is_expired=False,
    )
    mock_probe = {
        "url": "https://example.com",
        "final_url": "https://example.com/",
        "status_code": 200,
        "response_time_ms": 145.0,
        "redirect_count": 0,
        "content_length_bytes": 1024,
        "headers_sample": {"server": "ECS"},
    }

    with patch("app.services.ssrf_validator.resolve_hostname_ips", return_value=["93.184.215.14"]), \
         patch("app.services.url_scanner.safe_probe_url", return_value=mock_probe), \
         patch("app.services.url_scanner.check_ssl_certificate", return_value=mock_ssl):

        response = client.post(
            "/api/v1/scan",
            json={"url": "https://example.com"},
        )
        assert response.status_code == 200
        data = response.json()

        assert data["url"] == "https://example.com"
        assert "risk_score" in data
        assert data["risk_score"]["score"] == 0
        assert data["risk_score"]["classification"] == "safe"
        assert "Low Risk" in data["risk_score"]["label"]

        assert "ssl_details" in data
        assert data["ssl_details"]["has_ssl"] is True
        assert data["ssl_details"]["protocol_version"] == "TLSv1.3"

        assert "uptime_details" in data
        assert data["uptime_details"]["is_online"] is True
        assert data["uptime_details"]["status_code"] == 200
        assert data["uptime_details"]["latency_classification"] == "Fast"

        assert "threat_intelligence" in data
        assert len(data["threat_intelligence"]) == 2

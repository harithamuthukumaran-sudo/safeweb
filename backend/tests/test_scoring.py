from app.models.schemas import (
    SSLDetails,
    UptimeDetails,
    ThreatIntelResult,
)
from app.services.scoring_engine import calculate_risk_score


def _make_clean_ssl() -> SSLDetails:
    return SSLDetails(
        has_ssl=True,
        is_valid=True,
        issuer="Let's Encrypt",
        subject="example.com",
        valid_from="2026-01-01T00:00:00Z",
        valid_until="2026-12-31T00:00:00Z",
        days_until_expiry=90,
        protocol_version="TLSv1.3",
        san_domains=["example.com"],
        is_expired=False,
        is_expiring_soon=False,
        error_message=None,
    )


def _make_clean_uptime() -> UptimeDetails:
    return UptimeDetails(
        is_online=True,
        status_code=200,
        response_time_ms=120.5,
        latency_classification="Fast",
    )


def test_clean_website_produces_low_risk_score():
    ssl_details = _make_clean_ssl()
    uptime_details = _make_clean_uptime()
    threat_intel = [
        ThreatIntelResult(
            provider="Google Safe Browsing",
            status="clean",
            is_flagged=False,
        ),
        ThreatIntelResult(
            provider="VirusTotal",
            status="clean",
            is_flagged=False,
        ),
    ]

    result = calculate_risk_score(ssl_details, uptime_details, threat_intel)

    assert result.score == 0
    assert result.classification == "safe"
    assert "Low Risk" in result.label
    assert "no security scanner can guarantee 100% safety" in result.disclaimer
    assert len(result.risk_factors) == 0


def test_missing_ssl_adds_risk():
    ssl_details = SSLDetails(has_ssl=False, is_valid=False, error_message="No SSL")
    uptime_details = _make_clean_uptime()

    result = calculate_risk_score(ssl_details, uptime_details, [])

    assert result.score == 15
    assert result.classification == "safe"  # 15 is < 25
    assert any(f.category == "ssl" for f in result.risk_factors)


def test_expired_ssl_triggers_suspicious():
    ssl_details = _make_clean_ssl()
    ssl_details.is_expired = True
    ssl_details.days_until_expiry = -10
    uptime_details = _make_clean_uptime()

    result = calculate_risk_score(ssl_details, uptime_details, [])

    assert result.score == 35
    assert result.classification == "suspicious"
    assert "Suspicious" in result.label


def test_untrusted_ssl_triggers_suspicious():
    ssl_details = _make_clean_ssl()
    ssl_details.is_valid = False
    ssl_details.error_message = "Self-signed certificate in chain"
    uptime_details = _make_clean_uptime()

    result = calculate_risk_score(ssl_details, uptime_details, [])

    assert result.score == 30
    assert result.classification == "suspicious"


def test_google_safebrowsing_malware_triggers_dangerous():
    ssl_details = _make_clean_ssl()
    uptime_details = _make_clean_uptime()
    threat_intel = [
        ThreatIntelResult(
            provider="Google Safe Browsing",
            status="malicious",
            is_flagged=True,
            threat_types=["MALWARE"],
        )
    ]

    result = calculate_risk_score(ssl_details, uptime_details, threat_intel)

    assert result.score >= 70
    assert result.classification == "dangerous"
    assert "Dangerous" in result.label
    assert "Malware" in result.risk_factors[0].description


def test_google_safebrowsing_phishing_triggers_dangerous():
    ssl_details = _make_clean_ssl()
    uptime_details = _make_clean_uptime()
    threat_intel = [
        ThreatIntelResult(
            provider="Google Safe Browsing",
            status="phishing",
            is_flagged=True,
            threat_types=["SOCIAL_ENGINEERING"],
        )
    ]

    result = calculate_risk_score(ssl_details, uptime_details, threat_intel)

    assert result.score >= 70
    assert result.classification == "dangerous"


def test_virustotal_multi_engine_triggers_dangerous():
    ssl_details = _make_clean_ssl()
    uptime_details = _make_clean_uptime()
    threat_intel = [
        ThreatIntelResult(
            provider="VirusTotal",
            status="malicious",
            is_flagged=True,
            raw_details={"malicious": 8, "suspicious": 2},
        )
    ]

    result = calculate_risk_score(ssl_details, uptime_details, threat_intel)

    assert result.score >= 70
    assert result.classification == "dangerous"


def test_excessive_redirects_adds_risk():
    ssl_details = _make_clean_ssl()
    uptime_details = _make_clean_uptime()

    result = calculate_risk_score(ssl_details, uptime_details, [], redirect_count=3)

    assert result.score == 15
    assert any(f.category == "heuristic" for f in result.risk_factors)


def test_score_never_exceeds_100():
    ssl_details = SSLDetails(has_ssl=False, is_valid=False, is_expired=True)
    uptime_details = UptimeDetails(is_online=False, latency_classification="Offline")
    threat_intel = [
        ThreatIntelResult(provider="Google Safe Browsing", status="malicious", is_flagged=True, threat_types=["MALWARE"]),
        ThreatIntelResult(provider="VirusTotal", status="malicious", is_flagged=True, raw_details={"malicious": 10}),
    ]

    result = calculate_risk_score(ssl_details, uptime_details, threat_intel, redirect_count=5)

    assert result.score == 100
    assert result.classification == "dangerous"


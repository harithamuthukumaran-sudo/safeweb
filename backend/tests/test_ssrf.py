import pytest
from app.services.ssrf_validator import (
    validate_url_for_ssrf,
    SSRFSecurityException,
)


@pytest.mark.parametrize("target", [
    "http://localhost",
    "http://localhost:80",
    "https://localhost",
    "http://sub.localhost",
    "http://app.internal",
    "http://server.local",
    "http://metadata.google.internal",
])
def test_blocks_localhost_and_internal_domains(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code in ("BLOCKED_HOSTNAME", "FORBIDDEN_RESOLVED_IP")


@pytest.mark.parametrize("target", [
    "http://127.0.0.1",
    "http://127.0.0.2",
    "http://127.1.2.3",
    "http://[::1]",
])
def test_blocks_loopback_ips(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code in ("FORBIDDEN_IP", "FORBIDDEN_RESOLVED_IP")


@pytest.mark.parametrize("target", [
    "http://10.0.0.1",
    "http://10.254.254.254",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.0.1",
    "http://192.168.1.254",
    "http://[fc00::1]",
])
def test_blocks_private_rfc1918_ips(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code in ("FORBIDDEN_IP", "FORBIDDEN_RESOLVED_IP")


@pytest.mark.parametrize("target", [
    "http://169.254.169.254",  # AWS / GCP / Azure metadata IP
    "http://169.254.1.1",      # Link-local block
])
def test_blocks_link_local_and_cloud_metadata(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code in ("FORBIDDEN_IP", "FORBIDDEN_RESOLVED_IP")


@pytest.mark.parametrize("target", [
    "ftp://example.com",
    "file:///etc/passwd",
    "gopher://evil.com",
    "ssh://example.com",
    "dict://example.com",
])
def test_blocks_non_http_schemes(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code == "INVALID_SCHEME"


@pytest.mark.parametrize("target", [
    "http://example.com:22",
    "http://example.com:8080",
    "http://example.com:3000",
    "https://example.com:8443",
    "http://example.com:9200",
])
def test_blocks_disallowed_ports(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code == "FORBIDDEN_PORT"


@pytest.mark.parametrize("target", [
    "http://0.0.0.0",
    "http://224.0.0.1",       # Multicast
    "http://255.255.255.255", # Broadcast
])
def test_blocks_special_and_reserved_ips(target):
    with pytest.raises(SSRFSecurityException) as exc_info:
        validate_url_for_ssrf(target)
    assert exc_info.value.reason_code in ("FORBIDDEN_IP", "FORBIDDEN_RESOLVED_IP")


def test_allows_valid_public_domain():
    url, hostname, port, resolved_ips = validate_url_for_ssrf("https://example.com")
    assert url == "https://example.com/"
    assert hostname == "example.com"
    assert port == 443
    assert len(resolved_ips) > 0
    # None of the resolved IPs should be private or loopback
    import ipaddress
    for ip_str in resolved_ips:
        ip = ipaddress.ip_address(ip_str)
        assert not ip.is_private
        assert not ip.is_loopback


def test_normalizes_bare_domain():
    url, hostname, port, resolved_ips = validate_url_for_ssrf("example.com")
    assert url == "https://example.com/"
    assert hostname == "example.com"
    assert port == 443

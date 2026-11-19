import ssl
import socket
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from cryptography import x509
from cryptography.hazmat.backends import default_backend

from app.models.schemas import SSLDetails


def _format_x509_name(name: x509.Name) -> str:
    """Format an X.509 Name into a human-readable string (CN or Org)."""
    cn_attrs = name.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
    if cn_attrs:
        return str(cn_attrs[0].value)
    org_attrs = name.get_attributes_for_oid(x509.oid.NameOID.ORGANIZATION_NAME)
    if org_attrs:
        return str(org_attrs[0].value)
    return str(name)


def _extract_san_domains(cert: x509.Certificate) -> List[str]:
    """Extract list of SAN DNS names from an X.509 certificate."""
    san_list: List[str] = []
    try:
        san_ext = cert.extensions.get_extension_for_oid(x509.oid.ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        san_names = san_ext.value
        for name in san_names:
            if isinstance(name, x509.DNSName):
                san_list.append(name.value)
    except Exception:
        pass
    return san_list


def check_ssl_certificate(hostname: str, port: int = 443, timeout: float = 3.0) -> SSLDetails:
    """
    Inspects the SSL/TLS certificate for a target host.
    Checks validity, chain trust, expiration dates, protocol version, issuer, and SAN domains.
    Handles self-signed, expired, and hostname-mismatched certificates gracefully.
    """
    now = datetime.now(timezone.utc)

    # 1. First attempt: Standard strict chain-verified SSL connection
    verified_context = ssl.create_default_context()
    try:
        with socket.create_connection((hostname, port), timeout=timeout) as sock:
            with verified_context.wrap_socket(sock, server_hostname=hostname) as sslsock:
                der_cert = sslsock.getpeercert(binary_form=True)
                proto_version = sslsock.version()

                # Parse X.509 certificate using cryptography for precise parsing
                cert = x509.load_der_x509_certificate(der_cert, default_backend())
                not_before = cert.not_valid_before_utc
                not_after = cert.not_valid_after_utc
                days_left = (not_after - now).days

                return SSLDetails(
                    has_ssl=True,
                    is_valid=True,
                    issuer=_format_x509_name(cert.issuer),
                    subject=_format_x509_name(cert.subject),
                    valid_from=not_before.isoformat(),
                    valid_until=not_after.isoformat(),
                    days_until_expiry=days_left,
                    protocol_version=proto_version,
                    san_domains=_extract_san_domains(cert),
                    is_expired=(days_left < 0),
                    is_expiring_soon=(0 <= days_left <= 30),
                    error_message=None,
                )

    except ssl.SSLCertVerificationError as e:
        # Certificate failed verification (self-signed, untrusted CA, expired, or wrong host)
        # Attempt unverified probe to extract certificate metadata for user visibility
        unverified_details = _probe_unverified_cert(hostname, port, timeout, now, str(e.verify_message))
        return unverified_details

    except (ssl.SSLError, socket.timeout, ConnectionRefusedError, OSError) as e:
        # Target does not support SSL/TLS or connection failed
        return SSLDetails(
            has_ssl=False,
            is_valid=False,
            issuer=None,
            subject=None,
            valid_from=None,
            valid_until=None,
            days_until_expiry=None,
            protocol_version=None,
            san_domains=[],
            is_expired=False,
            is_expiring_soon=False,
            error_message=f"SSL handshake failed: {str(e)}",
        )


def _probe_unverified_cert(
    hostname: str,
    port: int,
    timeout: float,
    now: datetime,
    verification_error: str,
) -> SSLDetails:
    """Fallback to read metadata from an untrusted / self-signed certificate."""
    unverified_context = ssl._create_unverified_context()
    try:
        with socket.create_connection((hostname, port), timeout=timeout) as sock:
            with unverified_context.wrap_socket(sock, server_hostname=hostname) as sslsock:
                der_cert = sslsock.getpeercert(binary_form=True)
                proto_version = sslsock.version()
                cert = x509.load_der_x509_certificate(der_cert, default_backend())
                not_before = cert.not_valid_before_utc
                not_after = cert.not_valid_after_utc
                days_left = (not_after - now).days

                return SSLDetails(
                    has_ssl=True,
                    is_valid=False,
                    issuer=_format_x509_name(cert.issuer),
                    subject=_format_x509_name(cert.subject),
                    valid_from=not_before.isoformat(),
                    valid_until=not_after.isoformat(),
                    days_until_expiry=days_left,
                    protocol_version=proto_version,
                    san_domains=_extract_san_domains(cert),
                    is_expired=(days_left < 0),
                    is_expiring_soon=(0 <= days_left <= 30),
                    error_message=verification_error,
                )
    except Exception as e:
        return SSLDetails(
            has_ssl=True,
            is_valid=False,
            issuer=None,
            subject=None,
            valid_from=None,
            valid_until=None,
            days_until_expiry=None,
            protocol_version=None,
            san_domains=[],
            is_expired=False,
            is_expiring_soon=False,
            error_message=f"Untrusted certificate: {verification_error} (details unavailable: {str(e)})",
        )


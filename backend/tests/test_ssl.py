from unittest.mock import patch, MagicMock
from app.services.ssl_checker import check_ssl_certificate


def test_ssl_connection_failure():
    # Attempting SSL on a closed port / non-existent host should return has_ssl=False
    details = check_ssl_certificate("127.0.0.1", port=443, timeout=0.5)
    assert details.has_ssl is False
    assert details.is_valid is False
    assert details.error_message is not None


def test_ssl_successful_inspection_mock():
    with patch("socket.create_connection") as mock_conn:
        mock_sock = MagicMock()
        mock_conn.return_value.__enter__.return_value = mock_sock

        with patch("ssl.create_default_context") as mock_ctx:
            mock_sslsock = MagicMock()
            mock_ctx.return_value.wrap_socket.return_value.__enter__.return_value = mock_sslsock
            mock_sslsock.version.return_value = "TLSv1.3"

            from cryptography import x509
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.x509.oid import NameOID
            from datetime import datetime, timedelta, timezone

            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COMMON_NAME, "mocked-test.com"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Mock Security CA"),
            ])
            cert = (
                x509.CertificateBuilder()
                .subject_name(subject)
                .issuer_name(issuer)
                .public_key(private_key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
                .not_valid_after(datetime.now(timezone.utc) + timedelta(days=90))
                .add_extension(x509.SubjectAlternativeName([x509.DNSName("mocked-test.com")]), critical=False)
                .sign(private_key, hashes.SHA256())
            )
            mock_sslsock.getpeercert.return_value = cert.public_bytes(serialization.Encoding.DER)

            details = check_ssl_certificate("mocked-test.com", port=443)

            assert details.has_ssl is True
            assert details.is_valid is True
            assert details.issuer == "mocked-test.com"
            assert details.subject == "mocked-test.com"
            assert details.protocol_version == "TLSv1.3"
            assert "mocked-test.com" in details.san_domains
            assert details.days_until_expiry is not None
            assert details.days_until_expiry > 80
            assert details.is_expired is False

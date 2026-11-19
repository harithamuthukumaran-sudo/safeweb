import socket
import ipaddress
import urllib.parse
from typing import List, Tuple, Optional


class SSRFSecurityException(Exception):
    """Custom exception raised when a URL fails SSRF safety checks."""
    def __init__(self, message: str, reason_code: str = "SSRF_VIOLATION"):
        super().__init__(message)
        self.message = message
        self.reason_code = reason_code


# Restricted IP Networks
RESTRICTED_NETWORKS = [
    # Loopback
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    # Private RFC 1918 & IPv6 Unique Local
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("fc00::/7"),
    # Link-local & Cloud Metadata (AWS, Azure, GCP, DigitalOcean)
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("fe80::/10"),
    # Carrier Grade NAT (CGNAT - RFC 6598)
    ipaddress.ip_network("100.64.0.0/10"),
    # Documentation & Test nets (RFC 5737 / RFC 3849)
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("2001:db8::/32"),
    # Benchmarking (RFC 2544)
    ipaddress.ip_network("198.18.0.0/15"),
    # Multicast & Reserved
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("ff00::/8"),
    # Current network / Unspecified
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::/128"),
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "instance-data",
    "metadata.internal",
}

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}


def is_ip_restricted(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> Tuple[bool, str]:
    """Check if an IP address belongs to loopback, private, link-local, or reserved ranges."""
    if ip.is_loopback:
        return True, "Loopback address is not allowed"
    if ip.is_private:
        return True, "Private internal network address is not allowed"
    if ip.is_link_local:
        return True, "Link-local address (metadata service) is not allowed"
    if ip.is_multicast:
        return True, "Multicast address is not allowed"
    if ip.is_reserved:
        return True, "Reserved IP address is not allowed"
    if ip.is_unspecified:
        return True, "Unspecified address (0.0.0.0 or ::) is not allowed"

    for net in RESTRICTED_NETWORKS:
        if ip in net:
            return True, f"IP belongs to restricted CIDR block {net}"

    return False, ""


def resolve_hostname_ips(hostname: str) -> List[str]:
    """
    Resolve hostname to all distinct IPv4 and IPv6 addresses via DNS.
    Throws SSRFSecurityException if resolution fails or returns no IP.
    """
    try:
        addr_info = socket.getaddrinfo(
            hostname,
            None,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as e:
        raise SSRFSecurityException(f"Failed to resolve hostname '{hostname}' via DNS: {e.strerror}", "DNS_RESOLUTION_FAILED")
    except Exception as e:
        raise SSRFSecurityException(f"DNS lookup error for '{hostname}': {str(e)}", "DNS_LOOKUP_ERROR")

    ips = set()
    for entry in addr_info:
        sockaddr = entry[4]
        ip_str = sockaddr[0]
        # Clean any IPv6 zone index if present
        if "%" in ip_str:
            ip_str = ip_str.split("%")[0]
        ips.add(ip_str)

    if not ips:
        raise SSRFSecurityException(f"No IP addresses found for hostname '{hostname}'", "NO_DNS_RECORDS")

    return sorted(list(ips))


def validate_url_for_ssrf(raw_url: str) -> Tuple[str, str, int, List[str]]:
    """
    Validates a URL against strict SSRF constraints.
    Returns: (normalized_url, hostname, port, list_of_resolved_ips)
    Raises SSRFSecurityException on any policy violation.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise SSRFSecurityException("URL must be a non-empty string", "INVALID_INPUT")

    cleaned_url = raw_url.strip()

    parsed = urllib.parse.urlsplit(cleaned_url)

    # If no scheme was provided (e.g. "example.com" or "example.com:443"), default to https
    if not parsed.scheme:
        cleaned_url = "https://" + cleaned_url
        parsed = urllib.parse.urlsplit(cleaned_url)

    # 1. Scheme Check
    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise SSRFSecurityException(
            f"Scheme '{scheme}' is forbidden. Only HTTP and HTTPS are permitted.",
            "INVALID_SCHEME"
        )

    # 2. Hostname Validation
    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityException("URL is missing a valid hostname", "MISSING_HOSTNAME")

    hostname = hostname.rstrip(".").lower()

    # Reject localhost & internal cloud metadata suffixes
    if hostname in BLOCKED_HOSTNAMES:
        raise SSRFSecurityException(f"Access to hostname '{hostname}' is blocked.", "BLOCKED_HOSTNAME")

    if hostname.endswith((".localhost", ".local", ".internal", ".localdomain")):
        raise SSRFSecurityException(f"Internal domain name '{hostname}' is forbidden.", "BLOCKED_HOSTNAME")

    # Encode IDN / punycode if needed
    try:
        ascii_hostname = hostname.encode("idna").decode("ascii")
    except Exception:
        ascii_hostname = hostname

    # 3. Port Check
    port = parsed.port
    if port is None:
        port = 80 if scheme == "http" else 443

    if port not in ALLOWED_PORTS:
        raise SSRFSecurityException(
            f"Port {port} is not allowed. Only standard ports (80, 443) are allowed.",
            "FORBIDDEN_PORT"
        )

    # 4. Check if hostname is directly an IP address
    # (Catches direct IP inputs like 127.0.0.1, 10.0.0.1, 169.254.169.254, etc.)
    try:
        direct_ip = ipaddress.ip_address(hostname.strip("[]"))
        is_restricted, reason = is_ip_restricted(direct_ip)
        if is_restricted:
            raise SSRFSecurityException(f"Direct access to IP {direct_ip} is forbidden: {reason}", "FORBIDDEN_IP")
        resolved_ips = [str(direct_ip)]
    except ValueError:
        # Not a raw IP string, resolve via DNS
        resolved_ips = resolve_hostname_ips(ascii_hostname)

    # 5. Check all resolved IPs against the blacklist
    for ip_str in resolved_ips:
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            raise SSRFSecurityException(f"Invalid resolved IP '{ip_str}'", "INVALID_IP_RETURNED")

        is_restricted, reason = is_ip_restricted(ip_obj)
        if is_restricted:
            raise SSRFSecurityException(
                f"Resolved IP {ip_str} for host '{hostname}' is not permitted: {reason}",
                "FORBIDDEN_RESOLVED_IP"
            )

    # Reconstruct normalized URL
    netloc = ascii_hostname
    if (scheme == "http" and port != 80) or (scheme == "https" and port != 443):
        netloc = f"{ascii_hostname}:{port}"

    path = parsed.path if parsed.path else "/"
    query = f"?{parsed.query}" if parsed.query else ""
    normalized_url = f"{scheme}://{netloc}{path}{query}"

    return normalized_url, ascii_hostname, port, resolved_ips


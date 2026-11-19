import time
import urllib.parse
from typing import Dict, Any, Optional
import httpx

from app.core.config import settings
from app.services.ssrf_validator import (
    validate_url_for_ssrf,
    SSRFSecurityException,
)


SAFE_HEADER_KEYS = {
    "server",
    "content-type",
    "strict-transport-security",
    "x-frame-options",
    "x-content-type-options",
    "x-xss-protection",
    "content-security-policy",
    "referrer-policy",
    "location",
}


async def safe_probe_url(
    target_url: str,
    connect_timeout: float = settings.CONNECT_TIMEOUT_SECONDS,
    read_timeout: float = settings.TOTAL_TIMEOUT_SECONDS,
    max_bytes: int = settings.MAX_RESPONSE_BYTES,
    max_redirects: int = settings.MAX_REDIRECT_HOPS,
) -> Dict[str, Any]:
    """
    Performs a hardened, SSRF-protected HTTP probe of a target URL.
    - Validates DNS and IP before every hop.
    - Manually validates each redirect target before following.
    - Enforces strict connect and read timeouts.
    - Streams response with a maximum size ceiling (never downloads large files).
    """
    # Initial SSRF check on target URL
    normalized_url, hostname, port, resolved_ips = validate_url_for_ssrf(target_url)

    current_url = normalized_url
    redirect_count = 0
    final_status = None
    headers_sample = {}
    content_type = None
    bytes_read = 0
    start_time = time.perf_counter()

    timeout_config = httpx.Timeout(
        connect=connect_timeout,
        read=read_timeout,
        write=read_timeout,
        pool=connect_timeout,
    )

    # Custom User-Agent clearly identifying the security scanner
    custom_headers = {
        "User-Agent": "SafeWeb-Scanner/1.0 (+https://safeweb-tracker.local/bot; Security Inspection Bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    async with httpx.AsyncClient(
        verify=False,  # We allow self-signed to probe status code, but SSL checker validates the cert independently
        follow_redirects=False,
        timeout=timeout_config,
    ) as client:
        while True:
            try:
                # Perform streaming GET request to prevent downloading huge payloads
                async with client.stream("GET", current_url, headers=custom_headers) as response:
                    final_status = response.status_code
                    content_type = response.headers.get("content-type")

                    # Extract safe response headers
                    for k, v in response.headers.items():
                        if k.lower() in SAFE_HEADER_KEYS:
                            headers_sample[k.lower()] = v

                    # Check Content-Length upfront if reported
                    content_length_header = response.headers.get("content-length")
                    if content_length_header and content_length_header.isdigit():
                        if int(content_length_header) > max_bytes:
                            # Too large, stop immediately
                            bytes_read = int(content_length_header)
                            break

                    # Read only up to max_bytes from the stream
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        bytes_read += len(chunk)
                        if bytes_read >= max_bytes:
                            break

                    # Check if this is a redirect
                    if response.status_code in (301, 302, 303, 307, 308):
                        redirect_location = response.headers.get("location")
                        if not redirect_location:
                            break  # No location provided, finish

                        if redirect_count >= max_redirects:
                            raise SSRFSecurityException(
                                f"Too many redirects (exceeded limit of {max_redirects})",
                                "MAX_REDIRECTS_EXCEEDED",
                            )

                        # Resolve relative redirect URLs against current URL
                        next_url = urllib.parse.urljoin(current_url, redirect_location)

                        # CRITICAL: Validate redirect destination through SSRF defense!
                        next_url, hostname, port, resolved_ips = validate_url_for_ssrf(next_url)
                        current_url = next_url
                        redirect_count += 1
                        continue

                    # Not a redirect, we reached final destination
                    break

            except httpx.ConnectTimeout:
                raise SSRFSecurityException(f"Connection timed out ({connect_timeout}s) connecting to host", "CONNECT_TIMEOUT")
            except httpx.ReadTimeout:
                raise SSRFSecurityException(f"Read timed out ({read_timeout}s) waiting for server response", "READ_TIMEOUT")
            except httpx.ConnectError as e:
                raise SSRFSecurityException(f"Failed to connect to host: {str(e)}", "CONNECT_ERROR")
            except httpx.RequestError as e:
                raise SSRFSecurityException(f"HTTP request error: {str(e)}", "HTTP_REQUEST_ERROR")

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "url": target_url,
        "final_url": current_url,
        "status_code": final_status,
        "response_time_ms": elapsed_ms,
        "redirect_count": redirect_count,
        "content_length_bytes": min(bytes_read, max_bytes),
        "content_type": content_type,
        "headers_sample": headers_sample,
        "ssrf_check": {
            "is_safe_to_request": True,
            "normalized_url": normalized_url,
            "scheme": urllib.parse.urlsplit(normalized_url).scheme,
            "hostname": hostname,
            "port": port,
            "resolved_ips": resolved_ips,
            "reason": None,
        },
    }


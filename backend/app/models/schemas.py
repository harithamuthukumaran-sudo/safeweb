from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class URLValidateRequest(BaseModel):
    url: str = Field(..., description="Target URL to scan", examples=["https://example.com"])


class SSRFCheckResult(BaseModel):
    is_safe_to_request: bool = Field(..., description="Whether URL passes strict SSRF checks")
    normalized_url: str = Field(..., description="Sanitized and normalized URL")
    scheme: str = Field(..., description="Protocol scheme (http or https)")
    hostname: str = Field(..., description="Extracted target hostname")
    port: int = Field(..., description="Target port")
    resolved_ips: List[str] = Field(default_factory=list, description="IP addresses resolved via DNS")
    reason: Optional[str] = Field(None, description="Detailed explanation if blocked or flagged")


class SafeProbeResponse(BaseModel):
    url: str = Field(..., description="Original requested URL")
    final_url: str = Field(..., description="Final URL after validated redirects")
    status_code: Optional[int] = Field(None, description="HTTP response status code")
    response_time_ms: Optional[float] = Field(None, description="Time taken to connect and probe in ms")
    redirect_count: int = Field(0, description="Number of validated redirects followed")
    content_length_bytes: int = Field(0, description="Bytes received up to the safe limit")
    content_type: Optional[str] = Field(None, description="MIME content type reported by server")
    headers_sample: Dict[str, str] = Field(default_factory=dict, description="Safe subset of HTTP response headers")
    ssrf_check: SSRFCheckResult = Field(..., description="SSRF validation details")


class SSLDetails(BaseModel):
    has_ssl: bool = Field(..., description="Whether site supports HTTPS/SSL")
    is_valid: bool = Field(..., description="Whether SSL certificate passed chain verification")
    issuer: Optional[str] = Field(None, description="Certificate authority or issuer")
    subject: Optional[str] = Field(None, description="Subject common name (CN)")
    valid_from: Optional[str] = Field(None, description="ISO timestamp when certificate became valid")
    valid_until: Optional[str] = Field(None, description="ISO timestamp when certificate expires")
    days_until_expiry: Optional[int] = Field(None, description="Days remaining until expiration")
    protocol_version: Optional[str] = Field(None, description="Negotiated TLS/SSL protocol (e.g. TLSv1.3)")
    san_domains: List[str] = Field(default_factory=list, description="Subject Alternative Names (SAN)")
    is_expired: bool = Field(False, description="Whether certificate is currently expired")
    is_expiring_soon: bool = Field(False, description="Whether certificate expires in less than 30 days")
    error_message: Optional[str] = Field(None, description="Error details if SSL check failed")


class UptimeDetails(BaseModel):
    is_online: bool = Field(..., description="Whether website is responding to HTTP requests")
    status_code: Optional[int] = Field(None, description="HTTP response status code")
    response_time_ms: Optional[float] = Field(None, description="Round-trip latency in milliseconds")
    latency_classification: str = Field("Unknown", description="Fast (<300ms), Moderate (300-1000ms), Slow (>1000ms), or Offline")


class ThreatIntelResult(BaseModel):
    provider: str = Field(..., description="Provider name: Google Safe Browsing or VirusTotal")
    status: str = Field(..., description="Status: clean, malicious, phishing, suspicious, unconfigured, or error")
    is_flagged: bool = Field(False, description="True if provider detected any malware, phishing, or threat")
    threat_types: List[str] = Field(default_factory=list, description="List of detected threat classifications")
    raw_details: Dict[str, Any] = Field(default_factory=dict, description="Detailed stats or vendor counts")
    api_configured: bool = Field(True, description="Whether a live API key was supplied or heuristic fallback was used")


class RiskFactor(BaseModel):
    category: str = Field(..., description="Category: threat_intel, ssl, uptime, or heuristic")
    severity: str = Field(..., description="Severity level: low, medium, high, or critical")
    score_impact: int = Field(..., description="Points added to risk score (out of 100)")
    description: str = Field(..., description="Explanation of why this risk factor was triggered")


class RiskScoreResult(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Risk score from 0 (lowest risk) to 100 (highest risk)")
    classification: str = Field(..., description="safe, suspicious, or dangerous")
    label: str = Field(..., description="Human-readable badge label")
    disclaimer: str = Field(..., description="Accurate safety disclosure (no guarantee disclaimer)")
    risk_factors: List[RiskFactor] = Field(default_factory=list, description="List of triggered risk items")


class ScanResultResponse(BaseModel):
    id: str = Field(..., description="Unique scan identifier")
    url: str = Field(..., description="Original URL scanned")
    final_url: str = Field(..., description="Final URL after safe redirect inspection")
    scanned_at: str = Field(..., description="ISO 8601 timestamp of scan")
    risk_score: RiskScoreResult = Field(..., description="Calculated 0-100 risk score and classification")
    ssl_details: SSLDetails = Field(..., description="SSL/TLS certificate inspection details")
    uptime_details: UptimeDetails = Field(..., description="Uptime and latency metrics")
    threat_intelligence: List[ThreatIntelResult] = Field(default_factory=list, description="Threat intel provider results")
    headers_sample: Dict[str, str] = Field(default_factory=dict, description="Sample of relevant response headers")


class GenericErrorResponse(BaseModel):
    detail: str
    error_code: str

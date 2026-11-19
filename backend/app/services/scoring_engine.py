from typing import List, Tuple
from app.models.schemas import (
    SSLDetails,
    UptimeDetails,
    ThreatIntelResult,
    RiskFactor,
    RiskScoreResult,
)


def calculate_risk_score(
    ssl_details: SSLDetails,
    uptime_details: UptimeDetails,
    threat_intel_results: List[ThreatIntelResult],
    redirect_count: int = 0,
) -> RiskScoreResult:
    """
    Computes a deterministic, multi-factor risk score from 0 (lowest risk) to 100 (highest risk).
    Never invents scan findings; every score increment is explained by a documented RiskFactor.
    Adheres strictly to nuanced safety claims (no guarantee of 100% safety).
    """
    factors: List[RiskFactor] = []
    total_score = 0

    # 1. Threat Intelligence Analysis
    for intel in threat_intel_results:
        if not intel.is_flagged:
            continue

        if intel.provider == "Google Safe Browsing":
            if "MALWARE" in intel.threat_types:
                factors.append(RiskFactor(
                    category="threat_intel",
                    severity="critical",
                    score_impact=75,
                    description="Google Safe Browsing flagged this URL as hosting malicious software (Malware).",
                ))
                total_score += 75
            elif "SOCIAL_ENGINEERING" in intel.threat_types:
                factors.append(RiskFactor(
                    category="threat_intel",
                    severity="critical",
                    score_impact=75,
                    description="Google Safe Browsing identified this URL as a deceptive or phishing site.",
                ))
                total_score += 75
            else:
                factors.append(RiskFactor(
                    category="threat_intel",
                    severity="high",
                    score_impact=50,
                    description=f"Google Safe Browsing flagged threat types: {', '.join(intel.threat_types)}",
                ))
                total_score += 50

        elif intel.provider == "VirusTotal":
            malicious_count = intel.raw_details.get("malicious", 0)
            suspicious_count = intel.raw_details.get("suspicious", 0)

            if malicious_count >= 3:
                factors.append(RiskFactor(
                    category="threat_intel",
                    severity="critical",
                    score_impact=80,
                    description=f"{malicious_count} antivirus engines on VirusTotal flagged this URL as malicious.",
                ))
                total_score += 80
            elif malicious_count >= 1:
                factors.append(RiskFactor(
                    category="threat_intel",
                    severity="high",
                    score_impact=55,
                    description=f"{malicious_count} antivirus engine(s) on VirusTotal flagged this URL as malicious.",
                ))
                total_score += 55
            elif suspicious_count >= 1:
                factors.append(RiskFactor(
                    category="threat_intel",
                    severity="medium",
                    score_impact=30,
                    description=f"{suspicious_count} security vendor(s) marked this domain as suspicious.",
                ))
                total_score += 30

    # 2. SSL / TLS Certificate Evaluation
    if not ssl_details.has_ssl:
        factors.append(RiskFactor(
            category="ssl",
            severity="medium",
            score_impact=15,
            description="Website does not provide HTTPS encryption. Unencrypted HTTP traffic is vulnerable to interception.",
        ))
        total_score += 15
    else:
        if ssl_details.is_expired:
            factors.append(RiskFactor(
                category="ssl",
                severity="high",
                score_impact=35,
                description=f"SSL certificate expired ({abs(ssl_details.days_until_expiry or 0)} days ago).",
            ))
            total_score += 35
        elif not ssl_details.is_valid:
            factors.append(RiskFactor(
                category="ssl",
                severity="high",
                score_impact=30,
                description=f"SSL certificate failed verification: {ssl_details.error_message or 'Untrusted certificate authority'}.",
            ))
            total_score += 30
        elif ssl_details.is_expiring_soon:
            days_left = ssl_details.days_until_expiry or 0
            if days_left <= 14:
                factors.append(RiskFactor(
                    category="ssl",
                    severity="medium",
                    score_impact=15,
                    description=f"SSL certificate is expiring very soon ({days_left} days remaining).",
                ))
                total_score += 15
            else:
                factors.append(RiskFactor(
                    category="ssl",
                    severity="low",
                    score_impact=5,
                    description=f"SSL certificate will expire within 30 days ({days_left} days remaining).",
                ))
                total_score += 5

    # 3. Uptime & Availability Evaluation
    if not uptime_details.is_online:
        factors.append(RiskFactor(
            category="uptime",
            severity="medium",
            score_impact=20,
            description="Target website did not respond or timed out during probe.",
        ))
        total_score += 20
    elif uptime_details.status_code and uptime_details.status_code >= 500:
        factors.append(RiskFactor(
            category="uptime",
            severity="medium",
            score_impact=15,
            description=f"Server returned HTTP {uptime_details.status_code} server error.",
        ))
        total_score += 15

    # 4. Redirect Chaining Heuristics
    if redirect_count >= 3:
        factors.append(RiskFactor(
            category="heuristic",
            severity="medium",
            score_impact=15,
            description=f"Website executed {redirect_count} redirect hops (excessive redirect chains can conceal destinations).",
        ))
        total_score += 15

    # Clamp score to 0..100
    clamped_score = min(max(total_score, 0), 100)

    # Classification & Nuanced Disclaimers
    if clamped_score >= 70:
        classification = "dangerous"
        label = "Dangerous (High Risk)"
        disclaimer = "Known malicious threats, phishing signatures, or severe security violations were detected. Do not submit sensitive data or credentials."
    elif clamped_score >= 25:
        classification = "suspicious"
        label = "Suspicious (Caution Advised)"
        disclaimer = "Security warnings, configuration anomalies, or potential risks were identified. Proceed with elevated caution."
    else:
        classification = "safe"
        label = "Low Risk (No Known Threats Detected)"
        disclaimer = "No active threats were found in our threat intelligence databases. Always exercise standard caution, as no security scanner can guarantee 100% safety."

    return RiskScoreResult(
        score=clamped_score,
        classification=classification,
        label=label,
        disclaimer=disclaimer,
        risk_factors=factors,
    )


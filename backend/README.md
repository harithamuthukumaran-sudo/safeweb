# SafeWeb Backend (FastAPI)

SafeWeb's backend service provides URL safety scanning, threat intelligence aggregation, SSL inspection, uptime tracking, and strict SSRF defenses.

---

## Stage 1 & 2 Features Implemented

### 1. SSRF Defense & Hardened Probe
- **Scheme & Port Enforcement**: Only `http://` and `https://` on ports `80` and `443`.
- **IP Blacklist**: Loopback, RFC 1918 private, link-local, cloud metadata (`169.254.169.254`), CGNAT, and broadcast addresses are blocked.
- **DNS Resolution & Rebinding Defense**: Inspects all resolved IPs prior to socket connection.
- **Redirect Validation**: Follows redirects safely step-by-step up to 3 hops, re-checking DNS and IP at each hop.
- **Resource Limits**: 3s connect timeout, 5s total timeout, 512 KB response size ceiling.

### 2. Multi-Engine Threat Intelligence & Analysis
- **SSL / TLS Certificate Inspector** ([`app/services/ssl_checker.py`](app/services/ssl_checker.py)): Inspects chain trust, expiration days, issuer, protocol version, and SAN domains.
- **Website Uptime & Latency Prober** ([`app/services/uptime_checker.py`](app/services/uptime_checker.py)): Measures latency (Fast / Moderate / Slow) and HTTP status.
- **Google Safe Browsing Client** ([`app/services/google_safebrowsing.py`](app/services/google_safebrowsing.py)): Checks for malware, phishing, and unwanted software.
- **VirusTotal v3 Client** ([`app/services/virustotal.py`](app/services/virustotal.py)): Multi-engine antivirus aggregation.
- **Deterministic 0-100 Risk Scoring Engine** ([`app/services/scoring_engine.py`](app/services/scoring_engine.py)): Transparent, multi-factor scoring with nuanced safety disclaimers (no guarantee of 100% safety).
- **Unified Orchestrator Endpoint**: `POST /api/v1/scan` executes all checks concurrently using asynchronous tasks.

---

## Windows Quick-Start Guide

### 1. Run All Automated Tests
```powershell
.\backend\venv\Scripts\python.exe -m pytest backend\tests -v
```

### 2. Start the Backend Server
```powershell
.\backend\venv\Scripts\python.exe backend\run.py
```

### 3. Interactive Documentation
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## Example API Requests

### 1. Unified Website Safety Scan (`POST /api/v1/scan`)
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/scan" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### 2. SSRF Attack Block Check
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/scan" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
```
*(Returns HTTP 400 Bad Request with security reason)*

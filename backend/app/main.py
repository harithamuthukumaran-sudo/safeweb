from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.api.v1.scan import router as scan_router
from app.api.v1.history import router as history_router
from app.api.v1.monitor import router as monitor_router
from app.api.v1.alerts import router as alerts_router
from app.services.ssrf_validator import SSRFSecurityException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("safeweb")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "SafeWeb AI-Powered Website Safety Tracker API — "
        "SSRF Defense • SSL Inspection • Threat Intelligence • Risk Scoring"
    ),
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(SSRFSecurityException)
async def ssrf_exception_handler(request: Request, exc: SSRFSecurityException):
    client_ip = request.client.host if request.client else "unknown"
    logger.warning(f"SSRF violation blocked from {client_ip}: {exc.message}")
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "error_code": exc.reason_code},
    )


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify backend status."""
    supabase_configured = bool(
        settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_JWT_SECRET
    )
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ssrf_protection": "active",
        "supabase_configured": supabase_configured,
        "virustotal_configured": bool(settings.VIRUSTOTAL_API_KEY),
        "google_safe_browsing_configured": bool(settings.GOOGLE_SAFE_BROWSING_API_KEY),
    }


# Register API v1 routers
API_PREFIX = "/api/v1"
app.include_router(scan_router,    prefix=API_PREFIX)
app.include_router(history_router, prefix=API_PREFIX)
app.include_router(monitor_router, prefix=API_PREFIX)
app.include_router(alerts_router,  prefix=API_PREFIX)

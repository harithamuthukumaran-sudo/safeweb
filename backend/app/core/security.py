"""
Supabase Auth JWT verification middleware.

Supabase issues JWTs signed with your project's JWT_SECRET (HS256).
We verify that signature here on the backend – no request to Supabase
is needed for each API call, making auth fast and offline-capable.

The verified payload includes:
  - sub  : UUID of the authenticated user (same as auth.users.id)
  - email: user's email address
  - role : 'authenticated' or 'anon'
"""
import logging
from typing import Optional

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger("safeweb.security")

_bearer_scheme = HTTPBearer(auto_error=False)


def _decode_supabase_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase-issued JWT using the project's JWT secret.
    Raises HTTPException 401 on any failure.
    """
    jwt_secret = settings.SUPABASE_JWT_SECRET.strip()
    if not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication not configured. Set SUPABASE_JWT_SECRET in backend/.env",
        )

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["sub", "exp", "role"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency: extracts and verifies the Bearer JWT from the
    Authorization header. Raises HTTP 401 if missing or invalid.
    Returns the decoded JWT payload dict containing 'sub' (user UUID).
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode_supabase_jwt(credentials.credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
) -> Optional[dict]:
    """
    FastAPI dependency: same as get_current_user but returns None instead
    of raising 401 when no token is provided. Used for endpoints that work
    both anonymously and with an authenticated user (e.g. scan without saving).
    """
    if not credentials:
        return None
    try:
        return _decode_supabase_jwt(credentials.credentials)
    except HTTPException:
        return None

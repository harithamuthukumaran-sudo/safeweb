import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print("=" * 60)
    print(f"  Starting SafeWeb Backend Server ({settings.ENVIRONMENT})")
    print(f"  Listening on http://{settings.HOST}:{settings.PORT}")
    print(f"  Swagger Docs: http://{settings.HOST}:{settings.PORT}/docs")
    print("=" * 60)
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
    )


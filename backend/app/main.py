"""
FastAPI application entrypoint.

Scaffolding only: app instance, CORS, and a health check. Feature routers
(auth, links, search, tags) will be added and mounted here once implemented.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, links

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Basic liveness check used to confirm the backend + Docker setup work."""
    return {"status": "ok", "service": settings.app_name}


app.include_router(auth.router)
app.include_router(links.router)

# Future routers (not implemented yet):
# from app.routers import search, tags
# app.include_router(search.router)
# app.include_router(tags.router)

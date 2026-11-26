import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import init_db
from backend.routers import (
    outlets, imports, search, analytics, exports, settings, combined, excel_upload
)

app = FastAPI(
    title="Franchise Outlet Sales & Purchase Analytics System",
    description="Local web application for multi-outlet sales and purchase management, smart fuzzy matching, and operational analytics.",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(outlets.router)
app.include_router(imports.router)
app.include_router(search.router)
app.include_router(analytics.router)
app.include_router(exports.router)
app.include_router(settings.router)
app.include_router(combined.router)
app.include_router(excel_upload.router)


@app.on_event("startup")
def on_startup():
    init_db()


# Serve Frontend Production Build if present
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Prevent API routes from being handled by SPA fallback
        if full_path.startswith("api"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"status": "Frontend not built yet. Run 'npm run build' in frontend directory."}
else:
    @app.get("/")
    def root():
        return {
            "message": "Franchise Analytics API is active. Open the React frontend at http://localhost:5173",
            "docs": "/docs"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.utils.db import Base, engine
from src.user.router import user_router
from src.tasks.router import task_router
from src.queries.router import query_router
from src.attendance.router import attendance_router
from src.communications.router import comm_router
from src.communications.voice_router import upload_router
from src.calendar_events.router import calendar_router
from src.analytics.router import analytics_router
from src.worker.scheduler import start_scheduler, stop_scheduler
from src.admin.router import admin_router
from src.events import models as event_models
from src.events.router import router as events_router

# Ensure all database tables exist
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(
    title="Zenwork Workspace",
    version="1.0.0",
    description="Unified Enterprise Task Delegation, Attendance, and Operations Platform",
    lifespan=lifespan
)

# Mount uploads directory for serving voice notes & task files
os.makedirs("uploads", exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory="uploads"), name="static_uploads")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(task_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(query_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(comm_router, prefix="/api/v1")
app.include_router(calendar_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")



# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"message": "Zenwork Workspace API is running!"}
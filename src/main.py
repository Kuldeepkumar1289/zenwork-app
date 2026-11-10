import os
from fastapi.staticfiles import StaticFiles
from src.communications.voice_router import upload_router
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.utils.db import Base, engine
from src.user.router import user_router
from src.tasks.router import task_router
from src.queries.router import query_router
from src.attendance.router import attendance_router
from src.communications.router import communication_router
from src.calendar_events.router import calendar_router
from src.analytics.router import analytics_router
from src.worker.scheduler import start_scheduler, stop_scheduler

# Ensure tables exist
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # App startup: Background scheduler activate 
    start_scheduler()
    yield
    # App shutdown: Clean exit
    stop_scheduler()

app = FastAPI(
    title="Zenwork Workspace",
    version="1.0.0",
    description="Unified Enterprise Task Delegation, Attendance, and Operations Platform",
    lifespan=lifespan
)

# Routers
app.include_router(task_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(query_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(communication_router, prefix="/api/v1")
app.include_router(calendar_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")

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
import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from src.utils.dependencies import get_current_user
from src.user.models import User

upload_router = APIRouter(prefix="/media", tags=["Media & Voice Storage"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".webm", ".ogg", ".m4a", ".pdf", ".png", ".jpg"}

@upload_router.post("/upload-voice", status_code=status.HTTP_201_CREATED)
async def upload_voice_clip(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts audio blobs from browser MediaRecorder API or disk,
    stores them securely, and returns an accessible URL.
    """
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".webm"
    if not file_ext:
        file_ext = ".webm"

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    unique_filename = f"{uuid.uuid4()}_{current_user.id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {
        "file_name": unique_filename,
        "media_url": f"/static/uploads/{unique_filename}",
        "uploaded_by": current_user.full_name
    }
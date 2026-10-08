"""
FluxVid REST API Server
FastAPI + yt-dlp
Created By Shiv Yogi
"""

import os
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv

from downloader import MediaExtractor

load_dotenv()

app = FastAPI(
    title="FluxVid Universal Media API",
    description="Backend extraction service for FluxVid Downloader. Created By Shiv Yogi.",
    version="1.0.0"
)

# CORS Security Setup
allowed_origins_env = os.getenv("FRONTEND_ORIGIN", "*")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

TEMP_DIR = os.getenv("TEMP_DIRECTORY", os.path.join(os.path.dirname(__file__), "temp_downloads"))

# Schemas
class MediaInfoRequest(BaseModel):
    url: HttpUrl

class DownloadRequest(BaseModel):
    url: HttpUrl
    format_id: Optional[str] = "best"
    media_type: str = "video" # 'video' or 'audio'
    title: Optional[str] = "Media_File"

def cleanup_file(path: str):
    """Safely removes temporary download file after transmission."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

@app.get("/")
def health_check():
    return {
        "service": "FluxVid API",
        "creator": "Shiv Yogi",
        "status": "online"
    }

@app.post("/api/info")
def get_media_info(payload: MediaInfoRequest):
    """Extracts public media metadata without downloading."""
    try:
        data = MediaExtractor.extract_info(str(payload.url))
        return data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server was unable to extract media info.")

@app.post("/api/download")
def download_media_stream(payload: DownloadRequest, background_tasks: BackgroundTasks):
    """Downloads requested format and returns binary file with mandatory FluxVid naming format."""
    try:
        file_path, branded_filename = MediaExtractor.download_media(
            url=str(payload.url),
            format_id=payload.format_id or "best",
            media_type=payload.media_type,
            title=payload.title or "Media_File",
            temp_dir=TEMP_DIR
        )

        # Enforce automatic background cleanup after response completion
        background_tasks.add_task(cleanup_file, file_path)

        media_mime = "audio/mpeg" if payload.media_type == "audio" else "video/mp4"

        return FileResponse(
            path=file_path,
            filename=branded_filename,
            media_type=media_mime,
            headers={
                "Content-Disposition": f'attachment; filename="{branded_filename}"'
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Media processing error or format unavailable.")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
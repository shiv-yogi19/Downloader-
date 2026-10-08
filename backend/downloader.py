"""
FluxVid Media Extraction & Packaging Engine
Created By Shiv Yogi
Utilizes yt-dlp with subprocess isolation, safe temporary files, and strict filename generation.
"""

import os
import re
import tempfile
import asyncio
from typing import Dict, Any, List
import yt_dlp

SAFE_CHARS_PATTERN = re.compile(r'[^a-zA-Z0-9_\-\.\s]')
SPACES_PATTERN = re.compile(r'\s+')

def sanitize_media_title(title: str) -> str:
    """Sanitizes user/media titles without destroying legitimate readability."""
    if not title:
        return "Media_File"
    clean = SAFE_CHARS_PATTERN.sub('', title).strip()
    clean = SPACES_PATTERN.sub('_', clean)
    return clean[:80] if clean else "Media_File"

def build_fluxvid_filename(title: str, extension: str) -> str:
    """
    STRICT RULE:
    [Sanitized Original Name]_FluxVid-created by shiv yogi.[extension]
    """
    clean_title = sanitize_media_title(title)
    ext = extension.lstrip('.').lower()
    return f"{clean_title}_FluxVid-created by shiv yogi.{ext}"

class MediaExtractor:
    @staticmethod
    def extract_info(url: str, timeout: int = 45) -> Dict[str, Any]:
        """Extracts available video and audio format metadata from public URLs."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'socket_timeout': timeout,
            'extract_flat': False
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise ValueError("No metadata returned by extractor.")

                title = info.get('title', 'Unknown Title')
                duration = info.get('duration', 0)
                thumbnail = info.get('thumbnail', '')
                extractor_name = info.get('extractor_key', 'Public Source')

                raw_formats = info.get('formats', [])
                video_formats: List[Dict[str, Any]] = []
                audio_formats: List[Dict[str, Any]] = []
                seen_video_heights = set()

                for fmt in raw_formats:
                    # Video options (must have video stream)
                    vcodec = fmt.get('vcodec', 'none')
                    acodec = fmt.get('acodec', 'none')
                    height = fmt.get('height')

                    if vcodec != 'none' and height and height not in seen_video_heights:
                        seen_video_heights.add(height)
                        video_formats.append({
                            'format_id': fmt.get('format_id'),
                            'quality_label': f"{height}p",
                            'extension': fmt.get('ext', 'mp4'),
                            'height': height
                        })

                    # Audio options (audio stream present)
                    if acodec != 'none' and vcodec == 'none':
                        abr = fmt.get('abr')
                        label = f"{int(abr)} kbps" if abr else "Standard Audio"
                        audio_formats.append({
                            'format_id': fmt.get('format_id'),
                            'quality_label': label,
                            'extension': fmt.get('ext', 'mp3'),
                            'abr': abr or 0
                        })

                # Sort descending
                video_formats.sort(key=lambda x: x['height'], reverse=True)
                audio_formats.sort(key=lambda x: x['abr'], reverse=True)

                # Fallback if no specific split streams were provided
                if not video_formats:
                    video_formats.append({
                        'format_id': 'best',
                        'quality_label': 'Best Available',
                        'extension': 'mp4',
                        'height': 0
                    })
                
                if not audio_formats:
                    audio_formats.append({
                        'format_id': 'bestaudio/best',
                        'quality_label': 'Best Audio',
                        'extension': 'mp3',
                        'abr': 0
                    })

                return {
                    'title': title,
                    'duration': duration,
                    'thumbnail': thumbnail,
                    'extractor': extractor_name,
                    'video_formats': video_formats,
                    'audio_formats': audio_formats
                }

        except yt_dlp.utils.DownloadError as de:
            raise ValueError(f"Extractor Error: {str(de)}")
        except Exception as e:
            raise RuntimeError(f"Processing Failure: {str(e)}")

    @staticmethod
    def download_media(url: str, format_id: str, media_type: str, title: str, temp_dir: str) -> tuple[str, str]:
        """
        Executes actual media download/conversion and outputs file with the exact required filename.
        Returns: (file_path, fluxvid_filename)
        """
        os.makedirs(temp_dir, exist_ok=True)
        unique_prefix = next(tempfile._get_candidate_names())
        
        target_ext = "mp3" if media_type == "audio" else "mp4"
        final_filename = build_fluxvid_filename(title, target_ext)
        output_template = os.path.join(temp_dir, f"{unique_prefix}_%(title)s.%(ext)s")

        ydl_opts: Dict[str, Any] = {
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
            'max_filesize': 500 * 1024 * 1024, # 500MB max limit
        }

        if media_type == 'audio':
            ydl_opts.update({
                'format': format_id if format_id else 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        else:
            # Merges best video and audio via ffmpeg if format_id is single stream
            ydl_opts.update({
                'format': f"{format_id}+bestaudio/best" if format_id and format_id != 'best' else 'best',
                'merge_output_format': 'mp4'
            })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Locate downloaded file in temp_dir matching prefix
        produced_files = [
            f for f in os.listdir(temp_dir) 
            if f.startswith(unique_prefix)
        ]

        if not produced_files:
            raise FileNotFoundError("Processing failed: Output file not created.")

        actual_file_path = os.path.join(temp_dir, produced_files[0])
        return actual_file_path, final_filename
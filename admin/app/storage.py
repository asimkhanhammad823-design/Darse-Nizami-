import io
import time
import uuid

import boto3
from mutagen import File as MutagenFile

from .config import B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT, B2_KEY_ID, B2_REGION

ALLOWED_EXTENSIONS = {"mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"}

CONTENT_TYPES = {
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "ogg": "audio/ogg",
    "opus": "audio/opus",
    "wav": "audio/wav",
    "flac": "audio/flac",
}


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{B2_ENDPOINT}",
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APPLICATION_KEY,
        region_name=B2_REGION,
    )


def extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def upload_audio(file_bytes: bytes, original_filename: str) -> tuple[str, int | None]:
    """Uploads audio bytes to the private B2 bucket and returns (audio_key, duration_seconds)."""
    extension = extension_of(original_filename) or "mp3"
    audio_key = f"audio/lec_{int(time.time())}_{uuid.uuid4().hex[:8]}.{extension}"

    _client().put_object(
        Bucket=B2_BUCKET,
        Key=audio_key,
        Body=file_bytes,
        ContentType=CONTENT_TYPES.get(extension, "application/octet-stream"),
    )

    duration_seconds = None
    try:
        parsed = MutagenFile(io.BytesIO(file_bytes))
        if parsed is not None and parsed.info is not None:
            duration_seconds = int(parsed.info.length)
    except Exception:
        duration_seconds = None

    return audio_key, duration_seconds


def delete_audio(audio_key: str) -> None:
    """Best-effort removal of an uploaded object (used when the DB insert fails)."""
    try:
        _client().delete_object(Bucket=B2_BUCKET, Key=audio_key)
    except Exception:
        pass

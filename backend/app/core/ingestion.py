import os
import tempfile
import tiktoken
from pypdf import PdfReader
from pypdf.errors import PdfReadError
import docx
from loguru import logger
from typing import IO
import json
from rank_bm25 import BM25Okapi

enc = tiktoken.get_encoding("cl100k_base")

CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
DEFAULT_PROJECT_ID = "default"

VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",       # .mov
    "video/x-msvideo",       # .avi
    "video/x-matroska",      # .mkv
    "audio/mpeg",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
}

# All text-like MIME types we read directly
_TEXT_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "text/html",
    "text/csv",
    "text/tab-separated-values",
    "text/x-python",
    "text/x-ruby",
    "text/x-java",
    "text/x-c",
}

# Extension → canonical MIME for when browsers send application/octet-stream
_EXT_MIME: dict[str, str] = {
    ".md":       "text/markdown",
    ".markdown": "text/markdown",
    ".txt":      "text/plain",
    ".csv":      "text/csv",
    ".tsv":      "text/tab-separated-values",
    ".py":       "text/x-python",
    ".rb":       "text/x-ruby",
    ".java":     "text/x-java",
    ".c":        "text/x-c",
    ".h":        "text/x-c",
    ".html":     "text/html",
    ".htm":      "text/html",
    ".pdf":      "application/pdf",
    ".docx":     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".mp4":      "video/mp4",
    ".webm":     "video/webm",
    ".mov":      "video/quicktime",
    ".avi":      "video/x-msvideo",
    ".mkv":      "video/x-matroska",
    ".mp3":      "audio/mpeg",
    ".wav":      "audio/wav",
    ".ogg":      "audio/ogg",
    ".m4a":      "audio/mp4",
}


def chunk_text(text: str) -> list[dict]:
    """
    Split text into overlapping token windows.
    Returns list of { text, token_count, chunk_index }.
    """
    tokens = enc.encode(text)
    if not tokens:
        return []

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append({
            "text": enc.decode(chunk_tokens),
            "token_count": len(chunk_tokens),
            "chunk_index": len(chunks),
        })
        if end >= len(tokens):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


def _resolve_mime(mime_type: str, filename: str) -> str:
    """Use file extension to resolve ambiguous or missing MIME types."""
    ambiguous = {"application/octet-stream", "application/unknown", ""}
    if not mime_type or mime_type in ambiguous:
        ext = os.path.splitext(filename)[1].lower()
        return _EXT_MIME.get(ext, mime_type)
    return mime_type


def _transcribe_audio_or_video(file_obj: IO[bytes]) -> str:
    """Transcribe audio/video using Faster-Whisper. Writes to a temp file since Whisper needs a path."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise ValueError(
            "Video/audio transcription requires 'faster-whisper' to be installed."
        ) from None

    with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
        tmp.write(file_obj.read())
        tmp_path = tmp.name

    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(tmp_path)
        return "\n".join(seg.text for seg in segments if seg.text).strip()
    finally:
        os.unlink(tmp_path)


def normalize_filename(filename: str) -> str:
    """
    Normalize a filename to a consistent display-friendly format.
    Strips extension (using the last dot only), lowercases, replaces _/- with space,
    collapses repeated spaces, and strips leading/trailing dots and spaces.
    """
    if not filename or not filename.strip():
        return ""
    base, _ = os.path.splitext(filename)
    name = base.lower().strip(".").strip()
    name = name.replace("_", " ").replace("-", " ")
    name = " ".join(name.split())
    return name


def extract_text(file_obj: IO[bytes], mime_type: str, filename: str = "") -> tuple[str, None] | tuple[None, str]:
    """
    Extract text from a file-like object.
    Returns (text, None) on success or (None, error_message) on failure.
    """
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except Exception:
            pass
    mime_type = _resolve_mime(mime_type or "", filename)

    try:
        if mime_type == "application/pdf":
            try:
                reader = PdfReader(file_obj, strict=False)
            except Exception as e:
                logger.exception("PdfReader init failed for {}", filename)
                return None, f"Invalid PDF file: {e}"

            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception:
                    return None, "Encrypted PDFs are not supported."

            pages = []
            for i, page in enumerate(reader.pages):
                try:
                    t = page.extract_text()
                    if t and t.strip():
                        pages.append(t)
                except Exception as page_err:
                    logger.warning(
                        "Skipping PDF page {} due to error: {}", i, page_err
                    )

            if not pages:
                return None, (
                    "No text could be extracted from this PDF. "
                    "It may be image-only or use an unsupported encoding."
                )

            text = "\n\n".join(pages)

        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            doc = docx.Document(file_obj)
            text = "\n\n".join(p.text for p in doc.paragraphs if p.text)

        elif mime_type in _TEXT_MIME_TYPES:
            raw = file_obj.read()
            text = raw.decode("utf-8", errors="replace")

        elif mime_type in VIDEO_MIME_TYPES:
            text = _transcribe_audio_or_video(file_obj)

        else:
            return None, f"Unsupported file type: {mime_type!r} (filename: {filename!r})"

        return text, None

    except ValueError as e:
        return None, str(e)
    except Exception as e:
        logger.exception("Unexpected error extracting text from {}", filename)
        return None, f"Failed to read file: {e}"
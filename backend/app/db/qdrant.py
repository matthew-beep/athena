"""
Thin async Qdrant client using httpx.
Uses the Qdrant REST API — no extra dependency beyond httpx.
"""
import httpx
from loguru import logger
from app.config import get_settings

COLLECTION = "athena_knowledge"
# nomic-embed-text produces 768-dimensional vectors (spec says 384, actual is 768)
VECTOR_SIZE = 768


async def ensure_collection() -> None:
    """Create the athena_knowledge collection if it doesn't already exist."""
    settings = get_settings()
    base = settings.qdrant_base_url

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{base}/collections/{COLLECTION}")
        if resp.status_code == 200:
            logger.debug("Qdrant collection '{}' already exists", COLLECTION)
            return

        resp = await client.put(
            f"{base}/collections/{COLLECTION}",
            json={
                "vectors": {
                    "size": VECTOR_SIZE,
                    "distance": "Cosine",
                }
            },
        )
        resp.raise_for_status()
        logger.info("Created Qdrant collection '{}'", COLLECTION)


async def upsert_points(points: list[dict]) -> None:
    """
    Upsert vector points into the collection.

    Each point: { "id": int|str, "vector": list[float], "payload": dict }
    """
    if not points:
        return

    settings = get_settings()
    base = settings.qdrant_base_url

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.put(
            f"{base}/collections/{COLLECTION}/points",
            json={"points": points},
        )
        resp.raise_for_status()
        logger.debug("Upserted {} points into Qdrant", len(points))


async def delete_by_document_id(document_id: str) -> None:
    """Delete all Qdrant points whose payload.document_id matches."""
    settings = get_settings()
    base = settings.qdrant_base_url

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{base}/collections/{COLLECTION}/points/delete",
            json={
                "filter": {
                    "must": [{"key": "document_id", "match": {"value": document_id}}]
                }
            },
        )
        resp.raise_for_status()
        logger.info("Deleted Qdrant points for document {}", document_id)


async def search(vector: list[float], top_k: int = 6, filters: dict | None = None) -> list[dict]:
    """
    Search for the top_k nearest neighbours to the given vector.
    Returns list of { score, payload } dicts.
    """
    settings = get_settings()
    base = settings.qdrant_base_url

    body: dict = {"vector": vector, "limit": top_k, "with_payload": True}
    if filters:
        body["filter"] = filters

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{base}/collections/{COLLECTION}/points/search",
            json=body,
        )
        resp.raise_for_status()
        return resp.json().get("result", [])

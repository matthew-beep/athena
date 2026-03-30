import httpx
from fastapi import HTTPException
from loguru import logger
from app.config import get_settings
from app.models.url import FetchResult

async def fetch_url(url: str) -> FetchResult:
    settings = get_settings()
    crawl4ai_base_url = f"http://{settings.crawl4ai_host}:{settings.crawl4ai_port}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{crawl4ai_base_url}/crawl",
                json={
                    "urls": [url],
                    "crawler_config": {
                        "content_filter": {
                            "type": "PruningContentFilter"
                        }
                    }
                },
            )
            resp.raise_for_status()
        
        data = resp.json()
        
        if not data.get("results"):                                                                                                                               
            logger.warning("Crawl4AI returned no results for {}", url)
            raise HTTPException(status_code=502, detail="Crawl returned no results") 
        

        if not data["results"][0]["markdown"]["fit_markdown"]:
            res = data["results"][0]["markdown"]["raw_markdown"]
        else:
            res = data["results"][0]["markdown"]["fit_markdown"]

        return FetchResult(
            url=url,
            markdown=res,
            title=data["results"][0]["metadata"]["title"],
            word_count=len(res.split()),
        )

    except httpx.HTTPStatusError as e:
        logger.warning("Crawl4AI HTTP error for {}: {}", url, e.response.status_code)
        raise HTTPException(status_code=502, detail=f"Crawl failed: {e.response.status_code}")
    except httpx.RequestError as e:
        logger.warning("Crawl4AI network error for {}: {}", url, e)
        raise HTTPException(status_code=502, detail="Crawl4AI unreachable")
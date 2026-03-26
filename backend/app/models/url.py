from pydantic import BaseModel

class FetchResult:
    url: str
    markdown: str
    title: str
    word_count: int
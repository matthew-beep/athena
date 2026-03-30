from dataclasses import dataclass

@dataclass
class FetchResult:
    url: str
    markdown: str
    title: str
    word_count: int
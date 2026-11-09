from .trains import router as trains_router
from .stations import router as stations_router
from .search import router as search_router
from .assistant import router as assistant_router

__all__ = ["trains_router", "stations_router", "search_router", "assistant_router"]

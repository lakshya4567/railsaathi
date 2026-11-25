from .trains import router as trains_router
from .stations import router as stations_router
from .search import router as search_router
from .assistant import router as assistant_router
from .demo import router as demo_router
from .pnr import router as pnr_router
from .account import router as account_router

__all__ = ["trains_router", "stations_router", "search_router", "assistant_router", "demo_router", "pnr_router", "account_router"]

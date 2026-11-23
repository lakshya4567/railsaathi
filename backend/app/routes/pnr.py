"""Live PNR status lookup through the irctc.dev API."""
import re

import httpx
from fastapi import APIRouter, HTTPException

from ..config import settings

router = APIRouter(prefix="/api/pnr", tags=["pnr"])
PROVIDER_URL = "https://api.irctc.dev/api/v1/pnr/{pnr}"


@router.get("/{pnr}")
async def get_pnr_status(pnr: str):
    """Fetch a PNR status without persisting the PNR or provider response."""
    if not re.fullmatch(r"\d{10}", pnr):
        raise HTTPException(status_code=422, detail="PNR must contain exactly 10 digits.")

    if not settings.irctc_dev_api_key:
        raise HTTPException(status_code=503, detail="PNR lookup is not configured yet. Please try again later.")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as client:
            response = await client.get(
                PROVIDER_URL.format(pnr=pnr),
                headers={"x-api-key": settings.irctc_dev_api_key, "accept": "application/json"},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="PNR service took too long to respond.")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the PNR service.")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="No PNR record was found.")
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="PNR service rate limit reached. Please try again later.")
    if response.status_code in (401, 403):
        raise HTTPException(status_code=502, detail="PNR service authentication failed. Please contact support.")
    if response.status_code >= 500 or not response.is_success:
        raise HTTPException(status_code=502, detail="PNR service is temporarily unavailable.")

    try:
        return response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="PNR service returned an unreadable response.")

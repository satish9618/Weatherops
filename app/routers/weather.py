
import httpx

from fastapi import APIRouter, HTTPException, Query

from app.services.weather_service import get_weather

router = APIRouter(prefix="/api/v1", tags=["Weather"])


@router.get("/weather")
async def weather(
    city: str | None = Query(default=None, min_length=1, max_length=100),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
):
    # Require either a city OR a complete coordinate pair
    if city and (latitude is not None or longitude is not None):
        raise HTTPException(
            status_code=400,
            detail="Provide a city or coordinates, not both",
        )

    if not city and (latitude is None or longitude is None):
        raise HTTPException(
            status_code=400,
            detail="Provide city or both latitude and longitude",
        )

    if city and not city.strip():
        raise HTTPException(
            status_code=400,
            detail="City name cannot be empty",
        )

    try:
        return await get_weather(
            city=city.strip() if city else None,
            latitude=latitude,
            longitude=longitude,
        )

    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="Weather provider timed out",
        ) from exc

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail="Weather provider returned an error",
        ) from exc

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to weather provider",
        ) from exc

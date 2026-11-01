
import httpx

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"


async def get_weather(
    city: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:

    timeout = httpx.Timeout(10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:

        if city:
            # Resolve city to coordinates
            response = await client.get(
                GEOCODING_URL,
                params={
                    "name": city,
                    "count": 1,
                    "language": "en",
                },
            )
            response.raise_for_status()

            locations = response.json().get("results", [])

            if not locations:
                raise ValueError("City not found")

            location = locations[0]
            latitude = location["latitude"]
            longitude = location["longitude"]
            city_name = location["name"]
            country = location.get("country", "")

        else:
            # Coordinates supplied by the browser
            if latitude is None or longitude is None:
                raise ValueError(
                    "Provide a city or both latitude and longitude"
                )

            city_name = "Current location"
            country = ""

        # Fetch weather for either city or coordinates
        response = await client.get(
            WEATHER_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,"
                    "relative_humidity_2m,"
                    "apparent_temperature,"
                    "precipitation,"
                    "weather_code,"
                    "wind_speed_10m"
                ),
                "timezone": "auto",
            },
        )
        response.raise_for_status()

        data = response.json()
        current = data.get("current", {})

        return {
            "city": city_name,
            "country": country,
            "latitude": data.get("latitude", latitude),
            "longitude": data.get("longitude", longitude),
            "temperature_c": current.get("temperature_2m"),
            "feels_like_c": current.get("apparent_temperature"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "precipitation_mm": current.get("precipitation"),
            "weather_code": current.get("weather_code"),
            "observed_at": current.get("time"),
            "source": "Open-Meteo",
        }

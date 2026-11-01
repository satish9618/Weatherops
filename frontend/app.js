
const API_BASE = "/api/v1";

const elements = {
    form: document.getElementById("search-form"),
    input: document.getElementById("city-input"),
    searchButton: document.getElementById("search-button"),
    locationButton: document.getElementById("location-button"),
    message: document.getElementById("message"),
    panel: document.getElementById("weather-panel"),
};

// Map initialization
const weatherMap = L.map("weather-map", {
    zoomControl: true,
    scrollWheelZoom: true,
}).setView([20.5937, 78.9629], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(weatherMap);

let selectedMarker = null;
let latestRequestId = 0;

function showMessage(message, isError = false) {
    elements.message.textContent = message;
    elements.message.classList.toggle("error", isError);
}

function getCondition(code) {
    if (code === 0) return { text: "Clear sky", icon: "☀️" };
    if (code === 1) return { text: "Mainly clear", icon: "🌤️" };
    if (code === 2) return { text: "Partly cloudy", icon: "⛅" };
    if (code === 3) return { text: "Overcast", icon: "☁️" };

    if ([45, 48].includes(code)) {
        return { text: "Foggy", icon: "🌫️" };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        return { text: "Drizzle", icon: "🌦️" };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { text: "Rain", icon: "🌧️" };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return { text: "Snow", icon: "❄️" };
    }

    if ([95, 96, 99].includes(code)) {
        return { text: "Thunderstorm", icon: "⛈️" };
    }

    return { text: "Weather conditions", icon: "🌡️" };
}

function formatNumber(value, digits = 0) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value))
    ) {
        return "--";
    }

    return Number(value).toFixed(digits);
}

function placeWeatherMarker(latitude, longitude) {
    const position = [latitude, longitude];

    if (selectedMarker) {
        selectedMarker.setLatLng(position);
    } else {
        selectedMarker = L.marker(position).addTo(weatherMap);
    }

    selectedMarker
        .bindPopup("Loading weather…")
        .openPopup();
}

function updateMarkerPopup(data, label) {
    if (!selectedMarker) return;

    const condition = getCondition(data.weather_code);
    const popupContent = document.createElement("div");
    const title = document.createElement("strong");
    const details = document.createElement("div");

    title.textContent = label;
    details.textContent =
        `${condition.text} · ${formatNumber(data.temperature_c, 1)} °C`;

    popupContent.append(title, details);

    selectedMarker
        .bindPopup(popupContent)
        .openPopup();
}

function renderWeather(data, locationLabel = null) {
    const condition = getCondition(data.weather_code);

    document.getElementById("city-name").textContent =
        locationLabel ||
        [data.city, data.country].filter(Boolean).join(", ") ||
        "Selected location";

    document.getElementById("coordinates").textContent =
        `${formatNumber(data.latitude, 4)}, ${formatNumber(data.longitude, 4)}`;

    document.getElementById("temperature").textContent =
        formatNumber(data.temperature_c, 1);

    document.getElementById("feels-like").textContent =
        formatNumber(data.feels_like_c, 1);

    document.getElementById("humidity").textContent =
        `${formatNumber(data.humidity_percent)}%`;

    document.getElementById("wind").textContent =
        formatNumber(data.wind_speed_kmh, 1);

    document.getElementById("precipitation").textContent =
        formatNumber(data.precipitation_mm, 1);

    document.getElementById("condition-text").textContent = condition.text;
    document.getElementById("weather-symbol").textContent = condition.icon;
    document.getElementById("provider").textContent = data.source || "Unknown";
    document.getElementById("updated-at").textContent =
        data.observed_at || "Unavailable";

    elements.panel.classList.remove("hidden");
}

async function loadWeather(params, locationLabel = null) {
    const requestId = ++latestRequestId;

    elements.searchButton.disabled = true;
    showMessage("Loading weather information…");

    try {
        const query = new URLSearchParams(params);
        const response = await fetch(`${API_BASE}/weather?${query}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to retrieve weather.");
        }

        // Ignore stale responses from earlier searches.
        if (requestId !== latestRequestId) return;

        renderWeather(data, locationLabel);
        showMessage("Weather loaded successfully.");

        if (locationLabel) {
            updateMarkerPopup(data, locationLabel);
        }
    } catch (error) {
        if (requestId !== latestRequestId) return;

        showMessage(
            `${error.message} Check that the backend is running and your internet connection works.`,
            true
        );
    } finally {
        if (requestId === latestRequestId) {
            elements.searchButton.disabled = false;
        }
    }
}

// City search
elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const city = elements.input.value.trim();

    if (!city) {
        showMessage("Enter a city name to search.", true);
        elements.input.focus();
        return;
    }

    const requestId = ++latestRequestId;

    elements.searchButton.disabled = true;
    showMessage(`Searching weather for ${city}…`);

    try {
        const query = new URLSearchParams({ city });
        const response = await fetch(`${API_BASE}/weather?${query}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to retrieve weather.");
        }

        if (requestId !== latestRequestId) return;

        renderWeather(data);

        weatherMap.setView([data.latitude, data.longitude], 10);
        placeWeatherMarker(data.latitude, data.longitude);
        updateMarkerPopup(
            data,
            [data.city, data.country].filter(Boolean).join(", ")
        );

        showMessage("Weather loaded successfully.");
    } catch (error) {
        if (requestId === latestRequestId) {
            showMessage(error.message, true);
        }
    } finally {
        if (requestId === latestRequestId) {
            elements.searchButton.disabled = false;
        }
    }
});

// Current device location
function useCurrentLocation() {
    if (!navigator.geolocation) {
        showMessage(
            "Geolocation is not supported. Search for a city instead.",
            true
        );
        return;
    }

    // Invalidate any outstanding request while location is being resolved.
    ++latestRequestId;
    showMessage("Requesting location permission…");
    elements.locationButton.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            elements.locationButton.disabled = false;

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            weatherMap.setView([latitude, longitude], 10);
            placeWeatherMarker(latitude, longitude);

            loadWeather(
                {
                    latitude: String(latitude),
                    longitude: String(longitude),
                },
                "Current location"
            );
        },
        (error) => {
            elements.locationButton.disabled = false;

            let message = "Unable to determine your location.";

            if (error.code === error.PERMISSION_DENIED) {
                message =
                    "Location permission denied. Search for a city or select a point on the map.";
            } else if (error.code === error.TIMEOUT) {
                message = "Location request timed out. Please try again.";
            }

            showMessage(message, true);
        },
        {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
        }
    );
}

elements.locationButton.addEventListener("click", useCurrentLocation);

// Selecting any point on the map
weatherMap.on("click", (event) => {
    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;

    placeWeatherMarker(latitude, longitude);

    loadWeather(
        {
            latitude: String(latitude),
            longitude: String(longitude),
        },
        "Selected location"
    );
});

// Ensure the map fits correctly on initial render and after resizing.
function refreshMapLayout() {
    requestAnimationFrame(() => {
        weatherMap.invalidateSize({ pan: false });
    });
}

weatherMap.whenReady(refreshMapLayout);
window.addEventListener("resize", refreshMapLayout);
window.addEventListener("orientationchange", refreshMapLayout);

// Initial dashboard state: load Chennai as a useful default.
// The user can then search for another city or select their location.
loadWeather({ city: "Chennai" }).then(() => {
    // The city result will render when the request succeeds.
});

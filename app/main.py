
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.weather import router as weather_router

app = FastAPI(
    title="WeatherOps",
    description="Fault-Tolerant Cloud-Native Weather Platform",
    version="0.1.0"
)

# Development configuration.
# Restrict allowed origins before production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "Welcome to WeatherOps",
        "docs": "/docs",
        "weather_endpoint": "/api/v1/weather?city=Chennai"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "weatherops"
    }


app.include_router(weather_router)

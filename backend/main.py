from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator


def load_model_artifact() -> dict:
    """Load the saved recommendation model artifact without retraining."""
    project_root = Path(__file__).resolve().parents[1]
    model_path = project_root / "model" / "restaurant_model.pkl"

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at: {model_path}")

    return joblib.load(model_path)


class RecommendationRequest(BaseModel):
    """Input payload for restaurant recommendations."""
    cuisine: str | None = Field(default=None, description="Cuisine preference, optional")
    max_cost: float | int | None = Field(default=None, ge=0, description="Maximum budget")
    min_rating: float = Field(default=0.0, ge=0.0, le=5.0, description="Minimum rating")
    top_n: int = Field(default=5, ge=1, le=20, description="Number of restaurants to return")

    @field_validator("cuisine")
    @classmethod
    def validate_cuisine(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            return None
        return cleaned


app = FastAPI(title="Zomato Restaurant Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1",
        "http://localhost",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8001",
        "http://localhost:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def build_dashboard_data() -> dict:
    """Build dashboard analytics from the project's restaurant and review data."""
    project_root = Path(__file__).resolve().parents[1]
    restaurants = pd.read_csv(project_root / "data" / "restaurants.csv")
    reviews = pd.read_csv(project_root / "data" / "reviews.csv")

    restaurants["Cost"] = pd.to_numeric(
        restaurants["Cost"].astype(str).str.replace(r"[^0-9.]", "", regex=True),
        errors="coerce",
    ).fillna(0)
    reviews["Rating"] = pd.to_numeric(
        reviews["Rating"].astype(str).str.replace(r"[^0-9.]", "", regex=True),
        errors="coerce",
    )

    def normalize_name(value: object) -> str:
        return " ".join(str(value).replace("&", " and ").strip().lower().split())

    restaurants["name_key"] = restaurants["Name"].map(normalize_name)
    reviews["name_key"] = reviews["Restaurant"].map(normalize_name)
    review_summary = reviews.groupby("name_key").agg(
        average_rating=("Rating", "mean"),
        review_count=("Rating", "count"),
    )
    restaurants = restaurants.join(review_summary, on="name_key")
    restaurants["average_rating"] = restaurants["average_rating"].fillna(0)
    restaurants["review_count"] = restaurants["review_count"].fillna(0).astype(int)

    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    features = StandardScaler().fit_transform(restaurants[["Cost", "average_rating"]])
    restaurants["cluster"] = KMeans(n_clusters=4, random_state=42, n_init=10).fit_predict(features) + 1

    valid_ratings = reviews["Rating"].dropna()
    sentiment = {
        "positive": int((valid_ratings >= 4).sum()),
        "neutral": int(((valid_ratings >= 3) & (valid_ratings < 4)).sum()),
        "negative": int((valid_ratings < 3).sum()),
    }
    sentiment_total = sum(sentiment.values()) or 1

    cuisine_counts: dict[str, int] = {}
    for cuisines in restaurants["Cuisines"].fillna(""):
        for cuisine in str(cuisines).split(","):
            cuisine = cuisine.strip()
            if cuisine:
                cuisine_counts[cuisine] = cuisine_counts.get(cuisine, 0) + 1

    cluster_summary = (
        restaurants.groupby("cluster")
        .agg(count=("Name", "count"), average_cost=("Cost", "mean"), average_rating=("average_rating", "mean"))
        .reset_index()
        .to_dict(orient="records")
    )
    restaurant_rows = restaurants.fillna("").to_dict(orient="records")

    return {
        "summary": {
            "restaurant_count": int(restaurants["Name"].nunique()),
            "review_count": int(len(reviews)),
            "average_rating": round(float(valid_ratings.mean()), 2),
            "average_cost": round(float(restaurants["Cost"].mean()), 2),
            "positive_pct": round(sentiment["positive"] / sentiment_total * 100, 1),
        },
        "sentiment": [
            {"label": label, "count": count, "percent": round(count / sentiment_total * 100, 1)}
            for label, count in sentiment.items()
        ],
        "rating_distribution": [
            {"rating": rating, "count": int((valid_ratings.round().clip(1, 5) == rating).sum())}
            for rating in range(1, 6)
        ],
        "popular_cuisines": [
            {"name": name, "count": count}
            for name, count in sorted(cuisine_counts.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
        "clusters": cluster_summary,
        "restaurants": restaurant_rows,
    }


@app.get("/api")
def root() -> dict:
    """Return a simple welcome message."""
    return {"message": "Zomato Restaurant Recommendation API"}

@app.get("/healthz")
def health_check() -> dict:
    """Provide a lightweight health check for the hosting platform."""
    return {"status": "ok"}


@app.get("/dashboard")
def dashboard() -> dict:
    """Return cached analytics for the local restaurant dashboard."""
    return build_dashboard_data()


@app.post("/recommend")
def recommend(request: RecommendationRequest) -> dict:
    """Return restaurant recommendations based on cuisine, cost, rating, and content similarity."""
    try:
        model_artifact = load_model_artifact()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    import importlib.util
    import sys
    from pathlib import Path

    train_path = Path(__file__).resolve().parents[1] / "model" / "train_model.py"

    if not train_path.exists():
        raise HTTPException(status_code=500, detail="Training script not found.")

    spec = importlib.util.spec_from_file_location("restaurant_recommender_training", train_path)
    if spec is None or spec.loader is None:
        raise HTTPException(status_code=500, detail="Could not load training module.")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    recommendations = module.recommend_restaurants(
        cuisine=request.cuisine,
        max_cost=request.max_cost,
        min_rating=request.min_rating,
        top_n=request.top_n,
        model=model_artifact,
    )

    if not recommendations:
        return {"recommendations": []}

    return {"recommendations": recommendations}


frontend_path = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

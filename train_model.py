"""Train and save a content-based Zomato restaurant recommendation model.

This script performs the full data preparation and recommendation pipeline:
- loads the restaurant and review CSV files
- cleans the data safely
- normalizes restaurant names for matching
- calculates average rating and review count per restaurant
- creates a restaurant profile using Cuisines + Collections
- uses TF-IDF and cosine similarity for content-based matching
- combines content similarity with rating, review count, and budget suitability
- saves the required model artifact to model/restaurant_model.pkl

The script is intentionally beginner-friendly and does not create fake results.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def normalize_restaurant_name(name: object) -> str:
    """Return a cleaned restaurant name for matching across datasets."""
    if pd.isna(name):
        return ""

    cleaned = str(name).strip()
    cleaned = cleaned.replace("&", " and ")
    cleaned = " ".join(cleaned.split())
    return cleaned.lower()


def clean_restaurant_data(restaurant_df: pd.DataFrame) -> pd.DataFrame:
    """Clean the restaurant metadata dataset."""
    cleaned_df = restaurant_df.copy()

    for column in ["Name", "Links", "Cost", "Collections", "Cuisines", "Timings"]:
        if column in cleaned_df.columns:
            cleaned_df[column] = cleaned_df[column].fillna("").astype(str).str.strip()

    if "Cost" in cleaned_df.columns:
        cleaned_df["Cost"] = cleaned_df["Cost"].astype(str)
        cleaned_df["Cost"] = cleaned_df["Cost"].str.replace(r"[^0-9.]", "", regex=True)
        cleaned_df["Cost"] = pd.to_numeric(cleaned_df["Cost"], errors="coerce").fillna(0)

    if "Name" in cleaned_df.columns:
        cleaned_df["name_key"] = cleaned_df["Name"].apply(normalize_restaurant_name)
        cleaned_df["Name"] = cleaned_df["Name"].str.replace(r"\s+", " ", regex=True)

    cleaned_df = cleaned_df.drop_duplicates(subset=["name_key"], keep="first").reset_index(drop=True)
    return cleaned_df


def clean_review_data(review_df: pd.DataFrame) -> pd.DataFrame:
    """Clean the review dataset before aggregation."""
    cleaned_df = review_df.copy()

    for column in ["Restaurant", "Reviewer", "Review", "Metadata", "Time"]:
        if column in cleaned_df.columns:
            cleaned_df[column] = cleaned_df[column].fillna("").astype(str).str.strip()

    if "Restaurant" in cleaned_df.columns:
        cleaned_df["Restaurant_key"] = cleaned_df["Restaurant"].apply(normalize_restaurant_name)
        cleaned_df["Restaurant"] = cleaned_df["Restaurant"].str.replace(r"\s+", " ", regex=True)

    if "Rating" in cleaned_df.columns:
        cleaned_df["Rating"] = cleaned_df["Rating"].astype(str)
        cleaned_df["Rating"] = cleaned_df["Rating"].str.replace(r"[^0-9.]", "", regex=True)
        cleaned_df["Rating"] = pd.to_numeric(cleaned_df["Rating"], errors="coerce")

        median_rating = cleaned_df["Rating"].median()
        if pd.isna(median_rating):
            median_rating = 0.0
        cleaned_df["Rating"] = cleaned_df["Rating"].fillna(median_rating)

    if "Review" in cleaned_df.columns:
        cleaned_df["Review"] = cleaned_df["Review"].fillna("").astype(str).str.strip()

    cleaned_df = cleaned_df[cleaned_df["Restaurant_key"].astype(str).str.strip() != ""].copy()
    return cleaned_df


def print_dataset_summary(label: str, dataframe: pd.DataFrame) -> None:
    """Print a simple summary of the dataset for verification."""
    print(f"\n=== {label} ===")
    print(f"Shape: {dataframe.shape}")
    print(f"Columns: {list(dataframe.columns)}")
    print("Missing values:")
    print(dataframe.isna().sum())
    print("Data types:")
    print(dataframe.dtypes)
    print("Sample records:")
    print(dataframe.head(3).to_string(index=False))


def build_restaurant_profiles(restaurant_df: pd.DataFrame) -> pd.DataFrame:
    """Create a combined text profile from Cuisines + Collections."""
    prepared = restaurant_df.copy()
    prepared["profile"] = (
        prepared["Cuisines"].fillna("").astype(str).str.strip()
        + " "
        + prepared["Collections"].fillna("").astype(str).str.strip()
    )
    prepared["profile"] = prepared["profile"].str.replace(r"\s+", " ", regex=True).str.strip()
    return prepared


def build_model_artifact(restaurant_df: pd.DataFrame, review_df: pd.DataFrame) -> dict:
    """Prepare the restaurant dataset and TF-IDF model artifact."""
    cleaned_restaurants = clean_restaurant_data(restaurant_df)
    cleaned_reviews = clean_review_data(review_df)

    review_summary = (
        cleaned_reviews.groupby("Restaurant_key", as_index=False)
        .agg(
            average_rating=("Rating", "mean"),
            review_count=("Rating", "size"),
        )
        .rename(columns={"Restaurant_key": "name_key"})
    )

    review_summary["average_rating"] = review_summary["average_rating"].fillna(0.0)
    review_summary["review_count"] = review_summary["review_count"].fillna(0).astype(int)

    restaurant_with_reviews = cleaned_restaurants.merge(
        review_summary,
        on="name_key",
        how="left",
    )

    restaurant_with_reviews["average_rating"] = restaurant_with_reviews["average_rating"].fillna(0.0)
    restaurant_with_reviews["review_count"] = restaurant_with_reviews["review_count"].fillna(0).astype(int)

    restaurant_profiles = build_restaurant_profiles(restaurant_with_reviews)

    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    tfidf_matrix = vectorizer.fit_transform(restaurant_profiles["profile"].fillna(""))
    similarity_matrix = cosine_similarity(tfidf_matrix)

    model_artifact = {
        "restaurant_df": restaurant_profiles,
        "vectorizer": vectorizer,
        "tfidf_matrix": tfidf_matrix,
        "similarity_matrix": similarity_matrix,
        "config": {
            "content_weight": 0.50,
            "rating_weight": 0.30,
            "review_weight": 0.10,
            "budget_weight": 0.10,
            "min_rating": 0,
            "max_cost": None,
            "top_n": 5,
        },
    }

    return model_artifact


def recommend_restaurants(cuisine=None, max_cost=None, min_rating=0, top_n=5, model=None):
    """Recommend restaurants using content similarity, ratings, review count, and cost."""
    if model is None:
        model_path = Path(__file__).resolve().parent / "restaurant_model.pkl"
        model = joblib.load(model_path)

    restaurant_df = model["restaurant_df"].copy()

    if cuisine is not None and str(cuisine).strip():
        cuisine_filter = str(cuisine).strip().lower()
        restaurant_df = restaurant_df[
            restaurant_df["Cuisines"].fillna("").astype(str).str.lower().str.contains(cuisine_filter, na=False)
        ].copy()

    if max_cost is not None:
        max_cost = float(max_cost)
        restaurant_df = restaurant_df[restaurant_df["Cost"] <= max_cost].copy()

    if min_rating is not None:
        min_rating = float(min_rating)
        restaurant_df = restaurant_df[restaurant_df["average_rating"] >= min_rating].copy()

    if restaurant_df.empty:
        return []

    if cuisine is not None and str(cuisine).strip():
        query_text = str(cuisine).strip()
        query_vector = model["vectorizer"].transform([query_text])
        restaurant_indices = restaurant_df.index.to_list()
        similarity_scores = cosine_similarity(query_vector, model["tfidf_matrix"][restaurant_indices]).ravel()
        restaurant_df["content_similarity"] = similarity_scores
    else:
        restaurant_df["content_similarity"] = 1.0

    rating_min = restaurant_df["average_rating"].min()
    rating_max = max(restaurant_df["average_rating"].max(), 1.0)

    if rating_max > rating_min:
        restaurant_df["normalized_rating"] = (
            (restaurant_df["average_rating"] - rating_min) / (rating_max - rating_min)
        )
    else:
        restaurant_df["normalized_rating"] = 1.0

    review_max = max(restaurant_df["review_count"].max(), 1)
    restaurant_df["normalized_review_count"] = restaurant_df["review_count"] / review_max

    if max_cost is not None and max_cost > 0:
        restaurant_df["budget_score"] = 1 - (restaurant_df["Cost"] / max_cost).clip(lower=0, upper=1)
    else:
        restaurant_df["budget_score"] = 1.0

    restaurant_df["recommendation_score"] = (
        0.50 * restaurant_df["content_similarity"]
        + 0.30 * restaurant_df["normalized_rating"]
        + 0.10 * restaurant_df["normalized_review_count"]
        + 0.10 * restaurant_df["budget_score"]
    )

    ranked_restaurants = restaurant_df.sort_values(
        by="recommendation_score",
        ascending=False,
    ).head(int(top_n)).reset_index(drop=True)

    result = []
    for _, row in ranked_restaurants.iterrows():
        result.append(
            {
                "Name": row["Name"],
                "Cost": int(row["Cost"]),
                "Cuisines": row["Cuisines"],
                "Collections": row["Collections"],
                "average_rating": round(float(row["average_rating"]), 2),
                "review_count": int(row["review_count"]),
                "Links": row["Links"],
                "content_similarity": round(float(row["content_similarity"]), 4),
                "normalized_rating": round(float(row["normalized_rating"]), 4),
                "normalized_review_count": round(float(row["normalized_review_count"]), 4),
                "budget_score": round(float(row["budget_score"]), 4),
                "recommendation_score": round(float(row["recommendation_score"]), 4),
            }
        )

    return result


def print_recommendation_results(test_name: str, cuisine, max_cost, min_rating, top_n) -> None:
    """Print a recommendation result set for a user test case."""
    print(f"\n=== {test_name} ===")
    results = recommend_restaurants(
        cuisine=cuisine,
        max_cost=max_cost,
        min_rating=min_rating,
        top_n=top_n,
    )

    if not results:
        print("No restaurants found matching the given preferences.")
        return

    for item in results:
        print(
            f"{item['Name']} | cost={item['Cost']} | cuisine={item['Cuisines']} | "
            f"rating={item['average_rating']} | reviews={item['review_count']} | "
            f"score={item['recommendation_score']}"
        )


def main() -> None:
    """Train the model and print example recommendation results."""
    project_root = Path(__file__).resolve().parents[1]
    restaurants_path = project_root / "data" / "restaurants.csv"
    reviews_path = project_root / "data" / "reviews.csv"
    model_path = Path(__file__).resolve().parent / "restaurant_model.pkl"

    restaurant_df = pd.read_csv(restaurants_path)
    review_df = pd.read_csv(reviews_path)

    print_dataset_summary("Raw Restaurants", restaurant_df)
    print_dataset_summary("Raw Reviews", review_df)

    model_artifact = build_model_artifact(restaurant_df, review_df)
    joblib.dump(model_artifact, model_path)

    print(f"\nModel artifact saved to: {model_path}")
    print("Model keys:", list(model_artifact.keys()))

    print_recommendation_results("Test 1: Biryani", "Biryani", 1000, 3, 5)
    print_recommendation_results("Test 2: North Indian", "North Indian", 1500, 4, 5)
    print_recommendation_results("Test 3: No cuisine filter", None, 2000, 3.5, 5)

    print("\nRecommendation model training complete.")


if __name__ == "__main__":
    main()

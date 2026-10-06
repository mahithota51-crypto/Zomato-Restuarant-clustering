# Zomato Restaurant Recommendation Application

## Project Title
Zomato Restaurant Recommendation Application using Python, TF-IDF, Cosine Similarity, FastAPI, and a simple frontend.

## Problem Statement
Restaurant discovery can be difficult when users want a place that matches their cuisine preference, budget, and minimum rating. This project builds a recommendation system using the real Zomato restaurant metadata and review data to help users find suitable restaurants quickly.

## Project Objective
The objective of this project is to build a beginner-friendly end-to-end recommendation system that:
- loads real restaurant and review data
- cleans and prepares the data
- creates restaurant profiles using cuisine and collection information
- uses TF-IDF and cosine similarity for content-based matching
- combines content similarity with rating, review count, and budget suitability
- exposes the recommendation logic through a FastAPI backend
- provides a simple frontend interface for users to search restaurants

## Dataset Description
This project uses the real CSV files available in the project:

- `data/restaurants.csv`
- `data/reviews.csv`

### Restaurant data
The restaurant dataset includes:
- Name
- Links
- Cost
- Collections
- Cuisines
- Timings

### Review data
The review dataset includes:
- Restaurant
- Reviewer
- Review
- Rating
- Metadata
- Time
- Pictures

These files are used as-is without creating fake records.

## Data Preprocessing
The preprocessing step includes:
- loading both CSV files with pandas
- handling missing values
- converting cost values to numeric values
- cleaning rating values
- normalizing restaurant names so matching across datasets is reliable
- removing duplicate restaurant entries where needed
- handling empty values safely so the model does not break on missing data

## Feature Engineering
Feature engineering is done at the restaurant level using the review dataset:
- `average_rating` = mean rating for each restaurant
- `review_count` = total number of reviews for each restaurant

These features are combined with the restaurant metadata to create a richer user recommendation profile.

## TF-IDF
The restaurant profile is built as a combined text field using:
- Cuisines
- Collections

Example profile:

`North Indian, Biryani, Great Buffets, Hyderabad's Hottest`

This text is converted into numerical vectors using `TfidfVectorizer` from scikit-learn.

## Cosine Similarity
After creating the TF-IDF vectors, cosine similarity is used to measure how similar restaurant profiles are to each other.

This is the main content-based recommendation signal in the system, because it compares restaurant descriptions and cuisine-based similarity instead of simply ranking purely by rating.

## Recommendation Algorithm
The recommendation system filters restaurants based on:
- cuisine (optional)
- maximum cost
- minimum rating
- number of results requested

Then it calculates a final recommendation score using a transparent weighted formula:

`final_score = 0.50 * similarity_score + 0.30 * normalized_rating + 0.10 * normalized_review_count + 0.10 * budget_score`

### Weighted components
- similarity_score: how similar the restaurant profile is to the selected cuisine/content profile
- normalized_rating: restaurant quality based on average rating
- normalized_review_count: how popular the restaurant is based on review volume
- budget_score: how suitable the restaurant price is for the selected max budget

This score is sorted in descending order and the top N recommendations are returned.

## Recommendation Score
The recommendation score is not a scientific accuracy metric. It is a transparent ranking score designed to combine:
- content similarity
- average rating
- review volume
- budget fit

No accuracy percentage is claimed because the project does not implement a proper evaluation metric for recommendation quality.

## FastAPI Backend
The backend is created in `backend/main.py` and exposes:

### GET /api
Returns a welcome message:

```json
{
  "message": "Zomato Restaurant Recommendation API"
}
```

### POST /recommend
Accepts a JSON request like:

```json
{
  "cuisine": "Biryani",
  "max_cost": 1000,
  "min_rating": 3.5,
  "top_n": 5
}
```

Returns restaurant recommendations with fields such as:
- Name
- Cost
- Cuisines
- Collections
- average_rating
- review_count
- Links
- recommendation_score

## Frontend
The frontend is built with HTML, CSS, and JavaScript in the `frontend/` folder. The dashboard is split into individual pages with shared navigation:
- `overview.html` — restaurant summary and charts
- `explorer.html` — restaurant search and filters
- `clustering.html` — restaurant personas and cluster simulator
- `sentiment.html` — review sentiment analyzer
- `recommender.html` — personalized restaurant recommendations
- `hypothesis.html` — dataset comparisons
- `strategies.html` — strategic initiatives

`index.html` redirects to the Overview page. The API-backed pages load restaurant data from the local FastAPI service.

## Project Structure
```text
Zomato-ML-Application/
├── data/
│   ├── restaurants.csv
│   └── reviews.csv
├── model/
│   ├── train_model.py
│   └── restaurant_model.pkl
├── backend/
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── overview.html
│   ├── explorer.html
│   ├── clustering.html
│   ├── sentiment.html
│   ├── recommender.html
│   ├── hypothesis.html
│   ├── strategies.html
│   ├── layout.js
│   ├── style.css
│   └── script.js
├── requirements.txt
├── README.md
├── .gitignore
└── venv/
```

## Installation
Clone or open the project in VS Code, then create a virtual environment and install dependencies.

```powershell
cd "D:\Zomato ml application"
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If you do not have the required packages installed yet, use:

```powershell
python -m pip install pandas numpy scikit-learn joblib fastapi uvicorn pydantic
```

## How to Train the Model
From the project root:

```powershell
cd "D:\Zomato ml application"
.\venv\Scripts\Activate.ps1
python .\model\train_model.py
```

This script:
- loads the actual CSV files
- cleans the data
- computes review-based features
- builds the TF-IDF model
- saves the final artifact to `model/restaurant_model.pkl`

## How to Start the API
From the project root:

```powershell
cd "D:\Zomato ml application"
.\venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

The API will be available at:

```text
http://127.0.0.1:8000/
```

The API welcome response is available at `http://127.0.0.1:8000/api`.

## How to Use the Frontend
Serve the frontend locally:

```powershell
cd "D:\Zomato ml application\frontend"
python -m http.server 8001
```

Then open:

```text
http://127.0.0.1:8001/
```

Use the navigation to open Overview, Explorer, Clustering, Sentiment, Recommender, Evidence, or Strategies.

Enter values such as:
- Cuisine: `Biryani`
- Maximum Budget: `1000`
- Minimum Rating: `3.5`
- Number of Recommendations: `5`

Then click the button to get recommendations.

## Public deployment on Render

The included `render.yaml` configures a single Render web service that serves
both the frontend and API over the same public HTTPS address. The frontend
automatically uses the same origin for API requests when deployed.

1. Push this project to a GitHub repository. Include `data/`, `model/`, and
   `frontend/`; do not upload the local `venv/` folder.
2. Sign in to Render and choose **New + → Blueprint**.
3. Connect the GitHub repository and deploy the Blueprint. Render reads
   `render.yaml` and builds the service using `requirements-render.txt`.
4. When the service is live, open its `https://...onrender.com` URL and share
   that URL with users on any device.

The service exposes the dashboard data and recommendation API publicly. Do not
include private datasets or secrets in the deployed project. Render's free web
services may spin down when idle, so the first request after inactivity can be
slow.

## API Example
Request:

```json
{
  "cuisine": "Biryani",
  "max_cost": 1000,
  "min_rating": 3.5,
  "top_n": 5
}
```

Response:

```json
{
  "recommendations": [
    {
      "Name": "Paradise",
      "Cost": 800,
      "Cuisines": "Biryani, North Indian, Chinese",
      "Collections": "Hyderabad's Hottest",
      "average_rating": 4.7,
      "review_count": 100,
      "Links": "https://www.zomato.com/hyderabad/paradise-gachibowli",
      "recommendation_score": 0.5603
    }
  ]
}
```

## Technologies Used
- Python
- pandas
- NumPy
- scikit-learn
- joblib
- FastAPI
- Pydantic
- HTML
- CSS
- JavaScript

## Future Improvements
Possible improvements include:
- adding sentiment analysis from review text
- using more advanced metadata features
- applying user-based or hybrid recommendation methods
- adding filtering by location or collection
- adding search by restaurant name
- saving versioned models and metadata
- improving the recommendation scoring with user feedback

## Summary
This project is a beginner-friendly restaurant recommendation system that uses real Zomato data, TF-IDF, and cosine similarity to recommend restaurants based on cuisine, cost, rating, and review activity. It is designed to be simple, readable, and easy to run locally in VS Code.

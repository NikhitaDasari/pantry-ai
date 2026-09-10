# PantryAI

PantryAI is a deployable Flask product prototype for pantry management, meal planning, grocery coordination, and agent-style action workflows.

The current version focuses on validating the **application and interaction layer** before adding the production data and AI stack. It uses an in-memory store and deterministic recommendation logic, so it should be viewed as an **AI-ready workflow prototype**, not a production LLM application.

**Tech:** Python · Flask · JavaScript · Databricks Apps · REST-style APIs

---

## What is implemented

- Responsive pantry dashboard
- Pantry item add/remove workflows
- Expiration and “use soon” prioritization
- Grocery list add/remove/purchased actions
- Meal-plan creation and removal
- Recipe recommendations based on pantry coverage
- Missing-ingredient detection
- One-click addition of missing ingredients to the grocery list
- Agent-style propose/execute interaction pattern
- Flask JSON APIs for pantry, grocery, meal-plan, recommendation, and agent flows
- Health endpoint for deployment checks
- Databricks App configuration

---

## Application flow

```text
Pantry State
    |
    +--> Expiration Priority
    |
    +--> Recipe Matching
              |
              +--> Recommended Meal
              |
              +--> Missing Ingredients
                        |
                        +--> Grocery List
              |
              +--> Meal Plan

User Message
    |
    v
Agent-style Intent Router
    |
    +--> Recommend
    +--> Propose Action
    +--> Execute Approved Write
```

The current “agent” is intentionally deterministic. It recognizes a small set of intents, reads application state, recommends an action, and can execute approved writes such as adding grocery items or scheduling a meal.

---

## Core APIs

### Pantry

```http
GET    /api/pantry
POST   /api/pantry
DELETE /api/pantry/<item_id>
```

### Grocery list

```http
GET    /api/grocery
POST   /api/grocery
PATCH  /api/grocery/<item_id>
DELETE /api/grocery/<item_id>
```

### Meal plan

```http
GET    /api/meal-plan
POST   /api/meal-plan
DELETE /api/meal-plan/<item_id>
```

### Recommendations and actions

```http
GET  /api/recommendation
POST /api/recommendation/add-missing
POST /api/recommendation/plan
POST /api/agent
```

### Health

```http
GET /health
```

---

## Recommendation logic

The application scores recipes based on two signals:

1. **Pantry coverage** — how many required ingredients are already available
2. **Expiration priority** — a bonus for recipes that use ingredients approaching expiration

The highest-scoring recipe is returned with its pantry-match percentage and missing ingredients.

---

## Repository structure

```text
.
├── app.py
├── app.yaml
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── app.js
    └── style.css
```

---

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

The application runs on port `8000` by default.

For a production-style local process:

```bash
gunicorn --bind 0.0.0.0:8000 app:app
```

---

## Databricks Apps deployment

The included `app.yaml` launches PantryAI with Gunicorn and can be used to deploy the project as a Databricks App.

---

## Current limitation

Application state is stored in Python memory. Data resets when the process restarts.

The next engineering phase would replace the in-memory store with persistent operational tables and then add the data/AI architecture below.

---

## Planned production architecture

```text
USDA / Recipe API
        |
        v
Spark ingestion
        |
        v
Bronze raw data
        |
        v
Curated food + recipe data
        |
        +--------> Embeddings / Vector Retrieval
        |
        v
Lakebase operational state
        |
        v
LLM / Agent Tool Layer
        |
        v
Databricks App
```

Planned extensions include:

- Lakebase persistence for pantry, grocery, meal-plan, and recipe state
- External food/recipe API ingestion
- Spark-based Bronze/Silver data processing
- Recipe embeddings and semantic retrieval
- Real LLM/agent integration with controlled read/write tools

---

## Why this project exists

This prototype was built to validate the user workflow and action model before introducing the heavier data and AI infrastructure. It demonstrates how an application can separate **state, recommendation logic, proposed actions, and explicit execution**, which is the same interaction pattern needed when replacing deterministic logic with production agent tooling later.

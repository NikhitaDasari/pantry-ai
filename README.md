# PantryAI

PantryAI is a deployable Flask application for a Databricks AI Data Engineering capstone.

The current version is intentionally self-contained so you can deploy the UI immediately.
It uses in-memory Python lists as its data store. This lets you validate the complete product
flow before connecting Lakebase, Spark pipelines, third-party APIs, embeddings, and a real AI agent.

## What already works

- Responsive PantryAI dashboard
- Pantry item add/remove
- Expiration / "use soon" indicators
- Meal plan view
- Add recommended meal
- Grocery list add/remove
- Mark grocery items purchased
- Recipe recommendation logic based on pantry match
- Add missing recipe ingredients to grocery list
- Functional mock agent
- Agent reads pantry state
- Agent recommends meals
- Agent proposes actions
- Agent can execute writes against the demo data
- Health endpoint at `/health`

## Project structure

```text
pantry_ai_app/
├── app.py
├── app.yaml
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── app.js
    └── style.css
```

## Run locally

Create a virtual environment if desired, then:

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://localhost:8000
```

## Run using Gunicorn

```bash
gunicorn --bind 0.0.0.0:8000 app:app
```

## Databricks App

Upload the full folder into your Databricks workspace / app source and deploy it as a Databricks App.

The supplied `app.yaml` launches:

```text
gunicorn --bind 0.0.0.0:8000 app:app
```

## Important demo limitation

The current application stores data in memory. That means changes reset when the Python process restarts.

This is deliberate for the first deployable version.

The next implementation step should be replacing the in-memory data with Lakebase tables:

- pantry_items
- grocery_items
- meal_plan
- recipes
- recipe_ingredients

After that, add:

1. USDA FoodData Central API integration
2. Spark Bronze/Silver pipeline
3. Recipe dataset ingestion
4. Embeddings + Vector Search
5. Real Databricks AI agent tools

## Suggested capstone architecture

```text
USDA / Recipe API
        |
        v
Spark ingestion
        |
        v
Bronze raw JSON
        |
        v
Spark transformations
        |
        v
Silver food + recipe tables
        |
        +----------> Embeddings / Vector Search
        |
        v
Lakebase operational tables
        |
        v
PantryAI agent
   |           |
   | reads     | writes
   v           v
Pantry      Grocery / Meal Plan
        |
        v
Databricks App
```

## Example agent prompts

Try:

- `What can I make tonight?`
- `What will expire first?`
- `Plan dinner using whatever is going bad first`
- `What am I missing for dinner?`
- `Add the missing ingredients to my grocery list`

The current mock agent demonstrates the read + action pattern required by the capstone.

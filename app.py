from flask import Flask, render_template, request, jsonify
from datetime import datetime
import os

app = Flask(__name__)

# -------------------------------------------------------------------
# Demo in-memory data store
# This is intentionally simple so the app works immediately after deploy.
# Later, replace these lists with Lakebase / Delta tables.
# -------------------------------------------------------------------

pantry_items = [
    {"id": 1, "name": "Spinach", "quantity": "1 bag", "category": "Produce", "expiry_days": 2},
    {"id": 2, "name": "Paneer", "quantity": "1 pack", "category": "Dairy", "expiry_days": 6},
    {"id": 3, "name": "Tomatoes", "quantity": "5", "category": "Produce", "expiry_days": 5},
    {"id": 4, "name": "Basmati Rice", "quantity": "2 lb", "category": "Pantry", "expiry_days": None},
    {"id": 5, "name": "Eggs", "quantity": "8", "category": "Dairy", "expiry_days": 12},
    {"id": 6, "name": "Greek Yogurt", "quantity": "1 tub", "category": "Dairy", "expiry_days": 5},
    {"id": 7, "name": "Avocado", "quantity": "2", "category": "Produce", "expiry_days": 2},
]

grocery_items = [
    {"id": 1, "name": "Onions", "category": "Produce", "purchased": False},
    {"id": 2, "name": "Ginger", "category": "Produce", "purchased": False},
    {"id": 3, "name": "Tortillas", "category": "Pantry", "purchased": False},
]

meal_plan = [
    {"id": 1, "day": "Tonight", "meal": "Palak Paneer & Rice", "time_minutes": 25},
    {"id": 2, "day": "Monday", "meal": "Avocado Veggie Tacos", "time_minutes": 20},
    {"id": 3, "day": "Tuesday", "meal": "Tomato Egg Fried Rice", "time_minutes": 30},
]

recipe_catalog = [
    {
        "name": "Palak Paneer & Rice",
        "time_minutes": 25,
        "tags": ["Vegetarian", "Indian", "Comforting"],
        "ingredients": ["Spinach", "Paneer", "Tomatoes", "Basmati Rice", "Onions", "Ginger"],
        "uses_soon": ["Spinach"],
    },
    {
        "name": "Avocado Veggie Tacos",
        "time_minutes": 20,
        "tags": ["Vegetarian", "Quick", "Fresh"],
        "ingredients": ["Avocado", "Tomatoes", "Onions", "Tortillas", "Greek Yogurt"],
        "uses_soon": ["Avocado"],
    },
    {
        "name": "Tomato Egg Fried Rice",
        "time_minutes": 30,
        "tags": ["Quick", "High Protein"],
        "ingredients": ["Eggs", "Tomatoes", "Basmati Rice", "Onions"],
        "uses_soon": ["Tomatoes"],
    },
]

def next_id(items):
    return max([item["id"] for item in items], default=0) + 1

def use_soon_items():
    return [
        item for item in pantry_items
        if item.get("expiry_days") is not None and item["expiry_days"] <= 3
    ]

def pantry_names():
    return {item["name"].strip().lower() for item in pantry_items}

def recommend_recipe():
    names = pantry_names()
    best = None
    best_score = -1

    for recipe in recipe_catalog:
        total = len(recipe["ingredients"])
        have = sum(1 for x in recipe["ingredients"] if x.lower() in names)
        expiring_bonus = sum(
            1 for x in recipe.get("uses_soon", [])
            if x.lower() in {i["name"].lower() for i in use_soon_items()}
        )
        score = (have / total) + (0.15 * expiring_bonus)

        if score > best_score:
            best_score = score
            best = recipe

    if not best:
        return None

    missing = [x for x in best["ingredients"] if x.lower() not in names]
    match_percent = round(
        100 * (len(best["ingredients"]) - len(missing)) / len(best["ingredients"])
    )

    return {**best, "missing": missing, "match_percent": match_percent}


@app.route("/")
def home():
    recommendation = recommend_recipe()

    return render_template(
        "index.html",
        pantry_items=pantry_items,
        grocery_items=grocery_items,
        meal_plan=meal_plan,
        use_soon=use_soon_items(),
        recommendation=recommendation,
    )


# -------------------------------------------------------------------
# Pantry API
# -------------------------------------------------------------------

@app.get("/api/pantry")
def get_pantry():
    return jsonify(pantry_items)


@app.post("/api/pantry")
def add_pantry_item():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Item name is required"}), 400

    expiry = data.get("expiry_days")
    if expiry in ("", None):
        expiry = None
    else:
        try:
            expiry = int(expiry)
        except (TypeError, ValueError):
            return jsonify({"error": "expiry_days must be a number"}), 400

    item = {
        "id": next_id(pantry_items),
        "name": name,
        "quantity": str(data.get("quantity", "1")).strip() or "1",
        "category": str(data.get("category", "Other")).strip() or "Other",
        "expiry_days": expiry,
    }
    pantry_items.append(item)
    return jsonify(item), 201


@app.delete("/api/pantry/<int:item_id>")
def delete_pantry_item(item_id):
    idx = next((i for i, x in enumerate(pantry_items) if x["id"] == item_id), None)
    if idx is None:
        return jsonify({"error": "Pantry item not found"}), 404

    removed = pantry_items.pop(idx)
    return jsonify({"message": "Removed", "item": removed})


# -------------------------------------------------------------------
# Grocery API
# -------------------------------------------------------------------

@app.get("/api/grocery")
def get_grocery():
    return jsonify(grocery_items)


@app.post("/api/grocery")
def add_grocery():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()

    if not name:
        return jsonify({"error": "Item name is required"}), 400

    existing = next(
        (x for x in grocery_items if x["name"].strip().lower() == name.lower()),
        None
    )
    if existing:
        return jsonify(existing), 200

    item = {
        "id": next_id(grocery_items),
        "name": name,
        "category": str(data.get("category", "Other")).strip() or "Other",
        "purchased": False,
    }
    grocery_items.append(item)
    return jsonify(item), 201


@app.patch("/api/grocery/<int:item_id>")
def update_grocery(item_id):
    item = next((x for x in grocery_items if x["id"] == item_id), None)
    if not item:
        return jsonify({"error": "Grocery item not found"}), 404

    data = request.get_json(silent=True) or {}
    if "purchased" in data:
        item["purchased"] = bool(data["purchased"])

    return jsonify(item)


@app.delete("/api/grocery/<int:item_id>")
def delete_grocery(item_id):
    idx = next((i for i, x in enumerate(grocery_items) if x["id"] == item_id), None)
    if idx is None:
        return jsonify({"error": "Grocery item not found"}), 404

    removed = grocery_items.pop(idx)
    return jsonify({"message": "Removed", "item": removed})


# -------------------------------------------------------------------
# Meal plan API
# -------------------------------------------------------------------

@app.get("/api/meal-plan")
def get_meals():
    return jsonify(meal_plan)


@app.post("/api/meal-plan")
def add_meal():
    data = request.get_json(silent=True) or {}
    meal = str(data.get("meal", "")).strip()

    if not meal:
        return jsonify({"error": "Meal is required"}), 400

    item = {
        "id": next_id(meal_plan),
        "day": str(data.get("day", "Next meal")).strip() or "Next meal",
        "meal": meal,
        "time_minutes": int(data.get("time_minutes", 30) or 30),
    }
    meal_plan.append(item)
    return jsonify(item), 201


@app.delete("/api/meal-plan/<int:item_id>")
def delete_meal(item_id):
    idx = next((i for i, x in enumerate(meal_plan) if x["id"] == item_id), None)
    if idx is None:
        return jsonify({"error": "Meal not found"}), 404

    removed = meal_plan.pop(idx)
    return jsonify({"message": "Removed", "item": removed})


# -------------------------------------------------------------------
# Recommendation / agent demo API
# -------------------------------------------------------------------

@app.get("/api/recommendation")
def get_recommendation():
    rec = recommend_recipe()
    if not rec:
        return jsonify({"error": "No recipes available"}), 404
    return jsonify(rec)


@app.post("/api/recommendation/add-missing")
def add_missing():
    rec = recommend_recipe()
    if not rec:
        return jsonify({"error": "No recommendation found"}), 404

    added = []
    for name in rec["missing"]:
        existing = next(
            (x for x in grocery_items if x["name"].lower() == name.lower()),
            None
        )
        if not existing:
            item = {
                "id": next_id(grocery_items),
                "name": name,
                "category": "Suggested",
                "purchased": False,
            }
            grocery_items.append(item)
            added.append(item)

    return jsonify({"message": "Missing ingredients added", "added": added})


@app.post("/api/recommendation/plan")
def plan_recommendation():
    rec = recommend_recipe()
    if not rec:
        return jsonify({"error": "No recommendation found"}), 404

    existing = next(
        (x for x in meal_plan if x["meal"].lower() == rec["name"].lower()),
        None
    )
    if existing:
        return jsonify({"message": "Meal already exists", "meal": existing})

    meal = {
        "id": next_id(meal_plan),
        "day": "Tonight",
        "meal": rec["name"],
        "time_minutes": rec["time_minutes"],
    }
    meal_plan.append(meal)
    return jsonify({"message": "Meal added", "meal": meal}), 201


@app.post("/api/agent")
def agent():
    """
    Demo agent:
    - understands a few useful intents
    - searches pantry/recipe state
    - returns recommended real actions
    - can execute writes when action=execute is included

    Replace this with Databricks Model Serving / Agent Framework later.
    """
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    execute = bool(data.get("execute", False))

    if not message:
        return jsonify({"error": "Message is required"}), 400

    lower = message.lower()
    rec = recommend_recipe()

    if any(x in lower for x in ["expir", "use soon", "going bad", "spoil"]):
        soon = use_soon_items()
        names = ", ".join(x["name"] for x in soon) if soon else "nothing urgent"
        response = (
            f"Your highest-priority items are {names}. "
            f"I'd recommend {rec['name']} because it uses "
            f"{', '.join(rec.get('uses_soon', [])) or 'items you already have'}."
        )
        return jsonify({
            "message": response,
            "action": None,
            "recommendation": rec,
        })

    if any(x in lower for x in ["grocery", "shopping", "missing ingredient"]):
        if not rec:
            return jsonify({"message": "I could not find a recipe recommendation."})

        if execute:
            added = []
            for name in rec["missing"]:
                if not any(x["name"].lower() == name.lower() for x in grocery_items):
                    item = {
                        "id": next_id(grocery_items),
                        "name": name,
                        "category": "Suggested",
                        "purchased": False,
                    }
                    grocery_items.append(item)
                    added.append(name)

            return jsonify({
                "message": f"Done. I added {', '.join(added) if added else 'no new items'} to your grocery list.",
                "action": "grocery_updated",
                "recommendation": rec,
            })

        return jsonify({
            "message": (
                f"For {rec['name']}, you're missing "
                f"{', '.join(rec['missing']) if rec['missing'] else 'nothing'}. "
                "I can add the missing ingredients to your grocery list."
            ),
            "action": {
                "type": "add_missing_to_grocery",
                "label": "Add missing ingredients",
            },
            "recommendation": rec,
        })

    if any(x in lower for x in ["plan", "schedule", "tonight", "dinner", "cook", "make"]):
        if not rec:
            return jsonify({"message": "I could not find a recipe recommendation."})

        if execute:
            existing = next(
                (x for x in meal_plan if x["meal"].lower() == rec["name"].lower()),
                None
            )
            if not existing:
                existing = {
                    "id": next_id(meal_plan),
                    "day": "Tonight",
                    "meal": rec["name"],
                    "time_minutes": rec["time_minutes"],
                }
                meal_plan.append(existing)

            return jsonify({
                "message": f"Done. {rec['name']} is now on your meal plan for tonight.",
                "action": "meal_planned",
                "recommendation": rec,
            })

        expiring = ", ".join(rec.get("uses_soon", []))
        missing = ", ".join(rec["missing"]) if rec["missing"] else "nothing"
        response = (
            f"My top pick is {rec['name']} ({rec['time_minutes']} min, "
            f"{rec['match_percent']}% pantry match). "
            f"It helps use {expiring or 'ingredients you already have'} first. "
            f"You're missing {missing}."
        )
        return jsonify({
            "message": response,
            "action": {
                "type": "plan_meal",
                "label": "Plan this for tonight",
            },
            "recommendation": rec,
        })

    return jsonify({
        "message": (
            "I can help you choose meals from your pantry, prioritize ingredients "
            "that may expire soon, plan dinner, or add missing ingredients to your grocery list. "
            f"Right now, my top recommendation is {rec['name']}."
        ),
        "action": None,
        "recommendation": rec,
    })


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "PantryAI",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })


if __name__ == "__main__":
    # Databricks Apps commonly injects PORT. Local default is 8000.
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=False)

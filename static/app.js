const state = {
    pendingAgentAction: null,
    pendingAgentMessage: null,
};

const pageMeta = {
    overview: {
        title: "Good evening 👋",
        subtitle: "Here’s what your kitchen looks like today.",
    },
    pantry: {
        title: "My Pantry",
        subtitle: "Know what you have before you decide what to cook.",
    },
    meals: {
        title: "Meal Plan",
        subtitle: "Plan ahead without overthinking dinner.",
    },
    grocery: {
        title: "Grocery List",
        subtitle: "Shop only for what you actually need.",
    },
    assistant: {
        title: "Ask PantryAI",
        subtitle: "Your agent can search, recommend and take actions.",
    },
};

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2500);
}

function switchSection(sectionId) {
    document.querySelectorAll(".page").forEach((page) => {
        page.classList.toggle("active", page.id === sectionId);
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.section === sectionId);
    });

    const meta = pageMeta[sectionId];
    document.getElementById("page-title").textContent = meta.title;
    document.getElementById("page-subtitle").textContent = meta.subtitle;
}

document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
});

document.getElementById("topAskBtn").addEventListener("click", () => {
    switchSection("assistant");
    document.getElementById("agentInput").focus();
});

async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    let body = {};
    try {
        body = await response.json();
    } catch (_) {}

    if (!response.ok) {
        throw new Error(body.error || "Something went wrong");
    }

    return body;
}

async function refreshCounts() {
    const [pantry, meals] = await Promise.all([
        requestJSON("/api/pantry"),
        requestJSON("/api/meal-plan"),
    ]);

    document.getElementById("pantryCount").textContent = pantry.length;
    document.getElementById("mealCount").textContent = meals.length;

    const useSoon = pantry.filter(
        (x) => x.expiry_days !== null && x.expiry_days <= 3
    );
    document.getElementById("useSoonCount").textContent = useSoon.length;
}

function pantryEmoji(name) {
    const value = name.toLowerCase();
    if (value.includes("spinach")) return "🥬";
    if (value.includes("paneer") || value.includes("cheese")) return "🧀";
    if (value.includes("tomato")) return "🍅";
    if (value.includes("rice")) return "🍚";
    if (value.includes("egg")) return "🥚";
    if (value.includes("yogurt")) return "🥣";
    if (value.includes("avocado")) return "🥑";
    if (value.includes("milk")) return "🥛";
    if (value.includes("bread")) return "🍞";
    return "🥕";
}

function createPantryCard(item) {
    const article = document.createElement("article");
    article.className = "item-card";
    article.dataset.pantryId = item.id;

    const expiring =
        item.expiry_days !== null && item.expiry_days <= 3
            ? '<span class="danger-pill">Use soon</span>'
            : "";

    const expiry =
        item.expiry_days !== null
            ? `<div class="expiry-bar"><span>~${item.expiry_days} days remaining</span></div>`
            : "";

    article.innerHTML = `
        <div class="item-card-top">
            <div class="food-emoji large">${pantryEmoji(item.name)}</div>
            ${expiring}
        </div>
        <h3>${escapeHTML(item.name)}</h3>
        <p>${escapeHTML(item.quantity)}</p>
        <small>${escapeHTML(item.category)}</small>
        ${expiry}
        <button class="danger-text-btn delete-pantry-btn" data-id="${item.id}">Remove</button>
    `;

    article
        .querySelector(".delete-pantry-btn")
        .addEventListener("click", () => deletePantryItem(item.id));

    return article;
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.getElementById("openPantryFormBtn").addEventListener("click", () => {
    document.getElementById("pantryFormCard").classList.remove("hidden");
    document.getElementById("pantryName").focus();
});

document.getElementById("cancelPantryBtn").addEventListener("click", () => {
    document.getElementById("pantryFormCard").classList.add("hidden");
});

document.getElementById("savePantryBtn").addEventListener("click", async () => {
    const feedback = document.getElementById("pantryFeedback");

    try {
        const item = await requestJSON("/api/pantry", {
            method: "POST",
            body: JSON.stringify({
                name: document.getElementById("pantryName").value,
                quantity: document.getElementById("pantryQuantity").value || "1",
                category: document.getElementById("pantryCategory").value,
                expiry_days: document.getElementById("pantryExpiry").value,
            }),
        });

        document.getElementById("pantryGrid").appendChild(createPantryCard(item));
        feedback.textContent = `✓ ${item.name} added to your pantry.`;
        document.getElementById("pantryName").value = "";
        document.getElementById("pantryQuantity").value = "";
        document.getElementById("pantryExpiry").value = "";
        await refreshCounts();
        showToast("Pantry updated");
    } catch (error) {
        feedback.textContent = error.message;
    }
});

async function deletePantryItem(id) {
    try {
        await requestJSON(`/api/pantry/${id}`, { method: "DELETE" });
        document.querySelector(`[data-pantry-id="${id}"]`)?.remove();
        await refreshCounts();
        showToast("Pantry item removed");
    } catch (error) {
        showToast(error.message);
    }
}

document.querySelectorAll(".delete-pantry-btn").forEach((button) => {
    button.addEventListener("click", () => deletePantryItem(button.dataset.id));
});

function createGroceryRow(item) {
    const row = document.createElement("div");
    row.className = "grocery-row";
    row.dataset.groceryId = item.id;

    row.innerHTML = `
        <label class="checkbox-wrap">
            <input class="grocery-checkbox" type="checkbox" data-id="${item.id}">
            <span class="custom-checkbox"></span>
            <div class="grocery-copy">
                <strong>${escapeHTML(item.name)}</strong>
                <small>${escapeHTML(item.category)}</small>
            </div>
        </label>
        <button class="danger-text-btn delete-grocery-btn" data-id="${item.id}">Remove</button>
    `;

    row.querySelector(".grocery-checkbox").addEventListener("change", async (event) => {
        await toggleGrocery(item.id, event.target.checked, row);
    });

    row.querySelector(".delete-grocery-btn").addEventListener("click", async () => {
        await deleteGroceryItem(item.id);
    });

    return row;
}

document.getElementById("openGroceryFormBtn").addEventListener("click", () => {
    document.getElementById("groceryFormCard").classList.remove("hidden");
    document.getElementById("groceryName").focus();
});

document.getElementById("cancelGroceryBtn").addEventListener("click", () => {
    document.getElementById("groceryFormCard").classList.add("hidden");
});

document.getElementById("saveGroceryBtn").addEventListener("click", async () => {
    try {
        const item = await requestJSON("/api/grocery", {
            method: "POST",
            body: JSON.stringify({
                name: document.getElementById("groceryName").value,
                category: document.getElementById("groceryCategory").value,
            }),
        });

        if (!document.querySelector(`[data-grocery-id="${item.id}"]`)) {
            document.getElementById("groceryList").appendChild(createGroceryRow(item));
        }

        document.getElementById("groceryName").value = "";
        showToast(`${item.name} added to grocery list`);
    } catch (error) {
        showToast(error.message);
    }
});

async function toggleGrocery(id, purchased, row) {
    try {
        await requestJSON(`/api/grocery/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ purchased }),
        });

        row.querySelector(".grocery-copy").classList.toggle("completed", purchased);
    } catch (error) {
        showToast(error.message);
    }
}

async function deleteGroceryItem(id) {
    try {
        await requestJSON(`/api/grocery/${id}`, { method: "DELETE" });
        document.querySelector(`[data-grocery-id="${id}"]`)?.remove();
        showToast("Grocery item removed");
    } catch (error) {
        showToast(error.message);
    }
}

document.querySelectorAll(".grocery-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
        const row = event.target.closest(".grocery-row");
        await toggleGrocery(event.target.dataset.id, event.target.checked, row);
    });
});

document.querySelectorAll(".delete-grocery-btn").forEach((button) => {
    button.addEventListener("click", () => deleteGroceryItem(button.dataset.id));
});

async function deleteMeal(id) {
    try {
        await requestJSON(`/api/meal-plan/${id}`, { method: "DELETE" });
        document.querySelector(`[data-meal-id="${id}"]`)?.remove();
        await refreshCounts();
        showToast("Meal removed");
    } catch (error) {
        showToast(error.message);
    }
}

document.querySelectorAll(".delete-meal-btn").forEach((button) => {
    button.addEventListener("click", () => deleteMeal(button.dataset.id));
});

async function planRecommendedMeal() {
    const feedback = document.getElementById("recommendationFeedback");
    try {
        const data = await requestJSON("/api/recommendation/plan", {
            method: "POST",
        });
        if (feedback) feedback.textContent = `✓ ${data.meal.meal} is on your meal plan.`;
        await refreshCounts();
        showToast("Meal plan updated");
    } catch (error) {
        if (feedback) feedback.textContent = error.message;
    }
}

async function addMissingIngredients() {
    const feedback = document.getElementById("recommendationFeedback");
    try {
        const data = await requestJSON("/api/recommendation/add-missing", {
            method: "POST",
        });

        if (feedback) {
            feedback.textContent = data.added.length
                ? `✓ Added ${data.added.map((x) => x.name).join(", ")}.`
                : "✓ Your grocery list already has the missing ingredients.";
        }

        showToast("Grocery list updated");
    } catch (error) {
        if (feedback) feedback.textContent = error.message;
    }
}

document.getElementById("planRecommendedBtn")?.addEventListener("click", planRecommendedMeal);
document.getElementById("addMissingBtn")?.addEventListener("click", addMissingIngredients);
document.getElementById("addRecommendedMealBtn")?.addEventListener("click", planRecommendedMeal);

document.getElementById("findUseSoonBtn")?.addEventListener("click", () => {
    switchSection("assistant");
    const input = document.getElementById("agentInput");
    input.value = "Plan dinner using whatever is going bad first";
    input.focus();
});

function appendChatMessage(role, message) {
    const window = document.getElementById("chatWindow");
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message ${role}`;

    if (role === "ai") {
        wrapper.innerHTML = `
            <div class="chat-avatar">✦</div>
            <div class="chat-bubble">${escapeHTML(message)}</div>
        `;
    } else {
        wrapper.innerHTML = `<div class="chat-bubble">${escapeHTML(message)}</div>`;
    }

    window.appendChild(wrapper);
    wrapper.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function sendAgentMessage(message, source = "assistant") {
    const text = message.trim();
    if (!text) return;

    if (source === "assistant") appendChatMessage("user", text);

    try {
        const data = await requestJSON("/api/agent", {
            method: "POST",
            body: JSON.stringify({ message: text }),
        });

        if (source === "assistant") {
            appendChatMessage("ai", data.message);

            const banner = document.getElementById("agentActionBanner");
            if (data.action && data.action.type) {
                state.pendingAgentAction = data.action.type;
                state.pendingAgentMessage = text;
                document.getElementById("agentActionText").textContent = data.action.label;
                banner.classList.remove("hidden");
            } else {
                banner.classList.add("hidden");
            }
        } else {
            const box = document.getElementById("overviewAgentResponse");
            box.textContent = data.message;
            box.classList.remove("hidden");
        }
    } catch (error) {
        if (source === "assistant") {
            appendChatMessage("ai", error.message);
        } else {
            showToast(error.message);
        }
    }
}

document.getElementById("agentSendBtn").addEventListener("click", async () => {
    const input = document.getElementById("agentInput");
    const text = input.value;
    input.value = "";
    await sendAgentMessage(text, "assistant");
});

document.getElementById("agentInput").addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("agentSendBtn").click();
    }
});

document.getElementById("executeAgentActionBtn").addEventListener("click", async () => {
    if (!state.pendingAgentMessage) return;

    try {
        const data = await requestJSON("/api/agent", {
            method: "POST",
            body: JSON.stringify({
                message: state.pendingAgentMessage,
                execute: true,
            }),
        });

        appendChatMessage("ai", data.message);
        document.getElementById("agentActionBanner").classList.add("hidden");
        state.pendingAgentAction = null;
        state.pendingAgentMessage = null;
        await refreshCounts();
        showToast("PantryAI completed the action");
    } catch (error) {
        appendChatMessage("ai", error.message);
    }
});

document.querySelectorAll(".assistant-prompt").forEach((button) => {
    button.addEventListener("click", () => {
        document.getElementById("agentInput").value = button.textContent.trim();
        document.getElementById("agentSendBtn").click();
    });
});

document.querySelectorAll(".prompt-chip:not(.assistant-prompt)").forEach((button) => {
    button.addEventListener("click", () => {
        document.getElementById("overviewAgentInput").value = button.textContent.trim();
        document.getElementById("overviewAgentSend").click();
    });
});

document.getElementById("overviewAgentSend").addEventListener("click", async () => {
    const input = document.getElementById("overviewAgentInput");
    await sendAgentMessage(input.value, "overview");
});

document.getElementById("overviewAgentInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("overviewAgentSend").click();
    }
});

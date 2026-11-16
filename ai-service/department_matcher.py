"""Department recommendation.

score = 0.60 * (category handled by department) + 0.25 * (TF-IDF similarity of the request to the
department's name/description) + 0.15 * (share of retrieved historical records belonging to it).
The officer can always override the recommendation.
"""
from textutil import tfidf_cosine


def _dept_text(d):
    return f"{d.get('name', '')}. {d.get('description', '')}. {' '.join(d.get('categories') or [])}"


def recommend(category, text, departments, retrieved=None, selected_department=None):
    departments = [d for d in departments if d.get("active", True)]
    if not departments:
        return {"recommended": None, "reason": "No active departments are configured.", "category": category,
                "alternatives": [], "citizen_selected": selected_department}
    sims = tfidf_cosine(text, [_dept_text(d) for d in departments])
    retrieved = retrieved or []
    scored = []
    for d, sim in zip(departments, sims):
        cat = 1.0 if category in (d.get("categories") or []) else 0.0
        votes = [r for r in retrieved if r.get("department") in (d["name"], d["id"])]
        vote = len(votes) / len(retrieved) if retrieved else 0.0
        scored.append((0.60 * cat + 0.25 * float(sim) + 0.15 * vote, d, cat, vote))
    scored.sort(key=lambda x: x[0], reverse=True)
    score, best, cat_match, vote = scored[0]
    parts = []
    if cat_match:
        parts.append(f"it handles the '{category}' category")
    if vote:
        parts.append(f"{round(vote * 100)}% of the similar historical records belong to it")
    parts.append("its description overlaps with the request wording" if score - 0.6 * cat_match - 0.15 * vote > 0.02 else "no stronger match was found")
    reason = f"{best['name']} is suggested because " + "; ".join(parts) + "."
    if selected_department and selected_department not in (best["id"], best["name"]):
        reason += " The citizen selected a different department; the officer should confirm."
    return {
        "recommended": {"id": best["id"], "name": best["name"]},
        "reason": reason,
        "category": category,
        "score": round(score, 4),
        "score_type": "uncalibrated heuristic score",
        "alternatives": [{"id": d["id"], "name": d["name"], "score": round(s, 4)} for s, d, _, _ in scored[1:3] if s > 0],
        "citizen_selected": selected_department,
    }

"""Request categorisation.

Approach (documented in the README):
1. Each category has a prototype: a description, example requests and keywords (data/categories.json).
2. With the embedding model: the request and every category centroid are embedded and compared with
   cosine similarity; each distinct keyword hit adds a small bonus (0.05, capped at 0.20).
3. Without the model: a keyword-only fallback is used and clearly labelled.
4. If the best score is below a threshold the category is "Other".

Scores are UNCALIBRATED similarity-style scores, not probabilities.
"""
import re

import numpy as np

import embeddings
from textutil import load_categories

EMBEDDING_THRESHOLD = 0.20
_centroids = {"model": None, "names": [], "matrix": None}


def _keyword_hits(text, keywords):
    low = " " + re.sub(r"[^a-z0-9\- ]+", " ", text.lower()) + " "
    hits = []
    for kw in keywords:
        pattern = r"(?<![a-z0-9])" + re.escape(kw.lower()) + r"s?(?![a-z0-9])"
        if re.search(pattern, low):
            hits.append(kw)
    return hits


def _category_centroids(categories):
    if _centroids["matrix"] is not None and _centroids["model"] == (embeddings.MODEL_NAME, embeddings._test_embedder):
        return _centroids["names"], _centroids["matrix"]
    names, rows = [], []
    for cat in categories:
        if cat["name"] == "Other":
            continue
        texts = [cat["description"]] + cat["examples"] + [", ".join(cat["keywords"])]
        vecs = embeddings.embed(texts)
        centroid = vecs.mean(axis=0)
        norm = np.linalg.norm(centroid)
        rows.append(centroid / norm if norm else centroid)
        names.append(cat["name"])
    _centroids.update(model=(embeddings.MODEL_NAME, embeddings._test_embedder), names=names, matrix=np.vstack(rows))
    return names, _centroids["matrix"]


def classify(subject, description):
    text = f"{subject}. {description}".strip()
    categories = [c for c in load_categories() if c["name"] != "Other"]
    hits = {c["name"]: _keyword_hits(text, c["keywords"]) for c in categories}

    method, scores = None, {}
    try:
        names, matrix = _category_centroids(load_categories())
        q = embeddings.embed([text])[0]
        sims = matrix @ q
        for name, sim in zip(names, sims):
            scores[name] = float(sim) + min(0.20, 0.05 * len(hits[name]))
        method = "embedding+keywords"
        threshold = EMBEDDING_THRESHOLD
    except embeddings.EmbeddingUnavailable:
        for name, found in hits.items():
            scores[name] = min(1.0, 0.25 * len(found))
        method = "keyword-fallback"
        threshold = 0.2

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best_name, best_score = ranked[0]
    if best_score < threshold or (method == "keyword-fallback" and not hits[best_name]):
        best_name, best_score = "Other", best_score
    keywords = hits.get(best_name, [])

    if best_name == "Other":
        explanation = "No category reached the similarity threshold, so the request was labelled 'Other'."
    elif keywords:
        explanation = f"The request is closest to '{best_name}' and mentions: {', '.join(keywords)}."
    else:
        explanation = f"The request text is semantically closest to the '{best_name}' category description."
    if method == "keyword-fallback":
        explanation += " (Embedding model unavailable: keyword matching was used.)"

    return {
        "category": best_name,
        "score": round(float(best_score), 4),
        "score_type": "uncalibrated similarity score (not a probability)",
        "method": method,
        "keywords": keywords,
        "explanation": explanation,
        "top_categories": [{"category": n, "score": round(float(s), 4)} for n, s in ranked[:3]],
    }

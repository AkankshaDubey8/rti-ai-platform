"""Semantic search over historical RTI records.

Primary path: all-MiniLM-L6-v2 embeddings + cosine similarity (stored embeddings are reused;
only records without a matching-model embedding are embedded and returned in `new_embeddings`
so the caller can persist them). Fallback: TF-IDF cosine similarity, clearly labelled.
"""
import numpy as np

import embeddings
from textutil import split_sentences, tfidf_cosine, tokenize

NOTE = "Similarity scores measure textual closeness only; they do not prove authenticity, factual or legal correctness."


def record_text(rec):
    return " . ".join(filter(None, [rec.get("title"), rec.get("application_summary"), rec.get("response_summary")]))


def extract_information(query, rec, max_sentences=2):
    """Pick the sentences of a record that best overlap the query terms (deterministic, extractive)."""
    q = set(tokenize(query))
    sentences = split_sentences(rec.get("response_summary", "")) + split_sentences(rec.get("application_summary", ""))
    scored = sorted(((len(q & set(tokenize(s))), i, s) for i, s in enumerate(sentences)), key=lambda x: (-x[0], x[1]))
    picked = [s for score, _, s in scored[:max_sentences] if score > 0] or sentences[:1]
    return " ".join(picked)


def _valid_embedding(rec, model_name):
    emb = rec.get("embedding")
    return bool(emb) and rec.get("embedding_model") == model_name and len(emb) > 0


def search(query, records, top_k=3):
    if not records:
        return {"results": [], "method": "none", "new_embeddings": {}, "embedding_model": None, "note": NOTE}
    new_embeddings = {}
    try:
        model_name = embeddings.MODEL_NAME
        missing = [r for r in records if not _valid_embedding(r, model_name)]
        if missing:
            vecs = embeddings.embed([record_text(r) for r in missing])
            for rec, vec in zip(missing, vecs):
                rec["embedding"] = [float(x) for x in vec]
                rec["embedding_model"] = model_name
                new_embeddings[rec["id"]] = rec["embedding"]
        matrix = np.asarray([r["embedding"] for r in records], dtype=float)
        q = embeddings.embed([query])[0]
        norms = np.linalg.norm(matrix, axis=1)
        norms[norms == 0] = 1.0
        sims = (matrix / norms[:, None]) @ q / (np.linalg.norm(q) or 1.0)
        method = "all-MiniLM-L6-v2 embeddings + cosine similarity"
    except embeddings.EmbeddingUnavailable:
        sims = tfidf_cosine(query, [record_text(r) for r in records])
        method, model_name, new_embeddings = "TF-IDF cosine fallback (embedding model unavailable)", None, {}

    order = np.argsort(-sims)[: max(1, top_k)]
    results = []
    for idx in order:
        rec = records[int(idx)]
        results.append({
            "id": rec["id"],
            "record_id": rec.get("record_id"),
            "title": rec.get("title"),
            "department": rec.get("department"),
            "category": rec.get("category"),
            "similarity": round(float(sims[int(idx)]), 4),
            "extracted_information": extract_information(query, rec),
            "response_summary": rec.get("response_summary", ""),
        })
    return {"results": results, "method": method, "new_embeddings": new_embeddings, "embedding_model": model_name, "note": NOTE}

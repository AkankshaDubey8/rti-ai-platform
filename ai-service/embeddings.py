"""Embedding model wrapper: all-MiniLM-L6-v2 via sentence-transformers (PyTorch).

The model is loaded once (lazily, thread-safe) and reused for every request. If the
dependencies or the model weights are unavailable, `EmbeddingUnavailable` is raised so
callers can use their documented fallback instead of crashing.
"""
import os
import threading
import time

MODEL_NAME = os.getenv("HF_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
RETRY_AFTER_SECONDS = 120

_lock = threading.Lock()
_model = None
_error = None
_failed_at = 0.0
_test_embedder = None  # injected by unit tests only


class EmbeddingUnavailable(RuntimeError):
    pass


def set_test_embedder(fn):
    """Unit-test hook: replace the real model with a deterministic function."""
    global _test_embedder
    _test_embedder = fn


def _load():
    global _model, _error, _failed_at
    with _lock:
        if _model is not None:
            return _model
        if _error and time.time() - _failed_at < RETRY_AFTER_SECONDS:
            return None
        try:
            from sentence_transformers import SentenceTransformer  # heavy import, done lazily

            _model = SentenceTransformer(MODEL_NAME)
            _error = None
        except Exception as exc:  # missing package, no network for weights, corrupt cache...
            _error = f"{type(exc).__name__}: {exc}"
            _failed_at = time.time()
            _model = None
        return _model


def is_available():
    return _test_embedder is not None or _load() is not None


def status():
    return {
        "model_name": MODEL_NAME,
        "loaded": _model is not None,
        "last_error": _error,
        "test_embedder_active": _test_embedder is not None,
    }


def embed(texts):
    """Return an (n, d) array of L2-normalised embeddings."""
    import numpy as np

    texts = list(texts)
    if _test_embedder is not None:
        return np.asarray(_test_embedder(texts), dtype=float)
    model = _load()
    if model is None:
        raise EmbeddingUnavailable(_error or "Embedding model is not available")
    try:
        return model.encode(texts, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
    except Exception as exc:
        raise EmbeddingUnavailable(f"Embedding failed: {exc}") from exc

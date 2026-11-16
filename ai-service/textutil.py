"""Small text utilities shared by the AI modules (tokenising, sentences, TF-IDF cosine)."""
import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np

STOPWORDS = set(
    "a an and are as at be been by for from has have how i in is it its of on or please provide shall that the their "
    "there this to under was were what when where which who why will with you your me my our us any all copy details "
    "detail information kindly regarding respect sir madam can could do does did get got".split()
)

_CATEGORY_FILE = Path(__file__).parent / "data" / "categories.json"


def load_categories():
    with open(_CATEGORY_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)["categories"]


def stem(token):
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def tokenize(text):
    return [stem(t) for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in STOPWORDS and len(t) > 1]


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\n+", (text or "").strip())
    return [p.strip() for p in parts if len(p.strip()) > 3]


def tfidf_cosine(query, documents):
    """Cosine similarity between `query` and each document using TF-IDF vectors (numpy only)."""
    docs_tokens = [tokenize(d) for d in documents]
    q_tokens = tokenize(query)
    vocab = {}
    for toks in docs_tokens + [q_tokens]:
        for t in toks:
            vocab.setdefault(t, len(vocab))
    if not vocab or not documents:
        return np.zeros(len(documents))
    n = len(documents)
    df = Counter()
    for toks in docs_tokens:
        df.update(set(toks))
    idf = np.zeros(len(vocab))
    for t, i in vocab.items():
        idf[i] = math.log((1 + n) / (1 + df.get(t, 0))) + 1.0

    def vec(tokens):
        v = np.zeros(len(vocab))
        for t, c in Counter(tokens).items():
            v[vocab[t]] = (1 + math.log(c)) * idf[vocab[t]]
        norm = np.linalg.norm(v)
        return v / norm if norm else v

    q = vec(q_tokens)
    return np.array([float(vec(t) @ q) for t in docs_tokens])

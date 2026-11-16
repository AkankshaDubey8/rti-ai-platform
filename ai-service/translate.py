"""Hindi -> English translation.

Order of preference: (1) a local MarianMT model (Helsinki-NLP/opus-mt-hi-en) if `transformers` is installed,
(2) the configured LLM, (3) unavailable. Nothing is faked: when no engine works, TranslationUnavailable is raised.
"""
import os
import threading

import response_generator as rg

MARIAN_NAME = os.getenv("TRANSLATION_MODEL", "Helsinki-NLP/opus-mt-hi-en")
_lock = threading.Lock()
_marian = None
_marian_error = None
_test_engine = None


class TranslationUnavailable(RuntimeError):
    pass


def set_test_engine(fn):
    global _test_engine
    _test_engine = fn


def _load_marian():
    global _marian, _marian_error
    with _lock:
        if _marian or _marian_error:
            return _marian
        try:
            from transformers import MarianMTModel, MarianTokenizer  # optional heavy dependency

            tok = MarianTokenizer.from_pretrained(MARIAN_NAME)
            _marian = (tok, MarianMTModel.from_pretrained(MARIAN_NAME))
        except Exception as exc:
            _marian_error = f"{type(exc).__name__}: {exc}"
        return _marian


def capabilities():
    return {"marian_loaded": _marian is not None, "marian_error": _marian_error, "llm": rg.llm_configured()}


def translate(text):
    text = (text or "").strip()
    if not text:
        raise ValueError("Nothing to translate")
    if _test_engine:
        return {"translation": _test_engine(text), "engine": "test-engine"}
    pair = _load_marian()
    if pair:
        tok, model = pair
        parts = [p for p in text.split("\n")]
        out = []
        for p in parts:
            if not p.strip():
                out.append("")
                continue
            batch = tok([p], return_tensors="pt", truncation=True, max_length=400)
            out.append(tok.decode(model.generate(**batch, max_new_tokens=400)[0], skip_special_tokens=True))
        return {"translation": "\n".join(out), "engine": f"marian:{MARIAN_NAME}"}
    if rg.llm_configured():
        try:
            reply = rg.complete("Translate the user's text from Hindi (or mixed Hindi-English) into plain English. Keep names, numbers and dates exactly. Output only the translation.", text)
            if reply:
                return {"translation": reply, "engine": rg.llm_label()}
        except Exception as exc:  # fall through to unavailable with the reason
            raise TranslationUnavailable(f"LLM translation failed: {exc}") from exc
    raise TranslationUnavailable("No translation engine is available. Install `transformers`/`sentencepiece` for the local model or configure an LLM.")

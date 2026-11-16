"""RAG response drafting.

Retrieval happens upstream (semantic_search). This module assembles a structured drafting prompt from the
application, detected category, recommended department and retrieved historical records, then either:
  * calls a configured external LLM (LLM_PROVIDER = openai | openai_compatible | anthropic | gemini), or
  * produces a clearly labelled TEMPLATE draft ("template-fallback"). Template output is never described as LLM output.
The generator never invents facts: unsupported items are listed as missing and marked for officer verification.
"""
import json
import os
import re
import urllib.error
import urllib.request

from textutil import split_sentences, tokenize

DISCLAIMER = "AI-generated suggestion. Not verified. Must be reviewed, edited and approved by an authorised officer before any response is issued."
REQUEST_CUES = re.compile(r"\b(provide|furnish|details?|copy|copies|list|number of|how many|when|why|whether|status|please|supply|disclose|inspect|record|report|expenditure|amount)\b", re.I)
SUFFICIENT_SIMILARITY = {"embedding": 0.45, "tfidf": 0.20}

SYSTEM_PROMPT = (
    "You draft replies to Right to Information (RTI) applications for review by a Public Information Officer. "
    "Use ONLY the facts present in the CONTEXT RECORDS. Never invent figures, dates, names, file numbers, policies or legal citations. "
    "Where the context does not contain requested information, write [TO BE VERIFIED BY OFFICER: <what is needed>]. "
    "Historical records are reference material from other applications, not proof for this one. "
    "Write a polite, formal letter. Output only the letter text."
)


def _requested_items(description):
    items = [s for s in split_sentences(description) if REQUEST_CUES.search(s)]
    return items[:6] or split_sentences(description)[:3]


def analyse_gaps(description, records, method_hint="embedding"):
    """Heuristic gap analysis: a requested item is 'supported' if >=50% of its content terms appear in a retrieved record."""
    corpus = [(r, set(tokenize(" ".join([r.get("extracted_information", ""), r.get("response_summary", "")])))) for r in records]
    identified, missing = [], []
    for item in _requested_items(description):
        terms = set(tokenize(item))
        best, best_ratio = None, 0.0
        for rec, rterms in corpus:
            ratio = len(terms & rterms) / len(terms) if terms else 0.0
            if ratio > best_ratio:
                best, best_ratio = rec, ratio
        if best is not None and best_ratio >= 0.5:
            identified.append({"requested_item": item, "source_record": best.get("record_id"), "source_title": best.get("title"),
                               "statement": best.get("extracted_information", ""), "term_overlap": round(best_ratio, 2)})
        else:
            missing.append(item)
    threshold = SUFFICIENT_SIMILARITY["tfidf" if "TF-IDF" in method_hint else "embedding"]
    weak = not records or max(r.get("similarity", 0) for r in records) < threshold
    return identified, missing, weak


def build_prompt(application, category, department_name, records, missing):
    ctx = "\n\n".join(
        f"[{r.get('record_id')}] {r.get('title')} (department: {r.get('department')}, similarity {r.get('similarity')})\n"
        f"Relevant extract: {r.get('extracted_information')}\nResponse summary: {r.get('response_summary')}" for r in records
    ) or "(no similar historical records were retrieved)"
    user = (
        f"APPLICATION ID: {application.get('application_id')}\nSUBJECT: {application.get('subject')}\n"
        f"DESCRIPTION:\n{application.get('description')}\nREFERENCE INFO: {application.get('reference_info') or 'none'}\n"
        f"CATEGORY: {category}\nRECOMMENDED DEPARTMENT: {department_name}\n\nCONTEXT RECORDS:\n{ctx}\n\n"
        f"ITEMS WITH NO SUPPORT IN THE CONTEXT (must be marked for verification):\n" + ("\n".join(f"- {m}" for m in missing) or "- none identified")
    )
    return SYSTEM_PROMPT, user


def _post_json(url, headers, payload, timeout=45):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - URL comes from operator-controlled env/config
        return json.loads(resp.read().decode())


def call_llm(system, user, provider, api_key, model, base_url=None):
    if provider in ("openai", "openai_compatible"):
        base = (base_url or "https://api.openai.com/v1").rstrip("/")
        data = _post_json(f"{base}/chat/completions", {"Authorization": f"Bearer {api_key}"},
                          {"model": model, "temperature": 0.2, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
        return data["choices"][0]["message"]["content"].strip()
    if provider == "anthropic":
        data = _post_json("https://api.anthropic.com/v1/messages", {"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                          {"model": model, "max_tokens": 1500, "system": system, "messages": [{"role": "user", "content": user}]})
        return "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text").strip()
    if provider == "gemini":
        data = _post_json(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", {"x-goog-api-key": api_key},
                          {"systemInstruction": {"parts": [{"text": system}]}, "contents": [{"role": "user", "parts": [{"text": user}]}]})
        return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"]).strip()
    raise ValueError(f"Unsupported LLM_PROVIDER '{provider}'")


def template_draft(application, department_name, identified, missing):
    ref = application.get("application_id") or "[application id]"
    lines = [
        "*** DRAFT - GENERATED FROM A FIXED TEMPLATE (NO LLM USED) - NOT AN OFFICIAL RESPONSE ***", "",
        f"Subject: Response to RTI application {ref} - {application.get('subject')}", "",
        "Sir/Madam,", "",
        f"This is with reference to your application {ref} received by {department_name or '[Department]'} under the Right to Information Act, 2005.", "",
        "1. Information that may be available (each point must be verified against current department records before issue):",
    ]
    if identified:
        for i, item in enumerate(identified, 1):
            lines.append(f"   {i}. Regarding \"{item['requested_item']}\": {item['statement']}  [Reference: DEMO historical record {item['source_record']} - verify]")
    else:
        lines.append("   [TO BE VERIFIED BY OFFICER: no supporting information was found in the retrieved historical records.]")
    lines += ["", "2. Information that could not be supported from the retrieved records:"]
    lines += [f"   - [TO BE VERIFIED BY OFFICER: {m}]" for m in missing] or ["   - None identified by the automated gap check (officer must still confirm)."]
    lines += ["", "3. Appeal details: [OFFICER TO INSERT first appellate authority and time limit as per department rules].", "",
              "Yours faithfully,", f"Public Information Officer, {department_name or '[Department]'}"]
    return "\n".join(lines)


def generate(application, category, department_name, records, similarity_method="embedding"):
    identified, missing, weak = analyse_gaps(application.get("description", ""), records, similarity_method)
    notes = [
        "Check every statement against current, official department records. Historical records are reference material only.",
        "Confirm whether any exemption or third-party consideration applies; the AI does not make that decision.",
        "Confirm fees, dates and appeal details before issuing.",
    ]
    if weak:
        notes.insert(0, "Retrieved records are only weakly similar to this request: treat the draft as a skeleton and gather the information from original files.")
        if not any("similar" in m for m in missing):
            missing = missing + ["No sufficiently similar historical record exists, so all requested facts need verification from current files."]
    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    api_key, model, base_url = os.getenv("LLM_API_KEY", ""), os.getenv("LLM_MODEL", ""), os.getenv("LLM_BASE_URL")
    mode, error, text = "template-fallback", None, None
    if provider and api_key and model:
        try:
            system, user = build_prompt(application, category, department_name, records, missing)
            text = call_llm(system, user, provider, api_key, model, base_url)
            if text:
                mode = f"llm:{provider}/{model}"
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, ValueError, TimeoutError, OSError) as exc:
            error = f"LLM call failed ({type(exc).__name__}: {exc}). Template fallback used."
    elif provider:
        error = "LLM_PROVIDER is set but LLM_API_KEY or LLM_MODEL is missing. Template fallback used."
    if not text:
        text = template_draft(application, department_name, identified, missing)
    return {
        "generation_mode": mode,
        "llm_error": error,
        "disclaimer": DISCLAIMER,
        "draft": {
            "application_reference": application.get("application_id"),
            "subject": application.get("subject"),
            "request_summary": " ".join(split_sentences(application.get("description", ""))[:2]),
            "identified_information": identified,
            "missing_information": missing,
            "suggested_structure": ["Acknowledge the application reference and date", "Answer each numbered request using only verified information",
                                    "State clearly any information that is unavailable or withheld, with the lawful reason", "Give appeal details and officer sign-off"],
            "verification_notes": notes,
            "draft_text": text,
        },
    }


# ---- generic completion helpers shared by the assistant and the translator ----
def llm_configured():
    return bool(os.getenv("LLM_PROVIDER") and os.getenv("LLM_API_KEY") and os.getenv("LLM_MODEL"))


def llm_label():
    return f"llm:{os.getenv('LLM_PROVIDER', '').strip().lower()}/{os.getenv('LLM_MODEL', '')}"


def complete(system, user):
    """Single LLM completion using the configured provider. Raises on failure; callers decide on a fallback."""
    return call_llm(system, user, os.getenv("LLM_PROVIDER", "").strip().lower(), os.getenv("LLM_API_KEY", ""), os.getenv("LLM_MODEL", ""), os.getenv("LLM_BASE_URL"))

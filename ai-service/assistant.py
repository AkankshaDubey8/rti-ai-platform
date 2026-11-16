"""LLM gateway for the RTI assistant.

Retrieval, intent handling and the non-LLM fallbacks live in the Next.js app (so they work when this service is down).
This module only builds a grounded prompt and calls the configured LLM. If no LLM is configured it says so (mode "no-llm");
it never fabricates an answer.
"""
import urllib.error

import response_generator as rg

SYSTEM = {
    "answer": (
        "You are the help assistant of RTI Assist, an independent academic platform for Right to Information requests in India. "
        "Answer ONLY from the KNOWLEDGE entries provided. If they do not cover the question, say you do not have that information and suggest asking the "
        "public authority or checking its official website. NEVER invent legal sections, fees, deadlines, forms, addresses, phone numbers, email addresses or URLs. "
        "Use plain, short sentences. Do not give legal advice. Reply in the same language as the user's question."
    ),
    "rewrite": (
        "You help a citizen improve the wording of an RTI request. Keep the citizen's meaning. Make it specific, polite and numbered where there are several items. "
        "Do NOT add facts, names, dates, places or figures that the citizen did not give; use [add detail] placeholders instead. "
        "Do not mention legal sections. Output only the improved request text."
    ),
    "explain": (
        "Explain the term or sentence in simple language for someone with no legal background, using ONLY the KNOWLEDGE entries when they cover it. "
        "If they do not, give a short general explanation and say it is general. Never invent legal provisions, fees, deadlines or contacts."
    ),
}


def build_prompt(task, message, history, entries, draft=None):
    knowledge = "\n\n".join(f"[{e['id']}] {e['title']}\n{e['text']}" + ("\nSteps: " + "; ".join(e["steps"]) if e.get("steps") else "") for e in entries) or "(none)"
    convo = "\n".join(f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in (history or [])[-6:])
    user = f"KNOWLEDGE:\n{knowledge}\n\n"
    if draft:
        user += f"CITIZEN DRAFT REQUEST:\n{draft}\n\n"
    if convo:
        user += f"CONVERSATION SO FAR:\n{convo}\n\n"
    return SYSTEM.get(task, SYSTEM["answer"]), user + f"USER: {message}"


def run(task, message, history=None, entries=None, draft=None):
    if not rg.llm_configured():
        return {"mode": "no-llm", "reply": None, "note": "No LLM is configured on the AI service."}
    system, user = build_prompt(task, message, history, entries or [], draft)
    try:
        reply = rg.complete(system, user)
        if not reply:
            raise ValueError("empty reply")
        return {"mode": rg.llm_label(), "reply": reply, "note": None}
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, ValueError, TimeoutError, OSError) as exc:
        return {"mode": "llm-error", "reply": None, "note": f"LLM call failed ({type(exc).__name__}: {exc})."}

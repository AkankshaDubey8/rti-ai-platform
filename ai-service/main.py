"""FastAPI AI service for the RTI platform. Start with: uvicorn main:app --port 8000"""
import os
import threading
from pathlib import Path
from typing import List, Optional

try:  # optional: load the project-root .env (same file the Next.js app uses) before modules read the environment
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import assistant
import base64
import classifier
import department_matcher
import embeddings
import extract as extractor
import response_generator
import semantic_search
import translate as translator

app = FastAPI(title="RTI AI Service", version="1.0.0", description="Classification, semantic search and RAG drafting for the RTI platform (academic project).")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")],
                   allow_methods=["GET", "POST"], allow_headers=["*"])


def check_token(x_ai_token: Optional[str] = Header(default=None)):
    expected = os.getenv("AI_SERVICE_TOKEN")
    if expected and x_ai_token != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-AI-Token header")


@app.on_event("startup")
def preload_model():
    if os.getenv("PRELOAD_MODEL", "1") == "1":
        threading.Thread(target=embeddings.is_available, daemon=True).start()  # load once, in the background


class ApplicationIn(BaseModel):
    application_id: Optional[str] = None
    subject: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=10, max_length=8000)
    reference_info: Optional[str] = Field(default=None, max_length=1000)
    selected_department: Optional[str] = None


class DepartmentIn(BaseModel):
    id: str
    name: str
    description: str = ""
    categories: List[str] = []
    active: bool = True


class RecordIn(BaseModel):
    id: str
    record_id: Optional[str] = None
    title: str
    department: Optional[str] = None
    category: Optional[str] = None
    application_summary: str = ""
    response_summary: str = ""
    embedding: Optional[List[float]] = None
    embedding_model: Optional[str] = None


class ClassifyIn(BaseModel):
    subject: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=10, max_length=8000)


class SearchIn(BaseModel):
    query: str = Field(min_length=3, max_length=8000)
    records: List[RecordIn]
    top_k: int = Field(default=3, ge=1, le=10)


class AnalyzeIn(BaseModel):
    application: ApplicationIn
    departments: List[DepartmentIn] = []
    records: List[RecordIn] = []
    top_k: int = Field(default=3, ge=1, le=10)


class EmbedIn(BaseModel):
    texts: List[str] = Field(min_length=1, max_length=64)


class GenerateIn(BaseModel):
    application: ApplicationIn
    category: str
    department_name: Optional[str] = None
    records: List[dict] = []
    similarity_method: str = "embedding"


@app.get("/health")
def health():
    st = embeddings.status()
    return {
        "status": "ok",
        "embedding_model": st,
        "capabilities": {"ocr": extractor.ocr_available(), "translation": translator.capabilities()},
        "llm": {"provider": os.getenv("LLM_PROVIDER") or None, "model": os.getenv("LLM_MODEL") or None,
                "configured": bool(os.getenv("LLM_PROVIDER") and os.getenv("LLM_API_KEY") and os.getenv("LLM_MODEL"))},
    }


@app.post("/classify", dependencies=[Depends(check_token)])
def classify(body: ClassifyIn):
    return classifier.classify(body.subject, body.description)


@app.post("/embed", dependencies=[Depends(check_token)])
def embed(body: EmbedIn):
    try:
        vecs = embeddings.embed(body.texts)
    except embeddings.EmbeddingUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"Embedding model unavailable: {exc}")
    return {"model": embeddings.MODEL_NAME, "embeddings": [[float(x) for x in v] for v in vecs]}


@app.post("/semantic-search", dependencies=[Depends(check_token)])
def semantic(body: SearchIn):
    return semantic_search.search(body.query, [r.model_dump() for r in body.records], body.top_k)


@app.post("/analyze", dependencies=[Depends(check_token)])
def analyze(body: AnalyzeIn):
    app_in = body.application
    classification = classifier.classify(app_in.subject, app_in.description)
    query = f"{app_in.subject}. {app_in.description}"
    search = semantic_search.search(query, [r.model_dump() for r in body.records], body.top_k)
    retrieved = [{"department": r["department"]} for r in search["results"]]
    dept = department_matcher.recommend(classification["category"], query, [d.model_dump() for d in body.departments], retrieved, app_in.selected_department)
    return {
        "classification": classification,
        "department_recommendation": dept,
        "similar_records": search["results"],
        "search": {"method": search["method"], "embedding_model": search["embedding_model"], "note": search["note"]},
        "new_embeddings": search["new_embeddings"],
        "engine": "python-fastapi",
        "disclaimer": response_generator.DISCLAIMER,
    }


@app.post("/generate-response", dependencies=[Depends(check_token)])
def generate(body: GenerateIn):
    return response_generator.generate(body.application.model_dump(), body.category, body.department_name, body.records, body.similarity_method)


class AssistantIn(BaseModel):
    task: str = Field(default="answer", pattern="^(answer|rewrite|explain)$")
    message: str = Field(min_length=1, max_length=4000)
    history: List[dict] = []
    entries: List[dict] = []
    draft: Optional[str] = Field(default=None, max_length=6000)


class TranslateIn(BaseModel):
    text: str = Field(min_length=1, max_length=6000)


class ExtractIn(BaseModel):
    filename: str = ""
    mime: str
    data_b64: str = Field(max_length=8_000_000)
    ocr: bool = True


@app.post("/assistant", dependencies=[Depends(check_token)])
def assistant_endpoint(body: AssistantIn):
    """Grounded LLM answer. Returns mode "no-llm" (HTTP 200) when no LLM is configured so the caller can use its own fallback."""
    return assistant.run(body.task, body.message, body.history, body.entries, body.draft)


@app.post("/translate", dependencies=[Depends(check_token)])
def translate_endpoint(body: TranslateIn):
    try:
        return translator.translate(body.text)
    except translator.TranslationUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/extract", dependencies=[Depends(check_token)])
def extract_endpoint(body: ExtractIn):
    try:
        data = base64.b64decode(body.data_b64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="data_b64 is not valid base64")
    if len(data) > 6 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    return extractor.extract(data, body.mime, body.filename, body.ocr)

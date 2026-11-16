"""Document text extraction (PDF text layer, OCR for scans and images, plain text) plus an extractive summary.

OCR needs the `tesseract` program plus `pytesseract` and (for scanned PDFs) `pdf2image` + poppler. If these are missing the
result says so in `warnings`; no text is ever invented.
"""
import io
import os
import re

import numpy as np

from textutil import split_sentences, tfidf_cosine

MAX_CHARS = 60000
OCR_LANGS = os.getenv("OCR_LANGS", "eng")


def ocr_available():
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _clean(text):
    return re.sub(r"[ \t]+\n", "\n", re.sub(r"\n{3,}", "\n\n", (text or "").replace("\x00", ""))).strip()


def _ocr_image(img):
    import pytesseract

    return pytesseract.image_to_string(img, lang=OCR_LANGS)


def summarize(text, n=3):
    """Extractive summary: the n most central sentences (TF-IDF similarity to the whole text), kept in original order."""
    sentences = [s for s in split_sentences(text) if 25 <= len(s) <= 400]
    if len(sentences) <= n:
        return " ".join(sentences)
    sims = tfidf_cosine(text, sentences)
    keep = sorted(np.argsort(-sims)[:n])
    return " ".join(sentences[i] for i in keep)


def extract(data, mime, filename="", ocr=True):
    warnings, method, pages, ocr_used, text = [], None, None, False, ""
    if mime == "text/plain":
        text, method = data.decode("utf-8", errors="replace"), "plain-text"
    elif mime == "application/pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            pages = len(reader.pages)
            text = "\n\n".join((p.extract_text() or "") for p in reader.pages)
            method = "pdf-text-layer"
        except Exception as exc:
            warnings.append(f"PDF could not be read: {exc}")
        if len(_clean(text)) < 20 and ocr:
            if not ocr_available():
                warnings.append("The PDF has no text layer and OCR (tesseract/pytesseract) is not available.")
            else:
                try:
                    from pdf2image import convert_from_bytes

                    images = convert_from_bytes(data, dpi=200, first_page=1, last_page=10)
                    text, ocr_used, method = "\n\n".join(_ocr_image(im) for im in images), True, "ocr"
                    if pages and pages > 10:
                        warnings.append("OCR was limited to the first 10 pages.")
                except Exception as exc:
                    warnings.append(f"OCR failed: {exc}")
    elif mime in ("image/png", "image/jpeg"):
        if not ocr_available():
            warnings.append("OCR (tesseract/pytesseract) is not available, so no text could be read from this image.")
        else:
            try:
                from PIL import Image

                text, ocr_used, method = _ocr_image(Image.open(io.BytesIO(data))), True, "ocr"
            except Exception as exc:
                warnings.append(f"OCR failed: {exc}")
    else:
        warnings.append(f"Unsupported type {mime}")
    text = _clean(text)[:MAX_CHARS]
    if not text and not warnings:
        warnings.append("No text was found in this document.")
    return {"text": text, "summary": summarize(text) if text else "", "summary_method": "extractive (key sentences, no AI model)", "method": method, "pages": pages, "ocr_used": ocr_used, "warnings": warnings, "chars": len(text)}

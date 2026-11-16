"""Tests for document extraction (REAL pypdf / tesseract OCR when installed), translation gateway and the assistant LLM gateway."""
import io
import os
import sys
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import assistant, extract, response_generator as rg, translate  # noqa: E402

try:
    from reportlab.pdfgen import canvas
    HAVE_REPORTLAB = True
except ImportError:
    HAVE_REPORTLAB = False
try:
    from PIL import Image, ImageDraw, ImageFont
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

TEXT = "Street lights repaired in Ward seven during the year 2023. The ward office paid the contractor for all repairs. Maintenance expenditure is recorded in the ward register."


def text_pdf():
    buf = io.BytesIO(); c = canvas.Canvas(buf)
    y = 800
    for line in ["Street lights repaired in Ward seven during the year 2023.", "The ward office paid the contractor for all repairs.", "Maintenance expenditure is recorded in the ward register."]:
        c.drawString(60, y, line); y -= 24
    c.save(); return buf.getvalue()


def image_with_text(size=44):
    img = Image.new("RGB", (1500, 360), "white"); d = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=size)
    d.text((30, 40), "Street lights repaired in Ward seven", fill="black", font=font)
    d.text((30, 160), "Expenditure recorded in the register", fill="black", font=font)
    return img


class ExtractTests(unittest.TestCase):
    @unittest.skipUnless(HAVE_REPORTLAB, "reportlab missing")
    def test_pdf_text_layer(self):
        r = extract.extract(text_pdf(), "application/pdf")
        self.assertEqual(r["method"], "pdf-text-layer"); self.assertFalse(r["ocr_used"])
        self.assertIn("Street lights repaired", r["text"]); self.assertEqual(r["pages"], 1)

    def test_plain_text_and_summary(self):
        r = extract.extract(TEXT.encode(), "text/plain")
        self.assertEqual(r["method"], "plain-text"); self.assertIn("extractive", r["summary_method"]); self.assertTrue(r["summary"])
        self.assertIn(r["summary"].split(". ")[0], r["text"])  # extractive: the summary quotes the document's own sentences

    @unittest.skipUnless(HAVE_PIL and extract.ocr_available(), "tesseract/pytesseract not available")
    def test_ocr_image(self):
        buf = io.BytesIO(); image_with_text().save(buf, "PNG")
        r = extract.extract(buf.getvalue(), "image/png")
        self.assertTrue(r["ocr_used"]); self.assertIn("lights", r["text"].lower()); self.assertIn("ward", r["text"].lower())

    @unittest.skipUnless(HAVE_PIL and extract.ocr_available(), "tesseract/pytesseract not available")
    def test_scanned_pdf_falls_back_to_ocr(self):
        buf = io.BytesIO(); image_with_text().save(buf, "PDF")  # image-only PDF: no text layer
        r = extract.extract(buf.getvalue(), "application/pdf")
        self.assertEqual(r["method"], "ocr", r["warnings"]); self.assertIn("register", r["text"].lower())

    def test_unsupported_and_corrupt(self):
        self.assertIn("Unsupported", extract.extract(b"x", "application/zip")["warnings"][0])
        r = extract.extract(b"not a pdf", "application/pdf", ocr=False); self.assertEqual(r["text"], ""); self.assertTrue(r["warnings"])

    def test_ocr_disabled_reports_missing_text_layer_honestly(self):
        with mock.patch.object(extract, "ocr_available", return_value=False):
            buf = io.BytesIO(); Image.new("RGB", (200, 100), "white").save(buf, "PDF") if HAVE_PIL else None
            if HAVE_PIL:
                r = extract.extract(buf.getvalue(), "application/pdf")
                self.assertEqual(r["text"], ""); self.assertTrue(any("OCR" in w for w in r["warnings"]))


class TranslateTests(unittest.TestCase):
    def setUp(self):
        translate.set_test_engine(None)
        for k in ("LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"):
            os.environ.pop(k, None)

    def test_unavailable_when_nothing_configured(self):
        with self.assertRaises(translate.TranslationUnavailable):
            translate.translate("मुझे जानकारी चाहिए")

    def test_llm_engine_is_labelled(self):
        os.environ.update(LLM_PROVIDER="openai", LLM_API_KEY="k", LLM_MODEL="m")
        with mock.patch.object(rg, "call_llm", return_value="I need information"):
            r = translate.translate("मुझे जानकारी चाहिए")
        self.assertEqual(r, {"translation": "I need information", "engine": "llm:openai/m"})

    def test_llm_failure_is_reported_not_hidden(self):
        os.environ.update(LLM_PROVIDER="openai", LLM_API_KEY="k", LLM_MODEL="m")
        with mock.patch.object(rg, "call_llm", side_effect=urllib.error.URLError("down")):
            with self.assertRaises(translate.TranslationUnavailable):
                translate.translate("नमस्ते")


class AssistantTests(unittest.TestCase):
    ENTRIES = [{"id": "fees", "title": "Is there a fee?", "text": "A small fee is usually charged.", "steps": []}]

    def setUp(self):
        for k in ("LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"):
            os.environ.pop(k, None)

    def test_no_llm_returns_mode_not_an_invented_answer(self):
        r = assistant.run("answer", "Is there a fee?", [], self.ENTRIES)
        self.assertEqual(r["mode"], "no-llm"); self.assertIsNone(r["reply"])

    def test_prompt_is_grounded_and_forbids_inventing(self):
        system, user = assistant.build_prompt("answer", "Fee?", [{"role": "user", "content": "hi"}], self.ENTRIES)
        self.assertIn("NEVER invent", system); self.assertIn("[fees]", user); self.assertIn("USER: Fee?", user)
        s2, u2 = assistant.build_prompt("rewrite", "improve", [], [], draft="give me everything")
        self.assertIn("CITIZEN DRAFT REQUEST", u2); self.assertIn("[add detail]", s2)

    def test_llm_success_and_failure_modes(self):
        os.environ.update(LLM_PROVIDER="openai", LLM_API_KEY="k", LLM_MODEL="m")
        with mock.patch.object(rg, "call_llm", return_value="A small fee is usually charged."):
            self.assertEqual(assistant.run("answer", "fee?", [], self.ENTRIES)["mode"], "llm:openai/m")
        with mock.patch.object(rg, "call_llm", side_effect=urllib.error.URLError("x")):
            r = assistant.run("answer", "fee?", [], self.ENTRIES); self.assertEqual(r["mode"], "llm-error"); self.assertIsNone(r["reply"])


class KnowledgeBaseTests(unittest.TestCase):
    def test_entries_are_well_formed_and_make_no_contact_claims(self):
        import json, re
        with open(os.path.join(os.path.dirname(__file__), "..", "data", "rti_knowledge.json"), encoding="utf-8") as fh:
            kb = json.load(fh)
        ids = [e["id"] for e in kb["entries"]]; self.assertEqual(len(ids), len(set(ids))); self.assertGreaterEqual(len(ids), 25)
        blob = json.dumps(kb)
        self.assertFalse(re.search(r"https?://|www\.|@[a-z]+\.|\+91|\b\d{10}\b", blob), "KB must not contain URLs, emails or phone numbers")
        for e in kb["entries"]:
            self.assertTrue(e["title"] and e["text"] and e["keywords"], e["id"])
            self.assertIsInstance(e["keywords"], list, e["id"])
            self.assertTrue(all(isinstance(k, str) for k in e["keywords"]), e["id"])
            self.assertIn(e["type"], ("faq", "guide", "glossary"))


if __name__ == "__main__":
    unittest.main()

"""Offline unit tests (stdlib unittest + numpy). Run from ai-service/:  python -m unittest discover -s tests -v

NOTE: the real all-MiniLM-L6-v2 model is NOT exercised here. Tests that cover the embedding code path use a
deterministic hashed bag-of-words stand-in (FakeEmbedder) purely to test ranking/caching logic.
Tests of the fallback paths run for real when sentence-transformers is not installed.
"""
import hashlib
import os
import sys
import unittest
import urllib.error
from unittest import mock

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import classifier, department_matcher, embeddings, response_generator, semantic_search, textutil  # noqa: E402


def fake_embedder(texts, dim=256):
    out = []
    for t in texts:
        v = np.zeros(dim)
        for tok in textutil.tokenize(t):
            v[int(hashlib.md5(tok.encode()).hexdigest(), 16) % dim] += 1.0
        n = np.linalg.norm(v)
        out.append(v / n if n else v)
    return np.array(out)


RECORDS = [
    {"id": "r1", "record_id": "DEMO-HIST-001", "title": "Street light maintenance in Ward 7", "department": "Municipal Corporation (DEMO)", "category": "Municipal services",
     "application_summary": "Asked for the number of street lights repaired in Ward 7 during 2023.", "response_summary": "The ward office reported 112 street lights repaired in 2023. Maintenance expenditure was recorded in the ward register."},
    {"id": "r2", "record_id": "DEMO-HIST-002", "title": "Scholarship disbursement for government schools", "department": "Education Department (DEMO)", "category": "Education",
     "application_summary": "Asked for scholarship funds disbursed to students.", "response_summary": "Scholarship funds were disbursed in two instalments to eligible students."},
    {"id": "r3", "record_id": "DEMO-HIST-003", "title": "Borewell water quality testing", "department": "Water Board (DEMO)", "category": "Water supply",
     "application_summary": "Requested drinking water quality reports.", "response_summary": "Samples from borewells were tested quarterly by the water board laboratory."},
]
DEPTS = [
    {"id": "d1", "name": "Municipal Corporation (DEMO)", "description": "Garbage, street lights, sanitation and civic services", "categories": ["Municipal services"], "active": True},
    {"id": "d2", "name": "Education Department (DEMO)", "description": "Schools, colleges and scholarships", "categories": ["Education"], "active": True},
    {"id": "d3", "name": "Water Board (DEMO)", "description": "Drinking water supply and quality", "categories": ["Water supply"], "active": True},
]


class TextUtilTests(unittest.TestCase):
    def test_tokenize_drops_stopwords_and_stems_plurals(self):
        self.assertEqual(textutil.tokenize("The street lights of the ward"), ["street", "light", "ward"])

    def test_tfidf_ranks_relevant_doc_first(self):
        sims = textutil.tfidf_cosine("street lights repaired in ward", [textutil_doc for textutil_doc in ["scholarship for students", "street lights repair ward office", "water quality"]])
        self.assertEqual(int(np.argmax(sims)), 1)
        self.assertTrue(0 <= sims.max() <= 1.0001)


class FallbackPathTests(unittest.TestCase):
    """Runs the genuine fallback code (no embedding model available in this sandbox)."""

    def setUp(self):
        embeddings.set_test_embedder(None)
        if embeddings.is_available():
            self.skipTest("real embedding model present; fallback tests not applicable")

    def test_keyword_classifier_categories(self):
        cases = {
            "Please give details of scholarship amounts paid to students of the government college": "Education",
            "How many ambulances and doctors are at the district hospital": "Healthcare",
            "Tender and contractor details for the bridge construction": "Infrastructure",
            "Crop insurance and fertiliser subsidy paid to farmers": "Agriculture",
            "I want to know my favourite colour is purple and the moon is far": "Other",
        }
        for text, expected in cases.items():
            res = classifier.classify("Request", text)
            self.assertEqual(res["category"], expected, text)
            self.assertEqual(res["method"], "keyword-fallback")
            self.assertIn("not a probability", res["score_type"])

    def test_tfidf_fallback_search_labelled_and_ranked(self):
        res = semantic_search.search("How many street lights were repaired in ward 7?", [dict(r) for r in RECORDS])
        self.assertIn("TF-IDF", res["method"])
        self.assertEqual(res["results"][0]["record_id"], "DEMO-HIST-001")
        self.assertEqual(res["new_embeddings"], {})
        self.assertLessEqual(len(res["results"]), 3)

    def test_embed_raises_when_unavailable(self):
        with self.assertRaises(embeddings.EmbeddingUnavailable):
            embeddings.embed(["hello"])


class EmbeddingPathTests(unittest.TestCase):
    """Embedding code path with a deterministic STAND-IN embedder (not the real model)."""

    def setUp(self):
        embeddings.set_test_embedder(fake_embedder)
        classifier._centroids.update(matrix=None)

    def tearDown(self):
        embeddings.set_test_embedder(None)
        classifier._centroids.update(matrix=None)

    def test_search_computes_and_reuses_embeddings(self):
        recs = [dict(r) for r in RECORDS]
        first = semantic_search.search("street lights repaired in ward 7", recs)
        self.assertEqual(set(first["new_embeddings"]), {"r1", "r2", "r3"})
        self.assertEqual(first["results"][0]["record_id"], "DEMO-HIST-001")
        sims = [r["similarity"] for r in first["results"]]
        self.assertEqual(sims, sorted(sims, reverse=True))
        # second call: stored embeddings (with matching model name) are reused, nothing recomputed
        stored = [dict(r, embedding=first["new_embeddings"][r["id"]], embedding_model=embeddings.MODEL_NAME) for r in RECORDS]
        second = semantic_search.search("scholarship money for students", stored)
        self.assertEqual(second["new_embeddings"], {})
        self.assertEqual(second["results"][0]["record_id"], "DEMO-HIST-002")

    def test_embeddings_from_other_model_are_recomputed(self):
        stale = [dict(r, embedding=[0.1] * 5, embedding_model="some-other-model") for r in RECORDS]
        res = semantic_search.search("water quality reports borewell", stale)
        self.assertEqual(len(res["new_embeddings"]), 3)
        self.assertEqual(res["results"][0]["record_id"], "DEMO-HIST-003")

    def test_classifier_embedding_path(self):
        res = classifier.classify("Scholarship", "Details of scholarship disbursed to students of the government school")
        self.assertEqual(res["category"], "Education")
        self.assertEqual(res["method"], "embedding+keywords")


class DepartmentTests(unittest.TestCase):
    def test_recommends_department_handling_category(self):
        res = department_matcher.recommend("Water supply", "drinking water quality borewell", DEPTS, [{"department": "Water Board (DEMO)"}])
        self.assertEqual(res["recommended"]["id"], "d3")
        self.assertIn("Water supply", res["reason"])
        self.assertLessEqual(len(res["alternatives"]), 2)

    def test_no_departments(self):
        self.assertIsNone(department_matcher.recommend("Other", "x", [])["recommended"])

    def test_flags_citizen_selection_mismatch(self):
        res = department_matcher.recommend("Education", "scholarship students", DEPTS, selected_department="d1")
        self.assertIn("citizen selected a different department", res["reason"])


class ResponseGeneratorTests(unittest.TestCase):
    APP = {"application_id": "RTI-2026-TEST01", "subject": "Street light repairs",
           "description": "Please provide the number of street lights repaired in Ward 7 during 2023. Also provide the name of the contractor and the total amount paid."}
    RETRIEVED = [{"record_id": "DEMO-HIST-001", "title": "Street light maintenance in Ward 7", "department": "Municipal Corporation (DEMO)", "similarity": 0.7,
                  "extracted_information": "The ward office reported 112 street lights repaired in 2023.", "response_summary": RECORDS[0]["response_summary"]}]

    def setUp(self):
        for k in ("LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL", "LLM_BASE_URL"):
            os.environ.pop(k, None)

    def test_template_mode_is_labelled_and_flags_gaps(self):
        out = response_generator.generate(self.APP, "Municipal services", "Municipal Corporation (DEMO)", self.RETRIEVED)
        self.assertEqual(out["generation_mode"], "template-fallback")
        text = out["draft"]["draft_text"]
        self.assertIn("NO LLM USED", text)
        self.assertTrue(any("contractor" in m.lower() for m in out["draft"]["missing_information"]))
        self.assertTrue(out["draft"]["identified_information"])
        self.assertIn("TO BE VERIFIED BY OFFICER", text)
        self.assertIn("Not verified", out["disclaimer"])

    def test_no_records_means_everything_missing(self):
        out = response_generator.generate(self.APP, "Municipal services", "Municipal Corporation (DEMO)", [])
        self.assertEqual(out["draft"]["identified_information"], [])
        self.assertTrue(out["draft"]["missing_information"])
        self.assertIn("weakly similar", out["draft"]["verification_notes"][0])

    def test_llm_success_marks_mode(self):
        os.environ.update(LLM_PROVIDER="openai", LLM_API_KEY="k", LLM_MODEL="m")
        with mock.patch.object(response_generator, "call_llm", return_value="Dear applicant, ...") as m:
            out = response_generator.generate(self.APP, "Municipal services", "Dept", self.RETRIEVED)
        self.assertEqual(out["generation_mode"], "llm:openai/m")
        self.assertEqual(out["draft"]["draft_text"], "Dear applicant, ...")
        self.assertIn("CONTEXT RECORDS", m.call_args[0][1])

    def test_llm_failure_falls_back_and_says_so(self):
        os.environ.update(LLM_PROVIDER="openai", LLM_API_KEY="k", LLM_MODEL="m")
        with mock.patch.object(response_generator, "call_llm", side_effect=urllib.error.URLError("boom")):
            out = response_generator.generate(self.APP, "Municipal services", "Dept", self.RETRIEVED)
        self.assertEqual(out["generation_mode"], "template-fallback")
        self.assertIn("LLM call failed", out["llm_error"])

    def test_provider_without_key_reports_configuration_problem(self):
        os.environ.update(LLM_PROVIDER="openai")
        out = response_generator.generate(self.APP, "Other", "Dept", [])
        self.assertEqual(out["generation_mode"], "template-fallback")
        self.assertIn("missing", out["llm_error"])


if __name__ == "__main__":
    unittest.main()

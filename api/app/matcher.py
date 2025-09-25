"""Semantic matcher implementations."""

from __future__ import annotations

import json
import logging
from typing import Iterable, List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .models import CanonicalValue, SystemConfig
from .schemas import MatchCandidate

LOGGER = logging.getLogger(__name__)


class SemanticMatcher:
    """Selects the appropriate semantic matcher implementation."""

    def __init__(self, config: SystemConfig, canonical_values: Iterable[CanonicalValue]):
        self.config = config
        self.canonical_values = list(canonical_values)

    def rank(self, raw_text: str) -> List[MatchCandidate]:
        """Rank canonical values given raw input text."""

        if not raw_text.strip():
            return []

        if self.config.matcher_backend == "llm":
            llm_rankings = self._rank_with_llm(raw_text)
            if llm_rankings:
                return llm_rankings

        return self._rank_with_embeddings(raw_text)

    def _rank_with_embeddings(self, raw_text: str) -> List[MatchCandidate]:
        """Score matches using embedding cosine similarity."""

        if not self.canonical_values:
            return []

        try:
            sentences = [raw_text] + [self._canonical_as_sentence(cv) for cv in self.canonical_values]
            vectorizer = TfidfVectorizer().fit(sentences)
            embeddings = vectorizer.transform(sentences)
            scores = cosine_similarity(embeddings[0], embeddings[1:]).flatten()
        except Exception:  # pragma: no cover - defensive
            LOGGER.warning(
                "Falling back to lexical similarity because TF-IDF vectorization failed",
            )
            return self._rank_with_lexical(raw_text)

        matches = []
        for canonical, score in zip(self.canonical_values, scores):
            scaled = float(max(0.0, min(1.0, score)))
            matches.append(
                MatchCandidate(
                    canonical_id=canonical.id or 0,
                    canonical_label=canonical.canonical_label,
                    dimension=canonical.dimension,
                    description=canonical.description,
                    score=round(scaled, 4),
                )
            )

        matches.sort(key=lambda item: item.score, reverse=True)
        top_k = max(1, self.config.top_k or 5)
        return matches[:top_k]

    def _rank_with_lexical(self, raw_text: str) -> List[MatchCandidate]:
        """Fallback matcher using normalized token overlap."""

        raw_tokens = self._tokenize(raw_text)
        if not raw_tokens:
            return []

        candidates: list[MatchCandidate] = []
        for canonical in self.canonical_values:
            canonical_tokens = self._tokenize(self._canonical_as_sentence(canonical))
            if not canonical_tokens:
                continue
            overlap = len(raw_tokens & canonical_tokens)
            union = len(raw_tokens | canonical_tokens)
            score = float(overlap / union) if union else 0.0
            candidates.append(
                MatchCandidate(
                    canonical_id=canonical.id or 0,
                    canonical_label=canonical.canonical_label,
                    dimension=canonical.dimension,
                    description=canonical.description,
                    score=round(score, 4),
                )
            )

        candidates.sort(key=lambda item: item.score, reverse=True)
        top_k = max(1, self.config.top_k or 5)
        return candidates[:top_k]

    def _rank_with_llm(self, raw_text: str) -> List[MatchCandidate]:
        """Use an LLM to score match candidates when configured."""

        if not self.config.llm_api_key or not self.config.llm_model:
            LOGGER.warning("LLM backend configured without API credentials; falling back to embeddings")
            return []

        try:
            import openai
        except ImportError:  # pragma: no cover - dependency missing in some environments
            LOGGER.warning("openai package not available; falling back to embeddings")
            return []

        openai.api_key = self.config.llm_api_key
        if self.config.llm_api_base:
            openai.api_base = self.config.llm_api_base

        options = [
            {
                "id": canonical.id,
                "label": canonical.canonical_label,
                "dimension": canonical.dimension,
                "description": canonical.description or "",
            }
            for canonical in self.canonical_values
        ]

        prompt = (
            "You are assisting with semantic data harmonization. Given a raw value, "
            "rank the following canonical options from best to worst match. "
            "Respond with a JSON array of objects containing 'id' and 'score' (0-1).\n\n"
            f"Raw value: {raw_text}\n\n"
            f"Canonical options: {json.dumps(options, ensure_ascii=False)}"
        )

        try:
            response = openai.ChatCompletion.create(
                model=self.config.llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You respond only with JSON and never with additional text.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
            )
            content = response["choices"][0]["message"]["content"]
            data = json.loads(content)
        except Exception as exc:  # pragma: no cover - network/LLM errors not under test
            LOGGER.warning("LLM ranking failed: %s", exc)
            return []

        results = []
        for item in data:
            canonical = next((c for c in self.canonical_values if c.id == item.get("id")), None)
            if not canonical:
                continue
            score = float(item.get("score", 0))
            score = max(0.0, min(1.0, score))
            results.append(
                MatchCandidate(
                    canonical_id=canonical.id or 0,
                    canonical_label=canonical.canonical_label,
                    dimension=canonical.dimension,
                    description=canonical.description,
                    score=round(score, 4),
                )
            )

        results.sort(key=lambda item: item.score, reverse=True)
        top_k = max(1, self.config.top_k or 5)
        return results[:top_k]

    @staticmethod
    def _canonical_as_sentence(canonical: CanonicalValue) -> str:
        if canonical.description:
            return f"{canonical.canonical_label}. {canonical.description}"
        return canonical.canonical_label

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        tokens = {token.lower() for token in text.replace('-', ' ').split() if token}
        return tokens

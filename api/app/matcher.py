"""Semantic matcher implementations."""

from __future__ import annotations

import json
import logging
from typing import Any, Iterable, List

import httpx
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

        normalised_raw = raw_text.strip().casefold()

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
            if canonical.canonical_label.strip().casefold() == normalised_raw:
                scaled = 1.0
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

        normalised_raw = raw_text.strip().casefold()

        candidates: list[MatchCandidate] = []
        for canonical in self.canonical_values:
            canonical_tokens = self._tokenize(self._canonical_as_sentence(canonical))
            if not canonical_tokens:
                continue
            overlap = len(raw_tokens & canonical_tokens)
            union = len(raw_tokens | canonical_tokens)
            score = float(overlap / union) if union else 0.0
            if canonical.canonical_label.strip().casefold() == normalised_raw:
                score = 1.0
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

        if not self.canonical_values:
            return []

        mode = (self.config.llm_mode or "online").lower()
        if mode == "offline":
            return self._rank_with_ollama(raw_text)
        return self._rank_with_openai(raw_text)

    def _rank_with_openai(self, raw_text: str) -> List[MatchCandidate]:
        """Call an OpenAI-compatible API to score candidates."""

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

        prompt = self._build_llm_prompt(raw_text)

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
        except Exception as exc:  # pragma: no cover - network/LLM errors not under test
            LOGGER.warning("LLM ranking failed: %s", exc)
            return []

        rankings = self._parse_llm_json(content)
        return self._build_matches_from_rankings(rankings)

    def _rank_with_ollama(self, raw_text: str) -> List[MatchCandidate]:
        """Call a local Ollama instance to score candidates."""

        base_url = (self.config.llm_api_base or "http://ollama:11434").rstrip("/")
        model = self.config.llm_model or "llama3"
        endpoint = f"{base_url}/api/chat"
        payload = {
            "model": model,
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": "You respond only with JSON and never with additional text.",
                },
                {"role": "user", "content": self._build_llm_prompt(raw_text)},
            ],
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(endpoint, json=payload)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:  # pragma: no cover - network/LLM errors not under test
            LOGGER.warning("Ollama ranking failed: %s", exc)
            return []

        content = ""
        if isinstance(data, dict):
            if isinstance(data.get("message"), dict):
                content = data["message"].get("content", "")
            elif "response" in data:
                content = str(data.get("response", ""))

        if not content:
            LOGGER.warning("Ollama response missing usable content; falling back to embeddings")
            return []

        rankings = self._parse_llm_json(content)
        return self._build_matches_from_rankings(rankings)

    def _build_llm_prompt(self, raw_text: str) -> str:
        options = self._build_llm_options()
        if not options:
            LOGGER.warning("LLM backend has no canonical options to evaluate")
        header = (
            "You are assisting with semantic data harmonization. Given a raw value, "
            "rank the following canonical options from best to worst match. "
            "Respond with a JSON array of objects containing 'id' and 'score' (0-1)."
        )
        return header + f"\n\nRaw value: {raw_text}\n\n" + (
            f"Canonical options: {json.dumps(options, ensure_ascii=False)}"
        )

    def _build_llm_options(self) -> list[dict[str, Any]]:
        options: list[dict[str, Any]] = []
        for canonical in self.canonical_values:
            if canonical.id is None:
                continue
            options.append(
                {
                    "id": canonical.id,
                    "label": canonical.canonical_label,
                    "dimension": canonical.dimension,
                    "description": canonical.description or "",
                }
            )
        return options

    def _build_matches_from_rankings(self, rankings: list[dict[str, Any]]) -> List[MatchCandidate]:
        if not rankings:
            return []

        lookup = {
            canonical.id: canonical
            for canonical in self.canonical_values
            if canonical.id is not None
        }

        results: list[MatchCandidate] = []
        for item in rankings:
            if not isinstance(item, dict):
                continue
            canonical = lookup.get(item.get("id"))
            if not canonical:
                continue
            try:
                score = float(item.get("score", 0))
            except (TypeError, ValueError):
                continue
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

    def _parse_llm_json(self, content: str) -> list[dict[str, Any]]:
        text = (content or "").strip()
        if not text:
            return []

        if text.startswith("```"):
            stripped = text.strip("`")
            parts = stripped.split("\n", 1)
            text = parts[1] if len(parts) > 1 else parts[0]
            text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            start = text.find("[")
            end = text.rfind("]")
            if start == -1 or end == -1 or end <= start:
                LOGGER.warning("LLM response was not valid JSON")
                return []
            snippet = text[start : end + 1]
            try:
                data = json.loads(snippet)
            except json.JSONDecodeError:
                LOGGER.warning("LLM response snippet was not valid JSON")
                return []

        if isinstance(data, dict):
            if isinstance(data.get("results"), list):
                data = data["results"]
            else:
                LOGGER.warning("LLM JSON payload did not contain a rankings list")
                return []

        if not isinstance(data, list):
            LOGGER.warning("LLM response payload is not a list")
            return []

        return [item for item in data if isinstance(item, dict)]

    @staticmethod
    def _canonical_as_sentence(canonical: CanonicalValue) -> str:
        if canonical.description:
            return f"{canonical.canonical_label}. {canonical.description}"
        return canonical.canonical_label

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        tokens = {token.lower() for token in text.replace('-', ' ').split() if token}
        return tokens

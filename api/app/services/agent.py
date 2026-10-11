"""Agentic harmonization service backed by an LLM tool-calling loop."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Optional

import httpx
from sqlalchemy.sql import func
from sqlmodel import Session, select

from ..matcher import SemanticMatcher
from ..models import (
    CanonicalValue,
    Dimension,
    RawValue,
    SystemConfig,
    ValueMapping,
)
from ..schemas import AgentRunResult, AgentStep, AgentToolCall

LOGGER = logging.getLogger(__name__)

DEFAULT_MAX_STEPS = 8
HARD_MAX_STEPS = 20

AGENT_TOOLS: list[dict[str, Any]] = [
    {
        "name": "rank_matches",
        "description": (
            "Rank canonical values for a raw input text using the configured "
            "semantic matcher. Returns scored candidates with their canonical ids."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "raw_text": {
                    "type": "string",
                    "description": "Unstandardized raw value to match.",
                },
                "dimension": {
                    "type": "string",
                    "description": "Optional dimension code to scope the candidates.",
                },
            },
            "required": ["raw_text"],
        },
    },
    {
        "name": "list_canonical_values",
        "description": "List canonical values (ids, labels, descriptions) for a dimension.",
        "parameters": {
            "type": "object",
            "properties": {
                "dimension": {
                    "type": "string",
                    "description": "Dimension code. Defaults to the system default dimension.",
                },
            },
        },
    },
    {
        "name": "list_dimensions",
        "description": "List all configured canonical dimensions.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "propose_mapping",
        "description": (
            "Store an advisory raw-value-to-canonical mapping for human review. "
            "The mapping is always persisted in a pending/suggested state; the "
            "agent can never approve a mapping directly."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "raw_value": {
                    "type": "string",
                    "description": "The unstandardized raw value being harmonized.",
                },
                "canonical_id": {
                    "type": "integer",
                    "description": "Identifier of the canonical value to suggest.",
                },
                "confidence": {
                    "type": "number",
                    "description": "Agent confidence in the suggestion between 0 and 1.",
                },
                "notes": {
                    "type": "string",
                    "description": "Short rationale captured for the reviewer.",
                },
            },
            "required": ["raw_value", "canonical_id"],
        },
    },
    {
        "name": "flag_for_review",
        "description": (
            "Record a raw value that cannot be confidently matched and queue it "
            "for manual reviewer attention."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "raw_value": {
                    "type": "string",
                    "description": "The raw value awaiting manual review.",
                },
                "reason": {
                    "type": "string",
                    "description": "Why the value could not be matched automatically.",
                },
                "dimension": {
                    "type": "string",
                    "description": "Optional dimension code for the flagged value.",
                },
            },
            "required": ["raw_value"],
        },
    },
    {
        "name": "finish",
        "description": "End the run with a concise human-readable summary of the outcome.",
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Summary of the harmonization decision.",
                },
            },
            "required": ["summary"],
        },
    },
]

SYSTEM_POLICY = (
    "You are the RefData Hub harmonization agent. Standardize raw reference data "
    "values onto canonical dimensions. You operate in advisory mode only: you may "
    "record pending suggestions for human reviewers, but you must never approve, "
    "reject, or modify canonical data directly. Inspect candidates with the "
    "read-only tools, record your best proposal with propose_mapping (or "
    "flag_for_review when no candidate is convincing), then call finish with a "
    "short summary."
)


class AgentError(RuntimeError):
    """Raised when the agent run cannot continue."""


class AgentToolError(ValueError):
    """Raised when a tool call is invalid; the message is fed back to the model."""


@dataclass(slots=True)
class AgentSourceContext:
    """Optional source-system context recorded with proposed mappings."""

    source_connection_id: int
    source_table: str
    source_field: str


def _extract_json_object(text: str) -> Any:
    """Parse the first JSON object found in ``text`` tolerantly."""

    stripped = (text or "").strip()
    if not stripped:
        return None

    if stripped.startswith("```"):
        body = stripped.strip("`")
        parts = body.split("\n", 1)
        stripped = (parts[1] if len(parts) > 1 else parts[0]).strip()

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    start = stripped.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(stripped)):
        char = stripped[index]
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(stripped[start : index + 1])
                except json.JSONDecodeError:
                    return None
    return None


def parse_agent_tool_response(content: str) -> Optional[AgentToolCall]:
    """Parse a JSON tool-call object emitted by a non-function-calling model."""

    data = _extract_json_object(content)
    if not isinstance(data, dict):
        return None

    name = data.get("tool") or data.get("name") or data.get("function")
    if not isinstance(name, str) or not name.strip():
        return None

    raw_arguments = data.get("arguments")
    if raw_arguments is None:
        raw_arguments = data.get("args")
    if raw_arguments is None:
        raw_arguments = data.get("parameters", {})
    if isinstance(raw_arguments, str):
        try:
            raw_arguments = json.loads(raw_arguments)
        except json.JSONDecodeError:
            raw_arguments = {}
    arguments = raw_arguments if isinstance(raw_arguments, dict) else {}
    return AgentToolCall(name=name.strip(), arguments=arguments)


def request_llm_turn(
    config: SystemConfig, messages: list[dict[str, Any]]
) -> tuple[Optional[AgentToolCall], str]:
    """Ask the configured LLM for the next agent action."""

    mode = (config.llm_mode or "online").lower()
    if mode == "offline":
        return _request_offline_turn(config, messages)
    return _request_online_turn(config, messages)


def _request_online_turn(
    config: SystemConfig, messages: list[dict[str, Any]]
) -> tuple[Optional[AgentToolCall], str]:
    """Use an OpenAI-compatible chat API with native function calling."""

    if not config.llm_api_key or not config.llm_model:
        raise AgentError(
            "The online LLM backend is configured without API credentials; "
            "set the API key in Settings or switch to offline mode."
        )

    try:
        import openai
    except ImportError as exc:  # pragma: no cover - dependency availability
        raise AgentError("openai package is not available in this environment.") from exc

    openai.api_key = config.llm_api_key
    if config.llm_api_base:
        openai.api_base = config.llm_api_base

    try:
        response = openai.ChatCompletion.create(
            model=config.llm_model,
            messages=messages,
            functions=AGENT_TOOLS,
            function_call="auto",
            temperature=0,
        )
        choices = response["choices"]
        message = choices[0]["message"]
    except AgentError:
        raise
    except Exception as exc:  # pragma: no cover - network/provider failures
        raise AgentError(f"Online LLM request failed: {exc}") from exc

    content = str(message.get("content") or "")
    function_call = message.get("function_call")
    if not function_call:
        parsed = parse_agent_tool_response(content)
        return parsed, content

    name = str(function_call.get("name") or "")
    raw_arguments = function_call.get("arguments") or "{}"
    if isinstance(raw_arguments, str):
        try:
            arguments = json.loads(raw_arguments)
        except json.JSONDecodeError:
            arguments = {}
    else:
        arguments = dict(raw_arguments)
    if not name or not isinstance(arguments, dict):
        return None, content
    return AgentToolCall(name=name, arguments=arguments), content


def _request_offline_turn(
    config: SystemConfig, messages: list[dict[str, Any]]
) -> tuple[Optional[AgentToolCall], str]:
    """Use a local Ollama instance with a JSON tool protocol prompt."""

    base_url = (config.llm_api_base or "http://ollama:11434").rstrip("/")
    model = config.llm_model or "smollm:135m"
    endpoint = f"{base_url}/api/chat"
    payload = {"model": model, "stream": False, "messages": messages}

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # pragma: no cover - network/provider failures
        raise AgentError(f"Offline LLM request failed: {exc}") from exc

    content = ""
    if isinstance(data, dict):
        if isinstance(data.get("message"), dict):
            content = str(data["message"].get("content") or "")
        elif "response" in data:
            content = str(data.get("response") or "")

    if not content:
        raise AgentError("Ollama response did not contain usable content.")

    return parse_agent_tool_response(content), content


class AgentEngine:
    """Runs a bounded tool-calling loop to harmonize raw values advisively."""

    def __init__(self, session: Session, config: SystemConfig):
        self.session = session
        self.config = config
        self.source_context: Optional[AgentSourceContext] = None
        self._dimension_code: Optional[str] = None
        self._suggested_canonical_id: Optional[int] = None

    def run(
        self,
        raw_text: str,
        dimension: Optional[str] = None,
        max_steps: Optional[int] = None,
        source_context: Optional[AgentSourceContext] = None,
    ) -> AgentRunResult:
        """Execute the agent loop for a single raw value."""

        self.source_context = source_context
        self._dimension_code = dimension or self.config.default_dimension
        self._suggested_canonical_id = None

        limit = min(max_steps or DEFAULT_MAX_STEPS, HARD_MAX_STEPS)
        transcript: list[tuple[str, Optional[AgentToolCall], Any]] = []
        steps: list[AgentStep] = []

        status_value: str = "incomplete"
        summary: Optional[str] = None
        error: Optional[str] = None

        for index in range(limit):
            try:
                call, content = request_llm_turn(
                    self.config, self._build_messages(raw_text, transcript)
                )
            except AgentError as exc:
                status_value = "error"
                error = str(exc)
                LOGGER.warning("Agent run for '%s' failed: %s", raw_text, exc)
                break

            if call is None:
                observation = {
                    "error": (
                        "No tool call found in the model response. Reply with a "
                        "tool call or finish."
                    )
                }
                transcript.append((content or "", None, observation))
                steps.append(
                    AgentStep(index=index + 1, tool="<none>", arguments={}, observation=observation)
                )
                continue

            if call.name == "finish":
                summary = str(call.arguments.get("summary") or content or "Agent finished.")
                status_value = "completed"
                steps.append(
                    AgentStep(
                        index=index + 1,
                        tool="finish",
                        arguments=call.arguments,
                        observation={"summary": summary},
                    )
                )
                break

            observation = self._execute(call)
            transcript.append((content or "", call, observation))
            steps.append(
                AgentStep(index=index + 1, tool=call.name, arguments=call.arguments, observation=observation)
            )

        return AgentRunResult(
            raw_text=raw_text,
            dimension=self._dimension_code or self.config.default_dimension,
            status=status_value,
            summary=summary,
            steps=steps,
            suggested_canonical_id=self._suggested_canonical_id,
            error=error,
        )

    # ------------------------------------------------------------------
    # Prompt assembly
    # ------------------------------------------------------------------

    def _is_offline(self) -> bool:
        return (self.config.llm_mode or "online").lower() == "offline"

    def _build_messages(
        self, raw_text: str, transcript: list[tuple[str, Optional[AgentToolCall], Any]]
    ) -> list[dict[str, Any]]:
        system_prompt = SYSTEM_POLICY
        if self._is_offline():
            system_prompt += (
                " Reply with a single JSON object of the form "
                '{"tool": "<tool name>", "arguments": {<arguments>}} and nothing '
                "else. Available tools: " + json.dumps(AGENT_TOOLS)
            )

        goal = (
            f"Harmonize the raw value '{raw_text}'. "
            f"Target dimension hint: {self._dimension_hint(raw_text)}."
        )

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": goal},
        ]

        for content, call, observation in transcript:
            if self._is_offline():
                assistant_content = content or json.dumps(
                    {"tool": call.name if call else "finish", "arguments": call.arguments if call else {}}
                )
                messages.append({"role": "assistant", "content": assistant_content})
                messages.append(
                    {"role": "user", "content": "Observation: " + json.dumps(observation)}
                )
                continue

            assistant_message: dict[str, Any] = {"role": "assistant", "content": content or None}
            if call is not None:
                assistant_message["function_call"] = {
                    "name": call.name,
                    "arguments": json.dumps(call.arguments),
                }
                messages.append(assistant_message)
                messages.append(
                    {"role": "function", "name": call.name, "content": json.dumps(observation)}
                )
            else:
                messages.append(assistant_message)
                messages.append({"role": "user", "content": "Observation: " + json.dumps(observation)})

        return messages

    def _dimension_hint(self, raw_text: str) -> str:
        if self._dimension_code:
            return self._dimension_code
        return self.config.default_dimension

    # ------------------------------------------------------------------
    # Tool execution
    # ------------------------------------------------------------------

    def _execute(self, call: AgentToolCall) -> Any:
        handlers = {
            "rank_matches": self._rank_matches,
            "list_canonical_values": self._list_canonical_values,
            "list_dimensions": self._list_dimensions,
            "propose_mapping": self._propose_mapping,
            "flag_for_review": self._flag_for_review,
        }
        handler: Optional[Callable[..., Any]] = handlers.get(call.name)
        if handler is None:
            return {
                "error": (
                    f"Unknown tool '{call.name}'. Available tools: "
                    + ", ".join(sorted(list(handlers) + ["finish"]))
                )
            }

        allowed = self._allowed_arguments(call.name)
        arguments = {key: value for key, value in call.arguments.items() if key in allowed}
        try:
            return handler(**arguments)
        except AgentToolError as exc:
            return {"error": str(exc)}
        except TypeError as exc:
            return {"error": f"Invalid arguments for {call.name}: {exc}"}
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.exception("Agent tool '%s' failed", call.name)
            return {"error": f"Tool '{call.name}' failed: {exc}"}

    @staticmethod
    def _allowed_arguments(tool_name: str) -> set[str]:
        for tool in AGENT_TOOLS:
            if tool["name"] == tool_name:
                return set(tool["parameters"].get("properties", {}))
        return set()

    def _dimension_codes(self) -> set[str]:
        return {dimension.code for dimension in self.session.exec(select(Dimension)).all()}

    def _require_dimension(self, requested: Optional[str]) -> str:
        codes = self._dimension_codes()
        if requested:
            if requested not in codes:
                raise AgentToolError(f"Unknown dimension '{requested}'.")
            return requested
        if self.config.default_dimension in codes:
            return self.config.default_dimension
        if codes:
            return sorted(codes)[0]
        raise AgentToolError("No dimensions are defined.")

    def _match_context(self, raw_text: str, requested: Optional[str]) -> tuple[str, list[CanonicalValue]]:
        """Resolve candidates, mirroring the propose endpoint fallbacks."""

        code = self._require_dimension(requested)
        canonicals = list(
            self.session.exec(
                select(CanonicalValue).where(CanonicalValue.dimension == code)
            ).all()
        )

        if not canonicals:
            exact = self.session.exec(
                select(CanonicalValue).where(
                    func.lower(CanonicalValue.canonical_label) == raw_text.strip().casefold()
                )
            ).first()
            if exact:
                code = exact.dimension
                canonicals = list(
                    self.session.exec(
                        select(CanonicalValue).where(CanonicalValue.dimension == code)
                    ).all()
                )

        if not canonicals:
            richest = self.session.exec(
                select(CanonicalValue.dimension)
                .group_by(CanonicalValue.dimension)
                .order_by(func.count(CanonicalValue.id).desc())
            ).first()
            dimension_value = richest[0] if isinstance(richest, tuple) else richest
            if dimension_value:
                code = str(dimension_value)
                canonicals = list(
                    self.session.exec(
                        select(CanonicalValue).where(CanonicalValue.dimension == code)
                    ).all()
                )

        return code, canonicals

    def _rank_matches(self, raw_text: str, dimension: Optional[str] = None) -> Any:
        text = (raw_text or "").strip()
        if not text:
            raise AgentToolError("rank_matches requires a non-empty raw_text.")

        code, canonicals = self._match_context(text, dimension)
        self._dimension_code = code
        matcher = SemanticMatcher(config=self.config, canonical_values=canonicals)
        ranked = matcher.rank(text)
        return {"dimension": code, "matches": [match.model_dump() for match in ranked]}

    def _list_canonical_values(self, dimension: Optional[str] = None) -> Any:
        code = self._require_dimension(dimension)
        canonicals = self.session.exec(
            select(CanonicalValue)
            .where(CanonicalValue.dimension == code)
            .order_by(CanonicalValue.canonical_label)
        ).all()
        return {
            "dimension": code,
            "values": [
                {
                    "canonical_id": canonical.id,
                    "canonical_label": canonical.canonical_label,
                    "description": canonical.description,
                }
                for canonical in canonicals
            ],
        }

    def _list_dimensions(self) -> Any:
        dimensions = self.session.exec(select(Dimension).order_by(Dimension.label)).all()
        return {
            "dimensions": [
                {
                    "code": dimension.code,
                    "label": dimension.label,
                    "description": dimension.description,
                }
                for dimension in dimensions
            ]
        }

    def _propose_mapping(
        self,
        raw_value: str,
        canonical_id: int,
        confidence: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> Any:
        text = (raw_value or "").strip()
        if not text:
            raise AgentToolError("propose_mapping requires a non-empty raw_value.")
        try:
            identifier = int(canonical_id)
        except (TypeError, ValueError):
            raise AgentToolError("propose_mapping requires an integer canonical_id.")

        canonical = self.session.get(CanonicalValue, identifier)
        if not canonical:
            raise AgentToolError(f"Canonical value {identifier} was not found.")

        score: Optional[float] = None
        if confidence is not None:
            try:
                score = max(0.0, min(1.0, float(confidence)))
            except (TypeError, ValueError):
                score = None

        self._suggested_canonical_id = canonical.id or None

        context = self.source_context
        if context is not None:
            mapping = ValueMapping(
                source_connection_id=context.source_connection_id,
                source_table=context.source_table,
                source_field=context.source_field,
                raw_value=text,
                canonical_id=canonical.id or 0,
                status="pending",
                confidence=score,
                suggested_label=canonical.canonical_label,
                notes=notes,
            )
            self.session.add(mapping)
            self.session.commit()
            self.session.refresh(mapping)
            return {
                "created": "value_mapping",
                "id": mapping.id,
                "status": mapping.status,
                "canonical_label": canonical.canonical_label,
                "dimension": canonical.dimension,
            }

        raw = RawValue(
            dimension=canonical.dimension,
            raw_text=text,
            status="suggested",
            proposed_canonical_id=canonical.id,
            notes=notes,
        )
        self.session.add(raw)
        self.session.commit()
        self.session.refresh(raw)
        return {
            "created": "raw_suggestion",
            "id": raw.id,
            "status": raw.status,
            "canonical_label": canonical.canonical_label,
            "dimension": canonical.dimension,
        }

    def _flag_for_review(
        self, raw_value: str, reason: Optional[str] = None, dimension: Optional[str] = None
    ) -> Any:
        text = (raw_value or "").strip()
        if not text:
            raise AgentToolError("flag_for_review requires a non-empty raw_value.")

        code = self._require_dimension(dimension)
        raw = RawValue(
            dimension=code,
            raw_text=text,
            status="pending",
            notes=reason,
        )
        self.session.add(raw)
        self.session.commit()
        self.session.refresh(raw)
        self._dimension_code = code
        return {"created": "raw_value", "id": raw.id, "status": raw.status, "dimension": code}

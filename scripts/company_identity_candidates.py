"""Build conservative, pending company-alias proposals from employer JSON."""

from __future__ import annotations

import argparse
import csv
import hashlib
from html.parser import HTMLParser
import json
import re
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from rapidfuzz import fuzz

IDENTIFIER_FIELDS = ("linkedin_company_url", "lei", "commercial_registration_number", "registration_authority", "wikidata_id")
PLACEHOLDER = re.compile(r"(confidential|undisclosed|anonymous|stealth|not disclosed)", re.I)
AGENCY = re.compile(r"\b(recruit(?:ment|er)?|staffing|manpower|headhunt(?:ing)?|talent|jobs via)\b", re.I)
PLATFORM_DOMAINS = (
    "linkedin.com", "indeed.com", "glassdoor.com", "bayt.com", "gulftalent.com",
    "naukrigulf.com", "monster.com", "ziprecruiter.com", "careerbuilder.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com", "google.com",
)
NAME_BLOCK_STOPWORDS = {"company", "group", "holding", "holdings", "limited", "ltd", "llc", "inc", "corp", "corporation", "saudi", "arabia", "the"}


def _domain(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip() or value.strip().casefold() in {"none", "null"}:
        return None
    host = urlsplit(value if "://" in value else f"//{value}").hostname
    if not host:
        return None
    host = host.casefold().rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    if "." not in host or any(host == blocked or host.endswith(f".{blocked}") for blocked in PLATFORM_DOMAINS):
        return None
    return host


def _keys(record: dict[str, Any], *, canonical: bool = False) -> list[tuple[str, str, str]]:
    keys: list[tuple[str, str, str]] = []
    linkedin = record.get("linkedin_company_url") if canonical else record.get("company_url")
    if isinstance(linkedin, str):
        try:
            parsed = urlsplit(linkedin)
            match = re.fullmatch(r"/company/([^/]+)/?", parsed.path, re.I)
            if parsed.hostname and (parsed.hostname == "linkedin.com" or parsed.hostname.endswith(".linkedin.com")) and match:
                keys.append(("linkedin", match.group(1).casefold(), "A"))
        except ValueError:
            pass
    lei = record.get("lei")
    if isinstance(lei, str) and re.fullmatch(r"[a-z\d]{20}", lei.strip(), re.I):
        keys.append(("lei", lei.strip().upper(), "A"))
    number = record.get("commercial_registration_number")
    authority = record.get("registration_authority")
    if isinstance(number, str) and number.strip() and isinstance(authority, str) and authority.strip():
        keys.append(("registration", f"{authority.strip().upper()}:{number.strip().upper()}", "A"))
    wikidata = record.get("wikidata_id")
    if isinstance(wikidata, str) and re.fullmatch(r"Q\d+", wikidata.strip(), re.I):
        keys.append(("wikidata", wikidata.strip().upper(), "A"))
    domain = _domain(record.get("website_domain" if canonical else "domain"))
    if domain:
        keys.append(("domain", domain, "B"))
    return keys


def _normal_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(re.sub(r"[^\w\s]", " ", value).split())


def _cities(record: dict[str, Any]) -> set[str]:
    values = record.get("cities") or []
    if not isinstance(values, list):
        values = [values]
    aliases = {"makkah": "mecca", "al makkah": "mecca", "madinah": "medina", "al madinah": "medina"}
    return {
        aliases.get(_normal_name(value), _normal_name(value)).title()
        for value in values if isinstance(value, str) and _normal_name(value) not in {"", "none", "null"}
    }


def _industry_similarity(left: Any, right: Any) -> float:
    if not isinstance(left, str) or not isinstance(right, str) or not left.strip() or not right.strip():
        return 0.0
    return fuzz.token_sort_ratio(_normal_name(left), _normal_name(right)) / 100


def _cluster_id(canonical_id: int, key: tuple[str, str, str]) -> str:
    digest = hashlib.sha256(f"{key[0]}:{key[1]}".encode()).hexdigest()[:16]
    return f"company:{canonical_id}:{digest}"


def build_candidates(employers: list[dict[str, Any]], identities: list[dict[str, Any]]) -> dict[str, Any]:
    identity_keys: dict[tuple[str, str], set[int]] = defaultdict(set)
    identity_by_id = {item["canonical_id"]: item for item in identities if isinstance(item.get("canonical_id"), int)}
    identity_names: dict[int, str] = {}
    for identity in identities:
        canonical_id = identity.get("canonical_id")
        if not isinstance(canonical_id, int):
            continue
        identity_names[canonical_id] = str(identity.get("canonical_label") or "")
        for kind, value, tier in _keys(identity, canonical=True):
            identity_keys[(kind, value)].add(canonical_id)

    by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    key_identifier_values: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for employer in employers:
        name = employer.get("company_name")
        if isinstance(name, str) and name.strip():
            by_name[name.strip()].append(employer)
        for kind, value, _ in _keys(employer):
            for other_kind, other_value, _ in _keys(employer):
                if other_kind != kind:
                    key_identifier_values[(kind, value)][other_kind].add(other_value)
    conflicting_cluster_keys = {
        key for key, values in key_identifier_values.items()
        if any(len(distinct_values) > 1 for distinct_values in values.values())
    }
    city_frequency = Counter(
        city for records in by_name.values()
        for city in set().union(*(_cities(record) for record in records))
    )

    proposals: list[dict[str, Any]] = []
    quarantined: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    for name, records in by_name.items():
        targets: set[int] = set()
        matches: list[dict[str, str]] = []
        evidence_keys: set[tuple[str, str, str]] = set()
        for record in records:
            for kind, value, tier in _keys(record):
                ids = identity_keys.get((kind, value), set())
                if len(ids) > 1:
                    targets.update(ids)
                    matches.append({"field": kind, "value": value, "tier": tier, "canonical_ids": sorted(ids)})
                elif ids:
                    targets.update(ids)
                    evidence_keys.add((kind, value, tier))
                    matches.append({"field": kind, "value": value, "tier": tier, "canonical_id": str(next(iter(ids)))})
        metadata = {
            "raw_value": name,
            "records": len(records),
            "jobs_seen": sum(int(record.get("jobs_seen") or 0) for record in records),
            "evidence": matches,
        }
        if len(targets) > 1:
            quarantined.append({**metadata, "reason": "conflicting_canonical_identifiers", "canonical_ids": sorted(targets)})
            continue
        if PLACEHOLDER.search(name):
            quarantined.append({**metadata, "reason": "confidential_or_placeholder", "canonical_ids": sorted(targets)})
            continue
        if not targets:
            unresolved.append(metadata)
            continue

        canonical_id = next(iter(targets))
        # Strong, agreeing evidence only. Same-domain + similar name is reported
        # for investigation but never imported as a mapping by this first pass.
        strong_keys = sorted((key for key in evidence_keys if key[2] == "A"), key=lambda item: (item[0], item[1]))
        if not strong_keys:
            unresolved.append(metadata)
            continue
        key = strong_keys[0]
        if (key[0], key[1]) in conflicting_cluster_keys:
            quarantined.append({**metadata, "reason": "conflicting_identifiers_within_cluster", "canonical_ids": [canonical_id]})
            continue
        flags = ["agency_or_recruiter_name"] if AGENCY.search(name) else []
        cluster_id = _cluster_id(canonical_id, key)
        evidence = {
            "version": 1,
            "cluster_id": cluster_id,
            "evidence_tier": "A",
            "method": key[0],
            "canonical_id": canonical_id,
            "canonical_label": identity_names.get(canonical_id, ""),
            "matched_identifiers": matches,
            "review_flags": flags,
            "member_names": sorted({name for name in [name]}),
            "source_record_count": len(records),
        }
        proposals.append({
            "source_table": "employers",
            "source_field": "company_name",
            "raw_value": name,
            "canonical_id": canonical_id,
            "status": "pending",
            "confidence": 1.0 if key[0] != "domain" else 0.9,
            "suggested_label": identity_names.get(canonical_id, ""),
            "notes": json.dumps(evidence, ensure_ascii=False, sort_keys=True),
            "cluster_id": cluster_id,
            "review_flags": flags,
        })

    direct_names = {row["raw_value"] for row in proposals}
    anchor_records: dict[int, list[tuple[str, dict[str, Any], tuple[str, str, str]]]] = defaultdict(list)
    for name, records in by_name.items():
        for record in records:
            keys = [key for key in _keys(record) if key[2] == "A"]
            targets = {
                canonical_id
                for kind, value, _ in keys
                for canonical_id in identity_keys.get((kind, value), set())
            }
            if len(targets) == 1 and keys:
                canonical_id = next(iter(targets))
                anchor_records[canonical_id].extend((name, record, key) for key in keys)

    # ponytail: token blocking keeps this near-linear for the 3k-name queue; use an all-pairs scan only if measured recall is inadequate.
    anchors_by_token: dict[str, list[tuple[int, str, dict[str, Any], tuple[str, str, str]]]] = defaultdict(list)
    seen_anchors: set[tuple[int, str, str, str]] = set()
    for canonical_id, anchors in anchor_records.items():
        for anchor_name, record, key in anchors:
            anchor_key = (canonical_id, anchor_name, key[0], key[1])
            if anchor_key in seen_anchors:
                continue
            seen_anchors.add(anchor_key)
            for token in set(_normal_name(anchor_name).split()) - NAME_BLOCK_STOPWORDS:
                if len(token) > 1:
                    anchors_by_token[token].append((canonical_id, anchor_name, record, key))

    name_candidate_conflicts = []
    name_context_candidates = []
    name_only_candidates = []
    fuzzy_proposals = []
    for name, records in by_name.items():
        if name in direct_names or PLACEHOLDER.search(name):
            continue
        normalized = _normal_name(name)
        tokens = set(normalized.split()) - NAME_BLOCK_STOPWORDS
        anchors = {
            (canonical_id, anchor_name, key[0], key[1]): (canonical_id, anchor_name, record, key)
            for token in tokens for canonical_id, anchor_name, record, key in anchors_by_token.get(token, [])
        }
        candidate_by_id: dict[int, dict[str, Any]] = {}
        for canonical_id, anchor_name, anchor_record, key in anchors.values():
            name_score = fuzz.token_sort_ratio(normalized, _normal_name(anchor_name))
            if name_score < 80:
                continue
            for record in records:
                cities = sorted(_cities(record) & _cities(anchor_record))
                informative_cities = [
                    city for city in cities if city_frequency[city] / max(len(by_name), 1) <= 0.1
                ]
                industry_score = _industry_similarity(record.get("industry"), anchor_record.get("industry"))
                if not informative_cities and industry_score < 0.85:
                    continue
                evidence_item = {
                    "similar_company_name": anchor_name,
                    "name_similarity": round(name_score, 2),
                    "anchor_identifier": {"field": key[0], "value": key[1]},
                    "overlapping_job_cities": cities,
                    "informative_job_cities": informative_cities,
                    "source_industry": record.get("industry"),
                    "anchor_industry": anchor_record.get("industry"),
                    "industry_similarity": round(industry_score, 3),
                }
                previous = candidate_by_id.get(canonical_id)
                if not previous or evidence_item["name_similarity"] > previous["name_similarity"]:
                    candidate_by_id[canonical_id] = evidence_item

        if len(candidate_by_id) > 1:
            conflict = {
                "raw_value": name,
                "reason": "name_location_industry_candidates_disagree",
                "candidates": [
                    {"canonical_id": canonical_id, "canonical_label": identity_names.get(canonical_id), **evidence}
                    for canonical_id, evidence in sorted(candidate_by_id.items())
                ],
            }
            name_context_candidates.append({**conflict, "status": "candidate_only"})
            if max(item["name_similarity"] for item in candidate_by_id.values()) >= 90:
                name_candidate_conflicts.append(conflict)
            continue
        if not candidate_by_id:
            continue

        canonical_id, evidence_item = next(iter(candidate_by_id.items()))
        if evidence_item["name_similarity"] < 90:
            name_context_candidates.append({
                "raw_value": name,
                "canonical_id": canonical_id,
                "canonical_label": identity_names.get(canonical_id, ""),
                "candidate_evidence": evidence_item,
                "status": "candidate_only",
            })
            continue
        flags = ["location_is_job_market_not_headquarters"] if evidence_item["informative_job_cities"] else []
        if AGENCY.search(name):
            flags.append("agency_or_recruiter_name")
        cluster_digest = hashlib.sha256(f"{canonical_id}:{normalized}".encode()).hexdigest()[:16]
        cluster_id = f"company:{canonical_id}:name:{cluster_digest}"
        evidence = {
            "version": 1,
            "cluster_id": cluster_id,
            "evidence_tier": "C",
            "method": "name_similarity_with_context",
            "canonical_id": canonical_id,
            "canonical_label": identity_names.get(canonical_id, ""),
            "matched_identifiers": [],
            "candidate_evidence": evidence_item,
            "review_flags": flags,
            "source_record_count": len(records),
        }
        fuzzy_proposals.append({
            "source_table": "employers",
            "source_field": "company_name",
            "raw_value": name,
            "canonical_id": canonical_id,
            "status": "pending",
            "confidence": None,
            "suggested_label": identity_names.get(canonical_id, ""),
            "notes": json.dumps(evidence, ensure_ascii=False, sort_keys=True),
            "cluster_id": cluster_id,
            "review_flags": flags,
        })
    proposals.extend(fuzzy_proposals)

    mapped_candidates = direct_names | {row["raw_value"] for row in fuzzy_proposals}
    for name, records in by_name.items():
        if name in mapped_candidates or PLACEHOLDER.search(name):
            continue
        normalized = _normal_name(name)
        ranked = []
        for identity in identities:
            canonical_id = identity.get("canonical_id")
            label = identity.get("canonical_label")
            if not isinstance(canonical_id, int) or not isinstance(label, str):
                continue
            score = max(fuzz.ratio(normalized, _normal_name(label)), fuzz.token_sort_ratio(normalized, _normal_name(label))) / 100
            if score >= 0.95:
                ranked.append({"canonical_id": canonical_id, "canonical_label": label, "name_similarity": round(score, 4)})
        if ranked:
            ranked.sort(key=lambda row: row["name_similarity"], reverse=True)
            name_only_candidates.append({
                "raw_value": name,
                "candidates": ranked[:3],
                "source_context": {
                    "cities": sorted(set().union(*(_cities(record) for record in records))),
                    "industries": sorted({record["industry"].strip() for record in records if isinstance(record.get("industry"), str) and record["industry"].strip()}),
                    "canonical_context_available": False,
                },
                "status": "candidate_only",
            })

    # Detect domain/name corroboration separately; it is candidate evidence, not
    # sufficient to create an importable mapping without a matching canonical ID.
    domain_candidates = []
    canonical_domains: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for identity in identities:
        domain = _domain(identity.get("website_domain"))
        if domain:
            canonical_domains[domain].append((identity["canonical_id"], identity.get("canonical_label", "")))
    for name, records in by_name.items():
        for record in records:
            domain = _domain(record.get("domain"))
            if not domain or domain not in canonical_domains:
                continue
            for canonical_id, canonical_name in canonical_domains[domain]:
                similarity = fuzz.token_sort_ratio(_normal_name(name), _normal_name(canonical_name)) / 100
                if similarity >= 0.82:
                    domain_candidates.append({
                        "raw_value": name, "canonical_id": canonical_id, "canonical_label": canonical_name,
                        "domain": domain, "name_similarity": round(similarity, 4),
                        "status": "candidate_only",
                    })

    proposals.sort(key=lambda item: (item["suggested_label"].casefold(), item["cluster_id"], item["raw_value"].casefold()))
    quarantined.sort(key=lambda item: item["raw_value"].casefold())
    unresolved.sort(key=lambda item: (-item["jobs_seen"], item["raw_value"].casefold()))
    return {
        "summary": {
            "employer_rows": len(employers), "distinct_names": len(by_name),
            "canonical_identities": len(identity_by_id), "pending_proposals": len(proposals),
            "pending_clusters": len({row["cluster_id"] for row in proposals}),
            "exact_identifier_proposals": sum(json.loads(row["notes"]).get("evidence_tier") == "A" for row in proposals),
            "name_context_proposals": sum(json.loads(row["notes"]).get("evidence_tier") == "C" for row in proposals),
            "name_context_candidates": len(name_context_candidates),
            "name_only_candidates": len(name_only_candidates),
            "quarantined_names": len(quarantined), "unresolved_names": len(unresolved),
            "domain_candidates": len(domain_candidates),
        },
        "proposals": proposals,
        "quarantined": quarantined,
        "unresolved": unresolved,
        "domain_candidates": domain_candidates,
        "name_context_candidates": name_context_candidates,
        "name_only_candidates": name_only_candidates,
        "name_candidate_conflicts": name_candidate_conflicts,
        "enrichment": [],
    }


def _fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": "prop-intel-company-resolution/1.0", "Accept": "application/json"})
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def enrich_names(names: list[str], cache_path: Path) -> list[dict[str, Any]]:
    """Fetch free GLEIF/Wikidata search hints; never turns them into mappings."""
    try:
        cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    except (OSError, json.JSONDecodeError):
        cache = {}
    results = []
    now = int(time.time())
    for name in names:
        entry: dict[str, Any] = {"name": name, "gleif": [], "wikidata": []}
        for provider in ("gleif", "wikidata"):
            cached = cache.get(provider, {}).get(name)
            if isinstance(cached, dict) and now - cached.get("fetched_at", 0) < 30 * 86400:
                entry[provider] = cached.get("results", [])
                continue
            params = {"filter[entity.legalName]": name, "page[size]": "5"} if provider == "gleif" else {
                "action": "wbsearchentities", "search": name, "language": "en", "format": "json", "limit": "5",
            }
            url = ("https://api.gleif.org/api/v1/lei-records?" if provider == "gleif" else "https://www.wikidata.org/w/api.php?") + urlencode(params)
            try:
                body = _fetch_json(url)
                if provider == "gleif":
                    found = []
                    for row in body.get("data", []):
                        attrs = row.get("attributes", {})
                        entity = attrs.get("entity", {})
                        found.append({
                            "lei": attrs.get("lei"),
                            "legal_name": (entity.get("legalName") or {}).get("name"),
                            "country": (entity.get("legalAddress") or {}).get("country"),
                            "registered_as": entity.get("registeredAs"),
                            "registration_authority": (entity.get("registeredAt") or {}).get("id"),
                            "status": entity.get("status"),
                            "url": f"https://lei.info/{attrs.get('lei')}" if attrs.get("lei") else None,
                        })
                else:
                    found = [{
                        "id": row.get("id"), "label": row.get("label"), "description": row.get("description"),
                        "url": f"https://www.wikidata.org/wiki/{row.get('id')}" if row.get("id") else None,
                    } for row in body.get("search", [])]
                entry[provider] = found
                cache.setdefault(provider, {})[name] = {"fetched_at": now, "results": found}
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
                entry[provider] = []
                entry.setdefault("lookup_errors", {})[provider] = str(exc)
            time.sleep(0.25)
        results.append(entry)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
    return results


class _OpenGraphParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.metadata: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() != "meta":
            return
        values = {key.casefold(): value for key, value in attrs if value}
        key = values.get("property") or values.get("name")
        content = values.get("content")
        if key and content and key.casefold() in {"og:title", "og:description", "description"}:
            self.metadata[key.casefold()] = content.strip()


def fetch_linkedin_pages(identities: list[dict[str, Any]], limit: int, cache_path: Path) -> list[dict[str, Any]]:
    """Read only publicly served LinkedIn OpenGraph metadata, without login or browser automation."""
    try:
        cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    except (OSError, json.JSONDecodeError):
        cache = {}
    cached_pages = cache.setdefault("linkedin_pages", {})
    now = int(time.time())
    results = []
    urls = list(dict.fromkeys(
        item["linkedin_company_url"] for item in identities
        if isinstance(item.get("linkedin_company_url"), str)
        and item["linkedin_company_url"].startswith("https://")
    ))[:limit]
    for url in urls:
        cached = cached_pages.get(url)
        if isinstance(cached, dict) and now - cached.get("fetched_at", 0) < 30 * 86400:
            results.append({"url": url, **cached.get("result", {})})
            continue
        result: dict[str, Any] = {}
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; PropIntelCompanyResolution/1.0)", "Accept": "text/html"})
            with urlopen(request, timeout=15) as response:
                parser = _OpenGraphParser()
                parser.feed(response.read(1_000_000).decode("utf-8", errors="replace"))
                result = {"final_url": response.geturl(), **parser.metadata}
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            result = {"fetch_error": str(exc)}
        cached_pages[url] = {"fetched_at": now, "result": result}
        results.append({"url": url, **result})
        time.sleep(1)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
    return results


def attach_linkedin_evidence(report: dict[str, Any], identities: list[dict[str, Any]]) -> None:
    pages = {page["url"]: page for page in report.get("linkedin_pages", [])}
    by_id = {item.get("canonical_id"): item for item in identities}
    for proposal in report["proposals"]:
        identity = by_id.get(proposal["canonical_id"], {})
        url = identity.get("linkedin_company_url")
        page = pages.get(url)
        if not page:
            continue
        title = page.get("og:title") or page.get("title")
        description = page.get("og:description") or page.get("description")
        evidence = json.loads(proposal["notes"])
        evidence["linkedin_page"] = {
            "url": url,
            "title": title,
            "description": description[:800] if isinstance(description, str) else None,
        }
        if isinstance(description, str) and re.search(
            r"\b(recruit(?:ment|er)?|staffing|manpower|headhunt(?:ing)?|talent acquisition)\b",
            description,
            re.I,
        ):
            evidence["review_flags"] = sorted(set([*evidence["review_flags"], "linkedin_page_mentions_recruiting"]))
            proposal["review_flags"] = evidence["review_flags"]
        proposal["notes"] = json.dumps(evidence, ensure_ascii=False, sort_keys=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--employers", type=Path, required=True, help="R2 employers.json download")
    parser.add_argument("--identities", type=Path, required=True, help="RefDataHub company-identities JSON")
    parser.add_argument("--output", type=Path, required=True, help="Candidate report JSON output")
    parser.add_argument("--csv", type=Path, required=True, help="Pending mapping CSV for RefDataHub import")
    parser.add_argument("--enrich", action="store_true", help="Query public GLEIF and Wikidata APIs for unresolved names")
    parser.add_argument("--enrich-limit", type=int, default=15, help="Maximum unresolved names to query (default: 15; max: 50)")
    parser.add_argument("--cache", type=Path, help="Public lookup cache path; required with --enrich")
    parser.add_argument("--fetch-linkedin", action="store_true", help="Fetch public OpenGraph metadata from canonical LinkedIn pages")
    parser.add_argument("--linkedin-limit", type=int, default=10, help="Maximum LinkedIn pages to fetch (default: 10; max: 50)")
    args = parser.parse_args()
    if (args.enrich or args.fetch_linkedin) and args.cache is None:
        parser.error("--enrich and --fetch-linkedin require --cache")
    if args.enrich and not 1 <= args.enrich_limit <= 50:
        parser.error("--enrich-limit must be between 1 and 50")
    if args.fetch_linkedin and not 1 <= args.linkedin_limit <= 50:
        parser.error("--linkedin-limit must be between 1 and 50")
    employer_payload = json.loads(args.employers.read_text())
    identity_payload = json.loads(args.identities.read_text())
    employers = employer_payload.get("employers", []) if isinstance(employer_payload, dict) else employer_payload
    identities = identity_payload.get("identities", []) if isinstance(identity_payload, dict) else identity_payload
    report = build_candidates(employers, identities)
    if args.enrich:
        names = [row["raw_value"] for row in report["unresolved"][:args.enrich_limit]]
        report["enrichment"] = enrich_names(names, args.cache)
    report["linkedin_pages"] = fetch_linkedin_pages(identities, args.linkedin_limit, args.cache) if args.fetch_linkedin else []
    attach_linkedin_evidence(report, identities)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    with args.csv.open("w", newline="", encoding="utf-8") as file:
        fields = ("source_table", "source_field", "raw_value", "canonical_id", "status", "confidence", "suggested_label", "notes")
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows({key: row[key] for key in fields} for row in report["proposals"])
    print(json.dumps(report["summary"], indent=2))
    print(f"Wrote pending-only CSV to {args.csv}; no mappings were posted or approved.")


if __name__ == "__main__":
    main()

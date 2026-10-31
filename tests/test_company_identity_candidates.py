from __future__ import annotations

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from company_identity_candidates import build_candidates  # noqa: E402


def test_exact_linkedin_aliases_are_clustered_as_pending() -> None:
    identities = [{
        "canonical_id": 7,
        "canonical_label": "Acme Group",
        "linkedin_company_url": "https://sa.linkedin.com/company/acme/",
    }]
    employers = [
        {"company_name": "Acme", "company_url": "https://www.linkedin.com/company/acme", "jobs_seen": 3},
        {"company_name": "ACME Saudi", "company_url": "https://uk.linkedin.com/company/acme/", "jobs_seen": 2},
    ]

    report = build_candidates(employers, identities)
    assert report["summary"]["pending_proposals"] == 2
    first, second = report["proposals"]
    assert first["status"] == second["status"] == "pending"
    assert first["cluster_id"] == second["cluster_id"]
    assert first["canonical_id"] == second["canonical_id"] == 7


def test_identifier_conflicts_and_placeholders_are_quarantined() -> None:
    identities = [
        {"canonical_id": 7, "canonical_label": "Acme Group", "lei": "5493001KJTIIGC8Y1R12"},
        {"canonical_id": 8, "canonical_label": "Other Corp", "wikidata_id": "Q1234"},
    ]
    employers = [
        {
            "company_name": "Conflicted Company",
            "lei": "5493001KJTIIGC8Y1R12",
            "wikidata_id": "Q1234",
        },
        {
            "company_name": "Confidential Careers",
            "company_url": "https://linkedin.com/company/confidentialcareers",
        },
    ]

    report = build_candidates(employers, identities)
    assert not report["proposals"]
    assert {row["reason"] for row in report["quarantined"]} == {
        "conflicting_canonical_identifiers", "confidential_or_placeholder",
    }


def test_parent_lei_and_platform_domains_are_not_identity_keys() -> None:
    identities = [{"canonical_id": 7, "canonical_label": "Acme Group", "lei": "5493001KJTIIGC8Y1R12"}]
    report = build_candidates([{
        "company_name": "Acme Subsidiary",
        "parent_lei": "5493001KJTIIGC8Y1R12",
        "domain": "sa.linkedin.com",
    }], identities)
    assert not report["proposals"]
    assert report["summary"]["unresolved_names"] == 1


def test_domain_plus_name_similarity_is_candidate_only() -> None:
    identities = [{
        "canonical_id": 7,
        "canonical_label": "Acme Group",
        "website_domain": "https://www.acme.example/",
    }]
    report = build_candidates([{
        "company_name": "Acme Group",
        "domain": "acme.example",
    }], identities)
    assert not report["proposals"]
    assert report["domain_candidates"][0]["status"] == "candidate_only"


def test_name_similarity_uses_location_and_industry_but_stays_pending() -> None:
    identities = [{
        "canonical_id": 7,
        "canonical_label": "Acme Finance Technology",
        "linkedin_company_url": "https://linkedin.com/company/acme-finance-tech",
    }]
    employers = [
        {
            "company_name": "Acme Finance Technology",
            "company_url": "https://linkedin.com/company/acme-finance-tech",
            "cities": ["Riyadh"],
            "industry": "Financial Services",
        },
        {
            "company_name": "Acme Finance Technologies",
            "cities": ["Riyadh"],
            "industry": "Financial Services",
        },
    ]
    report = build_candidates(employers, identities)
    candidate = next(row for row in report["proposals"] if row["raw_value"] == "Acme Finance Technologies")
    evidence = json.loads(candidate["notes"])
    assert candidate["status"] == "pending"
    assert evidence["evidence_tier"] == "C"
    assert evidence["candidate_evidence"]["overlapping_job_cities"] == ["Riyadh"]
    assert evidence["candidate_evidence"]["informative_job_cities"] == []
    assert evidence["candidate_evidence"]["industry_similarity"] == 1.0


def test_rare_shared_job_city_can_corroborate_name_similarity() -> None:
    identity = {"canonical_id": 7, "canonical_label": "North Star Systems", "linkedin_company_url": "https://linkedin.com/company/north-star"}
    employers = [
        {"company_name": "North Star Systems", "company_url": "https://linkedin.com/company/north-star", "cities": ["Taif"]},
        {"company_name": "North Star System", "cities": ["Taif"]},
        *[{"company_name": f"Other Company {i}", "cities": ["Riyadh"]} for i in range(20)],
    ]
    report = build_candidates(employers, [identity])
    candidate = next(row for row in report["proposals"] if row["raw_value"] == "North Star System")
    evidence = json.loads(candidate["notes"])
    assert evidence["candidate_evidence"]["informative_job_cities"] == ["Taif"]


def test_recruiter_alias_stays_pending_with_warning() -> None:
    identities = [{
        "canonical_id": 7,
        "canonical_label": "Acme Recruitment",
        "linkedin_company_url": "https://linkedin.com/company/acme-recruitment",
    }]
    report = build_candidates([{
        "company_name": "Acme Recruitment",
        "company_url": "https://sa.linkedin.com/company/acme-recruitment",
    }], identities)
    assert report["proposals"][0]["status"] == "pending"
    assert "agency_or_recruiter_name" in report["proposals"][0]["review_flags"]


if __name__ == "__main__":
    test_exact_linkedin_aliases_are_clustered_as_pending()
    test_identifier_conflicts_and_placeholders_are_quarantined()
    test_parent_lei_and_platform_domains_are_not_identity_keys()
    test_domain_plus_name_similarity_is_candidate_only()
    test_name_similarity_uses_location_and_industry_but_stays_pending()
    test_rare_shared_job_city_can_corroborate_name_similarity()
    test_recruiter_alias_stays_pending_with_warning()

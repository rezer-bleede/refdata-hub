# RefData Hub Feature Overview

## 1. Core Reference Data Service
- Maintain authoritative mappings for key dimensions such as marital status, education, nationality, and employment status.
- Capture synonyms and spelling variations (e.g., "Single", "Unmarried", "Never married").
- Provide multilingual metadata to support future international roll-outs.

## 2. Semantic Matching
- Use NLP and embedding models to suggest standardized values for new raw inputs.
- Allow configurable confidence thresholds that determine when to auto-apply suggestions.
- Route low-confidence matches for manual review to ensure data quality.

## 3. Review & Approval Workflow
- Offer UI and API pathways for reviewers to approve or reject suggestions.
- Enable reviewers to add new mappings, merge duplicates, and maintain a clean catalog.
- Track an auditable history recording who approved each change and when it happened.
- Provide an OpenMetadata-inspired reviewer console with a persistent navigation rail, glassmorphism cards, and multiple
  responsive themes for comfortable accessibility in varied environments.

## 4. Integration & Access
- Expose REST and GraphQL APIs so downstream projects can query standardized values.
- Ship SDK clients (Python, Java, JavaScript) for streamlined integration into applications and pipelines.
- Emit webhooks when mappings change to keep dependent systems synchronized automatically.

## 5. Admin & Governance
- Support role-based access control profiles for reviewers, administrators, and consumers.
- Preserve change history with versioning for every mapping update.
- Offer CSV and JSON export/import flows for offline review and bulk edits.

## 6. Scalability & Reusability
- Ingest large batches of raw values for rapid onboarding of new datasets.
- Cache frequently requested lookups to serve high-volume access patterns.
- Operate as a shared, reusable service layer across all G100 projects.

## 7. Future Roadmap
- Detect new raw values automatically within connected project datasets.
- Provide a self-service reviewer dashboard with analytics (e.g., top inconsistent values).
- Align with external ontologies and standards (e.g., ISO country codes, education classifications).
- Integrate with data catalogs such as DataHub to surface lineage and metadata.

## 8. Operational Hardening
- Serve the Reviewer UI with an SPA-aware Nginx configuration so direct navigation to deep links (e.g., `/dashboard`) and
  browser refreshes resolve without 404 responses.
- Cache static assets aggressively while still surfacing errors for missing bundles, aiding troubleshooting during upgrades.

# RefData Hub Feature Overview

## 1. Core Reference Data Service
- Maintain authoritative mappings for key dimensions such as marital status, education, nationality, and employment status.
- Curate the dimension catalog itself, including machine-friendly codes, reviewer labels, descriptions, and custom attribute schemas.
- Capture synonyms and spelling variations (e.g., "Single", "Unmarried", "Never married").
- Provide multilingual metadata to support future international roll-outs.
- Model parent/child relationships between dimensions (e.g., region → district) and capture the canonical value pairings needed for drill-down analytics.
- Inspect connected source systems in real time—connection records can be tested inline and their available tables/columns are
  introspected to drive the mapping workflows without manual lookups. Analysts can now open a detailed explorer per connection
  to review schemas, objects, column profiles, match statistics, and captured sample values before curating mappings.
  Sample previews collapse duplicate raw values captured during multiple ingestion runs so reviewers always focus on distinct
  content with accurate occurrence totals.
- The Source Connections workspace foregrounds the existing connections grid ahead of the registration form so reviewers can
  audit current coverage before onboarding new systems, keeping the maintenance flow top-of-mind.
- Field mappings surface the existing mapping grid before the creation form to preserve context and reduce back-and-forth when
  analysts add or update rules.
- Canonical library dimension badges now use brighter aurora accents on translucent backgrounds to stay readable on the dark
  reviewer shell.

## 2. Semantic Matching
- Use NLP and embedding models to suggest standardized values for new raw inputs.
- Allow configurable confidence thresholds that determine when to auto-apply suggestions.
- Route low-confidence matches for manual review to ensure data quality.
- Operate in offline mode via the bundled Ollama llama3 runtime or switch to a hosted OpenAI-compatible endpoint from the dedicated settings workspace, which centralises matcher thresholds, embedding defaults, and credential inputs.

<figure>
  <img src="../screenshots/dashboard/semantic-playground.png" alt="Semantic Playground" width="1000">
  <figcaption>Test semantic matching with real-time confidence scores and suggestions</figcaption>
</figure>

## 3. Review & Approval Workflow
- Offer UI and API pathways for reviewers to approve or reject suggestions.
- Enable reviewers to add new mappings, merge duplicates, and maintain a clean catalog.
- Track an auditable history recording who approved each change and when it happened.
- Provide an observability-inspired reviewer console with a persistent navigation rail, glassmorphism cards, and multiple
   responsive themes for comfortable accessibility in varied environments, now implemented with a Tailwind CSS design system
   behind a React-Bootstrap-compatible component shim so existing screens retain their ergonomic JSX structure.
   The navigation rail now stays pinned on scroll and supports a collapsible layout for dense reconciliation sessions on
   widescreen monitors. A custom RefData helix mark sits in the top-left brand lockup so the workspace always shows a
   recognizable identity even when the sidebar collapses to icon-only mode.
- Match Insights cards clearly call out when no samples have been ingested yet, preventing misleading 0/0 match readouts, stay
   visible by falling back to configured field mappings when statistics are empty, and automatically refresh their samples when
   mappings are created, edited, or the global sync action runs.

<figure>
  <img src="../screenshots/suggestions/review-suggestions.png" alt="Review Suggestions" width="1200">
  <figcaption>Review and approve semantic match suggestions</figcaption>
</figure>

### Analytics & Insights
- Visualize match coverage rates across dimensions and field mappings
- Track top matched values with confidence scores
- Identify unmatched values requiring manual review
- Monitor harmonization health over time

<figure>
  <img src="../screenshots/match-insights/coverage-progress.png" alt="Match Coverage" width="1000">
  <figcaption>Track match coverage rates across dimensions</figcaption>
</figure>

<figure>
  <img src="../screenshots/match-insights/matched-values.png" alt="Top Matched Values" width="1200">
  <figcaption>View top matched values with confidence scores</figcaption>
</figure>

## 4. Integration & Access
- Expose REST and GraphQL APIs so downstream projects can query standardized values.
- Ship SDK clients (Python, Java, JavaScript) for streamlined integration into applications and pipelines.
- Emit webhooks when mappings change to keep dependent systems synchronized automatically.
- Bundle a seeded Postgres `targetdb` with a multi-table warehouse—departments, employees,
   globally diverse customers, loyalty tiers, addresses, products, orders, and line items—so
   analysts can rehearse field mappings and semantic match flows without external dependencies.

<figure>
  <img src="../screenshots/connections/connections-grid.png" alt="Source Connections" width="1200">
  <figcaption>Manage source system connections and test connectivity</figcaption>
</figure>

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

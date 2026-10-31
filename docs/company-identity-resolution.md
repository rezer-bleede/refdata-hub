# Company identity review

`scripts/company_identity_candidates.py` turns an R2 `employers.json` download
and RefDataHub's curated `/api/reference/company-identities` feed into a
candidate report plus an importable CSV. Tier A proposals use unique exact
LinkedIn-page, LEI, registration-number-plus-authority, or Wikidata matches.
Tier C proposals are generated only when name similarity is at least 90/100
and the names also share job-market city or have at least 85/100 industry
similarity to a Tier A anchor. Those context signals are not identity proof:
they remain pending, and city overlap is explicitly labeled as job location,
not headquarters. Scores from 80–89 are report-only candidate leads, not
importable mappings. Parent LEIs are ignored. LinkedIn/Indeed/job-board hosts are
never treated as company domains. Conflicts and confidential placeholders are
quarantined; agency/recruiter names stay pending with a warning.

All CSV rows use `status=pending`. Importing creates proposals only; a reviewer
must approve or reject the entire evidence cluster in **Mapping history**.
No external search result is written into canonical records or treated as a
match automatically.

```sh
# From jobs-analyzer/web, using Wrangler's authenticated Cloudflare session
npx wrangler r2 object get me-data-jobs/employers.json --remote --file /path/employers.json

# Save the curated identity response from the local RefDataHub API
curl -fsS http://localhost:8000/api/reference/company-identities -o /path/identities.json

python refdata-hub/scripts/company_identity_candidates.py \
  --employers /path/employers.json \
  --identities /path/identities.json \
  --output /path/company-review.json \
  --csv /path/company-pending.csv
```

Optional `--enrich --cache /path/company-lookup-cache.json` performs bounded,
cached, read-only searches against the public GLEIF API and Wikidata for up to
15 unresolved high-volume names (maximum 50). Their returned name, location,
status, and record links are only review leads. Names are sent to those public
services only when `--enrich` is requested. `--fetch-linkedin` reads public
OpenGraph metadata from up to 10 canonical LinkedIn URLs (maximum 50), without
login or browser automation. Results remain review leads and are never written
to canonical records automatically. No paid enrichment service is called.

The report preserves unresolved names, conflicts, name/context candidates, domain candidates, and
lookup results separately from importable proposals. Review the report before
importing the CSV; do not bulk-import quarantined or name-only candidates.

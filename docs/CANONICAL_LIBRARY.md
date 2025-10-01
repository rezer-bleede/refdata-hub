# Canonical Library Guide

The canonical library centralises every approved reference value. Reviewers can curate records manually or load large batches of
rows in one action. This guide documents the workflows now supported by the dedicated **Canonical Library** page in the reviewer
UI and provides an Abu Dhabi–specific dataset ready for import.

## Page overview

The library page offers four key capabilities:

1. **Filter & search** – Narrow the table by dimension and/or keyword to locate existing canonical values quickly.
2. **Create & edit** – Launch the editor modal to add brand-new entries or update labels, dimensions, and descriptions.
3. **Bulk import** – Paste a tab- or comma-delimited payload to create many canonical rows at once.
4. **Export** – Download the filtered table to CSV for auditing or offline collaboration.

All changes are persisted via the `/api/reference/canonical` endpoints exposed by the FastAPI backend.

## Adding or editing records

1. Open **Canonical Library** from the navigation bar.
2. Use the **New canonical value** button to capture the dimension, canonical label, and optional description (e.g., Arabic
   translation or code).
3. To edit a row, choose **Edit** in the table. Adjust any field and save to persist the change.
4. Use **Delete** to remove records that are no longer valid. A confirmation modal protects against accidental deletions.

## Bulk import walkthrough

The importer expects rows in the following structure:

```
dimension\tcanonical label\t(optional description columns)
```

* Columns can be separated by tabs, commas, or 2+ spaces. Additional columns are concatenated into the description.
* Empty dimension cells inherit the "Default dimension" value provided in the modal (useful when pasting single-dimension data).

### Abu Dhabi regional dataset

A ready-to-use dataset that mirrors the source material provided with this task lives at
[`docs/data/abu_dhabi_canonical.tsv`](data/abu_dhabi_canonical.tsv). It contains the emirate, region, and district hierarchy with
English labels, numeric codes, and Arabic names in the description.

To bulk load the dataset:

1. Open `docs/data/abu_dhabi_canonical.tsv` in your editor or run:
   ```bash
   cat docs/data/abu_dhabi_canonical.tsv
   ```
2. Copy all rows starting from the second line (skip the header row).
3. In the Reviewer UI, select **Bulk import** → paste the copied rows → click **Import rows**.
4. The importer reports how many records were created and automatically sorts them alongside existing values.

### Tips for custom datasets

- Include stable identifiers (codes) in the description field so downstream consumers can map raw values reliably.
- Use consistent dimensions (e.g., `region`, `district`, `currency`) to keep filtering predictable.
- When storing multilingual labels, concatenate translations with clear separators, for example: `English | Arabic`.
- The importer ignores blank lines and lines prefixed with `#`, enabling lightweight in-line commentary.

## Troubleshooting

- **"Unable to load canonical library" toast** – Verify the backend container is running. The UI now reports which resources
  failed to load.
- **Import validation errors** – Ensure each row contains at least two columns (dimension + canonical label). Codes and
  descriptions may be optional but are strongly recommended.
- **Duplicate records** – The API allows duplicates; run the export to CSV and deduplicate externally if necessary.

With these enhancements the canonical library is resilient enough to manage the full Abu Dhabi reference taxonomy and any future
expansions.

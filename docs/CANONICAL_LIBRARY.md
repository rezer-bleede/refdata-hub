# Canonical Library Guide

The canonical library centralises every approved reference value. Reviewers can curate records manually or load large batches of
rows in one action. This guide documents the workflows now supported by the dedicated **Canonical Library** page in the reviewer
UI and provides an Abu Dhabi–specific dataset ready for import.

## Page overview

The library page offers five key capabilities:

1. **Filter & search** – Narrow the table by dimension and/or keyword to locate existing canonical values quickly.
2. **Create & edit** – Launch the editor modal to add brand-new entries or update labels, dimensions, descriptions, and any
   dimension-specific attributes.
3. **Bulk import** – Upload CSV/TSV/Excel files or paste tabular rows and let the importer detect headers, attributes, and
   dimensions automatically.
4. **Attributes** – Capture the extra fields defined for the active dimension (for example, codes or international identifiers)
   alongside each canonical value.
5. **Export** – Download the filtered table to CSV for auditing or offline collaboration. The export includes attribute columns
   so downstream tools can preserve the additional metadata.

All changes are persisted via the `/api/reference/canonical` endpoints exposed by the FastAPI backend.

## Adding or editing records

1. Open **Canonical Library** from the navigation bar.
2. Use the **New canonical value** button to capture the dimension, canonical label, and optional description (e.g., Arabic
   translation or code).
3. To edit a row, choose **Edit** in the table. Adjust any field and save to persist the change.
4. Use **Delete** to remove records that are no longer valid. A confirmation modal protects against accidental deletions.

## Bulk import walkthrough

The importer accepts CSV, TSV, or Excel workbooks. Provide a header row describing each column—`dimension`, `label`, and
`description` columns are detected automatically, along with any extra attribute keys defined for the target dimension. When
pasting rows directly into the modal, the same headers should appear in the first line. Common aliases such as **Dimension
Name**, **Canonical Value**, **Canonical Name**, **Canonical Description**, and **Long Description** are now recognised out of the
box, ensuring legacy spreadsheets are parsed without manual edits.

* Columns can be separated by commas, tabs, or multiple spaces when pasting raw text.
* Empty dimension cells inherit the "Default dimension" value provided in the modal (useful when supplying single-dimension data).
* Any attribute columns that match the dimension's schema (for example `code`, `iso_code`, or `unesco_level`) are parsed and
  stored alongside the canonical value.
* Backend logs include the resolved filename, detected columns, and the number of created versus skipped rows. Check the FastAPI
  container logs for entries such as `Bulk canonical import received` or `Bulk import aborted: missing canonical label column`
  when diagnosing issues.
* Uploading both a file and pasted rows prioritises the file contents; remove the file to import the pasted data instead.

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
3. In the Reviewer UI, select **Bulk import** → either upload the TSV file or paste the copied rows → click **Import rows**.
4. The importer reports how many records were created, highlights any issues inline, and automatically sorts the additions alongside existing values.

### Tips for custom datasets

- Include stable identifiers (codes) either in dedicated attribute columns or the description so downstream consumers can map raw values reliably.
- Use consistent dimensions (e.g., `region`, `district`, `currency`) to keep filtering predictable.
- When storing multilingual labels, concatenate translations with clear separators, for example: `English | Arabic`.
- The importer ignores blank lines and lines prefixed with `#`, enabling lightweight in-line commentary.
- For spreadsheet imports, multiple worksheets are supported—only the first sheet is read by default. Save each dataset as a
  separate file for clarity.

## Troubleshooting

- **"Unable to load canonical library" toast** – Verify the backend container is running. The UI now reports which resources
  failed to load, and the backend automatically recreates the default configuration if it has been wiped—refresh the page after
  clearing a database.
- **Import validation errors** – Ensure each row contains at least two columns (dimension + canonical label). Codes and
  descriptions may be optional but are strongly recommended.
- **Duplicate records** – The API allows duplicates; run the export to CSV and deduplicate externally if necessary.

With these enhancements the canonical library is resilient enough to manage the full Abu Dhabi reference taxonomy and any future
expansions.

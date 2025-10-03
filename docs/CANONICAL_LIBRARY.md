# Canonical Library Guide

The canonical library centralises every approved reference value. Reviewers can curate records manually or load large batches of
rows in one action. This guide documents the workflows now supported by the dedicated **Canonical Library** page in the reviewer
UI and provides an Abu Dhabi–specific dataset ready for import.

## Page overview

The library page offers five key capabilities:

1. **Filter & search** – Narrow the table by dimension and/or keyword to locate existing canonical values quickly.
2. **Create & edit** – Launch the editor modal to add brand-new entries or update labels, dimensions, descriptions, and any
   dimension-specific attributes.
3. **Bulk import** – Upload CSV/TSV/Excel files or paste tabular rows, review the automatic column suggestions, and map headers
   to canonical fields before committing the import.
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

The importer accepts CSV, TSV, or Excel workbooks. Provide a header row describing each column; the preview step inspects the
headers and sample rows, proposes sensible defaults (label, dimension, description, and attribute candidates), and lets you map
or ignore each column before creating any records. Excel uploads no longer need to strip out metadata tabs or title banners—the
backend now scans every worksheet, discards prefatory rows until it finds the first genuine header, and keeps the data immediately
below it even when earlier cells are merged. When the dataset targets a brand-new dimension, you can capture the dimension label
and optional description inline—the backend will create the dimension and its attribute schema automatically during the import.

* Columns can be separated by commas, tabs, or multiple spaces when pasting raw text.
* Empty dimension cells inherit the selected target dimension when no dimension column is mapped—helpful for single-dimension
  datasets.
* Attribute columns can be mapped to existing schema keys or defined on the fly for new dimensions. Attribute types default to
  text but can be adjusted to numeric or boolean as part of the mapping step.
* Backend logs include the resolved filename, detected columns, and the number of created versus skipped rows. Check the FastAPI
  container logs for entries such as `Bulk canonical import received` or `Generated bulk import preview` when diagnosing issues.
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
3. In the Reviewer UI, select **Bulk import**, upload the TSV file (or paste the copied rows), and click **Review mappings**.
4. Map the detected columns to the canonical label, dimension (or default dimension), and any attributes. Adjust attribute data
   types if you're creating a new dimension.
5. Click **Import rows** to create the records. The importer reports how many values were created, highlights any issues inline,
   and automatically sorts the additions alongside existing values.

### Tips for custom datasets

- Include stable identifiers (codes) either in dedicated attribute columns or the description so downstream consumers can map raw values reliably.
- Use consistent dimensions (e.g., `region`, `district`, `currency`) to keep filtering predictable.
- When storing multilingual labels, concatenate translations with clear separators, for example: `English | Arabic`.
- The importer ignores blank lines and lines prefixed with `#`, enabling lightweight in-line commentary.
- For spreadsheet imports, multiple worksheets are supported. The loader inspects every sheet and selects the first region that
  looks like a tabular dataset, so workbooks with cover sheets or audit notes continue to import without manual editing.

## Troubleshooting

- **"Unable to load canonical library" toast** – Verify the backend container is running. The UI now reports which resources
  failed to load, and the backend automatically recreates the default configuration if it has been wiped—refresh the page after
  clearing a database.
- **Import validation errors** – Ensure each row contains at least two columns (dimension + canonical label). Codes and
  descriptions may be optional but are strongly recommended.
- **Duplicate records** – The API allows duplicates; run the export to CSV and deduplicate externally if necessary.

With these enhancements the canonical library is resilient enough to manage the full Abu Dhabi reference taxonomy and any future
expansions.

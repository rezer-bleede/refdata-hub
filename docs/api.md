# API Reference

The RefData Hub FastAPI service exposes a rich set of REST endpoints under `/api` for managing canonical values, dimensions, source connections, and mappings.

## Base URL

By default, the API is available at:
```
http://localhost:8000/api
```

Interactive API documentation is available at:
```
http://localhost:8000/docs
```

## Authentication

Currently, the API does not require authentication. Future versions will support role-based access control for reviewers, administrators, and consumers.

## Response Format

All endpoints accept and return structured JSON payloads that align with the React TypeScript models in `reviewer-ui/src/types.ts`.

---

## Canonical Values

### Get All Canonical Values
```http
GET /api/reference/canonical
```

Returns all canonical reference values in the library.

**Response:** `CanonicalValue[]`

### Create Canonical Value
```http
POST /api/reference/canonical
Content-Type: application/json
```

Create a new canonical reference value.

**Request Body:** `CanonicalValueUpdatePayload`

**Response:** `CanonicalValue`

### Update Canonical Value
```http
PUT /api/reference/canonical/{id}
Content-Type: application/json
```

Update an existing canonical value.

**Parameters:**
- `id` (path): Canonical value ID

**Request Body:** `CanonicalValueUpdatePayload`

**Response:** `CanonicalValue`

### Delete Canonical Value
```http
DELETE /api/reference/canonical/{id}
```

Delete a canonical value.

**Parameters:**
- `id` (path): Canonical value ID

### Bulk Import Canonical Values
```http
POST /api/reference/canonical/import
Content-Type: multipart/form-data
```

Import canonical values from CSV, TSV, or Excel files.

**Request Body:** `FormData` containing:
- `file`: The uploaded file (optional)
- `data`: Pasted tabular data (optional)
- `column_mapping`: Column mapping configuration
- `dimension_definition`: Optional dimension to create during import

**Response:** `BulkImportResult`

The loader scans every worksheet in an Excel workbook, skips prefatory metadata blocks, and promotes the first detected header row.

### Preview Bulk Import
```http
POST /api/reference/canonical/import/preview
Content-Type: multipart/form-data
```

Analyze an uploaded table and return detected columns, suggested roles, and proposed dimension mappings.

**Request Body:** `FormData` containing the file or data to preview

**Response:** `BulkImportPreview`

### Propose Match
```http
POST /api/reference/propose
Content-Type: application/json
```

Get semantic suggestions for a raw text value.

**Request Body:**
```json
{
  "raw_text": "Single",
  "dimension": "marital_status"
}
```

**Response:** `MatchResponse`

When no dimension is specified, the endpoint falls back to the dimension that contains available canonical values.

---

## Dimensions

### Get All Dimensions
```http
GET /api/reference/dimensions
```

Retrieve the dimension catalog.

**Response:** `DimensionDefinition[]`

### Create Dimension
```http
POST /api/reference/dimensions
Content-Type: application/json
```

Create a new dimension.

**Request Body:** `DimensionCreatePayload`

**Response:** `DimensionDefinition`

### Update Dimension
```http
PUT /api/reference/dimensions/{code}
Content-Type: application/json
```

Update an existing dimension.

**Parameters:**
- `code` (path): Dimension code

**Request Body:** `DimensionUpdatePayload`

**Response:** `DimensionDefinition`

### Delete Dimension
```http
DELETE /api/reference/dimensions/{code}
```

Delete a dimension.

**Parameters:**
- `code` (path): Dimension code

---

## Dimension Relations

### Get All Dimension Relations
```http
GET /api/reference/dimension-relations
```

Retrieve all parent/child dimension relationships.

**Response:** `DimensionRelationSummary[]`

### Create Dimension Relation
```http
POST /api/reference/dimension-relations
Content-Type: application/json
```

Create a new parent/child relationship between dimensions.

**Request Body:** `DimensionRelationCreatePayload`

**Response:** `DimensionRelationSummary`

### Update Dimension Relation
```http
PUT /api/reference/dimension-relations/{relationId}
Content-Type: application/json
```

Update a dimension relation.

**Parameters:**
- `relationId` (path): Relation ID

**Request Body:** `DimensionRelationUpdatePayload`

**Response:** `DimensionRelationSummary`

### Delete Dimension Relation
```http
DELETE /api/reference/dimension-relations/{relationId}
```

Delete a dimension relation.

**Parameters:**
- `relationId` (path): Relation ID

### Get Dimension Relation Links
```http
GET /api/reference/dimension-relations/{relationId}/links
```

Get canonical value pairings for a dimension relation.

**Parameters:**
- `relationId` (path): Relation ID

**Response:** `DimensionRelationLink[]`

### Create Dimension Relation Link
```http
POST /api/reference/dimension-relations/{relationId}/links
Content-Type: application/json
```

Create a canonical value pairing.

**Parameters:**
- `relationId` (path): Relation ID

**Request Body:** `DimensionRelationLinkPayload`

**Response:** `DimensionRelationLink`

### Delete Dimension Relation Link
```http
DELETE /api/reference/dimension-relations/{relationId}/links/{linkId}
```

Delete a canonical value pairing.

**Parameters:**
- `relationId` (path): Relation ID
- `linkId` (path): Link ID

---

## System Configuration

### Get Configuration
```http
GET /api/config
```

Retrieve the system configuration including matcher thresholds, embedding defaults, and LLM settings.

**Response:** `SystemConfig`

### Update Configuration
```http
PUT /api/config
Content-Type: application/json
```

Update the system configuration.

**Request Body:** `SystemConfigUpdate`

**Response:** `SystemConfig`

---

## Source Connections

### Get All Connections
```http
GET /api/source/connections
```

Retrieve all registered source system connections.

**Response:** `SourceConnection[]`

### Get Connection
```http
GET /api/source/connections/{id}
```

Retrieve a specific connection's full configuration.

**Parameters:**
- `id` (path): Connection ID

**Response:** `SourceConnection`

### Create Connection
```http
POST /api/source/connections
Content-Type: application/json
```

Register a new source system connection.

**Request Body:** `SourceConnectionCreatePayload`

**Response:** `SourceConnection`

### Update Connection
```http
PUT /api/source/connections/{id}
Content-Type: application/json
```

Update an existing connection.

**Parameters:**
- `id` (path): Connection ID

**Request Body:** `SourceConnectionUpdatePayload`

**Response:** `SourceConnection`

### Delete Connection
```http
DELETE /api/source/connections/{id}
```

Delete a connection.

**Parameters:**
- `id` (path): Connection ID

### Test Connection
```http
POST /api/source/connections/test
Content-Type: application/json
```

Validate connection details without saving.

**Request Body:** `SourceConnectionTestPayload`

**Response:** `SourceConnectionTestResult`

### Test Existing Connection
```http
POST /api/source/connections/{id}/test
Content-Type: application/json
```

Test a connection's credentials with optional overrides.

**Parameters:**
- `id` (path): Connection ID

**Request Body:** `SourceConnectionUpdatePayload` (optional)

**Response:** `SourceConnectionTestResult`

### Get Connection Tables
```http
GET /api/source/connections/{id}/tables
```

Discover available tables and views for a connection.

**Parameters:**
- `id` (path): Connection ID

**Response:** `SourceTableMetadata[]`

### Get Connection Fields
```http
GET /api/source/connections/{id}/tables/{table}/fields
```

Inspect column metadata for a specific table.

**Parameters:**
- `id` (path): Connection ID
- `table` (path): Table name
- `schema` (query): Optional schema name

**Response:** `SourceFieldMetadata[]`

---

## Field Mappings

### Get Field Mappings
```http
GET /api/source/connections/{id}/mappings
```

Retrieve all field mappings for a connection.

**Parameters:**
- `id` (path): Connection ID

**Response:** `SourceFieldMapping[]`

### Create Field Mapping
```http
POST /api/source/connections/{id}/mappings
Content-Type: application/json
```

Create a new field mapping.

**Parameters:**
- `id` (path): Connection ID

**Request Body:** `SourceFieldMappingPayload`

**Response:** `SourceFieldMapping`

### Update Field Mapping
```http
PUT /api/source/connections/{id}/mappings/{mappingId}
Content-Type: application/json
```

Update an existing field mapping.

**Parameters:**
- `id` (path): Connection ID
- `mappingId` (path): Mapping ID

**Request Body:** `SourceFieldMappingPayload`

**Response:** `SourceFieldMapping`

### Delete Field Mapping
```http
DELETE /api/source/connections/{id}/mappings/{mappingId}
```

Delete a field mapping.

**Parameters:**
- `id` (path): Connection ID
- `mappingId` (path): Mapping ID

### Capture Mapping Samples
```http
POST /api/source/connections/{id}/mappings/{mappingId}/capture
```

Ingest sample values from the source for a mapping.

**Parameters:**
- `id` (path): Connection ID
- `mappingId` (path): Mapping ID

**Response:** `SourceSample[]`

---

## Source Samples

### Ingest Samples
```http
POST /api/source/connections/{id}/samples
Content-Type: application/json
```

Manually upload sample values for a connection.

**Parameters:**
- `id` (path): Connection ID

**Request Body:**
```json
{
  "source_table": "customers",
  "source_field": "status",
  "values": [
    { "raw_value": "Active", "count": 150 },
    { "raw_value": "Inactive", "count": 23 }
  ]
}
```

**Response:** `SourceSample[]`

### Get Source Samples
```http
GET /api/source/connections/{id}/samples
```

Retrieve sample values for a connection.

**Parameters:**
- `id` (path): Connection ID
- `source_table` (query): Optional filter by table
- `source_field` (query): Optional filter by field

**Response:** `SourceSample[]`

---

## Match Statistics

### Get Match Statistics
```http
GET /api/source/connections/{id}/match-stats
```

Compute match rates, top matched/unmatched values per mapping.

**Parameters:**
- `id` (path): Connection ID

**Response:** `FieldMatchStats[]`

### Get Unmatched Values
```http
GET /api/source/connections/{id}/unmatched
```

Retrieve unmatched raw values with inline suggestions.

**Parameters:**
- `id` (path): Connection ID

**Response:** `UnmatchedValueRecord[]`

---

## Value Mappings

### Get Connection Mappings
```http
GET /api/source/connections/{id}/value-mappings
```

Retrieve all approved mappings for a connection.

**Parameters:**
- `id` (path): Connection ID

**Response:** `ValueMappingExpanded[]`

### Get All Mappings
```http
GET /api/source/value-mappings
```

Retrieve all value mappings across all connections.

**Response:** `ValueMappingExpanded[]`

### Create Value Mapping
```http
POST /api/source/connections/{id}/value-mappings
Content-Type: application/json
```

Approve a new raw-to-canonical mapping.

**Parameters:**
- `id` (path): Connection ID

**Request Body:** `ValueMappingPayload`

**Response:** `ValueMapping`

### Update Value Mapping
```http
PUT /api/source/connections/{id}/value-mappings/{mappingId}
Content-Type: application/json
```

Update an existing value mapping.

**Parameters:**
- `id` (path): Connection ID
- `mappingId` (path): Mapping ID

**Request Body:** `ValueMappingUpdatePayload`

**Response:** `ValueMapping`

### Delete Value Mapping
```http
DELETE /api/source/connections/{id}/value-mappings/{mappingId}
```

Delete a value mapping.

**Parameters:**
- `id` (path): Connection ID
- `mappingId` (path): Mapping ID

### Export Mappings
```http
GET /api/source/value-mappings/export?format=csv&connection_id={id}
```

Download mapping history as CSV or Excel.

**Query Parameters:**
- `format`: `csv` or `xlsx`
- `connection_id`: Optional, specific connection ID or `all`

**Response:** File download (CSV or Excel)

### Import Mappings
```http
POST /api/source/value-mappings/import
Content-Type: multipart/form-data
```

Upload CSV/Excel mapping updates.

**Query Parameters:**
- `connection_id`: Optional, specific connection ID

**Request Body:** `FormData` containing the file

**Response:** `ValueMappingImportResult`

---

## Error Responses

All endpoints may return the following error responses:

- **400 Bad Request**: Invalid request data
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

Error responses include a descriptive message:

```json
{
  "detail": "Error message here"
}
```

---

## TypeScript Types

The API response types are defined in `reviewer-ui/src/types.ts` and include:

- `CanonicalValue`
- `DimensionDefinition`
- `SourceConnection`
- `SourceFieldMapping`
- `ValueMapping`
- `SystemConfig`
- `MatchResponse`
- And many more...

These TypeScript interfaces provide full type safety for client-side code.

---

## Integration Examples

### Fetch Canonical Values
```javascript
const response = await fetch('http://localhost:8000/api/reference/canonical');
const canonicalValues = await response.json();
```

### Create a Connection
```javascript
const response = await fetch('http://localhost:8000/api/source/connections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Production DB',
    host: 'db.example.com',
    port: 5432,
    database: 'production',
    username: 'user',
    password: 'pass'
  })
});
const connection = await response.json();
```

### Get Match Statistics
```javascript
const response = await fetch(`http://localhost:8000/api/source/connections/${connectionId}/match-stats`);
const stats = await response.json();
```

For more examples, see the Reviewer UI source code in `reviewer-ui/src/api.ts`.

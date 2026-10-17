---
description: Define semantic dimensions, attach custom attribute schemas, and model parent/child relationships between dimensions.
---

# Dimensions

<p class="rdh-eyebrow">Workspace</p>

A **dimension** is a semantic domain — `marital_status`, `education`,
`nationality`, `employment_status`. Dimensions are the axis that everything
else in RefData Hub aligns to: canonical values belong to a dimension, source
fields map to a dimension, and match suggestions are scored within a dimension.

## Anatomy of a dimension

```json
{
  "code": "marital_status",
  "label": "Marital Status",
  "description": "Legal marital standing as reported by the individual",
  "extra_fields": [
    {
      "key": "is_legal_category",
      "label": "Is legal category",
      "data_type": "boolean",
      "description": "True when the value is a legal status rather than a descriptor",
      "required": false
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `code` | Unique, indexed, immutable once created. This is the join key everywhere else, so pick it carefully. |
| `label` | Human-facing name shown throughout the UI. |
| `description` | Optional prose shown in the playground and suggestion cards. |
| `extra_fields` | Attribute schema for this dimension. Defaults to `[]`. |

### Attribute field types

`data_type` must be exactly one of `string`, `number`, or `boolean`. The API
rejects anything else with a validation error, and the canonical value editor
renders the matching input control from it.

`required: true` makes the attribute mandatory on every canonical value created
under the dimension afterwards. Because it is enforced on create, set it only
once you are sure — existing rows are not retro-validated.

!!! warning "`code` cannot be changed"
    `PUT /api/reference/dimensions/{code}` updates `label`, `description`, and
    `extra_fields` only. The `code` is the identifier that field mappings and
    value mappings point at, so it is deliberately write-once. To rename a
    dimension, create the new one and migrate its values.

## CRUD reference

| Method | Endpoint | Notes |
| --- | --- | --- |
| `GET` | `/api/reference/dimensions` | Lists every dimension |
| `POST` | `/api/reference/dimensions` | Returns `201` |
| `PUT` | `/api/reference/dimensions/{code}` | Partial update — omitted keys untouched |
| `DELETE` | `/api/reference/dimensions/{code}` | Returns `204` |

```bash
curl -X POST http://localhost:8000/api/reference/dimensions \
  -H 'Content-Type: application/json' \
  -d '{"code": "loyalty_tier", "label": "Loyalty Tier", "description": "Customer loyalty band"}'
```

## Dimension detail view

Opening a dimension's detail page in the UI shows four derived metrics, all
computed client-side from `GET /api/source/value-mappings`:

- **Canonical values** — how many golden records the dimension holds
- **Documented entries** — how many carry a non-empty description
- **Attribute keys** — how many distinct attribute keys are in use
- **Value mappings** — how many raw-to-canonical mappings point at this dimension

Plus a canonical coverage table, an attribute fill-rate panel showing how often
each optional attribute is actually populated, and a mapping health breakdown by
status. The fill-rate panel is the fastest way to find attributes your team
declared but never populates — those are safe to drop.

## Dimension relations

Some dimensions are naturally hierarchical: `region` → `district`,
`country` → `city`. A **dimension relation** models that edge, and the links
under it pair actual canonical values so drill-down analytics work.

```
DimensionRelation
  label                    e.g. "Region to District"
  parent_dimension_code    e.g. "region"
  child_dimension_code     e.g. "district"
  description
```

A **relation link** then pairs one parent canonical value with one child:

```
DimensionRelationLink
  parent_canonical_id
  child_canonical_id
```

Both parent and child dimension codes are foreign keys to `dimension.code`, so
the two dimensions must exist before you can create the relation. The pair
`(parent, child, label)` is unique, and `(parent, child)` is unique per link —
you cannot record the same parent→child pairing twice.

### Endpoints

| Method | Endpoint | Notes |
| --- | --- | --- |
| `GET` | `/api/reference/dimension-relations` | Includes `link_count` per relation |
| `POST` | `/api/reference/dimension-relations` | Returns `201` |
| `PUT` | `/api/reference/dimension-relations/{relation_id}` | Partial update |
| `DELETE` | `/api/reference/dimension-relations/{relation_id}` | Returns `204`; cascades to links |
| `GET` | `/api/reference/dimension-relations/{relation_id}/links` | Value pairings |
| `POST` | `/api/reference/dimension-relations/{relation_id}/links` | Returns `201` |
| `DELETE` | `/api/reference/dimension-relations/{relation_id}/links/{link_id}` | Returns `204` |

```bash
curl -X POST http://localhost:8000/api/reference/dimension-relations \
  -H 'Content-Type: application/json' \
  -d '{
        "label": "Region to District",
        "parent_dimension_code": "region",
        "child_dimension_code": "district",
        "description": "Administrative containment"
      }'
```

!!! note "Relations are opt-in per pair"
    Declaring a relation does not imply that a parent maps to every child. Each
    valid pairing must be added as an explicit link, which keeps the graph
    honest about what the data actually says.

## Deleting a dimension

`DELETE` removes the dimension row. Because `dimensionrelation` holds foreign
keys to `dimension.code`, deleting a dimension that participates in a relation
will fail with a referential integrity error rather than silently orphaning the
relation. Remove the relation first.

## Next steps

<div class="grid cards" markdown>

-   :material-library: **Canonical Library**

    ---

    Add the actual values that live inside these dimensions.

    [:octicons-arrow-right-24: Canonical Library](canonical-library.md)

-   :material-source-branch: **Source Connections**

    ---

    Point real upstream schemas at the dimensions you just defined.

    [:octicons-arrow-right-24: Connect a source](source-connections.md)

</div>
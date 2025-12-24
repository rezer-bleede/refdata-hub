export interface CanonicalValue {
  id: number;
  dimension: string;
  canonical_label: string;
  description?: string | null;
  attributes?: Record<string, string | number | boolean | null> | null;
}

export interface CanonicalValueUpdatePayload {
  dimension?: string;
  canonical_label?: string;
  description?: string | null;
  attributes?: Record<string, string | number | boolean | null> | null;
}

export interface MatchCandidate {
  canonical_id: number;
  canonical_label: string;
  dimension: string;
  description?: string | null;
  score: number;
}

export interface MatchResponse {
  raw_text: string;
  dimension: string;
  matches: MatchCandidate[];
}

export interface SystemConfig {
  default_dimension: string;
  match_threshold: number;
  matcher_backend: 'embedding' | 'llm';
  embedding_model: string;
  llm_mode: 'online' | 'offline';
  llm_model?: string | null;
  llm_api_base?: string | null;
  top_k: number;
  llm_api_key_set: boolean;
}

export interface SystemConfigUpdate {
  default_dimension?: string;
  match_threshold?: number;
  matcher_backend?: 'embedding' | 'llm';
  embedding_model?: string;
  llm_mode?: 'online' | 'offline';
  llm_model?: string | null;
  llm_api_base?: string | null;
  top_k?: number;
  llm_api_key?: string;
}

export interface ToastMessage {
  type: 'success' | 'error';
  content: string;
}

export interface SourceConnection {
  id: number;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  options?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceConnectionCredentials {
  db_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  options?: string | null;
}

export interface SourceConnectionCreatePayload extends SourceConnectionCredentials {
  name: string;
}

export interface SourceConnectionUpdatePayload extends Partial<SourceConnectionCreatePayload> {}

export interface SourceConnectionTestPayload extends SourceConnectionCredentials {
  name?: string;
}

export interface SourceConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number | null;
}

export interface SourceTableMetadata {
  name: string;
  schema?: string | null;
  type: 'table' | 'view';
}

export interface SourceFieldMetadata {
  name: string;
  data_type?: string | null;
  nullable?: boolean | null;
  default?: string | null;
}

export interface SourceFieldMapping {
  id: number;
  source_connection_id: number;
  source_table: string;
  source_field: string;
  ref_dimension: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceFieldMappingPayload {
  source_table: string;
  source_field: string;
  ref_dimension: string;
  description?: string | null;
}

export interface SourceSampleValuePayload {
  raw_value: string;
  occurrence_count: number;
  dimension?: string | null;
}

export interface SourceSample {
  id: number;
  source_connection_id: number;
  source_table: string;
  source_field: string;
  dimension?: string | null;
  raw_value: string;
  occurrence_count: number;
  last_seen_at: string;
}

export interface FieldMatchStats {
  mapping_id: number;
  source_table: string;
  source_field: string;
  ref_dimension: string;
  total_values: number;
  matched_values: number;
  unmatched_values: number;
  match_rate: number;
  top_unmatched: UnmatchedValuePreview[];
  top_matched: MatchedValuePreview[];
}

export interface UnmatchedValuePreview {
  raw_value: string;
  occurrence_count: number;
  suggestions: MatchCandidate[];
}

export interface MatchedValuePreview {
  raw_value: string;
  occurrence_count: number;
  canonical_label: string;
  match_type: 'mapping' | 'semantic';
  confidence?: number | null;
}

export interface UnmatchedValueRecord extends UnmatchedValuePreview {
  mapping_id: number;
  source_table: string;
  source_field: string;
  ref_dimension: string;
}

export interface ValueMapping {
  id: number;
  source_connection_id: number;
  source_table: string;
  source_field: string;
  raw_value: string;
  canonical_id: number;
  status: string;
  confidence?: number | null;
  suggested_label?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValueMappingExpanded extends ValueMapping {
  canonical_label: string;
  ref_dimension: string;
}

export interface ValueMappingPayload {
  source_table: string;
  source_field: string;
  raw_value: string;
  canonical_id: number;
  status?: string;
  confidence?: number | null;
  suggested_label?: string | null;
  notes?: string | null;
}

export interface ValueMappingUpdatePayload extends Partial<ValueMappingPayload> {}

export interface ValueMappingImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export type DimensionExtraFieldType = 'string' | 'number' | 'boolean';

export interface DimensionExtraFieldDefinition {
  key: string;
  label: string;
  description?: string | null;
  data_type: DimensionExtraFieldType;
  required: boolean;
}

export interface DimensionDefinition {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  extra_fields: DimensionExtraFieldDefinition[];
  created_at: string;
  updated_at: string;
}

export interface DimensionCreatePayload {
  code: string;
  label: string;
  description?: string | null;
  extra_fields: DimensionExtraFieldDefinition[];
}

export interface DimensionUpdatePayload {
  label?: string;
  description?: string | null;
  extra_fields?: DimensionExtraFieldDefinition[];
}

export interface DimensionRelationSummary {
  id: number;
  label: string;
  description?: string | null;
  parent_dimension_code: string;
  child_dimension_code: string;
  parent_dimension: DimensionDefinition;
  child_dimension: DimensionDefinition;
  link_count: number;
  created_at: string;
  updated_at: string;
}

export interface DimensionRelationCreatePayload {
  label: string;
  parent_dimension_code: string;
  child_dimension_code: string;
  description?: string | null;
}

export interface DimensionRelationUpdatePayload {
  label?: string;
  description?: string | null;
}

export interface DimensionRelationLink {
  id: number;
  relation_id: number;
  parent_canonical_id: number;
  child_canonical_id: number;
  parent_label: string;
  child_label: string;
  created_at: string;
  updated_at: string;
}

export interface DimensionRelationLinkPayload {
  parent_canonical_id: number;
  child_canonical_id: number;
}

export interface BulkImportDuplicateRecord {
  row_number: number;
  dimension: string;
  canonical_label: string;
  existing_value: CanonicalValue;
  incoming_description?: string | null;
  incoming_attributes: Record<string, unknown>;
}

export interface BulkImportResult {
  created: CanonicalValue[];
  updated: CanonicalValue[];
  duplicates: BulkImportDuplicateRecord[];
  errors: string[];
}

export interface BulkImportPreviewColumn {
  name: string;
  sample: string[];
  suggested_role?: 'label' | 'dimension' | 'description' | 'attribute';
  suggested_attribute_key?: string;
  suggested_dimension?: string;
}

export interface ProposedDimensionSuggestion {
  code: string;
  label: string;
}

export interface BulkImportPreview {
  columns: BulkImportPreviewColumn[];
  suggested_dimension?: string | null;
  proposed_dimension?: ProposedDimensionSuggestion | null;
  available_sheets: string[];
  selected_sheet?: string | null;
  duplicates: BulkImportDuplicateRecord[];
}

export interface BulkImportColumnMapping {
  label?: string;
  dimension?: string;
  description?: string;
  attributes: Record<string, string>;
  default_dimension?: string;
  dimension_definition?: DimensionCreatePayload;
}

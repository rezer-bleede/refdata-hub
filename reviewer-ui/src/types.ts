export interface CanonicalValue {
  id: number;
  dimension: string;
  canonical_label: string;
  description?: string | null;
}

export interface CanonicalValueUpdatePayload {
  dimension?: string;
  canonical_label?: string;
  description?: string | null;
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

export interface SourceConnectionCreatePayload {
  name: string;
  db_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  options?: string | null;
}

export interface SourceConnectionUpdatePayload extends Partial<SourceConnectionCreatePayload> {}

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
}

export interface UnmatchedValuePreview {
  raw_value: string;
  occurrence_count: number;
  suggestions: MatchCandidate[];
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

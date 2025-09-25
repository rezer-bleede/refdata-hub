export interface CanonicalValue {
  id: number;
  dimension: string;
  canonical_label: string;
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

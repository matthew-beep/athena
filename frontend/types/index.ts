export interface DocProgress {
  stage: string;
  done: number;
  total: number;
  active: boolean;
  processing_status: string;
}

export type ProgressMap = Record<string, DocProgress>;

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Conversation {
  conversation_id: string;
  title: string | null;
  knowledge_tier: 'ephemeral' | 'persistent';
  started_at: string;
  last_active: string;
  token_count?: number;
}

export interface ConversationDocument {
  document_id: string;
  filename: string;
  file_type?: string;
  word_count?: number;
  added_at?: string;
}

export interface RagSource {
  filename: string;
  score: number;
  score_type?: 'hybrid' | 'vector';
  vector_score?: number;
  bm25_score?: number;
  chunk_index: number;
  document_id: string;
  text: string;
  chunk_id?: string;
}

export interface Message {
  message_id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_used: string | null;
  timestamp: string;
  rag_sources?: RagSource[];
}

export interface StreamToken {
  type: 'token';
  content: string;
}

export interface StreamDone {
  type: 'done';
  conversation_id: string;
  model_tier: number;
  model: string;
  latency_ms: number;
  rag_sources?: RagSource[];
}

export interface StreamError {
  type: 'error';
  content: string;
}

export interface StreamStatus {
  type: 'status';
  content: string;
}

export interface StreamContextDebug {
  type: 'context_debug';
  tokens: number;
  budget: number;
}

export interface StreamSources {
  type: 'sources';
  rag_sources: RagSource[];
}

export type StreamEvent =
  | StreamToken
  | StreamDone
  | StreamError
  | StreamStatus
  | StreamContextDebug
  | StreamSources;

export interface ResourceStats {
  cpu_pct: number;
  ram_used_gb: number;
  ram_total_gb: number;
  gpu_used_gb: number;
  gpu_total_gb: number;
  nvme_used_pct: number;
  hdd_used_pct: number;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export interface ModelStats {
  active: boolean
  name?: string
  size_gb?: number
  gpu_pct?: number
  ram_pct?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Collections (mirrors backend/app/models/collections.py)
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectionNameRequest {
  name: string;
}

export interface CollectionDocumentsRequest {
  document_ids: string[];
}

export interface CollectionItem {
  collection_id: string;
  name: string;
  created_at: string; // datetime
  document_count: number;
}

export interface CollectionsListResponse {
  collections: CollectionItem[];
  total: number;
}

export interface CollectionMutateResponse {
  collection_id: string;
  name: string;
  detail: string;
  created_at?: string | null; // datetime | null (only on create)
}

export interface CollectionDetailResponse {
  detail: string;
}

export interface CollectionDocumentsMutateResponse {
  detail: string;
  updated: number;
}

export interface SuggestionsRequest {
  conversation_id: string;
  last_user_message: string;
  last_assistant_message: string;
  history?: { role: string; content: string }[];
}

export interface SuggestionsResponse {
  suggestions: string[];
}
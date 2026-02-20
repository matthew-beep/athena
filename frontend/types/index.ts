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
}

export interface Message {
  message_id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_used: string | null;
  timestamp: string;
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
}

export interface StreamError {
  type: 'error';
  content: string;
}

export type StreamEvent = StreamToken | StreamDone | StreamError;

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

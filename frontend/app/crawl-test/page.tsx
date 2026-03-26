'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export default function CrawlTestPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/documents/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? 'Request failed');
        return;
      }
      // Extract markdown from response
      let md = data.markdown;
      if (md && typeof md === 'object') {
        md = md.raw_markdown ?? md.markdown_with_citations ?? '';
      }
      setResult(typeof md === 'string' ? md : JSON.stringify(data, null, 2));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'monospace' }}>
      <h1 style={{ marginBottom: 16 }}>Crawl Test</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder="https://example.com"
          style={{ flex: 1, padding: '8px 12px', fontSize: 14, background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 4 }}
        />
        <button
          onClick={handleFetch}
          disabled={loading || !url.trim()}
          style={{ padding: '8px 16px', background: '#fff', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}
        >
          {loading ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {error && (
        <pre style={{ marginTop: 20, padding: 12, background: '#1a0000', color: '#ff6b6b', border: '1px solid #440000', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {error}
        </pre>
      )}

      {result && (
        <pre style={{ marginTop: 20, padding: 12, background: '#0a0a0a', color: '#ccc', border: '1px solid #222', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 600, overflow: 'auto' }}>
          {result}
        </pre>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FetchResult {
  url: string;
  markdown: string;
  title: string;
  word_count: number;
}

export default function CrawlTestPage() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);

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
      setResult(data as FetchResult);
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
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#111', border: '1px solid #333', borderRadius: 4, fontSize: 13 }}>
            <div><span style={{ color: '#666' }}>title:</span> <span style={{ color: '#fff' }}>{result.title || '—'}</span></div>
            <div><span style={{ color: '#666' }}>url:</span> <span style={{ color: '#888' }}>{result.url}</span></div>
            <div><span style={{ color: '#666' }}>words:</span> <span style={{ color: '#888' }}>{result.word_count}</span></div>
          </div>
          <div
            style={{
              padding: 12,
              background: '#0a0a0a',
              border: '1px solid #222',
              borderRadius: 4,
              maxHeight: 600,
              overflow: 'auto',
            }}
          >
            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt, ...props }) => {
                    if (!src || String(src).trim() === '') return null;
                    return <img src={src} alt={alt ?? ''} {...props} />;
                  },
                }}
              >
                {result.markdown}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

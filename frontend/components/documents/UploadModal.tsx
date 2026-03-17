'use client';

import { useState, useRef } from 'react';
import { Link2, Upload, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export type UploadStage = 1 | 2 | 3 | 4;

export type QueuedItem =
  | { type: 'file'; id: string; file: File }
  | { type: 'url'; id: string; url: string };

function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u.trim());
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return u.trim().toLowerCase();
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeMeta(filename: string): { label: string; bg: string; border: string; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { label: 'PDF', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.22)', color: 'var(--red)' };
  if (ext === 'md' || ext === 'markdown') return { label: 'MD', bg: 'rgba(59,124,244,0.1)', border: 'rgba(59,124,244,0.22)', color: 'var(--blue)' };
  if (ext === 'docx') return { label: 'DOC', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.22)', color: 'var(--purple)' };
  if (ext === 'txt') return { label: 'TXT', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.22)', color: 'var(--green)' };
  if (ext === 'csv') return { label: 'CSV', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.22)', color: 'var(--amber)' };
  return { label: ext.toUpperCase().slice(0, 3) || 'FILE', bg: 'var(--raised-a)', border: 'var(--border)', color: 'var(--t3)' };
}

function TypeBadge({ filename }: { filename: string }) {
  const { label, bg, border, color } = getTypeMeta(filename);
  return (
    <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, border: `1px solid ${border}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: '8.5px', fontWeight: 700, fontFamily: 'var(--fm)', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );
}

const STAGE_TITLES: Record<UploadStage, string> = {
  1: 'Add Files',
  2: 'Save to Collection',
  3: 'Indexing…',
  4: 'Import Complete',
};

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
}

export function UploadModal({ open, onClose }: UploadModalProps) {
  const [stage, setStage] = useState<UploadStage>(1);
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setStage(1);
    setItems([]);
    setUrl('');
    setIsDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setItems((prev) => {
      const existingKeys = new Set(
        prev.filter((i): i is QueuedItem & { type: 'file' } => i.type === 'file').map((i) => `${i.file.name}:${i.file.size}`)
      );
      const deduped = files.filter((f) => !existingKeys.has(`${f.name}:${f.size}`));
      return [...prev, ...deduped.map((file) => ({ type: 'file' as const, id: crypto.randomUUID(), file }))];
    });
  };

  const handleAddUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try { new URL(withProtocol); } catch { return; }
    const normalized = normalizeUrl(withProtocol);
    setItems((prev) => {
      const existingUrls = new Set(
        prev.filter((i): i is QueuedItem & { type: 'url' } => i.type === 'url').map((i) => normalizeUrl(i.url))
      );
      if (existingUrls.has(normalized)) return prev;
      return [...prev, { type: 'url', id: crypto.randomUUID(), url: withProtocol }];
    });
    setUrl('');
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearAll = () => { setItems([]); setUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); addFiles(Array.from(e.dataTransfer.files)); };

  const footerStatusText = () => {
    if (stage === 1) return items.length === 0 ? 'Add files to continue' : `${items.length} file(s) ready`;
    if (stage === 2) return 'Save to collection';
    if (stage === 3) return 'Indexing continues in the background';
    return 'Done — files added to library';
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <div>
          <p className="df" style={{ fontSize: 15, color: 'var(--t1)' }}>
            {STAGE_TITLES[stage]}
          </p>
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            {([1, 2, 3, 4] as const).map((s) => (
              <div
                key={s}
                style={{
                  height: 3,
                  width: 28,
                  borderRadius: 2,
                  background: s <= stage ? 'var(--blue)' : 'var(--border)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--t4)', fontFamily: 'var(--fb)' }}>
            {footerStatusText()}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {stage < 3 && (
              <button
                type="button"
                className="btn btn-g"
                onClick={stage === 1 ? handleClose : () => setStage((prev) => (prev - 1) as UploadStage)}
              >
                {stage === 1 ? 'Cancel' : 'Back'}
              </button>
            )}
            {stage < 4 ? (
              <button
                type="button"
                className="btn btn-p"
                style={stage === 1 && items.length === 0 ? { opacity: 0.45, pointerEvents: 'none' } : {}}
                onClick={() => setStage((prev) => (prev + 1) as UploadStage)}
              >
                {stage === 1 ? 'Next' : stage === 2 ? 'Start Import' : 'Close'}
              </button>
            ) : (
              <button type="button" className="btn btn-p" onClick={handleClose}>Close</button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ padding: '16px 20px' }}>

        {/* ── Stage 1 — Add Files ── */}
        {stage === 1 && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); }}
              className="hidden"
              accept=".pdf,.md,.markdown,.txt,.docx,.csv,text/plain,text/markdown,application/pdf"
            />

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? 'var(--blue)' : 'var(--border-s)'}`,
                borderRadius: 12,
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                marginBottom: 12,
                background: isDragOver ? 'var(--blue-b)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {/* Icon box */}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--raised-h)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Upload size={16} strokeWidth={1.8} style={{ color: 'var(--t2)' }} />
              </div>

              {/* Label + format pills */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', fontFamily: 'var(--fb)', marginBottom: 6 }}>
                  Drop files here
                </p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['PDF', 'MD', 'DOCX', 'TXT'].map((fmt) => (
                    <span key={fmt} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 4, background: 'var(--raised-a)', border: '1px solid var(--border)', color: 'var(--t4)', fontFamily: 'var(--fm)' }}>
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Browse button */}
              <button
                type="button"
                className="btn btn-g"
                style={{ fontSize: 12, padding: '6px 13px', flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Browse
              </button>
            </div>

            {/* URL row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Link2 size={12} strokeWidth={2} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t4)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Paste a URL…"
                  className="inp"
                  style={{ paddingLeft: 28 }}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                />
              </div>
              <button type="button" className="btn btn-g" style={{ fontSize: 12, flexShrink: 0 }} onClick={handleAddUrl}>
                Add
              </button>
            </div>

            {/* File queue — empty */}
            {items.length === 0 && (
              <p style={{ textAlign: 'center', padding: '18px 0 4px', color: 'var(--t4)', fontSize: '12.5px', fontFamily: 'var(--fb)' }}>
                No files added yet
              </p>
            )}

            {/* File queue — populated */}
            {items.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="slabel">{items.length} item(s) queued</span>
                  <button type="button" onClick={clearAll} style={{ fontSize: 11, color: 'var(--t4)', fontFamily: 'var(--fb)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
                  {items.map((item, i) => (
                    <div
                      key={item.id}
                      className="animate-fade-up"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: 'var(--raised)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        animationDelay: `${i * 0.04}s`,
                      }}
                    >
                      {item.type === 'file' ? (
                        <>
                          <TypeBadge filename={item.file.name} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12.5px', color: 'var(--t1)', fontWeight: 500, fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.file.name}
                            </p>
                            <p style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>
                              {formatSize(item.file.size)}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(59,124,244,0.1)', border: '1px solid rgba(59,124,244,0.22)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Link2 size={12} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12.5px', color: 'var(--t1)', fontWeight: 500, fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.url}
                            </p>
                            <p style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>URL</p>
                          </div>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--t4)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stage 2 — Save to Collection (placeholder) ── */}
        {stage === 2 && (
          <div style={{ minHeight: 120 }}>
            <p style={{ fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--fb)' }}>Collection picker — coming soon.</p>
          </div>
        )}

        {/* ── Stage 3 — Indexing (placeholder) ── */}
        {stage === 3 && (
          <div style={{ minHeight: 120 }}>
            <p style={{ fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--fb)' }}>Indexing — coming soon.</p>
          </div>
        )}

        {/* ── Stage 4 — Done ── */}
        {stage === 4 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--green-a)', border: '1px solid var(--green-br)', borderRadius: 10, justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--green)', fontFamily: 'var(--fb)', fontWeight: 500 }}>
              All documents added to library
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

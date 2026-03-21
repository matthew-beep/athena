'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link2, Upload, X, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { CollectionItem } from '@/types';
import { Pill } from '@/components/ui/Pill';
import { apiClient } from '@/api/client';

export type UploadStage = 1 | 2 | 3 | 4;

export type QueuedItem =
  | { type: 'file'; id: string; file: File }
  | { type: 'url'; id: string; url: string };

/** Per-file outcome after POST /api/documents/upload */
export type ImportFileResult =
  | { queueItemId: string; ok: true; documentId: string; filename: string }
  | { queueItemId: string; ok: false; filename: string; error: string };

/** URL rows are not ingested until a URL→document backend exists */
export type ImportUrlResult = {
  queueItemId: string;
  ok: false;
  url: string;
  error: string;
};

export type ImportBatchResult = {
  fileResults: ImportFileResult[];
  urlResults: ImportUrlResult[];
  /** document_ids from successful file uploads */
  documentIds: string[];
  /** true if collectionId was set and assignment API succeeded */
  assignedToCollection: boolean;
};

/**
 * Upload all queued files, optionally assign them to a collection, and report URL rows as skipped.
 * Call this from the stage-2 "Start Import" action (not wired to UI here).
 */
export async function runImportFromQueue(options: {
  items: QueuedItem[];
  /** collections[].collection_id, or "" to skip assignment */
  collectionId: string;
}): Promise<ImportBatchResult> {

  const fileResults: ImportFileResult[] = [];
  const urlResults: ImportUrlResult[] = [];
  const documentIds: string[] = [];

  for (const item of options.items) {
    if (item.type === 'url') {
      urlResults.push({
        queueItemId: item.id,
        ok: false,
        url: item.url,
        error: 'URL ingestion is not implemented yet (backend has no document create from URL).',
      });
      continue;
    }

    const formData = new FormData();
    formData.append('file', item.file);
    if (options.collectionId) {
      formData.append('collection_id', options.collectionId);
    }

    try {
      const data = await apiClient.postForm<{ document_id?: string }>('/documents/upload', formData);
      if (!data.document_id) {
        fileResults.push({
          queueItemId: item.id,
          ok: false,
          filename: item.file.name,
          error: 'Missing document_id in response',
        });
        continue;
      }
      documentIds.push(data.document_id);
      fileResults.push({
        queueItemId: item.id,
        ok: true,
        documentId: data.document_id,
        filename: item.file.name,
      });
    } catch (e) {
      fileResults.push({
        queueItemId: item.id,
        ok: false,
        filename: item.file.name,
        error: e instanceof Error ? e.message : 'Upload failed',
      });
    }
  }

  const assignedToCollection = !!(options.collectionId && documentIds.length > 0);

  return { fileResults, urlResults, documentIds, assignedToCollection };
}

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

const COLLECTION_COLORS = [
  'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--amber)',
  '#f87171', '#34d399', '#a78bfa', '#fb923c',
];

const STAGE_TITLES: Record<UploadStage, string> = {
  1: 'Add Files',
  2: 'Save to Collection',
  3: 'Indexing…',
  4: 'Import Complete',
};

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  collections: CollectionItem[];
  onCreateCollection: (name: string) => Promise<void>;
}

export function UploadModal({ open, onClose, collections, onCreateCollection }: UploadModalProps) {
  const [stage, setStage] = useState<UploadStage>(1);
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [addingNewCol, setAddingNewCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const newColInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportBatchResult | null>(null);
  const [importInProgress, setImportInProgress] = useState(false);

  useEffect(() => {
    if (addingNewCol) newColInputRef.current?.focus();
  }, [addingNewCol]);


  const handleClose = () => {
    setStage(1);
    setItems([]);
    setUrl('');
    setIsDragOver(false);
    setImportResult(null);
    setImportInProgress(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  /**
   * Primary footer action: Next (1→2), Start Import (2→3 + uploads), advance indexing UI (3→4).
   */
  const handlePrimaryStageAction = useCallback(async () => {
    if (stage === 1) {
      if (items.length === 0) return;
      setStage(2);
      return;
    }
    if (stage === 2) {
      if (importInProgress) return;
      setImportInProgress(true);
      setImportResult(null);
      try {
        const result = await runImportFromQueue({
          items,
          collectionId: selectedCollection,
        });
        setImportResult(result);
        setStage(3);
      } catch (e) {
        console.error(e);
      } finally {
        setImportInProgress(false);
      }
      return;
    }
    if (stage === 3) {
      setStage(4);
    }
  }, [stage, items, selectedCollection, importInProgress]);

  const handleCreateCollection = async (name: string) => {
    try {
      const trimmed = name.trim();
      if (!trimmed) return;
      await onCreateCollection(trimmed);
    } catch (error) {
      console.error(error);
    }
  }

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
    if (stage === 2) return `Saving to: ${selectedCollection ? collections.find((c) => c.collection_id === selectedCollection)?.name : '-'}`;
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
                style={
                  (stage === 1 && items.length === 0) || (stage === 2 && importInProgress)
                    ? { opacity: 0.45, pointerEvents: 'none' }
                    : {}
                }
                disabled={stage === 2 && importInProgress}
                onClick={() => void handlePrimaryStageAction()}
              >
                {stage === 1 ? 'Next' : stage === 2 ? (importInProgress ? 'Importing…' : 'Start Import') : 'Close'}
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
                    <Pill key={fmt}>
                      {fmt}
                    </Pill>
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

        {/* ── Stage 2 — Save to Collection ── */}
        {stage === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* File summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-a)', border: '1px solid var(--blue-br)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={15} strokeWidth={1.8} style={{ color: 'var(--blue)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--t1)', fontFamily: 'var(--fb)', fontWeight: 500 }}>
                  {items.length} file{items.length !== 1 ? 's' : ''} ready to import
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {items.map((i) => (i.type === 'file' ? i.file.name : i.url)).join(', ')}
                </div>
              </div>
              <button
                type="button"
                style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', whiteSpace: 'nowrap' }}
                onClick={() => setStage(1)}
              >
                Edit
              </button>
            </div>

            {/* Collection picker */}
            <div>
              <div className="slabel" style={{ marginBottom: 8 }}>Save to collection</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {collections.map((c, i) => {
                  const color = COLLECTION_COLORS[i % COLLECTION_COLORS.length];
                  const sel = selectedCollection === c.collection_id;
                  return (
                    <button
                      key={c.collection_id}
                      type="button"
                      className={`pill pill-collection${sel ? ' pill-collection--selected' : ''}`}
                      style={{
                        borderColor: sel ? color : '',
                        background: sel ? color + '22' : '',
                        color: sel ? color : '',
                        gap: 5,
                      }}
                      onClick={() => setSelectedCollection(sel ? '' : c.collection_id)}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                      {c.name}
                    </button>
                  );
                })}
                {addingNewCol ? (
                  <div
                    className="pill pill-collection pill-collection--dashed"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      borderStyle: 'dashed',
                      borderColor: 'var(--blue-br)',
                      padding: '2px 4px 2px 10px',
                      maxWidth: 200,
                    }}
                  >
                    <input
                      ref={newColInputRef}
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newColName.trim()) {
                          handleCreateCollection(newColName.trim());
                          setNewColName('');
                          setAddingNewCol(false);
                        }
                        if (e.key === 'Escape') {
                          setAddingNewCol(false);
                          setNewColName('');
                        }
                      }}
                      onBlur={() => {
                        setAddingNewCol(false);
                        setNewColName('');
                      }}
                      placeholder="Collection name"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--t1)',
                        fontSize: 11,
                        fontFamily: 'var(--fb)',
                        outline: 'none',
                        flex: 1,
                        minWidth: 0,
                        width: 100,
                      }}
                    />
                    <button
                      type="button"
                      className="pill-collection-dismiss"
                      aria-label="Cancel new collection"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAddingNewCol(false);
                        setNewColName('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--t3)',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'color 0.15s ease, background 0.15s ease',
                      }}
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="pill pill-collection pill-collection--dashed"
                    style={{ borderStyle: 'dashed' }}
                    onClick={() => setAddingNewCol(true)}
                  >
                    + New
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stage 3 — Indexing ── */}
        {stage === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--blue-a)', border: '1px solid var(--blue-br)', borderRadius: 10 }}>
              <div className="animate-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--blue-br)', borderTop: '2px solid var(--blue)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)', fontFamily: 'var(--fb)' }}>
                Indexing {items.length} document{items.length !== 1 ? 's' : ''}…
              </span>
              <span style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--fb)' }}>You can close this</span>
            </div>
            {items.map((item) => (
              <div key={item.id} style={{ padding: '10px 12px', background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div className="animate-spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border-s)', borderTop: '2px solid var(--blue)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--t1)', fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.type === 'file' ? item.file.name : item.url}
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '0%', background: 'var(--blue)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--fb)', marginTop: 4 }}>Queued for processing</div>
              </div>
            ))}
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

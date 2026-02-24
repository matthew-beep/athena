'use client';

import { useState, useRef, type DragEvent } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth.store';

export interface UploadedDocument {
  document_id: string;
  filename: string;
  mime_type?: string;
  word_count?: number;
  status: string;
  message?: string;
}

interface UploadZoneProps {
  /** Called when a file is about to be uploaded (so the UI can show it in the processing list). */
  onUploadStart?: (payload: { file: File; tempId: string }) => void;
  /** Called when a file has been uploaded; use tempId to match the item added in onUploadStart. */
  onUploadComplete?: (payload: { tempId: string; doc: UploadedDocument }) => void;
  /** Called when upload fails so the panel can remove the placeholder from the processing list. */
  onUploadFailed?: (tempId: string) => void;
}

interface StagedFile {
  file: File;
  id: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onUploadStart, onUploadComplete, onUploadFailed }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploadResults, setUploadResults] = useState<{ name: string; ok: boolean }[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const stageFiles = (files: File[]) => {
    const next: StagedFile[] = files.map((f) => ({ file: f, id: `${f.name}-${f.size}-${Date.now()}` }));
    setStaged((prev) => {
      const existingNames = new Set(prev.map((s) => s.file.name));
      return [...prev, ...next.filter((n) => !existingNames.has(n.file.name))];
    });
    setUploadResults([]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    stageFiles(Array.from(e.dataTransfer.files));
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpload = async () => {
    if (!staged.length || uploading) return;
    setUploading(true);
    setUploadResults([]);
    const token = useAuthStore.getState().token;
    const toUpload = [...staged];
    let anyOk = false;

    for (let i = 0; i < toUpload.length; i++) {
      const { file, id } = toUpload[i];
      const tempId = `upload-${id}`;
      onUploadStart?.({ file, tempId });

      const formData = new FormData();
      formData.append('file', file);
      let ok = false;
      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        ok = res.ok;
        if (ok) {
          const data = await res.json();
          setUploadResults((prev) => [...prev, { name: file.name, ok }]);
          onUploadComplete?.({ tempId, doc: data });
        } else {
          setUploadResults((prev) => [...prev, { name: file.name, ok: false }]);
          onUploadFailed?.(tempId);
        }
      } catch {
        setUploadResults((prev) => [...prev, { name: file.name, ok: false }]);
        onUploadFailed?.(tempId);
      }
      setStaged((prev) => prev.filter((s) => s.id !== id));
      if (ok) anyOk = true;
    }

    setUploading(false);
  };

  const succeeded = uploadResults.filter((r) => r.ok);
  const failed = uploadResults.filter((r) => !r.ok);

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'glass rounded-sm border border-dashed p-8 text-center cursor-pointer transition-all select-none',
          isDragging
            ? 'border-foreground/30 bg-white/5'
            : 'border-border/40 hover:border-border/70 hover:bg-white/[0.02]'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.md,.docx"
          multiple
          onChange={(e) => {
            stageFiles(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center">
            <Upload size={15} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground font-mono">PDF · TXT · Markdown</p>
        </div>
      </div>

      {/* Staged file queue */}
      {staged.length > 0 && (
        <div className="glass rounded-sm border border-border/40 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {staged.length} file{staged.length !== 1 ? 's' : ''} queued
            </p>
          </div>
          <ul className="divide-y divide-border/20">
            {staged.map(({ file, id }, index) => {
              const isCurrent = uploading && index === 0;
              const isPending = uploading && index > 0;
              return (
                <li
                  key={id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 transition-opacity',
                    isPending && 'opacity-50'
                  )}
                >
                  {isCurrent ? (
                    <div className="w-[14px] h-[14px] shrink-0 flex items-center justify-center">
                      <div className="w-3.5 h-3.5 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin" />
                    </div>
                  ) : (
                    <FileText size={14} className="text-muted-foreground/60 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeStaged(id)}
                    disabled={uploading}
                    className="w-5 h-5 rounded-sm flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <X size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2.5 border-t border-border/30">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full h-8 rounded-sm bg-foreground text-background text-sm font-medium flex items-center justify-center gap-2 hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                `Upload ${staged.length} file${staged.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload result feedback */}
      {failed.length > 0 && (
        <div className="flex flex-col gap-3">
          {/*succeeded.length > 0 && (
            <div className="glass rounded-sm border border-border/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/30">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {succeeded.length} file{succeeded.length !== 1 ? 's' : ''} uploaded
                </p>
              </div>
              <div className="flex flex-col gap-1 p-3">
                {succeeded.map((r, i) => (
                  <p
                    key={`ok-${i}-${r.name}`}
                    className="text-xs font-mono px-3 py-1.5 rounded-sm bg-green-500/10 text-green-400 border border-green-500/20"
                  >
                    ✓ {r.name}
                  </p>
                ))}
              </div>
            </div>
          )*/}
          {failed.length > 0 && (
            <div className="glass rounded-sm border border-border/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/30">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {failed.length} file{failed.length !== 1 ? 's' : ''} failed
                </p>
              </div>
              <div className="flex flex-col gap-1 p-3">
                {failed.map((r, i) => (
                  <p
                    key={`fail-${i}-${r.name}`}
                    className="text-xs font-mono px-3 py-1.5 rounded-sm bg-red-500/10 text-red-400 border border-red-500/20"
                  >
                    ✗ {r.name}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { UploadZone, type UploadedDocument } from './UploadZone';
import { DocumentList } from './DocumentList';
import { GlassCard } from '@/components/ui/GlassCard';

export type ProcessingDoc = {
  document_id: string;
  filename: string;
  mime_type?: string;
  word_count?: number;
  status: 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'queued' | 'complete';
  progress: number;
  chunks: number;
  concepts: number;
  completedAt?: number;
};

const STAGES_AFTER_UPLOAD: ProcessingDoc['status'][] = ['extracting', 'chunking', 'embedding'];
const STAGE_DURATION_MS = 1200;
const UPLOAD_PROGRESS_DURATION_MS = 1500;
const TICK_MS = 80;
const COMPLETE_DELAY_MS = 600;

export function DocumentsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingDocs, setProcessingDocs] = useState<ProcessingDoc[]>([]);
  const startedAt = useRef<Map<string, number>>(new Map());

  const onUploadStart = useCallback((payload: { file: File; tempId: string }) => {
    setProcessingDocs((prev) => [
      ...prev,
      {
        document_id: payload.tempId,
        filename: payload.file.name,
        status: 'uploading',
        progress: 0,
        chunks: 0,
        concepts: 0,
      },
    ]);
  }, []);

  const onUploadFailed = useCallback((tempId: string) => {
    setProcessingDocs((prev) => prev.filter((d) => d.document_id !== tempId));
  }, []);

  const onUploadComplete = useCallback((payload: { tempId: string; doc: UploadedDocument }) => {
    // Drop the placeholder — the real DB row (status: processing) appears via the
    // refreshKey refetch triggered by the length decrease in the effect below.
    // Fake stage animations (extracting/chunking/embedding) are misleading because
    // actual backend work takes 10-60s+. Let the polling show real status instead.
    setProcessingDocs((prev) => prev.filter((d) => d.document_id !== payload.tempId));
    startedAt.current.delete(payload.tempId);
  }, []);

  useEffect(() => {
    if (processingDocs.length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      setProcessingDocs((prev) => {
        const next = prev
          .map((d) => {
            if (d.status === 'complete') {
              if (d.completedAt && now - d.completedAt >= COMPLETE_DELAY_MS) return null;
              return d;
            }
            const key = d.document_id;
            const start = startedAt.current.get(key) ?? now;
            startedAt.current.set(key, start);
            const elapsed = now - start;

            if (d.status === 'uploading') {
              const progress = Math.min(100, (elapsed / UPLOAD_PROGRESS_DURATION_MS) * 100);
              return { ...d, progress };
            }

            const stageIndex = STAGES_AFTER_UPLOAD.indexOf(d.status);
            const stageStart = stageIndex * STAGE_DURATION_MS;
            const stageElapsed = elapsed - stageStart;
            if (stageIndex >= 0 && stageElapsed >= STAGE_DURATION_MS) {
              if (stageIndex === STAGES_AFTER_UPLOAD.length - 1) {
                startedAt.current.delete(key);
                return {
                  ...d,
                  status: 'complete',
                  progress: 100,
                  chunks: Math.max(1, Math.floor((d.word_count ?? 500) / 400)),
                  concepts: 0,
                  completedAt: now,
                };
              }
              return {
                ...d,
                status: STAGES_AFTER_UPLOAD[stageIndex + 1],
                progress: 0,
                chunks: d.status === 'chunking' ? Math.max(1, Math.floor((d.word_count ?? 500) / 400)) : d.chunks,
              };
            }
            const progress = Math.min(100, Math.max(0, (stageElapsed / STAGE_DURATION_MS) * 100));
            const chunks =
              d.status === 'chunking'
                ? Math.max(0, Math.floor((progress / 100) * Math.max(1, (d.word_count ?? 500) / 400)))
                : d.chunks;
            return { ...d, progress, chunks };
          })
          .filter((d): d is ProcessingDoc => d !== null);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [processingDocs.length]);

  const prevLengthRef = useRef(processingDocs.length);
  useEffect(() => {
    if (processingDocs.length < prevLengthRef.current) setRefreshKey((k) => k + 1);
    prevLengthRef.current = processingDocs.length;
  }, [processingDocs.length]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-up">
        <div>
          <h2 className="text-base font-display font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents to add them to Athena's knowledge base
          </p>
        </div>
        <UploadZone onUploadStart={onUploadStart} onUploadComplete={onUploadComplete} onUploadFailed={onUploadFailed} />
        <GlassCard>
         <input type="text" placeholder="Search documents" className="font-mono w-full bg-transparent outline-none p-2" />
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Knowledge Base</h3>
          </div>
          <DocumentList refreshKey={refreshKey} processingDocs={processingDocs} />
        </GlassCard>
      </div>
    </div>
  );
}

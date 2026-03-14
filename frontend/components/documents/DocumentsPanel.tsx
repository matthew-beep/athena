'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { UploadZone, type UploadedDocument } from './UploadZone';
import { DocumentList } from './DocumentList';
import { GlassCard } from '@/components/ui/GlassCard';
import { apiClient } from '@/api/client';
import { FilePlusIcon } from 'lucide-react';
import { DocumentSideBar } from './DocumentSideBar';
import { DocumentTypeSelector } from './DocumentTypeSelector';
import { UploadModal } from './UploadModal';
import type { CollectionItem, CollectionsListResponse } from '@/types';
import { Pill } from '@/components/ui/Pill';
import { useAuthStore } from '@/stores/auth.store';

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docCount, setDocCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [processingDocs, setProcessingDocs] = useState<ProcessingDoc[]>([]);
  const startedAt = useRef<Map<string, number>>(new Map());
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');

  const [selectedCollections, setSelectedCollections] = useState<CollectionItem[]>([]); // will need to load this in
  const [docTypes, setDocTypes] = useState<string[]>(["PDF", "TXT", "Markdown"]); // will need to load this in
  const [tab, setTab] = useState<string>("all");
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchDocuments = () => {
    const token = useAuthStore.getState().token;
    return fetch('/api/documents', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { 
        setDocuments(data.documents ?? []); 
        setDocCount(data.doc_count ?? 0); 
        setError(null); 
      })
      .catch(() => setError('Failed to load documents'));
  };


  const handleSelectCollection = (collection: CollectionItem) => {
    setSelectedCollections((prev) =>
      prev.some((c) => c.collection_id === collection.collection_id)
        ? prev.filter((c) => c.collection_id !== collection.collection_id)
        : [...prev, collection]
    );
  };

  const handleSelectDocType = (docType: string) => {
    setTab(docType);
  };

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

  const refetchCollections = useCallback(async () => {
    try{
      setLoadingCollections(true);
      const response = await apiClient.get<CollectionsListResponse>("/collections");
      setCollections(response.collections);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCollections(false);
    }
  }, [])

  const removeSelectedCollection = (collectionId: string) => {
    setSelectedCollections((prev) => prev.filter((c) => c.collection_id !== collectionId));
  };

  // refetch collections on mount and on changes
  useEffect(() => {
      refetchCollections();
    
  }, [refetchCollections]);



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


  useEffect(() => { refetchCollections(); }, [refetchCollections]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="animate-fade-up w-full flex flex-col h-full">
        <header className="flex items-center justify-between border-b border-b-[var(--border)] p-4">
          <div className="flex flex-col items-start justify-between">
            <h2 className="text-base font-display font-semibold tracking-tight">Library</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {docCount} Documents - {collections.length} Collections
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input type="text" placeholder="Search documents" className="border-[var(--border)] border w-full bg-transparent outline-none p-2 rounded-md" value={search} onChange={(e) => setSearch(e.target.value)} />

            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <FilePlusIcon className="w-4 h-4" />
              Upload
            </button>
          </div>
        </header>

        <div className="flex w-full h-full">
          <DocumentSideBar
            collections={collections}
            loadingCollections={loadingCollections}
            selectedCollections={selectedCollections}
            onSelectCollection={handleSelectCollection}
            onCollectionDeleted={(id) => setSelectedCollections((prev) => prev.filter((c) => c.collection_id !== id))}
            refetchCollections={refetchCollections}
          />
          <div className="flex flex-col w-full">

            {selectedCollections.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2">
                {selectedCollections.map((c) => (
                  <Pill key={c.collection_id} onDelete={() => removeSelectedCollection(c.collection_id)}>{c.name}</Pill>
                ))}
              </div>
            )}
            <div className="px-4 py-2 border-b border-b-[var(--border)]">
              <DocumentTypeSelector docTypes={docTypes} onSelectDocType={handleSelectDocType} tab={tab} />
            </div>
            <DocumentList refreshKey={refreshKey} processingDocs={processingDocs} search={search}/>
          </div>
        </div>
      </div>

      <UploadModal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} />
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect } from 'react';
import { DocumentList } from './DocumentList';
import type { DocumentItem } from './DocumentList';
import { apiClient } from '@/api/client';
import { FilePlusIcon } from 'lucide-react';
import { DocumentSideBar } from './DocumentSideBar';
import { DocumentTypeSelector } from './DocumentTypeSelector';
import { UploadModal } from './UploadModal';
import type { CollectionItem, CollectionMutateResponse, CollectionsListResponse, ProgressMap } from '@/types';
import { Pill } from '@/components/ui/Pill';
import { useAuthStore } from '@/stores/auth.store';

export function DocumentsPanel() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [progressMap, setProgressMap] = useState<ProgressMap | null>(null);
  const [isPollingProgress, setIsPollingProgress] = useState(false);

  const [selectedCollections, setSelectedCollections] = useState<CollectionItem[]>([]);
  const [docTypes] = useState<string[]>(["PDF", "TXT", "Markdown"]);
  const [tab, setTab] = useState<string>("all");
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchDocuments = useCallback(() => {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch('/api/documents', { headers })
      .then((r) => r.json())
      .then((data) => {
        setDocuments(data.documents ?? []);
        setDocsError(null);
      })
      .catch(() => setDocsError('Failed to load documents'));
  }, []);

  // Poll /progress/active while isPollingProgress is true
  useEffect(() => {
    if (!isPollingProgress) return;

    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const poll = () => {
      fetch('/api/documents/progress/active', { headers })
        .then((r) => r.json())
        .then((data: ProgressMap) => {
          setProgressMap(data);
          if (Object.keys(data).length === 0) {
            setIsPollingProgress(false);
            fetchDocuments();
          }
        })
        .catch(() => {});
    };

    poll();
    const t = setInterval(poll, 800);
    return () => clearInterval(t);
  }, [isPollingProgress, fetchDocuments]);

  const handleDeleteDocument = useCallback((documentId: string) => {
    setDocuments((prev) => prev.filter((d) => d.document_id !== documentId));
  }, []);

  const handleSelectCollection = (collection: CollectionItem) => {
    setSelectedCollections((prev) =>
      prev.some((c) => c.collection_id === collection.collection_id)
        ? prev.filter((c) => c.collection_id !== collection.collection_id)
        : [...prev, collection]
    );
  };

  const refetchCollections = useCallback(async () => {
    try {
      setLoadingCollections(true);
      const response = await apiClient.get<CollectionsListResponse>("/collections");
      setCollections(response.collections);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  const removeSelectedCollection = (collectionId: string) => {
    setSelectedCollections((prev) => prev.filter((c) => c.collection_id !== collectionId));
  };

  const createCollection = useCallback(async (name: string): Promise<string> => {
    const trimmed = name.trim();
    const res = await apiClient.post<CollectionMutateResponse>('/collections', { name: trimmed });
    await refetchCollections();
    return res.collection_id;
  }, [refetchCollections]);

  const handleImportComplete = useCallback(() => {
    setIsPollingProgress(true);
  }, []);

  useEffect(() => {
    refetchCollections();
  }, [refetchCollections]);

  useEffect(() => {
    setLoadingDocs(true);
    fetchDocuments().finally(() => setLoadingDocs(false));
  }, [fetchDocuments]);

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="animate-fade-up w-full flex flex-col h-full">
        <header className="flex items-center justify-between border-b border-b-[var(--border)] p-4">
          <div className="flex flex-col items-start justify-between">
            <h2 className="text-base font-display font-semibold tracking-tight">Library</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {collections.length} Collections
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="Search documents"
              className="border-[var(--border)] border w-full bg-transparent outline-none p-2 rounded-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
            onCreateCollection={createCollection}
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
              <DocumentTypeSelector docTypes={docTypes} onSelectDocType={setTab} tab={tab} />
            </div>
            <DocumentList
              documents={documents}
              loading={loadingDocs}
              error={docsError}
              progressMap={progressMap}
              search={search}
              collectionIds={selectedCollections.map((c) => c.collection_id)}
              fileType={tab}
              onDelete={handleDeleteDocument}
            />
          </div>
        </div>
      </div>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        collections={collections}
        onCreateCollection={createCollection}
        onImportComplete={handleImportComplete}
        progressMap={progressMap}
      />
    </div>
  );
}

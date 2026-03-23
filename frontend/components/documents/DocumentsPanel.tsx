'use client';

import { useState, useCallback, useEffect } from 'react';
import { DocumentList } from './DocumentList';
import { apiClient } from '@/api/client';
import { FilePlusIcon } from 'lucide-react';
import { DocumentSideBar } from './DocumentSideBar';
import { DocumentTypeSelector } from './DocumentTypeSelector';
import { UploadModal } from './UploadModal';
import type { CollectionItem, CollectionMutateResponse, CollectionsListResponse } from '@/types';
import { Pill } from '@/components/ui/Pill';
import { useAuthStore } from '@/stores/auth.store';

export function DocumentsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docCount, setDocCount] = useState<number>(0);
  const [search, setSearch] = useState('');

  const [selectedCollections, setSelectedCollections] = useState<CollectionItem[]>([]);
  const [docTypes, setDocTypes] = useState<string[]>(["PDF", "TXT", "Markdown"]);
  const [tab, setTab] = useState<string>("all");
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

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

  const createCollection = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await apiClient.post<CollectionMutateResponse>('/collections', { name: trimmed });
    await refetchCollections();
  }, [refetchCollections]);

  useEffect(() => {
    refetchCollections();
  }, [refetchCollections]);

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
              <DocumentTypeSelector docTypes={docTypes} onSelectDocType={handleSelectDocType} tab={tab} />
            </div>
            <DocumentList refreshKey={refreshKey} search={search} />
          </div>
        </div>
      </div>

      <UploadModal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} collections={collections} onCreateCollection={createCollection}/>
    </div>
  );
}

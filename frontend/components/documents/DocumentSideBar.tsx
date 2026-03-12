'use client';

import { Loader2, PlusIcon, CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiClient } from '@/api/client';
import type { CollectionMutateResponse } from '@/types';
import { CollectionsList } from './CollectionsList';


interface DocumentSideBarProps {
  collections: string[];
  selectedCollections: string[];
  onSelectCollection: (collection: string) => void;
  loadingCollections: boolean;
  refetchCollections: () => void;
}

export function DocumentSideBar({ collections, selectedCollections, onSelectCollection, loadingCollections, refetchCollections }: DocumentSideBarProps) {

  const  [creatingCollection, setCreatingCollection] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [newCollectionName, setNewCollectionName] = useState('');


  useEffect(() => {
    if (creatingCollection) inputRef.current?.focus();
  }, [creatingCollection]);




  const createCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
  
    try {
      await apiClient.post<CollectionMutateResponse>('/collections', { name });
      setNewCollectionName('');
      setCreatingCollection(false);
      await refetchCollections();
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingCollection(false);
    }
    
  };

  const handleCreateCollection = () => {

    if (loadingCollections) return;

    setCreatingCollection(!creatingCollection);
  }

  return (
    <div 
      className="w-full h-full p-4 max-w-[240px] shrink-0 border-r border-r-[var(--border)]">
      <div className="flex flex-col gap-3 h-full">
        <div className="flex flex-col gap-2 h-full min-h-0">
          {/* Header*/}
          <div className="flex items-center justify-between gap-2 w-full">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Collections</h3>
            <button 
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-[var(--t1)] hover:bg-[color:var(--border)]/30 transition-colors disabled:opacity-50"
              onClick={handleCreateCollection}
              disabled={loadingCollections}
            >
              <PlusIcon className={`w-4 h-4 rounded-full ${creatingCollection ? 'rotate-45' : ''} transition-transform duration-200`}/>
            </button>
          </div>

          {/* Collections */}
          <div className="flex flex-col gap-2 h-full min-h-0">
            {creatingCollection && (
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-transparent px-2 py-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="New collection"
                  value={newCollectionName}
                  className="w-full bg-transparent outline-none text-sm text-[var(--t1)] placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createCollection();
                    if (e.key === 'Escape') setCreatingCollection(false);
                  }}
                  onChange={(e) => setNewCollectionName(e.target.value)}

                />
                <button
                  className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-[var(--t1)] hover:bg-[color:var(--border)]/30 transition-colors"
                  onClick={createCollection}
                  aria-label="Create collection"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {loadingCollections ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-1 overflow-y-auto h-full">
                {collections && collections.length > 0 ? (
                  <CollectionsList
                    collections={collections}
                    selectedCollections={selectedCollections}
                    onSelectCollection={onSelectCollection}
                    onAction={(collection, action) => {
                      console.log('collection action', { collection, action });
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center flex-1">
                    <p className="text-sm text-muted-foreground">No documents</p>
                  </div>
                )}
              </div>
          )}

          </div>




          {/**
           * basically if no collections exist display no collections
           * if a user creates document then create a new collection
           * 
           * 
           * 
           * 
           * 
           */}


        </div>
      </div>
    </div>
  );
}

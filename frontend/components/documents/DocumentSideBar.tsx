'use client';

import { Loader2, PlusIcon, CheckIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiClient } from '@/api/client';

interface DocumentSideBarProps {
  collections: string[];
  selectedCollections: string[];
  onSelectCollection: (collection: string) => void;
  loadingCollections: boolean;
}

export function DocumentSideBar({ collections, selectedCollections, onSelectCollection, loadingCollections }: DocumentSideBarProps) {

  const  [creatingCollection, setCreatingCollection] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingCollection) inputRef.current?.focus();
  }, [creatingCollection]);




  const createCollection = async () => {
    console.log("create collection");
    try {
      setCreatingCollection(true);
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingCollection(false);
    }
  }

  const handleCreateCollection = () => {

    setCreatingCollection(!creatingCollection);
  }

  return (
    <div 
      className="w-full h-full p-4 max-w-[210px] border-r border-r-[var(--border)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 w-full">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Collections</h3>
            <button 
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
              onClick={handleCreateCollection }
            >
              <PlusIcon className={`w-4 h-4 rounded-full ${creatingCollection ? 'rotate-45' : ''} transition-transform duration-200`}/>
            </button>
          </div>

          {creatingCollection && (
            <div className="flex items-center justify-center h-full">
              <input ref={inputRef} type="text" placeholder="New Collection" className="w-full bg-transparent outline-none p-2 rounded-md" />
              <div className="flex items-center justify-center gap-2">
                <CheckIcon className="w-4 h-4" />
              </div>
            </div>
          )}

          {loadingCollections ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            ) : (
            <div className="flex flex-col gap-2">
              {collections && collections.length > 0 ? collections.map((collection) => (
                <label
                  key={collection}
                  htmlFor={collection}
                  className={`cursor-pointer flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:text-[var(--t1)] transition-colors ${selectedCollections.includes(collection) ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}`}
                >
                  <input
                    type="checkbox"
                    id={collection}
                    name={collection}
                    value={collection}
                    checked={selectedCollections.includes(collection)}
                    className="doc-sidebar-checkbox"
                    onChange={() => onSelectCollection(collection)}
                  />
                  <span className="truncate">{collection}</span>
                </label>
              )) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">No collections found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

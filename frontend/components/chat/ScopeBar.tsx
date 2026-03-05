'use client';

import { Globe, FileText, X } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useShallow } from 'zustand/react/shallow';
import { apiClient } from '@/api/client';

export function ScopeBar() {
  const {
    activeConversationId,
    conversationDocuments,
    removeConversationDocument,
    pendingDocuments,
    setPendingDocuments,
    conversationSearchAll,
    setSearchAll,
    pendingSearchAll,
    setPendingSearchAll,
  } = useChatStore(
    useShallow((s) => ({
      activeConversationId: s.activeConversationId,
      conversationDocuments: s.conversationDocuments,
      removeConversationDocument: s.removeConversationDocument,
      pendingDocuments: s.pendingDocuments,
      setPendingDocuments: s.setPendingDocuments,
      conversationSearchAll: s.conversationSearchAll,
      setSearchAll: s.setSearchAll,
      pendingSearchAll: s.pendingSearchAll,
      setPendingSearchAll: s.setPendingSearchAll,
    }))
  );

  const docs = activeConversationId
    ? (conversationDocuments[activeConversationId] ?? [])
    : pendingDocuments;

  const isSearchAll = activeConversationId
    ? (conversationSearchAll[activeConversationId] ?? false)
    : pendingSearchAll;

  const hasDocs = docs.length > 0;

  if (!hasDocs && !isSearchAll) return null;

  const handleRemove = (docId: string) => {
    if (!activeConversationId) {
      setPendingDocuments(pendingDocuments.filter((d) => d.document_id !== docId));
      return;
    }
    apiClient
      .delete(`/chat/${activeConversationId}/documents/${docId}`)
      .then(() => removeConversationDocument(activeConversationId, docId))
      .catch(console.error);
  };

  const handleDisableSearchAll = () => {
    if (activeConversationId) {
      setSearchAll(activeConversationId, false);
    } else {
      setPendingSearchAll(false);
    }
  };

  return (
    <div className="px-4 pt-2.5 pb-0 flex items-center gap-1.5 flex-wrap border-t border-border/20">
      {hasDocs && !isSearchAll ? (
        docs.map((doc) => (
          <span
            key={doc.document_id}
            className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border border-border/40 bg-foreground/5 text-[10px] font-mono text-muted-foreground max-w-[220px]"
          >
            <FileText size={9} className="flex-shrink-0 text-muted-foreground/50" />
            <span className="truncate">{doc.filename}</span>
            <button
              onClick={() => handleRemove(doc.document_id)}
              className="flex-shrink-0 ml-0.5 p-0.5 rounded-full text-muted-foreground/40 hover:text-foreground transition-colors"
              aria-label={`Remove ${doc.filename}`}
            >
              <X size={8} />
            </button>
          </span>
        ))
      ) : (
        <span className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border border-border/40 bg-foreground/5 text-[10px] font-mono text-muted-foreground">
          <Globe size={9} className="flex-shrink-0 text-muted-foreground/50" />
          <span>Searching all documents</span>
          <button
            onClick={handleDisableSearchAll}
            className="flex-shrink-0 ml-0.5 p-0.5 rounded-full text-muted-foreground/40 hover:text-foreground transition-colors"
            aria-label="Disable search all"
          >
            <X size={8} />
          </button>
        </span>
      )}
    </div>
  );
}

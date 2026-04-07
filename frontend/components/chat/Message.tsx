'use client';

import { useMemo, useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Pin } from 'lucide-react';
import { TierBadge } from './TierBadge';
import { useChatStore } from '@/stores/chat.store';
import { apiClient } from '@/api/client';
import { useShallow } from 'zustand/react/shallow';
import type { Message as MessageType, RagSource } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SourceItem } from './SourceItem';

interface MessageProps {
  message: MessageType;
}



function SourcesPanel({ sources }: { sources: RagSource[] }) {
  const { setCitationShutter, activeConversationId, conversationDocuments, addConversationDocument, setSearchAll } = useChatStore(
    useShallow((s) => ({
      setCitationShutter: s.setCitationShutter,
      activeConversationId: s.activeConversationId,
      conversationDocuments: s.conversationDocuments,
      addConversationDocument: s.addConversationDocument,
      setSearchAll: s.setSearchAll,
    }))
  );



  const attachedIds = activeConversationId
    ? new Set((conversationDocuments[activeConversationId] ?? []).map((d) => d.document_id))
    : new Set<string>();

  const handleAttach = (src: RagSource) => {
    if (!activeConversationId || attachedIds.has(src.document_id)) return;
    apiClient
      .post(`/chat/${activeConversationId}/documents`, { document_ids: [src.document_id] })
      .then(() => {
        addConversationDocument(activeConversationId, { document_id: src.document_id, filename: src.filename });
        setSearchAll(activeConversationId, false);
      })
      .catch(console.error);
  };


  const [open, setOpen] = useState(false);

  // TODO: re do deduped to show chunk rather than unique document 

  return (
    <div className="px-1 mt-0.5">



      {sources && (<div className="flex gap-1">
        {sources.map((src, index) => (
          <SourceItem key={src.filename + (src.chunk_id ?? src.chunk_index)} index={index} />
        ))}
      </div>)}


    </div>
  );
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const hasSources = !isUser && (message.rag_sources?.length ?? 0) > 0;

  const { selectedMessageId, setSelectedMessageId } = useChatStore(
    useShallow((s) => ({
      selectedMessageId: s.selectedMessageId,
      setSelectedMessageId: s.setSelectedMessageId,
    }))
  );

  const isActiveMessage = selectedMessageId[message.conversation_id] === message.message_id;

  useEffect(() => {
    console.log(selectedMessageId);
  }, [selectedMessageId]);

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold font-display ${
          isUser
            ? 'bg-foreground/10 border border-foreground/20 text-foreground'
            : 'bg-foreground/5 border border-foreground/10 text-muted-foreground'
        }`}
      >
        {isUser ? 'U' : 'A'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] ${
          isUser ? 'items-end' : `items-start ${isActiveMessage ? 'border-[var(--blue-br)]' : ''}`
        } flex flex-col gap-1`}
      >
        <div 
          className={isUser ? 'msg-user' : `msg-ai border ${isActiveMessage ? 'border-[var(--blue-br)] bg-[var(--blue-a)]' : 'border-[var(--border)]'}`}
          onClick={() => {
            if (isUser) return;
            setSelectedMessageId(message.conversation_id, message.message_id)
          }}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className={`message-content`}>
              <div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer: tier badge + sources toggle */}
        {!isUser && (
          <div className="flex flex-col gap-1 w-full">
            {message.model_used && (
              <div className="px-1">
                <TierBadge tier={1} model={message.model_used} />
              </div>
            )}
            {hasSources && (
              <SourcesPanel sources={message.rag_sources!} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

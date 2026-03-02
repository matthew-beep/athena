'use client';

import { useState } from 'react';
import { FileText, X, Plus, Search, Zap, Lightbulb } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/utils/cn';

// ── Mock data — replace with store/API when wired up ───────────────────────
const MOCK_SCOPED = [
  { document_id: 'doc_1', filename: 'transformer-paper.pdf' },
];

const MOCK_SUGGESTED = [
  { document_id: 'doc_2', filename: 'attention-mechanism.pdf', score: 0.84 },
  { document_id: 'doc_3', filename: 'lecture-notes.md', score: 0.71 },
  { document_id: 'doc_4', filename: 'system-design.md', score: 0.63 },
];

const MOCK_ALL = [
  { document_id: 'doc_1', filename: 'transformer-paper.pdf' },
  { document_id: 'doc_2', filename: 'attention-mechanism.pdf' },
  { document_id: 'doc_3', filename: 'lecture-notes.md' },
  { document_id: 'doc_4', filename: 'system-design.md' },
  { document_id: 'doc_5', filename: 'algorithms.pdf' },
  { document_id: 'doc_6', filename: 'notes.txt' },
  { document_id: 'doc_7', filename: 'research-synthesis.md' },
];
// ──────────────────────────────────────────────────────────────────────────

type Doc = { document_id: string; filename: string };

// ── Context ────────────────────────────────────────────────────────────────

function ContextSection({
  tokens,
  budget,
  model,
}: {
  tokens: number;
  budget: number;
  model: string | null;
}) {
  const pct = budget > 0 ? Math.min(tokens / budget, 1) : 0;
  const barColor =
    pct > 0.8
      ? 'bg-red-400/60'
      : pct > 0.6
      ? 'bg-yellow-400/60'
      : 'bg-foreground/25';

  return (
    <div className="px-4 py-3 border-b border-border/20">
      <div className="flex items-center gap-2 mb-2.5">
        <Zap size={11} className="text-muted-foreground/40" />
        <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Context
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
          <span>
            {tokens.toLocaleString()} / {budget.toLocaleString()} tok
          </span>
          <span>{Math.round(pct * 100)}%</span>
        </div>
        <div className="h-1 rounded-full bg-foreground/5 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/35">
          {model ?? '—'} · Tier 1
        </p>
      </div>
    </div>
  );
}

// ── In Scope ───────────────────────────────────────────────────────────────

function ScopeSection({
  scoped,
  onRemove,
  onAdd,
}: {
  scoped: Doc[];
  onRemove: (id: string) => void;
  onAdd: (doc: Doc) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const scopedIds = new Set(scoped.map((d) => d.document_id));
  const pickerResults = MOCK_ALL.filter(
    (d) =>
      !scopedIds.has(d.document_id) &&
      d.filename.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (doc: Doc) => {
    onAdd(doc);
    setShowPicker(false);
    setSearch('');
  };

  return (
    <div className="px-4 py-3 border-b border-border/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={11} className="text-muted-foreground/40" />
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
            In Scope
          </span>
          {scoped.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/30">
              ({scoped.length})
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setShowPicker((v) => !v);
            setSearch('');
          }}
          className="p-1 rounded text-muted-foreground/30 hover:text-foreground transition-colors"
          title="Add document"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Attached docs */}
      {scoped.length === 0 && !showPicker && (
        <p className="text-[10px] font-mono text-muted-foreground/25 py-1">
          No documents in scope
        </p>
      )}
      <div className="space-y-1">
        {scoped.map((doc) => (
          <div
            key={doc.document_id}
            className="flex items-center gap-2 px-2 py-1 rounded-md bg-foreground/5 border border-border/20 group"
          >
            <FileText size={10} className="text-muted-foreground/35 flex-shrink-0" />
            <span className="text-[10px] font-mono text-foreground/65 truncate flex-1">
              {doc.filename}
            </span>
            <button
              onClick={() => onRemove(doc.document_id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/35 hover:text-foreground flex-shrink-0"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Inline search picker */}
      {showPicker && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-foreground/5 border border-border/25">
            <Search size={10} className="text-muted-foreground/35 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search documents..."
              className="bg-transparent text-[10px] font-mono text-foreground placeholder:text-muted-foreground/30 outline-none flex-1"
            />
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {pickerResults.length === 0 && (
              <p className="text-[10px] font-mono text-muted-foreground/25 px-1 py-1">
                No results
              </p>
            )}
            {pickerResults.map((doc) => (
              <button
                key={doc.document_id}
                onClick={() => handleAdd(doc)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-foreground/5 transition-colors group"
              >
                <FileText size={10} className="text-muted-foreground/25 flex-shrink-0" />
                <span className="text-[10px] font-mono text-muted-foreground/50 group-hover:text-foreground truncate transition-colors">
                  {doc.filename}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suggested ──────────────────────────────────────────────────────────────

type SuggestedDoc = Doc & { score: number };

function SuggestedSection({
  suggestions,
  scopedIds,
  onPin,
}: {
  suggestions: SuggestedDoc[];
  scopedIds: Set<string>;
  onPin: (doc: Doc) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = suggestions.filter(
    (s) => !dismissed.has(s.document_id) && !scopedIds.has(s.document_id)
  );

  if (visible.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={11} className="text-muted-foreground/40" />
        <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Suggested
        </span>
      </div>
      <div className="space-y-1">
        {visible.map((doc) => (
          <div
            key={doc.document_id}
            className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/15 hover:border-border/25 group transition-colors"
          >
            <FileText size={10} className="text-muted-foreground/25 flex-shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground/45 truncate flex-1">
              {doc.filename}
            </span>

            {/* Default: show score */}
            <span className="text-[10px] font-mono text-muted-foreground/25 flex-shrink-0 group-hover:hidden">
              {Math.round(doc.score * 100)}%
            </span>

            {/* Hover: show actions */}
            <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onPin({ document_id: doc.document_id, filename: doc.filename })}
                className="text-[10px] font-mono text-foreground/50 hover:text-foreground px-1.5 py-0.5 rounded border border-border/25 hover:border-border/50 transition-colors"
              >
                + pin
              </button>
              <button
                onClick={() =>
                  setDismissed((s) => new Set([...s, doc.document_id]))
                }
                className="text-muted-foreground/25 hover:text-muted-foreground transition-colors"
              >
                <X size={9} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DocumentBar ────────────────────────────────────────────────────────────

export function DocumentBar() {
  const { activeConversationId, contextTokens, contextBudget, activeModel } =
    useChatStore(
      useShallow((s) => ({
        activeConversationId: s.activeConversationId,
        contextTokens: s.contextTokens,
        contextBudget: s.contextBudget,
        activeModel: s.activeModel,
      }))
    );

  const tokens = activeConversationId
    ? (contextTokens[activeConversationId] ?? 0)
    : 0;

  // Local state — will live in chat.store once wired
  const [scoped, setScoped] = useState<Doc[]>(MOCK_SCOPED);

  const scopedIds = new Set(scoped.map((d) => d.document_id));

  const handleAdd = (doc: Doc) => {
    if (!scopedIds.has(doc.document_id)) {
      setScoped((s) => [...s, doc]);
    }
  };

  const handleRemove = (id: string) => {
    setScoped((s) => s.filter((d) => d.document_id !== id));
  };

  return (
    <div className="flex flex-col glass-strong shadow-glass h-full rounded-lg overflow-hidden">
      <ContextSection tokens={tokens} budget={contextBudget} model={activeModel} />
      <ScopeSection scoped={scoped} onRemove={handleRemove} onAdd={handleAdd} />
      <SuggestedSection
        suggestions={MOCK_SUGGESTED}
        scopedIds={scopedIds}
        onPin={handleAdd}
      />
    </div>
  );
}

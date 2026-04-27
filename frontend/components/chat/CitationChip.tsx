import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH = 240;
const EDGE_MARGIN = 8;
const HOVER_DELAY_MS = 250;

// Ensures only one tooltip is open at a time across all chips
let closeActiveTooltip: (() => void) | null = null;

export function CitationChip({
  index,
  filename,
  text,
  active = false,
  onClick,
}: {
  index: number;
  filename?: string;
  text: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => {
      closeActiveTooltip?.();
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const centerX = r.left + r.width / 2;
      const left = Math.max(EDGE_MARGIN, Math.min(centerX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - EDGE_MARGIN));
      setPos({ top: r.top - EDGE_MARGIN, left });
      closeActiveTooltip = () => setPos(null);
    }, HOVER_DELAY_MS);
  }

  function handleMouseLeave() {
    const hadTimer = !!timerRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(null);
    closeActiveTooltip = null;
  }

  return (
    <span className="relative inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {pos && typeof document !== 'undefined' && createPortal(
        <span
          className="tooltip-enter fixed z-[9999] w-[240px] overflow-hidden rounded-md border border-border/50 bg-background shadow-md"
          style={{ top: pos.top, left: pos.left }}
          role="tooltip"
        >
          {filename && (
            <span className="block border-b border-border/40 px-3 py-2 text-[10px] font-medium text-foreground truncate">
              {filename}
            </span>
          )} 
          <div className="p-3">
            <span className="line-clamp-3 text-[10px] font-mono leading-relaxed text-muted-foreground">
              {text}
            </span>
          </div>
        </span>,
        document.body
      )}
      <button
        ref={btnRef}
        type="button"
        className={`flex items-center truncate relative z-10 min-w-6 max-w-[80px] cursor-pointer overflow-hidden whitespace-nowrap rounded-md border px-1 py-0.5 text-center transition-colors ${active ? 'border-[var(--blue-br)] bg-[var(--blue-a)] text-[var(--t1)]' : 'border-[var(--blue-br)] bg-[var(--blue-a)] text-[var(--blue)] hover:bg-[var(--blue-br)]'}`}
        onClick={onClick}
      >
        <span className="min-w-0 truncate text-[10px] font-mono">{filename ? filename.replace(/\.[^/.]+$/, '') : index + 1}</span>
      </button>
    </span>
  );
}

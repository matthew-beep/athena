import { useState } from 'react';




export function CitationChip({
  index,
  text,
  active = false,
  onClick,
}: {
  index: number;
  text: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);



  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 max-w-[min(240px,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-border/50 bg-background px-2 py-1.5 shadow-md"
          role="tooltip"
        >
          <span className="line-clamp-[8] text-[10px] font-mono leading-relaxed text-muted-foreground">
            {text}
          </span>
        </span>
      )}
      <button
        type="button"
        className={`relative z-10 min-w-6 cursor-pointer rounded-md border px-1 py-0.5 text-center transition-colors ${active ? 'border-[var(--blue-br)] bg-[var(--blue-a)] text-[var(--t1)]' : 'border-[var(--blue-br)] bg-[var(--blue-a)] text-[var(--blue)] hover:bg-[var(--blue-br)]'}`}
        onClick={onClick}
      >
        <span className="text-[10px] font-mono">{index + 1}</span>
      </button>
    </span>
  );
}

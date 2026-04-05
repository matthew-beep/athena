export function SourceItem({ index, active = false, onClick }: { index: number, active?: boolean, onClick?: () => void }) {
    return (
      <button className={`border rounded-md px-1 py-0.5 min-w-6 text-center cursor-pointer border-[var(--blue-br)] bg-[var(--blue-a)] text-[var(--blue)] transition-colors ${active ? 'bg-[var(--blue-a)] text-[var(--t1)]' : 'bg-[var(--blue-a)] text-[var(--blue)]'}`} onClick={onClick}>
        <p className={`text-[10px] font-mono`}>{index + 1}</p>
      </button>
    );
  }
'use client';

import { Menu } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';

export function MobileHeader() {
  const { setSidebarOpen } = useUIStore();

  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 glass-subtle border-b border-border/30 flex-shrink-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center">
          <span className="text-foreground text-xs font-bold font-display">A</span>
        </div>
        <span className="font-display font-semibold text-sm tracking-tight">Athena</span>
      </div>
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
    </header>
  );
}

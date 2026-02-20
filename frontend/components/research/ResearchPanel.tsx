'use client';

import { Search } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

export function ResearchPanel() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <h2 className="text-base font-display font-semibold tracking-tight">Research</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Launch autonomous research pipelines to build persistent knowledge
          </p>
        </div>
        <GlassCard className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <Search size={24} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Research pipeline — Phase 5</p>
        </GlassCard>
      </div>
    </div>
  );
}

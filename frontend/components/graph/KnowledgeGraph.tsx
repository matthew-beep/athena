'use client';

import { Network } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

export function KnowledgeGraph() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <h2 className="text-base font-display font-semibold tracking-tight">Knowledge Graph</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Concept relationships extracted from research and documents
          </p>
        </div>
        <GlassCard className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <Network size={24} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Knowledge graph — Phase 6</p>
        </GlassCard>
      </div>
    </div>
  );
}

'use client';

import { BookOpen } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

export function QuizzesPanel() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <h2 className="text-base font-display font-semibold tracking-tight">Quizzes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Test knowledge retention with spaced repetition
          </p>
        </div>
        <GlassCard className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <BookOpen size={24} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Quiz engine — Phase 3</p>
        </GlassCard>
      </div>
    </div>
  );
}

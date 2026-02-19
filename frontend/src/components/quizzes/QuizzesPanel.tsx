import { BookOpen, Brain } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

export function QuizzesPanel() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <GlassCard className="p-8 text-center max-w-md animate-scale-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <BookOpen size={28} className="text-primary/60" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Spaced Repetition Quizzes</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Quiz generation via Tier 2 model, SM-2 spaced repetition scheduling,
          and concept mastery tracking. Coming in Phase 3.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Brain size={12} />
          <span>Requires document ingestion pipeline</span>
        </div>
      </GlassCard>
    </div>
  );
}

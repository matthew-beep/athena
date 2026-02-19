import { Network } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

export function KnowledgeGraph() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <GlassCard className="p-8 text-center max-w-md animate-scale-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Network size={28} className="text-accent/60" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Knowledge Graph</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Concept nodes and relationships extracted from research and documents,
          visualized with D3.js. Coming in Phase 6.
        </p>
        {/* Placeholder graph visualization */}
        <div className="mt-4 h-32 glass-subtle rounded-xl flex items-center justify-center">
          <div className="flex gap-6 items-center opacity-30">
            <div className="w-8 h-8 rounded-full border-2 border-primary" />
            <div className="w-16 h-px bg-muted-foreground" />
            <div className="w-8 h-8 rounded-full border-2 border-accent" />
            <div className="w-16 h-px bg-muted-foreground" />
            <div className="w-8 h-8 rounded-full border-2 border-primary/50" />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

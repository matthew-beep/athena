import { Search, Zap } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

export function ResearchPanel() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <GlassCard className="p-8 text-center max-w-md animate-scale-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Search size={28} className="text-primary/60" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Research Pipeline</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Multi-stage autonomous research with web search, scraping, and Tier 3
          synthesis. Coming in Phase 5.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Zap size={12} />
          <span>Requires SerpAPI + Crawl4AI + Ollama 70B</span>
        </div>
      </GlassCard>
    </div>
  );
}

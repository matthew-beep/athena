import { GlassCard } from "../ui/GlassCard";
import { Badge } from "../ui/Badge";
import { Server, Cpu, Database, Zap } from "lucide-react";
import { useSystemStore } from "../../stores/system.store";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function SettingsPanel() {
  const stats = useSystemStore((s) => s.stats);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <h2 className="text-lg font-semibold">Settings & System Info</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Prototype v0.1.0 — Phase 1 Light Prototype
          </p>
        </div>

        <GlassCard className="p-5 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Models</h3>
          </div>
          <InfoRow label="Active Model" value="llama3.2:3b (Tier 1)" />
          <InfoRow label="Inference" value="Ollama" />
          <InfoRow label="Embedding" value="Not configured (Phase 2)" />
        </GlassCard>

        <GlassCard className="p-5 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-accent" />
            <h3 className="text-sm font-semibold">Storage</h3>
          </div>
          <InfoRow label="Database" value="PostgreSQL 16" />
          <InfoRow label="Vector DB" value="Not configured (Phase 2)" />
          <InfoRow label="Cache" value="Not configured (Phase 2)" />
        </GlassCard>

        {stats && (
          <GlassCard className="p-5 space-y-1">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Resources</h3>
            </div>
            <InfoRow label="CPU" value={`${stats.cpu_pct.toFixed(1)}%`} />
            <InfoRow
              label="RAM"
              value={`${stats.ram_used_gb.toFixed(1)} / ${stats.ram_total_gb} GB`}
            />
            <InfoRow
              label="GPU"
              value={`${stats.gpu_used_gb.toFixed(1)} / ${stats.gpu_total_gb} GB`}
            />
            <InfoRow
              label="NVMe"
              value={`${stats.nvme_used_pct.toFixed(0)}% used`}
            />
          </GlassCard>
        )}

        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-accent" />
            <h3 className="text-sm font-semibold">Phase Roadmap</h3>
          </div>
          <div className="space-y-2">
            {[
              {
                phase: "Phase 1",
                label: "Foundation + Auth + Chat",
                done: true,
              },
              { phase: "Phase 2", label: "Document Processing", done: false },
              {
                phase: "Phase 3",
                label: "Quizzes + Spaced Repetition",
                done: false,
              },
              {
                phase: "Phase 4",
                label: "Two-Tier Knowledge Model",
                done: false,
              },
              { phase: "Phase 5", label: "Research Pipeline", done: false },
              { phase: "Phase 6", label: "Knowledge Graph", done: false },
            ].map(({ phase, label, done }) => (
              <div key={phase} className="flex items-center gap-3 py-1">
                <Badge variant={done ? "accent" : "muted"}>
                  {done ? "Done" : "Planned"}
                </Badge>
                <span className="text-sm">
                  <span className="text-muted-foreground">{phase}: </span>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

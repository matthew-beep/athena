import { useSystemStore } from "../../stores/system.store";
import { useSystemStats } from "../../hooks/useSystemStats";

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-bar w-16">
      <div
        className="progress-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function SystemFooter() {
  useSystemStats();
  const stats = useSystemStore((s) => s.stats);

  const fallback = {
    cpu_pct: 0,
    ram_used_gb: 0,
    ram_total_gb: 96,
    gpu_used_gb: 0,
    gpu_total_gb: 16,
    nvme_used_pct: 0,
    hdd_used_pct: 0,
  };

  const s = stats ?? fallback;
  const gpuPct = (s.gpu_used_gb / s.gpu_total_gb) * 100;

  return (
    <div className="glass-subtle border-t border-border/50 px-4 py-2 flex items-center gap-6 text-xs text-muted-foreground flex-shrink-0">
      <div className="flex items-center gap-2">
        <span>NVMe</span>
        <ProgressBar value={s.nvme_used_pct} color="hsl(217 91% 60%)" />
        <span>{s.nvme_used_pct.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span>HDD</span>
        <ProgressBar value={s.hdd_used_pct} color="hsl(217 91% 60%)" />
        <span>{s.hdd_used_pct.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span>CPU</span>
        <ProgressBar value={s.cpu_pct} color="hsl(142 71% 45%)" />
        <span>{s.cpu_pct.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span>GPU</span>
        <ProgressBar value={gpuPct} color="hsl(270 80% 65%)" />
        <span>
          {s.gpu_used_gb.toFixed(1)}/{s.gpu_total_gb}GB
        </span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="status-online" />
        <span>Athena v0.1.0</span>
      </div>
    </div>
  );
}

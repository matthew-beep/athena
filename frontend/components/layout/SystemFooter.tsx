'use client';

import { useSystemStore } from '@/stores/system.store';
import { useSystemStats } from '@/hooks/useSystemStats';
import { cn } from '@/utils/cn';

function PrecisionBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-bar w-14">
      <div
        className="progress-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function SystemFooter({ className }: { className?: string }) {
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
    <div className={cn('glass-subtle border-t border-border/30 px-4 py-2 flex items-center gap-5 flex-shrink-0 relative z-10', className)}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">NVMe</span>
        <PrecisionBar value={s.nvme_used_pct} color="hsl(217 91% 60%)" />
        <span className="font-mono text-xs text-muted-foreground">
          {s.nvme_used_pct.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">HDD</span>
        <PrecisionBar value={s.hdd_used_pct} color="hsl(217 91% 60%)" />
        <span className="font-mono text-xs text-muted-foreground">
          {s.hdd_used_pct.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">CPU</span>
        <PrecisionBar value={s.cpu_pct} color="hsl(142 71% 45%)" />
        <span className="font-mono text-xs text-muted-foreground">
          {s.cpu_pct.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">GPU</span>
        <PrecisionBar value={gpuPct} color="hsl(270 80% 65%)" />
        <span className="font-mono text-xs text-muted-foreground">
          {s.gpu_used_gb.toFixed(1)}/{s.gpu_total_gb}GB
        </span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="status-online" />
        <span className="font-mono text-[10px] text-muted-foreground">Athena v0.2.0</span>
      </div>
    </div>
  );
}

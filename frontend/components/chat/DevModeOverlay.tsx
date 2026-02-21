'use client';

import { useUIStore } from '@/stores/ui.store';
import { useChatStore } from '@/stores/chat.store';
import { useSystemStore } from '@/stores/system.store';

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-px w-full bg-white/10 rounded-none overflow-hidden">
      <div className="h-full rounded-none transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground/60">{label}</span>
      <span className="text-foreground/80 tabular-nums">{value}</span>
    </div>
  );
}

export function DevModeOverlay() {
  const devMode = useUIStore((s) => s.devMode);
  const { contextTokens, contextBudget, messageTokens, activeConversationId } = useChatStore();
  const stats = useSystemStore((s) => s.stats);

  if (!devMode) return null;

  const convTokens = (activeConversationId ? contextTokens[activeConversationId] : 0) ?? 0;
  const historyBudget = Math.max(0, contextBudget - 500 - 1000 - messageTokens);
  const ctxPct = contextBudget > 0 ? Math.round((convTokens / contextBudget) * 100) : 0;
  const ramPct = stats ? (stats.ram_used_gb / stats.ram_total_gb) * 100 : 0;
  const gpuPct = stats ? (stats.gpu_used_gb / stats.gpu_total_gb) * 100 : 0;

  const WARN_TOKENS = 3000;
  const inputWarning = messageTokens > WARN_TOKENS;

  return (
    <div
      className="fixed bottom-14 right-3 z-50 w-52 rounded-sm border border-border/40 glass-subtle"
      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', lineHeight: '1.6' }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-border/30 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
          dev mode
        </span>
        <span
          className={`tabular-nums ${ctxPct > 85 ? 'text-red-400' : ctxPct > 60 ? 'text-yellow-400' : 'text-green-400/70'}`}
        >
          {convTokens > 0 ? `${ctxPct}%` : '—'} ctx
        </span>
      </div>

      {/* Context section */}
      <div className="px-3 py-2 space-y-1.5 border-b border-border/20">
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">
          context
        </div>
        <Row
          label="input est"
          value={
            inputWarning
              ? `~${messageTokens} tok ⚠`
              : `~${messageTokens} tok`
          }
        />
        <Row label="history budget" value={`${historyBudget} tok`} />
        <Row label="total sent" value={convTokens > 0 ? `${convTokens} / ${contextBudget}` : '— / 4096'} />
        <MiniBar value={convTokens} max={contextBudget} color={ctxPct > 85 ? 'hsl(0 72% 51%)' : ctxPct > 60 ? 'hsl(43 96% 56%)' : 'hsl(142 71% 45%)'} />
      </div>

      {/* System section */}
      {stats ? (
        <div className="px-3 py-2 space-y-1.5">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">
            system
          </div>
          <Row label="cpu" value={`${stats.cpu_pct.toFixed(0)}%`} />
          <MiniBar value={stats.cpu_pct} max={100} color="hsl(142 71% 45%)" />
          <Row
            label="ram"
            value={`${stats.ram_used_gb.toFixed(1)} / ${stats.ram_total_gb} GB`}
          />
          <MiniBar value={ramPct} max={100} color="hsl(217 91% 60%)" />
          <Row
            label="vram"
            value={`${stats.gpu_used_gb.toFixed(1)} / ${stats.gpu_total_gb} GB`}
          />
          <MiniBar value={gpuPct} max={100} color="hsl(270 80% 65%)" />
        </div>
      ) : (
        <div className="px-3 py-2 text-muted-foreground/40">
          system stats unavailable
        </div>
      )}
    </div>
  );
}

'use client';

import { Moon, Sun } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore, type BgTheme } from '@/stores/theme.store';
import { cn } from '@/utils/cn';

const BG_THEMES: {
  id: BgTheme;
  label: string;
  preview: string;
}[] = [
  {
    id: 'solid',
    label: 'Solid',
    preview: 'bg-background',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    preview: '',
  },
  {
    id: 'ember',
    label: 'Ember',
    preview: '',
  },
  {
    id: 'forest',
    label: 'Forest',
    preview: '',
  },
  {
    id: 'dusk',
    label: 'Dusk',
    preview: '',
  },
];

const BG_GRADIENTS: Record<BgTheme, string> = {
  solid: '',
  aurora:
    'radial-gradient(ellipse at 15% 40%, rgba(59,130,246,0.4) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(139,92,246,0.3) 0%, transparent 55%), radial-gradient(ellipse at 50% 90%, rgba(20,184,166,0.25) 0%, transparent 50%)',
  ember:
    'radial-gradient(ellipse at 20% 30%, rgba(239,68,68,0.35) 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(251,146,60,0.30) 0%, transparent 50%), radial-gradient(ellipse at 50% 5%, rgba(234,179,8,0.20) 0%, transparent 40%)',
  forest:
    'radial-gradient(ellipse at 25% 65%, rgba(34,197,94,0.35) 0%, transparent 55%), radial-gradient(ellipse at 75% 20%, rgba(20,184,166,0.30) 0%, transparent 50%)',
  dusk:
    'radial-gradient(ellipse at 25% 40%, rgba(168,85,247,0.38) 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(236,72,153,0.32) 0%, transparent 55%)',
};

export function SettingsPanel() {
  const { user } = useAuthStore();
  const { colorMode, bgTheme, setColorMode, setBgTheme } = useThemeStore();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <h2 className="text-base font-display font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            System configuration and preferences
          </p>
        </div>

        {/* Account info */}
        <GlassCard className="p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground">User</span>
              <span className="text-sm font-mono">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-mono">0.2.0</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">LLM Backend</span>
              <span className="text-sm font-mono">Ollama · qwen2.5:7b</span>
            </div>
          </div>
        </GlassCard>

        {/* Appearance */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-display font-semibold mb-4 tracking-tight">Appearance</h3>

          {/* Color mode */}
          <div className="mb-5">
            <p className="text-xs text-muted-foreground font-mono mb-2">Color mode</p>
            <div className="flex gap-2">
              <button
                onClick={() => setColorMode('dark')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  colorMode === 'dark'
                    ? 'bg-foreground text-background border-foreground'
                    : 'glass-subtle border-border/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Moon size={14} />
                Dark
              </button>
              <button
                onClick={() => setColorMode('light')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  colorMode === 'light'
                    ? 'bg-foreground text-background border-foreground'
                    : 'glass-subtle border-border/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Sun size={14} />
                Light
              </button>
            </div>
          </div>

          {/* Background theme */}
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-2">Ambient background</p>
            <div className="grid grid-cols-5 gap-2">
              {BG_THEMES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setBgTheme(id)}
                  className={cn(
                    'flex flex-col gap-1.5 p-1 rounded-xl transition-all',
                    bgTheme === id
                      ? 'ring-1 ring-primary'
                      : 'ring-1 ring-transparent hover:ring-border/50'
                  )}
                >
                  {/* Swatch preview */}
                  <div
                    className="h-16 rounded-lg overflow-hidden border border-border/20 w-full"
                    style={{
                      background: `hsl(var(--background))`,
                      backgroundImage: BG_GRADIENTS[id] || undefined,
                    }}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground text-center w-full block">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Appearance */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-display font-semibold mb-4 tracking-tight">System</h3>

          {/* Color mode */}
          <div className="mb-5">
            <p className="text-xs text-muted-foreground font-mono mb-2">Color mode</p>
            <div className="flex gap-2">
              <button
                onClick={() => setColorMode('dark')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  colorMode === 'dark'
                    ? 'bg-foreground text-background border-foreground'
                    : 'glass-subtle border-border/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Moon size={14} />
                Dark
              </button>
              <button
                onClick={() => setColorMode('light')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  colorMode === 'light'
                    ? 'bg-foreground text-background border-foreground'
                    : 'glass-subtle border-border/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Sun size={14} />
                Light
              </button>
            </div>
          </div>

          {/* Background theme */}
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-2">Ambient background</p>
            <div className="grid grid-cols-5 gap-2">
              {BG_THEMES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setBgTheme(id)}
                  className={cn(
                    'flex flex-col gap-1.5 p-1 rounded-xl transition-all',
                    bgTheme === id
                      ? 'ring-1 ring-primary'
                      : 'ring-1 ring-transparent hover:ring-border/50'
                  )}
                >
                  {/* Swatch preview */}
                  <div
                    className="h-16 rounded-lg overflow-hidden border border-border/20"
                    style={{
                      background: `hsl(var(--background))`,
                      backgroundImage: BG_GRADIENTS[id] || undefined,
                    }}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground text-center w-full block">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

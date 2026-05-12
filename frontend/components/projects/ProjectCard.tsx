'use client';

import { formatDistanceToNow } from '@/utils/time';
import { cn } from '@/utils/cn';
import type { Project } from '@/stores/projects.store';

interface ProjectCardProps {
  project: Project;
  index: number;
  onClick: () => void;
}

export function ProjectCard({ project, index, onClick }: ProjectCardProps) {
  const statusColor =
    project.status === 'active'
      ? 'bg-emerald-500'
      : project.status === 'paused'
      ? 'bg-yellow-500/60'
      : 'bg-muted-foreground/40';

  return (
    <button
      onClick={onClick}
      className="glass glass-hover rounded-2xl p-5 text-left flex flex-col gap-3 animate-fade-up w-full"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
          <span className="font-semibold text-sm text-foreground truncate">{project.name}</span>
        </div>
        {project.surface_count > 0 && (
          <span className="glass-subtle rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary flex-shrink-0">
            {project.surface_count}
          </span>
        )}
      </div>

      {/* Goal */}
      {project.goal ? (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {project.goal}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic flex-1">No goal set</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <span className="text-[10px] text-muted-foreground/60">
          {formatDistanceToNow(project.last_active_at)}
        </span>
        <span className={cn(
          'text-[10px] font-medium uppercase tracking-wide',
          project.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground/50'
        )}>
          {project.status}
        </span>
      </div>
    </button>
  );
}

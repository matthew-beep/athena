'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, Pencil, Check, X } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useProjectsStore, type Project } from '@/stores/projects.store';
import { formatDistanceToNow } from '@/utils/time';
import { cn } from '@/utils/cn';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, updateProject } = useProjectsStore();
  const [project, setProject] = useState<Project | null>(
    projects.find((p) => p.project_id === id) ?? null
  );
  const [loading, setLoading] = useState(!project);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  useEffect(() => {
    if (project) return;
    apiClient
      .get<Project>(`/projects/${id}`)
      .then((p) => setProject(p))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, project, router]);

  const saveGoal = async () => {
    if (!project) return;
    const trimmed = goalDraft.trim();
    try {
      const updated = await apiClient.patch<Project>(`/projects/${id}`, { goal: trimmed || null });
      setProject(updated);
      updateProject(id, { goal: updated.goal });
    } catch {
      /* noop */
    }
    setEditingGoal(false);
  };

  const startEditGoal = () => {
    setGoalDraft(project?.goal ?? '');
    setEditingGoal(true);
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="glass rounded-2xl h-48 shimmer" />
      </div>
    );
  }

  if (!project) return null;

  const statusColor =
    project.status === 'active'
      ? 'text-emerald-500'
      : project.status === 'paused'
      ? 'text-yellow-500/60'
      : 'text-muted-foreground/50';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--raised-h)] transition-all flex-shrink-0"
          >
            <ArrowLeft size={15} />
          </button>
          <h1 className="text-base font-semibold text-foreground truncate">{project.name}</h1>
          <span className={cn('text-[10px] font-semibold uppercase tracking-wide flex-shrink-0', statusColor)}>
            {project.status}
          </span>
        </div>
        <button
          onClick={() => router.push(`/chat?project=${id}`)}
          className="btn-glow flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium flex-shrink-0"
        >
          <MessageSquare size={13} />
          Open chat
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-w-3xl">
        {/* Goal */}
        <section className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goal</span>
            {!editingGoal && (
              <button
                onClick={startEditGoal}
                className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>

          {editingGoal ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                rows={4}
                className="w-full bg-[var(--raised)] border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors resize-none"
                placeholder="What are you trying to accomplish?"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveGoal}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Check size={12} /> Save
                </button>
                <button
                  onClick={() => setEditingGoal(false)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-foreground/80 leading-relaxed cursor-text"
              onClick={startEditGoal}
            >
              {project.goal ?? (
                <span className="text-muted-foreground/40 italic">Click to add a goal</span>
              )}
            </p>
          )}
        </section>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
          <span>Created {formatDistanceToNow(project.created_at)}</span>
          <span>·</span>
          <span>Active {formatDistanceToNow(project.last_active_at)}</span>
          {project.surface_count > 0 && (
            <>
              <span>·</span>
              <span className="text-primary font-medium">{project.surface_count} unread surface{project.surface_count !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {/* Surfaces placeholder */}
        <section className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Surfaces</span>
          <div className="glass rounded-2xl p-6 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/50 text-center">
              No surfaces yet. Virgil will surface findings as research runs.
            </p>
          </div>
        </section>

        {/* Documents placeholder */}
        <section className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Documents</span>
          <div className="glass rounded-2xl p-6 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/50 text-center">
              No documents attached.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

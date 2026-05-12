'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useProjectsStore, type Project } from '@/stores/projects.store';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated?: (project: Project) => void;
}

export function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const addProject = useProjectsStore((s) => s.addProject);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await apiClient.post<Project>('/projects', {
        name: name.trim(),
        goal: goal.trim() || null,
      });
      addProject(project);
      onCreated?.(project);
      onClose();
    } catch {
      setError('Failed to create project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="glass-strong rounded-2xl w-full max-w-md p-6 animate-scale-in pointer-events-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">New project</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--raised-h)] transition-all"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Name
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI safety research"
                className="w-full bg-[var(--raised)] border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Goal <span className="normal-case font-normal tracking-normal text-muted-foreground/50">(optional)</span>
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What are you trying to accomplish?"
                rows={3}
                className="w-full bg-[var(--raised)] border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || submitting}
                className="btn-glow px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

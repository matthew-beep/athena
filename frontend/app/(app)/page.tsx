'use client';

import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/api/client';
import { useProjectsStore, type Project } from '@/stores/projects.store';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

export default function ProjectsDashboard() {
  const router = useRouter();
  const { projects, isLoading, setProjects, setLoading } = useProjectsStore();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get<{ projects: Project[]; total: number }>('/projects')
      .then((res) => setProjects(res.projects))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setProjects, setLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border/30 flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Projects</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-glow flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
        >
          <Plus size={14} />
          New project
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass rounded-2xl p-5 h-36 shimmer" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onNew={() => setModalOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <ProjectCard
                key={project.project_id}
                project={project}
                index={i}
                onClick={() => router.push(`/projects/${project.project_id}`)}
              />
            ))}
            {/* New project ghost card */}
            <button
              onClick={() => setModalOpen(true)}
              className="glass glass-hover rounded-2xl p-5 border-2 border-dashed border-border/30 flex flex-col items-center justify-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors animate-fade-up min-h-[140px]"
              style={{ animationDelay: `${projects.length * 0.05}s` }}
            >
              <Plus size={20} />
              <span className="text-xs font-medium">New project</span>
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <CreateProjectModal onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-24 text-center">
      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center">
        <Sparkles size={22} className="text-primary/70" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">Start your first project</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Describe a goal. Virgil will research it, track it, and surface what matters.
        </p>
      </div>
      <button
        onClick={onNew}
        className="btn-glow flex items-center gap-1.5 px-4 py-2 text-sm font-medium mt-2"
      >
        <Plus size={14} />
        New project
      </button>
    </div>
  );
}

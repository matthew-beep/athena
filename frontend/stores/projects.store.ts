'use client';

import { create } from 'zustand';

export interface Project {
  project_id: string;
  name: string;
  goal: string | null;
  status: string;
  constraints: string | null;
  created_at: string;
  last_active_at: string;
  surface_count: number;
}

interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectsStore = create<ProjectsState>()((set) => ({
  projects: [],
  isLoading: false,

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((s) => ({ projects: [project, ...s.projects] })),

  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.project_id === id ? { ...p, ...updates } : p
      ),
    })),

  removeProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.project_id !== id) })),

  setLoading: (isLoading) => set({ isLoading }),
}));

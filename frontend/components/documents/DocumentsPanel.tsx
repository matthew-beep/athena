'use client';

import { UploadZone } from './UploadZone';
import { DocumentList } from './DocumentList';
import { GlassCard } from '@/components/ui/GlassCard';

export function DocumentsPanel() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-up">
        <div>
          <h2 className="text-base font-display font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents to add them to Athena's knowledge base
          </p>
        </div>
        <UploadZone />
        <GlassCard className="p-4">
          <DocumentList />
        </GlassCard>
      </div>
    </div>
  );
}

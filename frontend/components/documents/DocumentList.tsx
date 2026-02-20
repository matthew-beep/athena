'use client';

import { FileText } from 'lucide-react';

export function DocumentList() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-10 h-10 rounded-sm bg-muted/30 border border-border flex items-center justify-center">
        <FileText size={18} className="text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">No documents yet</p>
      <p className="text-xs text-muted-foreground/50 font-mono">
        Upload a document above to get started
      </p>
    </div>
  );
}

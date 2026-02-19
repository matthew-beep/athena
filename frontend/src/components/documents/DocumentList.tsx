import { FileText } from "lucide-react";

export function DocumentList() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
        <FileText size={24} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        No documents yet
      </p>
      <p className="text-xs text-muted-foreground/60">
        Upload a document above to get started
      </p>
    </div>
  );
}

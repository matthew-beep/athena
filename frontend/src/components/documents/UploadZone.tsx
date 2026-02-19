import { useState, useRef, DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuthStore } from "../../stores/auth.store";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = useAuthStore.getState().token;
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        setMessage(`Uploaded: ${file.name} (processing not yet implemented)`);
      } else {
        setMessage("Upload failed");
      }
    } catch {
      setMessage("Upload error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "glass rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all",
        isDragging
          ? "border-primary/60 bg-primary/5"
          : "border-border/50 hover:border-primary/30 hover:bg-white/3"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload size={20} className="text-primary/60" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {uploading
              ? "Uploading..."
              : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, TXT, Markdown
          </p>
        </div>
        {message && (
          <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

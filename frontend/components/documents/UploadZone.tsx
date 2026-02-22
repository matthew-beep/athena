'use client';

import { useState, useRef, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth.store';

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // State for the "staged" files

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);    
    if (files.length > 0) setSelectedFiles((prev) => [...prev, ...files]);  
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = useAuthStore.getState().token;
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        setMessage(`Uploaded: ${file.name}`);
      } else {
        setMessage('Upload failed');
      }
    } catch {
      setMessage('Upload error');
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
        'glass rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all',
        isDragging
          ? 'border-foreground/30 bg-white/5'
          : 'border-border/40 hover:border-border/70 hover:bg-white/3'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          setSelectedFiles((prev) => [...prev, ...files]);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center">
          {uploading ? (
            <div className="w-4 h-4 border-2 border-foreground/40 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload size={16} className="text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            PDF · TXT · Markdown
          </p>
        </div>
        {message && (
          <p className="text-xs text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

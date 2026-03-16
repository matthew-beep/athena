'use client';

import { useState, useRef } from 'react';
import { FileIcon, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';

export type UploadStage = 1 | 2 | 3 | 4;

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
}

export function UploadModal({ open, onClose }: UploadModalProps) {
  const [stage, setStage] = useState<UploadStage>(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState<string>('');

  const handleClose = () => {
    setStage(1);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const deduplicated = files.filter((f) => !existing.has(`${f.name}:${f.size}`));
      return [...prev, ...deduplicated];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) addFiles(Array.from(files));
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleAddURL = () => {
    console.log('add URL');
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-3 w-full">
          <span>Upload</span>
          <div className="flex gap-1 flex-1" aria-label={`Step ${stage} of 4`}>
            {([1, 2, 3, 4] as const).map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-200',
                  s <= stage ? 'bg-[var(--blue)]' : 'bg-[var(--border)]'
                )}
              />
            ))}
          </div>
        </div>
      }
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--raised)] transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {stage > 1 && (
              <button
                type="button"
                onClick={() => setStage((prev) => (prev - 1) as UploadStage)}
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--raised)] transition-colors"
              >
                Back
              </button>
            )}
            {stage < 4 ? (
              <button
                type="button"
                onClick={() => setStage((prev) => (prev + 1) as UploadStage)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedFiles.length > 0 || url.length > 0 ? 'bg-[var(--blue)]' : 'bg-[var(--border)]'} text-white hover:opacity-90 transition-opacity`}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--blue)] text-white hover:opacity-90 transition-opacity"
              >
                View in Library
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="p-4">
        {/* Stage 1 — Drop */}
        {stage === 1 && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.md,.markdown,.txt,text/plain,text/markdown,application/pdf"
            />
            <button
              type="button"
              onClick={triggerFileInput}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                'w-full border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer flex',
                'border-[var(--border)] hover:border-[var(--blue-br)] bg-[var(--raised)]/30'
              )}
            >
              <div className="flex items-center justify-center w-10 h-10 border rounded-lg">
                <Upload className=" text-[var(--t3)]" />
              </div>
              <div className="flex flex-col gap-2 items-start">
                <p className="text-sm text-[var(--t1)]">Drop files here or click to browse</p>
                <div className="flex flex-wrap gap-2">
                  {['PDF', 'Markdown', 'TXT', 'Web'].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--t2)] bg-[var(--raised)]"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

            </button>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or paste a URL..."
                className= "w-full px-3 py-2 rounded-lg bg-[var(--raised)] border border-[var(--border)] text-sm text-[var(--t1)] placeholder:text-[var(--t3)] outline-none focus:border-[var(--blue-br)]"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddURL}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${url.length > 0 ? 'bg-[var(--blue)]' : 'bg-[var(--border)]'} text-white hover:opacity-90 transition-opacity`}
              >
                Add
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between py-2">
                  <span className="block text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    {selectedFiles.length} file(s) queued 
                  </span>
                  <button type="button" className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">Clear all</button>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedFiles.map((file) => (
                    <span key={file.name} className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--border)] text-[var(--t2)] bg-[var(--raised)]">
                      <FileIcon className="w-4 h-4 mr-1" />
                      {file.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 2 — Files */}
        {stage === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--t2)]">File list with type badge and remove. Collection picker. Auto-tag / Summary / Chunking toggles.</p>
            <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--raised)]/30 min-h-[120px]">
              <p className="text-xs text-[var(--t3)] font-mono">(No files staged — flow only)</p>
            </div>
          </div>
        )}

        {/* Stage 3 — Processing */}
        {stage === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--t2)]">Per-file progress bars. Parsing → Chunking → Embeddings.</p>
            <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--raised)]/30 min-h-[120px]">
              <p className="text-xs text-[var(--t3)] font-mono">(Processing placeholder)</p>
            </div>
          </div>
        )}

        {/* Stage 4 — Done */}
        {stage === 4 && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[var(--green-a)] border border-[var(--green-br)] flex items-center justify-center mx-auto text-[var(--green)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--t1)]">Upload complete</p>
            <p className="text-xs text-[var(--t3)] font-mono">Files listed with chunk counts</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
